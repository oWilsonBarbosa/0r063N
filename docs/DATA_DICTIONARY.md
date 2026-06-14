# Data dictionary — `orogen_regions_full`

Every row in the dataset is one surface cell of the planet (2,560,001 cells on a
Fibonacci sphere). There are **56 columns**. Values are taken straight from the
World Orogen full export; the unit-conversion formulas below come from
`data/orogen_regions_full/orogen_meta_full.json`.

Two naming gotchas, confirmed against the generator source and the analysis
pipelines:

- **`pS`/`pW` are precipitation**, not pressure (`precip_mm = pS × 1000` per half-year).
- **`prS`/`prW` are sea-level pressure**, despite the `p…` prefix.

"Summer"/"winter" (`…S`/`…W`) are **Northern-Hemisphere-centric** (per the
generator's `js/koppen.js`): the `…S` season is NH summer / SH winter.

## Conversion formulas (from the export metadata)

| Quantity | Formula |
|---|---|
| Physical elevation (km) | `elev_km = elev > 0 ? elev × 6 : elev × 10` (range −9.281 … +8.538 km) |
| Temperature (°C) | `temp_C = −45 + t × 90` (apply to `tS`/`tW`) |
| Precipitation (mm/half-year) | `precip_mm = p × 1000` (apply to `pS`/`pW`) |
| Latitude (degrees) | `asin(y) × 180/π` |
| Longitude (degrees) | `atan2(x, z) × 180/π` |

## Columns

### Identity & geometry
| Column | Meaning |
|---|---|
| `id` | Cell index, `0 … 2,560,000` (Fibonacci-sphere point order). |
| `lat`, `lon` | Geographic latitude / longitude, **radians**. For degrees use the formulas above. |
| `x`, `y`, `z` | Unit-sphere Cartesian coordinates of the cell (`y` is the polar axis: `lat = asin(y)`, `lon = atan2(x, z)`). |

### Elevation & erosion
| Column | Meaning |
|---|---|
| `elev` | Model elevation, dimensionless (~−1 … +1; below sea level when negative). |
| `elev_km` | Physical elevation in km (see formula). |
| `prePost` | Elevation **before** terrain post-processing/erosion — the pre/post baseline (pair with `eroD`). |
| `eroD` | Erosion delta (`erosionDelta`): net elevation change applied by erosion post-processing. |

### Tectonics
| Column | Meaning |
|---|---|
| `plate` | Plate ID (integer). |
| `isOcPlate` | `1` if the cell's plate is oceanic, else `0`. |
| `superPlate` | Super-plate group ID (the ~20-unit dual-layer super-plate system). |
| `plateSpeed` | Plate motion speed. |
| `isLand` | `1` land, `0` ocean. |
| `isCoastal` | `1` if a coastal cell. |
| `isMountain` | `1` if a mountain cell. |
| `stress` | Tectonic stress magnitude at the cell. |
| `orogPow` | Orogenic power (`orogenicPower`). |
| `tecAct` | Tectonic activity (`tecActivity`). |

### Elevation-component debug layers
Each is a separable contribution the generator combines into the final elevation field.
| Column | Meaning |
|---|---|
| `base` | Base elevation field. |
| `tectonic` | Tectonic uplift contribution. |
| `noise` | Noise / domain-warp contribution. |
| `interior` | Continental-interior distance-field component. |
| `coastal_l` | Coastal distance-field component. |
| `ocean_l` | Ocean distance-field component. |
| `hotspot` | Hotspot volcanism field. |
| `margins` | Continental-margin field. |
| `backArc` | Back-arc basin field. |
| `foldRidge` | Fold-and-thrust ridge field. |
| `basin` | Foreland / drainage basin field. |

### Climate classification
| Column | Meaning |
|---|---|
| `koppen` | Köppen class ID, `0 … 30` (`0` = Ocean; see legend below). |
| `contality` | Continentality — distance-from-ocean climate index. |
| `tempContality` | Thermal continentality — annual temperature-range index. |

### Seasonal climate (`…S` = summer, `…W` = winter)
| Column | Meaning |
|---|---|
| `tS`, `tW` | Normalized temperature, 0–1 (°C via `−45 + t×90`). |
| `pS`, `pW` | Normalized **precipitation**, half-year total, 0–1 (mm via `p×1000`). |
| `wsS`, `wsW` | Wind speed. |
| `prS`, `prW` | Sea-level **pressure**. |
| `windES`, `windNS` | Surface wind east / north component (summer). |
| `windEW`, `windNW` | Surface wind east / north component (winter). |
| `owS`, `owW` | Ocean-current heat-transport (warmth) signal: positive = warm poleward flow, negative = cold equatorward (summer / winter). |
| `ocSpeedS`, `ocSpeedW` | Ocean-current speed. |
| `ocEastS`, `ocNorthS` | Ocean-current east / north component (summer). |
| `ocEastW`, `ocNorthW` | Ocean-current east / north component (winter). |
| `rsSummer`, `rsWinter` | Orographic rain-shadow factor (`rainShadow`), summer / winter. |

## Köppen class legend (`koppen` column)

The `koppen` value is an index into the generator's class table (`js/koppen.js`).
The land-cell counts come from `orogen_meta_full.json` → `koppenDistributionLand`.

| ID | Code | Name | Land cells |
|---:|---|---|---:|
| 0 | Ocean | Ocean (not in land distribution) | — |
| 1 | Af | Tropical rainforest | 44,467 |
| 2 | Am | Tropical monsoon | 17,343 |
| 3 | Aw | Tropical savanna | 63,006 |
| 4 | BWh | Hot desert | 35,019 |
| 5 | BWk | Cold desert | 9,302 |
| 6 | BSh | Hot steppe | 82,367 |
| 7 | BSk | Cold steppe | 17,914 |
| 8 | Cfa | Humid subtropical | 41,552 |
| 9 | Cfb | Oceanic | 22,932 |
| 10 | Cfc | Subpolar oceanic | 1,410 |
| 11 | Csa | Hot-summer Mediterranean | 24,495 |
| 12 | Csb | Warm-summer Mediterranean | 920 |
| 13 | Csc | Cold-summer Mediterranean | 25 |
| 14 | Cwa | Humid subtropical (monsoon) | 2,134 |
| 15 | Cwb | Subtropical highland | 1,658 |
| 16 | Cwc | Cold subtropical highland | 277 |
| 17 | Dfa | Hot-summer continental | 21,767 |
| 18 | Dfb | Warm-summer continental | 20,341 |
| 19 | Dfc | Subarctic | 36,960 |
| 20 | Dfd | Extremely cold subarctic | 1 |
| 21 | Dsa | Hot-summer continental (dry summer) | 4,125 |
| 22 | Dsb | Warm-summer continental (dry summer) | 1,261 |
| 23 | Dsc | Subarctic (dry summer) | 1,951 |
| 24 | Dsd | Extremely cold subarctic (dry summer) | — |
| 25 | Dwa | Hot-summer continental (monsoon) | 70 |
| 26 | Dwb | Warm-summer continental (monsoon) | 30 |
| 27 | Dwc | Subarctic (monsoon) | 861 |
| 28 | Dwd | Extremely cold subarctic (monsoon) | 4 |
| 29 | ET | Tundra | 48,178 |
| 30 | EF | Ice cap | 34,470 |

## Provenance

The data was exported from World Orogen planet
[`06cy8w6z6a89kow6psje93`](https://www.orogen.studio/#06cy8w6z6a89kow6psje93)
(seed 10673275) on 2026-06-06. The generator that produced it is vendored at
`third_party/planet_heightmap_generation/`; per-part checksums and row counts are
in `data/orogen_regions_full/orogen_regions_full_csv_parts_manifest.md`.
