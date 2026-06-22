"""Active-margin subduction style: Chilean vs Mariana (Uyeda-Kanamori).

Classifies the planet's convergent (subduction) margins by the deformation
style of the OVERRIDING plate, and maps interior back-arc extensional provinces:

  - Chilean-type margin   - compressional, high coastal orogen, no live back-arc
  - Mariana-type margin    - extensional, thin/low arc with a live back-arc basin
  - back-arc province       - strong back-arc extension in the interior, decoupled
                              (far) from any live margin: relict

Everything here is derived from this repo's own data - the super-plate boundaries
and subduction polarity from 20_boundaries, plus the per-cell orogPow / backArc /
elevation fields. It is an independent implementation (the source atlas's code was
not available), so absolute counts depend on the thresholds printed in the output.

Inputs : reports/tectonics/cache/{rasters.npz, blocks.npz}, boundary_segments.json,
         inventory.json
Outputs: reports/tectonics/subduction_style.json
         reports/tectonics/maps/present/present_subduction_style.png
         docs/SUBDUCTION_STYLE.md
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, mapstyle, raster

H, Wd = raster.H, raster.W
PX_KM = (180.0 / H) * 111.32  # nominal latitude pixel size in km (~19.6 km)

g = data_io.load_rasters()
inv = data_io.load_inventory()
with open(data_io.OUT_DIR / "boundary_segments.json") as f:
    segments = json.load(f)["segments"]

land = g["isLand"] == 1
ocean = ~land
unit = g["superPlate"].astype(np.int32)
orog = np.nan_to_num(g["orogPow"])
ba = np.nan_to_num(g["backArc"])


def hex2rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        grown = out.copy()
        for dr, dc in raster.NEIGHBORS:
            grown |= raster._shift(out, dr, dc)
        out = grown
    return out


# ---- 1. convergent boundary pixels + overriding side ------------------------
conv_pairs, overriding = set(), {}
for s in segments.values():
    if s.get("dominant") == "convergent" and "overriding" in s:
        pair = frozenset(s["plates"])
        conv_pairs.add(pair)
        overriding[pair] = s["overriding"]

bmask, other = raster.boundary_pixels(unit)
conv_boundary = np.zeros((H, Wd), bool)
ov_plate = np.zeros((H, Wd), bool)  # pixels sitting on an overriding plate at a subduction margin
for pair in conv_pairs:
    a, b = tuple(pair)
    on_pair = bmask & (((unit == a) & (other == b)) | ((unit == b) & (other == a)))
    conv_boundary |= on_pair
    ov_plate |= (unit == overriding[pair])

# ---- 2. active-margin coastal land on the overriding side -------------------
coastal_land = land & dilate(ocean, 2)          # land within ~40 km of ocean
trench_zone = dilate(conv_boundary, 6)          # ~120 km either side of the trench
active = coastal_land & trench_zone & ov_plate

# ---- 3. local compression vs extension at each active-margin pixel ----------
orog_s = np.nan_to_num(raster.neighborhood_mean(orog, radius=4))   # coastal orogen
ba_s = np.nan_to_num(raster.neighborhood_mean(ba, radius=6))       # back-arc (negative = basin)

ar, ac = np.nonzero(active)
if len(ar) == 0:
    raise SystemExit("no active-margin pixels found - check boundary polarity step")

o = orog_s[ar, ac]
e = -ba_s[ar, ac]                                # higher = stronger extension/basin
zo = (o - o.mean()) / (o.std() + 1e-9)
ze = (e - e.mean()) / (e.std() + 1e-9)
is_chilean = zo >= ze                            # compression dominates -> Chilean

chilean = np.zeros((H, Wd), bool)
mariana = np.zeros((H, Wd), bool)
chilean[ar[is_chilean], ac[is_chilean]] = True
mariana[ar[~is_chilean], ac[~is_chilean]] = True

# ---- 4. interior back-arc extensional provinces (relict) --------------------
ba_thr = np.nanpercentile(ba[land & (ba < 0)], 25)   # strong basins (matches inventory)
province_raw = land & (ba_s <= ba_thr)

# hop distance from every pixel to the nearest live active margin
INF = 10**6
dist = np.full((H, Wd), INF, np.int32)
dist[active] = 0
frontier = active.copy()
for hop in range(1, 161):
    nxt = np.zeros_like(frontier)
    for dr, dc in raster.NEIGHBORS:
        nxt |= raster._shift(frontier, dr, dc)
    nxt &= dist == INF
    if not nxt.any():
        break
    dist[nxt] = hop
    frontier = nxt

DECOUPLE_HOPS = 20                               # ~400 km from a live margin = decoupled
province = province_raw & (dist >= DECOUPLE_HOPS)
prov_hops = dist[province_raw]
prov_hops = prov_hops[prov_hops < INF]
median_decouple_km = float(np.median(prov_hops) * PX_KM) if len(prov_hops) else None

# ---- 5. per-continent style (named via continents.yaml) ---------------------
blocks = np.load(data_io.CACHE_DIR / "blocks.npz")
block_grid = blocks["block_grid"]
block_names = {int(k): v for k, v in inv["block_names"].items()}
letter2cont = {}                                  # craton letter -> {key, name}
for key, c in inv["continents"].items():
    for letter in c["cratons"]:
        letter2cont[letter] = {"key": key, "name": c.get("name", key)}

per_continent = {}
for mask, style in ((chilean, "chilean"), (mariana, "mariana")):
    rr, cc = np.nonzero(mask)
    for bid in block_grid[rr, cc]:
        letter = block_names.get(int(bid), "")
        cont = letter2cont.get(letter)
        if not cont:
            continue
        d = per_continent.setdefault(cont["name"], {"key": cont["key"], "chilean_px": 0, "mariana_px": 0})
        d[f"{style}_px"] += 1
for d in per_continent.values():
    tot = d["chilean_px"] + d["mariana_px"]
    d["dominant_style"] = "chilean" if d["chilean_px"] >= d["mariana_px"] else "mariana"
    d["chilean_fraction"] = round(d["chilean_px"] / tot, 3) if tot else None

# ---- 6. outputs -------------------------------------------------------------
nch, nma = int(chilean.sum()), int(mariana.sum())
prov_area = float(province.sum()) * (PX_KM ** 2)  # rough, latitude-naive
result = {
    "unit": "raster pixel (2048x1024 equirectangular)",
    "px_km_nominal": round(PX_KM, 1),
    "method": "Uyeda-Kanamori end-members from overriding-plate orogPow (compression) "
              "vs backArc (extension); back-arc provinces are strong-basin land >= "
              f"{DECOUPLE_HOPS} hops (~{round(DECOUPLE_HOPS * PX_KM)} km) from a live margin",
    "active_margin_px": nch + nma,
    "chilean_px": nch,
    "mariana_px": nma,
    "chilean_fraction": round(nch / (nch + nma), 3),
    "backarc_province_px": int(province.sum()),
    "backarc_province_Mkm2_approx": round(prov_area / 1e6, 2),
    "median_decoupling_km_approx": None if median_decouple_km is None else round(median_decouple_km),
    "backarc_threshold": round(float(ba_thr), 4),
    "per_continent": per_continent,
}
with open(data_io.OUT_DIR / "subduction_style.json", "w") as f:
    json.dump(result, f, indent=1)

# ---- 7. map ----------------------------------------------------------------
img = np.tile(hex2rgb("#0d1b2a"), (H, Wd, 1))
img[land] = hex2rgb("#2b3038")
img[province] = hex2rgb("#1f7a72")
fig, ax = mapstyle.new_map(
    "World Orogen - Active-Margin Subduction Style (Uyeda-Kanamori): Chilean vs Mariana")
ax.imshow(img, extent=[-180, 180, -90, 90], origin="upper", aspect="auto", zorder=0)
mapstyle.coastline_overlay(ax, land)


def scatter(mask, color, label):
    rr, cc = np.nonzero(mask)
    lat = 90.0 - (rr + 0.5) * 180.0 / H
    lon = (cc + 0.5) * 360.0 / Wd - 180.0
    ax.scatter(lon, lat, s=3, c=color, marker="o", linewidths=0, label=label, zorder=3)


scatter(chilean, "#e8743b", "Chilean-type (compressional, high coastal orogen)")
scatter(mariana, "#4f9bff", "Mariana-type (extensional, thin arc / back-arc)")
ax.scatter([], [], s=40, marker="s", c="#1f7a72", label="back-arc extensional province (relict)")
ax.legend(loc="lower left", fontsize=7, framealpha=0.85)
mapstyle.save(fig, data_io.MAPS_DIR / "present" / "present_subduction_style.png")

# ---- 8. doc ----------------------------------------------------------------
doc = ["# Subduction style", "",
       "Active continental margins of Orogen planet "
       f"`{data_io.load_meta()['planetCode']}`, classified into the two "
       "**Uyeda-Kanamori** end-members from the overriding plate's deformation, "
       "with interior back-arc extensional provinces marked separately.", "",
       "![Subduction style](../reports/tectonics/maps/present/present_subduction_style.png)", "",
       "| measure | value |", "|---|---:|",
       f"| Active-margin pixels | {nch + nma:,} |",
       f"| Chilean-type (compressional) | {nch:,} ({100 * nch / (nch + nma):.0f}%) |",
       f"| Mariana-type (extensional) | {nma:,} ({100 * nma / (nch + nma):.0f}%) |",
       f"| Back-arc provinces (relict) | {int(province.sum()):,} px "
       f"(~{round(prov_area / 1e6, 2)} Mkm²) |",
       f"| Median back-arc decoupling | ~{None if median_decouple_km is None else round(median_decouple_km)} km |",
       "", "## By continent", "",
       "| continent | dominant style | Chilean px | Mariana px |", "|---|---|---:|---:|"]
for name, d in sorted(per_continent.items(), key=lambda kv: -(kv[1]["chilean_px"] + kv[1]["mariana_px"])):
    doc.append(f"| {name} (`{d['key']}`) | {d['dominant_style']} | {d['chilean_px']:,} | {d['mariana_px']:,} |")
doc += ["",
        "*Method:* a coastal land pixel on a subduction overriding plate is Chilean "
        "where local `orogPow` (compression) outweighs `backArc` extension, Mariana "
        "otherwise; back-arc provinces are strong-basin land more than "
        f"~{round(DECOUPLE_HOPS * PX_KM)} km from any live margin. Derived from data by "
        "`tools/tectonics-pipeline/scripts/35_subduction_style.py`.", ""]
(data_io.REPO_ROOT / "docs" / "SUBDUCTION_STYLE.md").write_text("\n".join(doc) + "\n")

print(f"subduction style: Chilean {nch:,}, Mariana {nma:,}, "
      f"back-arc province {int(province.sum()):,} px, "
      f"median decoupling ~{None if median_decouple_km is None else round(median_decouple_km)} km")
