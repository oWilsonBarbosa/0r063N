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
from lib import data_io, mapstyle, raster

H, Wd = raster.H, raster.W
MIN_CELLS = 2000
CELL_KM2 = (4 * np.pi * 6371.0 ** 2) / data_io.EXPECTED_ROWS

# Table-18 terrain classes, order identical to classify.mjs TERRAIN_CLASSES.
TERRAIN = ["Barren", "Desert sandy", "Desert rocky", "Scrub/brush", "Grass/savanna",
           "Prairie", "Steppe", "Forest light", "Forest medium", "Forest heavy",
           "Jungle medium", "Jungle heavy", "Marsh/swamp", "Moor", "Tundra", "Glacier"]
# macro-habitat for each terrain index, and the macro display order/colours.
MACRO_OF = {0: "Tundra/Alpine", 14: "Tundra/Alpine", 15: "Glacier",
            1: "Desert", 2: "Desert", 3: "Grass/Scrub", 4: "Grass/Scrub",
            5: "Grass/Scrub", 6: "Grass/Scrub", 7: "Forest", 8: "Forest", 9: "Forest",
            10: "Jungle", 11: "Jungle", 12: "Wetland", 13: "Wetland"}
MACRO_COLOR = {"Jungle": "#0a5a23", "Forest": "#2e8b57", "Grass/Scrub": "#bdb76b",
               "Desert": "#e8d27a", "Wetland": "#5f8c78", "Tundra/Alpine": "#b6b6a6",
               "Glacier": "#eef2f8"}


def temp_c(t):
    return -45.0 + np.clip(t, 0, 1) * 90.0


def classify_terrain(k, elev, pann, coastal):
    """Vectorised port of classify.mjs classifyTerrain (priority-ordered)."""
    terr = np.full(len(k), -1, np.int8)

    def setif(mask, val):
        terr[mask & (terr == -1)] = val

    setif(k == 30, 15)                                  # EF glacier
    setif(elev > 3.0, 0)                                # above treeline -> barren
    setif((k == 29) & (elev > 2.0), 0)                  # alpine ET -> barren
    setif(k == 29, 14)                                  # ET tundra
    setif((elev < 0.05) & coastal & (pann > 800) & (k >= 1) & (k <= 16), 12)  # marsh
    setif(k == 1, 11); setif(k == 2, 10)                # Af, Am
    setif((k == 3) & (pann >= 900), 7); setif(k == 3, 4)                       # Aw
    setif((k == 4) & (elev > 1.0), 2); setif(k == 4, 1)                        # BWh
    setif(k == 5, 2); setif(k == 6, 3); setif(k == 7, 6)                       # BWk BSh BSk
    setif(((k == 8) | (k == 14)) & (pann >= 1200), 9)
    setif((k == 8) | (k == 14), 8); setif(k == 9, 8)                           # Cfa/Cwa, Cfb
    setif((k == 10) & (pann >= 800), 13); setif(k == 10, 7)                    # Cfc
    setif((k == 11) | (k == 13), 3)                                            # Csa Csc
    setif((k == 12) & (pann >= 700), 7); setif(k == 12, 3)                     # Csb
    setif((k == 15) | (k == 16), 4)                                           # Cwb Cwc
    da = (k == 17) | (k == 21) | (k == 25)
    setif(da & (pann >= 600), 8); setif(da, 5)
    db = (k == 18) | (k == 22) | (k == 26)
    setif(db & (pann >= 500), 8); setif(db, 5)
    dsub = np.isin(k, [19, 20, 23, 24, 27, 28])
    setif(dsub & (pann < 350), 4); setif(dsub, 7)
    setif(terr == -1, 0)
    return terr


def miami_npp(k, tS, tW, pS, pW):
    T = (temp_c(tS) + temp_c(tW)) / 2.0
    P = (np.maximum(0, pS) + np.maximum(0, pW)) * 1000.0
    npp = np.minimum(3000.0 / (1.0 + np.exp(1.315 - 0.119 * T)),
                     3000.0 * (1.0 - np.exp(-0.000664 * P)))
    return np.where(k == 30, 0.0, npp)                  # ice-corrected (EF = 0)


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

# ---- continent of each land cell (connected landmass) -----------------------
inv = data_io.load_inventory()
land_ras = data_io.load_rasters()["isLand"] == 1
cont_labels, _ = raster.connected_components(land_ras)
label2name, label2cratons = {}, {}
for key, c in inv["continents"].items():
    clat, clon = c["centroid"]
    r, col = raster.pixel_indices(np.array([clat]), np.array([clon]))
    lab = int(cont_labels[r[0], col[0]])
    if lab == 0:                                        # centroid fell on an ocean pixel: take nearest land label
        rr, cc = np.nonzero(cont_labels > 0)
        j = np.argmin((rr - r[0]) ** 2 + (cc - col[0]) ** 2)
        lab = int(cont_labels[rr[j], cc[j]])
    label2name[lab] = c.get("name", key)
    label2cratons[c.get("name", key)] = "·".join(c["cratons"])
label2cratons["Islands"] = "—"

cr, cc = raster.pixel_indices(lat, lon)
cell_label = cont_labels[cr, cc]
continent = np.array([label2name.get(int(l), "Islands") for l in cell_label], dtype=object)

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
