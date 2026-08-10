# Physical Atlas of Planet `06cy8w6z6a89kow6psje93`

A natural-physical atlas derived from the [World Orogen](https://www.orogen.studio/#06cy8w6z6a89kow6psje93) full export (seed 10673275, 2,560,001 cells, 20.89 % land). Everything below is computed from the simulation data; hydrology (rivers, lakes, basins) and NPP are derived by this tool — see the method notes at the end.

## I. Relief & Hypsometry

![Plate 1 — Shaded relief](plate-01-relief.png)

![Plate 2 — Hypsometric curve](plate-02-hypsometry.png)

![Plate 3 — Cross-sections](plate-03-cross-sections.png)

![Plate 4 — Erosion](plate-04-erosion.png)

## II. Tectonics

![Plate 5 — Tectonic plates](plate-05-tectonic-plates.png)

![Plate 6 — Tectonic activity](plate-06-tectonic-activity.png)

## III. Climate

![Plate 7 — Köppen](plate-07-koppen.png)

![Plate 8 — Temperature](plate-08-temperature.png)

![Plate 9 — Precipitation](plate-09-precipitation.png)

![Plate 10 — Pressure and winds](plate-10-pressure-winds.png)

![Plate 11 — Ocean currents](plate-11-ocean-currents.png)

## IV. Hydrography

![Plate 12 — Drainage basins](plate-12-drainage-basins.png)

## V. Ecology

![Plate 13 — NPP](plate-13-npp.png)

## VI. Planetary Records

| Record | Value | Where |
|---|---|---|
| Highest peak | 7.66 km | 28.6°N 130.4°W (Region 06) |
| Deepest trench | -9.28 km | 26.4°N 96.2°E (Region 09) |
| Hottest place (seasonal mean) | 38.1 °C | 37.6°S 51.8°E (Region 19) |
| Coldest place (seasonal mean) | -45.0 °C | 58.8°N 39.3°E (Region 04) |
| Wettest place | 2,000 mm/yr | 7.1°S 18.9°E (Region 14) |
| Driest place | 96 mm/yr | 39.9°S 59.5°E (Region 19) |
| Continents (≥ 3 M km²) | 4 | 28M km², 27M km², 27M km², 20M km² |
| Largest island | 372,877 km² | 1.5°N 114.3°W |
| Greatest river (discharge) | 2,031 km³/yr | mouth 53.6°N 68.2°E |
| Longest river (main stem) | 7,904 km | mouth 16.6°S 152.7°W |
| Largest lake (endorheic) | 206,469 km² | 17.3°N 101.8°W |
| Major rivers planet-wide | 177 | ≥ 15 km³/yr at the mouth |
| Lakes ≥ 2,000 km² | 61 | closed-basin (endorheic); see HYDROLOGY_VALIDATION.md |

### The ten great rivers

| # | Discharge | Main stem | Mouth | Empties into |
|---|---|---|---|---|
| 1 | 2,031 km³/yr | 4,347 km | 53.6°N 68.2°E | sea |
| 2 | 1,437 km³/yr | 7,904 km | 16.6°S 152.7°W | sea |
| 3 | 1,397 km³/yr | 2,801 km | 67.4°N 132.8°E | sea |
| 4 | 1,291 km³/yr | 3,243 km | 11.7°S 40.8°E | sea |
| 5 | 1,235 km³/yr | 2,880 km | 56.9°N 131.4°W | sea |
| 6 | 831 km³/yr | 2,578 km | 12.4°N 153.2°W | sea |
| 7 | 703 km³/yr | 2,481 km | 69.9°N 51.7°E | sea |
| 8 | 619 km³/yr | 2,037 km | 52.9°N 119.8°E | sea |
| 9 | 594 km³/yr | 1,980 km | 5.7°S 85.4°W | sea |
| 10 | 454 km³/yr | 2,824 km | 5.3°S 135.7°W | sea |

### The ten great lakes (closed-basin / endorheic)

| # | Area | Surface | Max. depth | Where |
|---|---|---|---|---|
| 1 | 206,469 km² | 267 m | 218 m | 17.3°N 101.8°W |
| 2 | 91,027 km² | 220 m | 106 m | 45.1°N 113.0°W |
| 3 | 37,822 km² | 43 m | 31 m | 26.6°S 43.7°E |
| 4 | 35,208 km² | 361 m | 179 m | 34.1°N 132.4°W |
| 5 | 32,862 km² | 45 m | 28 m | 29.2°S 46.0°E |
| 6 | 27,367 km² | 174 m | 92 m | 18.4°S 20.6°E |
| 7 | 19,448 km² | 292 m | 38 m | 24.2°N 99.4°W |
| 8 | 18,783 km² | 26 m | 9 m | 29.5°S 53.8°E |
| 9 | 16,297 km² | 88 m | 20 m | 21.9°S 39.4°E |
| 10 | 14,030 km² | 355 m | 61 m | 30.1°N 115.6°W |

## Method notes

- Rasterized at 0.125° from the 2.56 M-cell Fibonacci-sphere export; all areas are cos-latitude weighted.
- **Relief, erosion, tectonics, Köppen, temperature, precipitation, pressure, winds, currents** come directly from exported per-cell fields (`elev`, `eroD`, `plate`, `stress`, `foldRidge`, `backArc`, `hotspot`, `koppen`, `tS/tW`, `pS/pW`, `prS/prW` [pressure], `wind*`, `oc*`). Built from the corrected v2 export (`data/orogen_regions_full_v2/`).
- **Physical height in km** uses the repository's canonical Earth-fitted power mapping of `elev` (`4.574·elev^1.462`; land peaks ~7.7 km, Earth-plausible distribution). The stored `elev_km` column is the legacy linear mapping and is not used here. The generator's exported climate (temperature, Köppen, precipitation, winds) was computed on the generator's own internal profile and is preserved as published.
- `pS/pW`, `wsS/wsW`, and `ocSpeed*` are p95-normalized and capped at 1, so values at the cap are floors (≥ p95), not exact maxima; precipitation-mm figures in the wettest areas are lower bounds.
- **Hydrology** is derived: priority-flood depression filling, steepest-descent routing, Ol'dekop runoff, per-depression water balance. Only closed-basin (endorheic) lakes are reported; exorheic filled-depression lakes are suppressed as a coarse-DEM artifact — see [HYDROLOGY_VALIDATION.md](../HYDROLOGY_VALIDATION.md).
- **NPP** uses the Miami model: `min(3000/(1+e^(1.315−0.119T)), 3000(1−e^(−0.000664P)))` g/m²/yr, ice-corrected (Köppen-EF ice caps set to 0).
- Plate-boundary types on Plate 5 are heuristic: ridge field → divergent, high collision stress → convergent, otherwise transform.
- Seasons follow the northern-hemisphere convention (June vs December half-years).

Regenerate with: `node tools/regional-report/atlas-main.mjs`
