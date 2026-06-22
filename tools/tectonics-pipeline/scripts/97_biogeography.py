"""Biogeography: native habitat provinces of the four continents.

Classifies every land cell into a Table-18 terrain class (a Python port of the
repo's tools/regional-report/classify.mjs, kept in sync with it), groups the 16
classes into 7 macro-habitats, assigns each cell to one of the four major
continents (or an Islands bucket) by connected landmass, and rolls up provinces
(continent x habitat, >= MIN_CELLS cells) with area, latitude span, mean
elevation, temperature, precipitation and ice-corrected Miami NPP.

Honesty tags (after the source audit): continent SHAPES are MEASURED, but their
craton composition is INTERPRETED (from the reconstructed geological history);
the Koppen->terrain mapping is INTERPRETED; the continent names are INVENTED
(authored in continents.yaml).

Inputs : the 13 csv.gz parts, reports/tectonics/cache/{rasters.npz, blocks.npz},
         inventory.json
Outputs: reports/tectonics/biogeography_provinces.csv
         reports/tectonics/maps/present/present_biogeography.png
         docs/BIOGEOGRAPHY.md
"""
import csv
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import continents, data_io, mapstyle, raster
from lib.biogeo import (MACRO_COLOR, MACRO_OF, TERRAIN, classify_terrain,
                        miami_npp, temp_c)

H, Wd = raster.H, raster.W
MIN_CELLS = 2000
CELL_KM2 = (4 * np.pi * 6371.0 ** 2) / data_io.EXPECTED_ROWS


# ---- load land-cell fields --------------------------------------------------
cols = data_io.load_columns(["lat", "lon", "koppen", "elev_km", "tS", "tW",
                             "pS", "pW", "isCoastal", "isLand"])
island = cols["isLand"] == 1
lat = cols["lat"][island]            # degrees
lon = cols["lon"][island]
k = cols["koppen"][island].astype(int)
elev = cols["elev_km"][island]
pann = (np.maximum(0, cols["pS"][island]) + np.maximum(0, cols["pW"][island])) * 1000.0
coastal = cols["isCoastal"][island] == 1

terr = classify_terrain(k, elev, pann, coastal)
macro = np.array([MACRO_OF[t] for t in terr], dtype=object)
npp = miami_npp(k, cols["tS"][island], cols["tW"][island], cols["pS"][island], cols["pW"][island])
tmean = (temp_c(cols["tS"][island]) + temp_c(cols["tW"][island])) / 2.0

# ---- continent of each land cell (shared connected-landmass assignment) ------
land_ras = data_io.load_rasters()["isLand"] == 1
continent, label2cratons = continents.assign(lat, lon)

# ---- province roll-up -------------------------------------------------------
total_land = int(island.sum())
rows = []
for cont in sorted(set(continent)):
    cm = continent == cont
    for mh in sorted(set(macro[cm])):
        m = cm & (macro == mh)
        n = int(m.sum())
        if n < MIN_CELLS:
            continue
        tcounts = np.bincount(terr[m], minlength=16)
        rows.append({
            "continent": cont, "cratons": label2cratons.get(cont, "—"),
            "habitat": mh, "dom_terrain": TERRAIN[int(tcounts.argmax())],
            "cells": n, "pct_land": round(100.0 * n / total_land, 2),
            "lat_min": round(float(lat[m].min()), 1), "lat_max": round(float(lat[m].max()), 1),
            "elev_mean": round(float(elev[m].mean()), 2),
            "T_mean": round(float(tmean[m].mean()), 1),
            "P_mean": round(float(pann[m].mean()), 0),
            "NPP": round(float(npp[m].mean()), 0),
        })
rows.sort(key=lambda r: (r["continent"], -r["cells"]))

fields = ["continent", "cratons", "habitat", "dom_terrain", "cells", "pct_land",
          "lat_min", "lat_max", "elev_mean", "T_mean", "P_mean", "NPP"]
with open(data_io.OUT_DIR / "biogeography_provinces.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

# ---- habitat map ------------------------------------------------------------
macro_id = {mh: i for i, mh in enumerate(MACRO_COLOR)}
mh_per_cell = np.array([macro_id[m] for m in macro], dtype=np.int32)
mh_ras = raster.rasterize_mode(lat, lon, mh_per_cell)          # -1 on ocean / empty
img = np.tile(mapstyle.hex2rgb("#c8dcea") if hasattr(mapstyle, "hex2rgb")
              else np.array([0.78, 0.86, 0.92]), (H, Wd, 1))
lut = np.array([[int(MACRO_COLOR[m][i:i + 2], 16) / 255 for i in (1, 3, 5)] for m in MACRO_COLOR])
land_px = mh_ras >= 0
img[land_px] = lut[mh_ras[land_px]]
fig, ax = mapstyle.new_map("World Orogen - Biogeographic habitats (native Table-18 terrain)")
ax.imshow(img, extent=[-180, 180, -90, 90], origin="upper", aspect="auto", zorder=0)
mapstyle.coastline_overlay(ax, land_ras)
import matplotlib.patches as mpatches
ax.legend(handles=[mpatches.Patch(color=MACRO_COLOR[m], label=m) for m in MACRO_COLOR],
          loc="lower left", fontsize=7, framealpha=0.9, ncol=2)
mapstyle.save(fig, data_io.MAPS_DIR / "present" / "present_biogeography.png")

# ---- docs/BIOGEOGRAPHY.md ---------------------------------------------------
doc = ["# Biogeography", "",
       "Habitat provinces of Orogen planet "
       f"`{data_io.load_meta()['planetCode']}`. Every land cell is classified into a "
       "Table-18 terrain class (a port of `tools/regional-report/classify.mjs`), grouped "
       "into seven macro-habitats, and assigned to the connected landmass it belongs to. "
       "NPP is the ice-corrected Miami model (Köppen-EF ice caps = 0).", "",
       "Tags: continent **shapes** `MEASURED`; craton composition `INTERPRETED` "
       "(reconstructed history); Köppen→terrain `INTERPRETED`; continent **names** "
       "`INVENTED` (`continents.yaml`).", "",
       "![Biogeographic habitats](../reports/tectonics/maps/present/present_biogeography.png)", "",
       "## Provinces (continent × habitat, ≥ 2,000 cells)", "",
       "| continent | cratons | habitat | dom. terrain | % land | lat span | elev | T °C | P mm | NPP |",
       "|---|---|---|---|---:|---|---:|---:|---:|---:|"]
for r in sorted(rows, key=lambda r: -r["pct_land"]):
    doc.append(f"| {r['continent']} | {r['cratons']} | {r['habitat']} | {r['dom_terrain']} | "
               f"{r['pct_land']} | {r['lat_min']:.0f}→{r['lat_max']:.0f} | {r['elev_mean']} | "
               f"{r['T_mean']} | {r['P_mean']:.0f} | {r['NPP']:.0f} |")
doc += ["", "Glacier provinces read **NPP 0** (ice caps carry no standing vegetation); "
        "tundra keeps its real low productivity. EF ice caps occur at high *elevation* as "
        "well as high latitude, so a glacier province can reach low latitudes. Generated by "
        "`tools/tectonics-pipeline/scripts/97_biogeography.py`.", ""]
(data_io.REPO_ROOT / "docs" / "BIOGEOGRAPHY.md").write_text("\n".join(doc) + "\n")

print(f"biogeography: {len(rows)} provinces over {total_land:,} land cells")
for cont in sorted(set(continent)):
    n = int((continent == cont).sum())
    print(f"  {cont:14} {n:>8,} cells ({100 * n / total_land:.1f}%)")
