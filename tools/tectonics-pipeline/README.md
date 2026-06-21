# Tectonics: a plate-tectonic history for the Orogen planet

This package reads the procedurally generated planet in `data/orogen_regions_full/`
(a single present-day snapshot: 2.56 M surface regions with plates, boundaries,
orogens, hotspots, margins) and **constructs a plate-tectonic history for it**
using Earth-like theory — one full supercontinent cycle, T-750 Myr to present,
in 50-Myr stages — following Worldbuilding Pasta's *Constructing a Plate
Tectonic History* and *Alternatives to Plate Tectonics*.

The deliverable is in three parts:

1. **Analysis** of the present-day planet → `reports/tectonics/INVENTORY.md`,
   `reports/tectonics/maps/present/*.png`
2. **The history** → `tools/tectonics-pipeline/history/history.yaml` (the single
   source of truth) and `reports/tectonics/maps/stages/*.png` (16 paleogeographic
   reconstructions)
3. **The write-up** → `docs/GEOLOGICAL_HISTORY.md`, machine-validated against
   the quantitative rules of thumb (`reports/tectonics/VALIDATION.md`)

## Run it

Run from the repository root (paths are resolved absolutely, so the working
directory does not matter):

```bash
pip install -r tools/tectonics-pipeline/requirements.txt   # numpy, pandas, matplotlib, pyyaml
python3 tools/tectonics-pipeline/scripts/00_env_check.py   # deps + data integrity
python3 tools/tectonics-pipeline/scripts/10_ingest.py      # parts -> reports/tectonics/cache/columns.npz
python3 tools/tectonics-pipeline/scripts/15_rasterize.py   # -> reports/tectonics/cache/rasters.npz (2048x1024 fields)
python3 tools/tectonics-pipeline/scripts/20_boundaries.py  # classify boundaries -> reports/tectonics/boundary_segments.json
python3 tools/tectonics-pipeline/scripts/25_inventory.py   # plates/cratons/continents/features -> reports/tectonics/inventory.json
python3 tools/tectonics-pipeline/scripts/30_render_present.py # -> reports/tectonics/maps/present/*.png
python3 tools/tectonics-pipeline/scripts/35_subduction_style.py # -> subduction_style.json + map + docs/SUBDUCTION_STYLE.md
python3 tools/tectonics-pipeline/scripts/50_render_stages.py  # -> reports/tectonics/maps/stages/*.png
python3 tools/tectonics-pipeline/scripts/60_validate.py    # -> reports/tectonics/VALIDATION.md (exit 0 = valid)
python3 tools/tectonics-pipeline/scripts/70_build_doc.py   # -> docs/GEOLOGICAL_HISTORY.md
python3 tools/tectonics-pipeline/scripts/80_paleoclimate.py   # per-stage climate + T-0 calibration (exit 0 = valid)
python3 tools/tectonics-pipeline/scripts/85_render_climate.py # -> reports/tectonics/maps/climate/*.png (Koppen stages + curve)
python3 tools/tectonics-pipeline/scripts/90_build_climate_doc.py # -> docs/PALEOCLIMATE.md
python3 tools/tectonics-pipeline/scripts/95_continent_profiles.py # -> continent_profiles.json + docs/CONTINENTS.md
```

`continents.yaml` is the authored continent-naming map (craton group -> name,
e.g. `AIJ: Meridia`); `25_inventory.py`, `35_subduction_style.py` and
`95_continent_profiles.py` read it so the names flow into every output.

`scripts/40_init_history.py` regenerates a blank `history.yaml` skeleton from the
inventory; it refuses to overwrite the authored file.

`reports/tectonics/cache/` is gitignored (derived); the reports, maps, history,
and documents are committed.

## Layout

| path | what |
|---|---|
| `tools/tectonics-pipeline/lib/data_io.py` | streaming loader for the 13 csv.gz parts + npz cache |
| `tools/tectonics-pipeline/lib/raster.py` | equirectangular binning, gap fill, boundary/component ops |
| `tools/tectonics-pipeline/lib/spherical.py` | lat/lon↔xyz, Rodrigues rotations, great-circle distance |
| `tools/tectonics-pipeline/lib/history_schema.py` | history.yaml schema, keyframe interpolation, block rotations |
| `tools/tectonics-pipeline/lib/mapstyle.py` | shared map styling |
| `tools/tectonics-pipeline/lib/climate.py` | zonal climate model (temp/precip/Köppen), generator-calibrated |
| `tools/tectonics-pipeline/lib/paleoclimate_schema.py` | forcing-curve schema + validation |
| `tools/tectonics-pipeline/history/history.yaml` | **the authored timeline** — edit this to revise the history |
| `tools/tectonics-pipeline/history/paleoclimate.yaml` | **the authored climate forcing curve** (dT per stage, eras) |
| `tools/tectonics-pipeline/continents.yaml` | **authored continent names** (craton group -> name) |
| `reports/tectonics/subduction_style.json` | Chilean/Mariana margin + back-arc-province classification |
| `reports/tectonics/continent_profiles.json` | per-continent area, Köppen bands, mean NPP |
| `reports/tectonics/maps/present/present_subduction_style.png` | subduction-style map |
| `reports/tectonics/INVENTORY.md` | present-day tectonic inventory (human-readable) |
| `reports/tectonics/VALIDATION.md` | validation report against the rules of thumb |
| `reports/tectonics/climate_summary.json` | climate calibration + per-stage stats |
| `reports/tectonics/maps/present/` | 5 present-day tectonic maps |
| `reports/tectonics/maps/stages/` | 16 paleogeographic stage maps |
| `reports/tectonics/maps/climate/` | 16 paleo-Köppen maps + climate curve + calibration figure |

## How the history is encoded

Each craton (`A`-`J`) and microcontinent moves by **keyframed paleo-centroids +
spin**; `lib/history_schema.py` turns these into rigid spherical rotations.
Microcontinents may instead be **attached** to a parent block (`rides:`/`home:`)
as accreted terranes. Stage maps are rendered by rotating the present-day land
cells, grouped by block, back to each stage — so `stage_T000` reproduces the
present geography (land-mask IoU ≈ 0.84). Every present-day feature is tied to a
formative event in the `provenance` section, and `60_validate.py` enforces the
quantitative constraints (plate speeds, ocean-crust lifetime, cycle timing,
orogen height-vs-age erosion model, feature-provenance coverage, no undeclared
block overlaps, craton conservation, hotspot/LIP timing).

**Caveat.** The generator does not export plate Euler poles, so motion
*directions* are inferred heuristically; the absolute paleo-longitudes are one
self-consistent solution among several that fit the present map. The relative
sequence of rift→drift→collision and the feature provenance are data-constrained.

## Paleoclimate

A simplified climate model (`lib/climate.py`, constants transcribed from the
generator's own climate code) runs on every stage's paleogeography under the
authored forcing curve `history/paleoclimate.yaml` (LIPs warm, orogenic
weathering cools; dT must be 0 at present). Beyond the zonal core it computes,
from each stage's land mask alone: a land-following per-longitude ITCZ,
parameterized gyre ocean currents (warm western-boundary / cold
eastern-boundary, ±16 °C, diffused into coasts), and downwind moisture
advection with ITCZ convective recycling. Ice ages are emergent from forcing
× polar land position. Calibrated at T-0 against the generator's real Köppen
output: every major class within 9 pp (B, D, E within ~3 pp); deviations
documented in `docs/PALEOCLIMATE.md`. Orogen belts carry age-scaled
elevations into the past using the same erosion model the tectonic validator
enforces.
