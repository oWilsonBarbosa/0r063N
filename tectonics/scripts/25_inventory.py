"""Build the tectonic inventory: super-plate stats + inferred motions, cratons A-J,
continents (craton combos), microcontinents, terrane/block raster, and feature lists
(orogens, trenches, back-arcs, hotspots, ridges).

Outputs:
  out/inventory.json, out/INVENTORY.md
  out/cache/blocks.npz  - block label raster + per-land-cell block ids
"""

import json
import string
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, raster
from lib.spherical import xyz_to_latlon

H, Wd = raster.H, raster.W

g = data_io.load_rasters()
with open(data_io.OUT_DIR / "boundary_segments.json") as f:
    seg_data = json.load(f)
segments = seg_data["segments"]

unit = g["superPlate"]
land = g["isLand"] == 1
area_w = raster.pixel_area_weights()[:, None] * np.ones((H, Wd))
SPHERE_AREA_KM2 = 4 * np.pi * 6371.0**2
px_area = SPHERE_AREA_KM2 / (H * Wd) * area_w


def spherical_centroid(mask):
    rows, cols = np.nonzero(mask)
    lat = np.radians(90.0 - (rows + 0.5) * 180.0 / H)
    lon = np.radians((cols + 0.5) * 360.0 / Wd - 180.0)
    w = area_w[rows, cols]
    v = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], axis=1)
    m = (v * w[:, None]).sum(axis=0)
    return xyz_to_latlon(m / np.linalg.norm(m))


# ---------------- super-plate stats ----------------
plate_ids = sorted(int(p) for p in np.unique(unit))
plates = {}
for pid in plate_ids:
    m = unit == pid
    a = float(px_area[m].sum())
    landfrac = float(px_area[m & land].sum() / a)
    oc = float(np.mean(g["isOcPlate"][m] == 1))
    clat, clon = spherical_centroid(m)
    kind = "oceanic" if oc > 0.5 else ("continental" if landfrac > 0.25 else "mixed")
    plates[pid] = {
        "area_Mkm2": round(a / 1e6, 2),
        "land_fraction": round(landfrac, 3),
        "is_oceanic": oc > 0.5,
        "kind": kind,
        "centroid": [round(float(clat), 1), round(float(clon), 1)],
        "boundaries": {},
    }
for key, s in segments.items():
    a, b = s["plates"]
    for me, them in ((a, b), (b, a)):
        entry = {"with": them, "type": s["dominant"], "px": s["boundary_px"]}
        if "overriding" in s:
            entry["role"] = "overriding" if s["overriding"] == me else "subducting"
        plates[me]["boundaries"][key] = entry

# ---------------- inferred motion ----------------
# Slab-pull (weight 3) toward trenches where the plate subducts; ridge-push
# (weight 1) away from ridges. Tangent-plane vector sum at the plate centroid.
for pid, p in plates.items():
    clat, clon = np.radians(p["centroid"][0]), np.radians(p["centroid"][1])
    cvec = np.array([np.cos(clat) * np.sin(clon), np.sin(clat), np.cos(clat) * np.cos(clon)])
    east = np.array([np.cos(clon), 0, -np.sin(clon)])
    north = np.cross(cvec, east)
    vec = np.zeros(2)
    total_w = 0.0
    for key, b in p["boundaries"].items():
        s = segments[key]
        blat, blon = np.radians(s["mean_lat"]), np.radians(s["mean_lon"])
        bvec = np.array([np.cos(blat) * np.sin(blon), np.sin(blat), np.cos(blat) * np.cos(blon)])
        t = bvec - cvec * (bvec @ cvec)  # direction toward boundary, tangent at centroid
        n = np.linalg.norm(t)
        if n < 1e-9:
            continue
        t = t / n
        t2 = np.array([t @ east, t @ north])
        w = s["boundary_px"]
        if b["type"] == "convergent" and b.get("role") == "subducting":
            vec += 3.0 * w * t2
            total_w += 3.0 * w
        elif b["type"] == "divergent":
            vec += -1.0 * w * t2
            total_w += w
    coherence = float(np.linalg.norm(vec) / total_w) if total_w else 0.0
    azimuth = float(np.degrees(np.arctan2(vec[0], vec[1])) % 360) if total_w else None
    subducting = any(b.get("role") == "subducting" and b["type"] == "convergent"
                     for b in p["boundaries"].values())
    active = any(b["type"] == "convergent" for b in p["boundaries"].values())
    if p["is_oceanic"] and subducting:
        speed = "10-20 cm/yr (subducting oceanic)"
    elif subducting or (active and not p["is_oceanic"]):
        speed = "2-5 cm/yr (active-margin)"
    else:
        speed = "<1 cm/yr (passive)"
    p["motion"] = {"azimuth_deg": None if azimuth is None else round(azimuth, 0),
                   "speed_class": speed, "confidence": round(coherence, 2)}

# ---------------- cratons A-J ----------------
interior = g["interior"]
tec = g["tecAct"]
basin = g["basin"]
i_thr = np.nanpercentile(interior[land], 55)
t_thr = np.nanpercentile(tec[land], 45)
shield = land & (interior >= i_thr) & (tec <= t_thr) & (basin <= 0.5)
labels, n = raster.connected_components(shield)
sizes = np.bincount(labels.ravel(), weights=px_area.ravel(), minlength=n + 1)
order = np.argsort(sizes[1:])[::-1] + 1
keep = order[: min(10, len(order))]
craton_grid = np.zeros((H, Wd), dtype=np.int16)  # 0 = none, 1..10 = A..J
cratons = {}
for i, lab in enumerate(keep):
    letter = string.ascii_uppercase[i]
    m = labels == lab
    craton_grid[m] = i + 1
    clat, clon = spherical_centroid(m)
    cratons[letter] = {"area_Mkm2": round(float(sizes[lab]) / 1e6, 2),
                       "centroid": [round(float(clat), 1), round(float(clon), 1)],
                       "super_plate": int(np.bincount(unit[m].ravel()).argmax())}

# ---------------- continents & microcontinents ----------------
cont_labels, cn = raster.connected_components(land)
cont_sizes = np.bincount(cont_labels.ravel(), weights=px_area.ravel(), minlength=cn + 1)
continents = {}
microcontinents = {}
micro_idx = 0
landmass_name = np.zeros(cn + 1, dtype=object)
for lab in range(1, cn + 1):
    if cont_sizes[lab] < 5e4:  # < 50,000 km^2: minor island, rides with nearest block
        continue
    m = cont_labels == lab
    letters = sorted(string.ascii_uppercase[c - 1] for c in np.unique(craton_grid[m]) if c > 0)
    clat, clon = spherical_centroid(m)
    if letters:
        name = "".join(letters)
        continents[name] = {"area_Mkm2": round(float(cont_sizes[lab]) / 1e6, 2),
                            "cratons": letters,
                            "centroid": [round(float(clat), 1), round(float(clon), 1)],
                            "super_plates": [int(v) for v in np.unique(unit[m])]}
        landmass_name[lab] = name
    else:
        micro_idx += 1
        name = str(micro_idx)
        microcontinents[name] = {"area_Mkm2": round(float(cont_sizes[lab]) / 1e6, 2),
                                 "centroid": [round(float(clat), 1), round(float(clon), 1)],
                                 "super_plate": int(np.bincount(unit[m].ravel()).argmax())}
        landmass_name[lab] = name

# ---------------- block raster (terranes) ----------------
# Block = unit of motion for paleo maps: craton blocks (1..10) within continents,
# microcontinents (11..), everything else joins the nearest block by BFS.
block_grid = np.zeros((H, Wd), dtype=np.int16)
block_names = {}
for i, letter in enumerate(cratons):
    block_grid[craton_grid == i + 1] = i + 1
    block_names[i + 1] = letter
for j, name in enumerate(microcontinents):
    bid = 11 + j
    lab = [k for k in range(1, cn + 1) if landmass_name[k] == name]
    block_grid[np.isin(cont_labels, lab)] = bid
    block_names[bid] = f"micro_{name}"
# BFS fill: land pixels first claim within-continent proximity, then any land.
unl = land & (block_grid == 0)
for _ in range(600):
    if not unl.any():
        break
    grown = block_grid.copy()
    for dr, dc in raster.NEIGHBORS:
        nb = raster._shift(block_grid, dr, dc)
        take = unl & (grown == 0) & (nb > 0) & (cont_labels == raster._shift(cont_labels, dr, dc))
        grown[take] = nb[take]
    if (grown == block_grid).all():
        break
    block_grid = grown
    unl = land & (block_grid == 0)
# Remaining (small islands, separate components): nearest block through ocean,
# by growing a copy of the labels across ocean pixels until all land is covered.
spread = block_grid.copy()
while (land & (spread == 0)).any():
    grown = spread.copy()
    for dr, dc in raster.NEIGHBORS:
        nb = raster._shift(spread, dr, dc)
        take = (grown == 0) & (nb > 0)
        grown[take] = nb[take]
    if (grown == spread).all():
        break
    spread = grown
block_grid = np.where(land, np.where(block_grid > 0, block_grid, spread), 0).astype(np.int16)

# Per-land-cell block id (for stage-map point clouds).
cols_data = data_io.load_columns(["lat", "lon", "isLand"])
cell_land = cols_data["isLand"] == 1
rr, cc = raster.pixel_indices(cols_data["lat"][cell_land], cols_data["lon"][cell_land])
cell_block = block_grid[rr, cc]
# Land cells whose raster pixel was majority-voted ocean: use the nearest block.
miss = cell_block == 0
cell_block[miss] = spread[rr[miss], cc[miss]]
print(f"land cells without block: {(cell_block == 0).sum()} of {cell_land.sum()}")

# ---------------- features ----------------
def clusters(mask, min_km2=2e4, top=None):
    lab, k = raster.connected_components(mask)
    sz = np.bincount(lab.ravel(), weights=px_area.ravel(), minlength=k + 1)
    out = []
    for L in np.argsort(sz[1:])[::-1] + 1:
        if sz[L] < min_km2:
            break
        m = lab == L
        clat, clon = spherical_centroid(m)
        out.append({"area_Mkm2": round(float(sz[L]) / 1e6, 3),
                    "centroid": [round(float(clat), 1), round(float(clon), 1)], "_mask": m})
        if top and len(out) >= top:
            break
    return out


orog_thr = np.nanpercentile(g["orogPow"][land], 85)
orogens = clusters(land & (g["orogPow"] >= orog_thr), min_km2=1e5)
for o in orogens:
    m = o.pop("_mask")
    o["mean_elev_km"] = round(float(np.nanmean(g["elev_km"][m])), 2)
    o["max_elev_km"] = round(float(np.nanmax(g["elev_km"][m])), 2)
    o["blocks"] = sorted({block_names.get(int(b), "?") for b in np.unique(block_grid[m]) if b > 0})

trench_thr = np.nanpercentile(g["tectonic"][~land], 2)
trenches = clusters(~land & (g["tectonic"] <= trench_thr), min_km2=1e5, top=12)
for t in trenches:
    m = t.pop("_mask")
    t["min_elev_km"] = round(float(np.nanmin(g["elev_km"][m])), 2)

ba = g["backArc"]  # negative depressions; deepest quartile marks real basins
backarcs = clusters(ba <= np.nanpercentile(ba[ba < 0], 25), min_km2=2e5, top=10)
for b in backarcs:
    b.pop("_mask")

hs_thr = np.nanpercentile(g["hotspot"][g["hotspot"] > 0], 99)
hotspots = clusters(g["hotspot"] >= hs_thr, min_km2=0, top=15)
for h_ in hotspots:
    h_.pop("_mask")

ridges = [{"plates": s["plates"], "mean_lat": s["mean_lat"], "mean_lon": s["mean_lon"],
           "px": s["boundary_px"]}
          for s in segments.values() if s["dominant"] == "divergent" and s["boundary_px"] > 100]

# Ocean super-plate roman numerals by area.
ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
         "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"]
oceanic_sorted = sorted((p for p in plates if plates[p]["is_oceanic"]),
                        key=lambda p: -plates[p]["area_Mkm2"])
for i, pid in enumerate(oceanic_sorted):
    plates[pid]["name"] = ROMAN[i]
for pid in plates:
    if "name" not in plates[pid]:
        host = [n for n, c in continents.items() if pid in c["super_plates"]]
        plates[pid]["name"] = f"P{pid}" + (f"({'/'.join(host)})" if host else "")

inventory = {
    "unit": "superPlate",
    "plates": {str(k): v for k, v in plates.items()},
    "cratons": cratons,
    "continents": continents,
    "microcontinents": microcontinents,
    "block_names": {str(k): v for k, v in block_names.items()},
    "features": {"orogens": orogens, "trenches": trenches, "backarcs": backarcs,
                 "hotspots": hotspots, "ridges": ridges},
}
with open(data_io.OUT_DIR / "inventory.json", "w") as f:
    json.dump(inventory, f, indent=1)
np.savez_compressed(data_io.CACHE_DIR / "blocks.npz",
                    block_grid=block_grid, craton_grid=craton_grid,
                    cell_block=cell_block, cell_land_idx=np.flatnonzero(cell_land))

# ---------------- INVENTORY.md ----------------
lines = ["# Present-day tectonic inventory", "",
         "Mesh verified uniform-on-sphere; areas from cos-lat-weighted pixel counts.", "",
         "## Super-plates", "",
         "| id | name | kind | area Mkm2 | land % | motion az | speed class | conf |",
         "|---:|---|---|---:|---:|---:|---|---:|"]
for pid, p in sorted(plates.items(), key=lambda kv: -kv[1]["area_Mkm2"]):
    mo = p["motion"]
    lines.append(f"| {pid} | {p['name']} | {p['kind']} | {p['area_Mkm2']} | "
                 f"{100 * p['land_fraction']:.0f} | {mo['azimuth_deg']} | {mo['speed_class']} | "
                 f"{mo['confidence']} |")
lines += ["", "## Cratons", "", "| craton | area Mkm2 | centroid | super-plate |", "|---|---:|---|---:|"]
for c, v in cratons.items():
    lines.append(f"| {c} | {v['area_Mkm2']} | {v['centroid']} | {v['super_plate']} |")
lines += ["", "## Continents", "", "| name | cratons | area Mkm2 | centroid | super-plates |", "|---|---|---:|---|---|"]
for nm, v in continents.items():
    lines.append(f"| {nm} | {','.join(v['cratons'])} | {v['area_Mkm2']} | {v['centroid']} | {v['super_plates']} |")
lines += ["", "## Microcontinents", ""]
for nm, v in microcontinents.items():
    lines.append(f"- {nm}: {v['area_Mkm2']} Mkm2 at {v['centroid']} (super-plate {v['super_plate']})")
lines += ["", f"## Orogens (orogPow >= p85, {len(orogens)} belts)", ""]
for i, o in enumerate(orogens):
    lines.append(f"- O{i + 1}: {o['area_Mkm2']} Mkm2 at {o['centroid']}, mean {o['mean_elev_km']} km, "
                 f"max {o['max_elev_km']} km, blocks {o['blocks']}")
lines += ["", "## Trenches", ""]
for i, t in enumerate(trenches):
    lines.append(f"- T{i + 1}: {t['area_Mkm2']} Mkm2 at {t['centroid']}, min {t['min_elev_km']} km")
lines += ["", "## Back-arc basins", ""]
for i, b in enumerate(backarcs):
    lines.append(f"- B{i + 1}: {b['area_Mkm2']} Mkm2 at {b['centroid']}")
lines += ["", "## Hotspots (top 15)", ""]
for i, h_ in enumerate(hotspots):
    lines.append(f"- H{i + 1}: at {h_['centroid']}")
lines += ["", "## Boundary segments", "",
          "| pair | dominant | conv/div/trans frac | overriding |", "|---|---|---|---|"]
for key, s in sorted(segments.items(), key=lambda kv: -kv[1]["boundary_px"]):
    fr = s["fractions"]
    lines.append(f"| {key} | {s['dominant']} | {fr['convergent']:.2f}/{fr['divergent']:.2f}/"
                 f"{fr['transform']:.2f} | {s.get('overriding', '-')} |")
(data_io.OUT_DIR / "INVENTORY.md").write_text("\n".join(lines) + "\n")
print(f"plates {len(plates)}, cratons {len(cratons)}, continents {list(continents)}, "
      f"micros {len(microcontinents)}, orogens {len(orogens)}, trenches {len(trenches)}, "
      f"hotspots {len(hotspots)}")
