"""Extract plate boundaries from the rasters, classify them (divergent /
convergent / transform), and infer subduction polarity per plate pair.

Outputs:
  out/cache/boundaries.npz   - class raster + boundary masks
  out/boundary_segments.json - per super-plate pair: type fractions, polarity
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, raster

UNIT = "superPlate"  # primary tectonic unit (20 units, Earth-like count)

# class codes
INDET, CONV, DIV, TRANS = 0, 1, 2, 3
CLASS_NAMES = {CONV: "convergent", DIV: "divergent", TRANS: "transform", INDET: "indeterminate"}

g = data_io.load_rasters()
unit_grid = g[UNIT]
mask, other = raster.boundary_pixels(unit_grid)

margins_s = raster.neighborhood_mean(g["margins"], radius=2)
stress_s = raster.neighborhood_mean(g["stress"], radius=2)
tectonic_s = raster.neighborhood_mean(g["tectonic"], radius=2)
backarc_s = raster.neighborhood_mean(g["backArc"], radius=3)

cls = np.zeros(unit_grid.shape, dtype=np.int8)
b = mask
cls[b & (margins_s <= -0.25)] = TRANS
conv = b & (cls == 0) & (stress_s >= 0.35)
cls[conv] = CONV
div = b & (cls == 0) & (margins_s >= 0.85)
cls[div] = DIV
conv2 = b & (cls == 0) & (stress_s >= 0.15)
cls[conv2] = CONV

rows, cols_ = np.nonzero(mask)
pa = unit_grid[rows, cols_]
pb = other[rows, cols_]
lo, hi = np.minimum(pa, pb), np.maximum(pa, pb)
pair_key = lo.astype(np.int64) * 10000 + hi
pix_cls = cls[rows, cols_]

area_w = raster.pixel_area_weights()[rows]

segments = {}
for key in np.unique(pair_key):
    sel = pair_key == key
    a, bb = int(key // 10000), int(key % 10000)
    n = int(sel.sum())
    if n < 20:  # ignore raster-noise contacts
        continue
    w = area_w[sel]
    fracs = {CLASS_NAMES[c]: float(w[pix_cls[sel] == c].sum() / w.sum()) for c in (CONV, DIV, TRANS, INDET)}
    dominant = max((CONV, DIV, TRANS), key=lambda c: fracs[CLASS_NAMES[c]])
    if fracs[CLASS_NAMES[dominant]] == 0:
        dominant = INDET
    seg = {
        "plates": [a, bb],
        "boundary_px": n,
        "fractions": fracs,
        "dominant": CLASS_NAMES[dominant],
        "mean_lat": float(np.mean(90.0 - (rows[sel] + 0.5) * 180.0 / unit_grid.shape[0])),
        "mean_lon": float(np.mean((cols_[sel] + 0.5) * 360.0 / unit_grid.shape[1] - 180.0)),
    }
    # Subduction polarity for convergent pairs: the overriding side carries the
    # back-arc basin (generator seeds backArc on the overriding plate) and the
    # subducting side carries the trench (tectonic minimum).
    if fracs["convergent"] >= 0.25:
        band = np.zeros_like(mask)
        band[rows[sel], cols_[sel]] = True
        for _ in range(4):  # dilate the boundary into both plates
            grown = band.copy()
            for dr, dc in raster.NEIGHBORS:
                grown |= raster._shift(band, dr, dc)
            band = grown
        side_stats = {}
        for p in (a, bb):
            side = band & (unit_grid == p)
            if side.sum() == 0:
                side_stats[p] = (0.0, 0.0)
                continue
            side_stats[p] = (float(np.nanmean(backarc_s[side])), float(np.nanmin(tectonic_s[side])))
        ba_a, tr_a = side_stats[a]
        ba_b, tr_b = side_stats[bb]
        # backArc is a negative depression carried by the OVERRIDING plate;
        # the trench minimum (tectonic) is deepest on the SUBDUCTING side.
        score_a = (ba_b - ba_a) + 0.5 * (tr_a - tr_b)  # >0: a is overriding
        seg["overriding"] = a if score_a >= 0 else bb
        seg["subducting"] = bb if score_a >= 0 else a
        seg["polarity_confidence"] = float(abs(score_a))
    segments[f"{a}-{bb}"] = seg

data_io.OUT_DIR.mkdir(parents=True, exist_ok=True)
np.savez_compressed(data_io.CACHE_DIR / "boundaries.npz", cls=cls, mask=mask, other=other)
with open(data_io.OUT_DIR / "boundary_segments.json", "w") as f:
    json.dump({"unit": UNIT, "class_codes": {v: k for k, v in CLASS_NAMES.items()},
               "segments": segments}, f, indent=1)

counts = {CLASS_NAMES[c]: int((pix_cls == c).sum()) for c in (CONV, DIV, TRANS, INDET)}
print(f"boundary pixels: {mask.sum()}  classes: {counts}")
print(f"plate pairs kept: {len(segments)}")
dom = {}
for s in segments.values():
    dom[s["dominant"]] = dom.get(s["dominant"], 0) + 1
print(f"dominant types: {dom}")
