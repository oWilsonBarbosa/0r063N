"""Per-continent physical, climate and ecology profiles.

For each of the four major continents (named via continents.yaml) this rolls up,
from the per-cell export: land area, Köppen-band composition (A/B/C/D/E), mean
Miami-model NPP, mountainous fraction and mean elevation. It reproduces the
per-continent summaries in the World Orogen Atlas, computed from data.

Continent membership reuses the block raster from 25_inventory (out/cache/blocks.npz):
each land cell already carries the craton/microcontinent block it belongs to, and
each craton letter maps to exactly one continent.

Inputs : reports/tectonics/cache/blocks.npz, inventory.json, the 13 csv.gz parts
Outputs: reports/tectonics/continent_profiles.json, docs/CONTINENTS.md
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io

EXPECTED = data_io.EXPECTED_ROWS
CELL_KM2 = (4 * np.pi * 6371.0 ** 2) / EXPECTED   # uniform-on-sphere mesh: equal-area cells

# Köppen class id (1..30) -> band letter; 0 = ocean (excluded).  See docs/DATA_DICTIONARY.md
BANDS = {**{i: "A" for i in (1, 2, 3)}, **{i: "B" for i in (4, 5, 6, 7)},
         **{i: "C" for i in range(8, 17)}, **{i: "D" for i in range(17, 29)},
         **{i: "E" for i in (29, 30)}}


def temp_c(t):
    return -45.0 + np.clip(t, 0, 1) * 90.0


def miami_npp(koppen, tS, tW, pS, pW):
    """Miami model NPP (g/m²/yr), ice-corrected: Köppen-EF (code 30) ice caps = 0.
    Matches the canonical miamiNpp in tools/regional-report/classify.mjs."""
    T = (temp_c(tS) + temp_c(tW)) / 2.0
    P = (np.maximum(0, pS) + np.maximum(0, pW)) * 1000.0
    npp_t = 3000.0 / (1.0 + np.exp(1.315 - 0.119 * T))
    npp_p = 3000.0 * (1.0 - np.exp(-0.000664 * P))
    return np.where(koppen == 30, 0.0, np.minimum(npp_t, npp_p))


inv = data_io.load_inventory()
block_names = {int(k): v for k, v in inv["block_names"].items()}
letter2cont = {}
for key, c in inv["continents"].items():
    for letter in c["cratons"]:
        letter2cont[letter] = key
cont_meta = {key: {"key": key, "name": c.get("name", key),
                   "cratons": c["cratons"], "centroid": c["centroid"]}
             for key, c in inv["continents"].items()}

# per-land-cell block id (aligned to cell_land_idx) -> continent key per land cell
blocks = np.load(data_io.CACHE_DIR / "blocks.npz")
cell_block = blocks["cell_block"]
land_idx = blocks["cell_land_idx"]
cont_of_landcell = np.array(
    [letter2cont.get(block_names.get(int(b), ""), "") for b in cell_block], dtype=object)

cols = data_io.load_columns(["koppen", "tS", "tW", "pS", "pW", "isMountain", "elev_km"])
sel = {k: v[land_idx] for k, v in cols.items()}          # restrict to land cells
koppen = sel["koppen"].astype(int)
npp = miami_npp(koppen, sel["tS"], sel["tW"], sel["pS"], sel["pW"])
band_of = np.array([BANDS.get(int(k), "") for k in range(0, 31)], dtype=object)

profiles = {}
for key, meta in cont_meta.items():
    m = cont_of_landcell == key
    n = int(m.sum())
    if n == 0:
        continue
    kvals = koppen[m]
    bands = {b: 0.0 for b in "ABCDE"}
    for k in np.unique(kvals):
        b = BANDS.get(int(k))
        if b:
            bands[b] += int((kvals == k).sum())
    band_pct = {b: round(100.0 * bands[b] / n, 1) for b in "ABCDE"}
    profiles[meta["name"]] = {
        "key": key,
        "cratons": meta["cratons"],
        "centroid": meta["centroid"],
        "land_cells": n,
        "area_Mkm2": round(n * CELL_KM2 / 1e6, 2),
        "koppen_band_pct": band_pct,
        "mean_npp_g_m2_yr": round(float(npp[m].mean()), 0),
        "mountainous_pct": round(100.0 * float(sel["isMountain"][m].mean()), 1),
        "mean_elev_km": round(float(sel["elev_km"][m].mean()), 2),
    }

with open(data_io.OUT_DIR / "continent_profiles.json", "w") as f:
    json.dump({"cell_km2": round(CELL_KM2, 2), "continents": profiles}, f, indent=1)

# ---- docs/CONTINENTS.md ----
order = sorted(profiles.items(), key=lambda kv: -kv[1]["area_Mkm2"])
lines = ["# Continents", "",
         "The four major landmasses of Orogen planet "
         f"`{data_io.load_meta()['planetCode']}`, named in "
         "`tools/tectonics-pipeline/continents.yaml`. Physical and climate/ecology "
         "figures are rolled up per continent from the per-cell export "
         "(Köppen bands and Miami-model NPP as in `docs/DATA_DICTIONARY.md`).", "",
         "| continent | cratons | area (Mkm²) | A | B | C | D | E | mean NPP (g/m²/yr) | mountainous % | mean elev (km) |",
         "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
for name, p in order:
    b = p["koppen_band_pct"]
    lines.append(f"| **{name}** | {','.join(p['cratons'])} | {p['area_Mkm2']} | "
                 f"{b['A']} | {b['B']} | {b['C']} | {b['D']} | {b['E']} | "
                 f"{p['mean_npp_g_m2_yr']:.0f} | {p['mountainous_pct']} | {p['mean_elev_km']} |")
lines += ["", "Köppen bands: **A** tropical · **B** arid · **C** temperate · "
          "**D** continental · **E** polar (percent of each continent's land cells). "
          "Generated by `tools/tectonics-pipeline/scripts/95_continent_profiles.py`.", ""]
(data_io.REPO_ROOT / "docs" / "CONTINENTS.md").write_text("\n".join(lines) + "\n")

print("continent profiles:")
for name, p in order:
    b = p["koppen_band_pct"]
    print(f"  {name:8} {p['area_Mkm2']:>6} Mkm²  A{b['A']:.0f} B{b['B']:.0f} C{b['C']:.0f} "
          f"D{b['D']:.0f} E{b['E']:.0f}  NPP {p['mean_npp_g_m2_yr']:.0f}")
