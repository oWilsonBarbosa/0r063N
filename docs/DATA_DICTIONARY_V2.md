# Data dictionary — `orogen_regions_full_v2`

Each row represents one surface cell of the 2,560,001-cell spherical mesh.
Numeric values use up to six decimal places. The v2 header is:

```text
id,lat,lon,x,y,z,elev,elev_km,prePost,eroD,plate,isOcPlate,superPlate,plateSpeed,isLand,isCoastal,isMountain,stress,orogPow,tecAct,base,tectonic,noise,interior,coastal_l,ocean_l,hotspot,margins,backArc,foldRidge,basin,koppen,contality,tempContinentality,tS,tW,pS,pW,wsS,wsW,prS,prW,windES,windNS,windEW,windNW,owS,owW,ocSpeedS,ocSpeedW,ocEastS,ocNorthS,ocEastW,ocNorthW,rsSummer,rsWinter,isSurfaceCoast,postProcessDelta
```

## Identity and geometry

| Field | Meaning |
|---|---|
| `id` | Cell index, `0 … 2,560,000`. |
| `lat`, `lon` | Geographic latitude and longitude in **degrees**. |
| `x`, `y`, `z` | Unit-sphere Cartesian coordinates; `lat = asin(y)` and `lon = atan2(x,z)`. |

## Elevation and post-processing

| Field | Meaning |
|---|---|
| `elev` | Final dimensionless model elevation; positive values are above sea level. **This is the primary height field** — derive physical height from it via the canonical mapping below. |
| `elev_km` | **LEGACY / non-canonical.** Linear physical elevation: positive `elev × 6`, negative `elev × 10`. Preserved for provenance only. Its land values (peak 8.54 km) use a linear mapping the generator's own climate physics did **not** use — do not treat it as physical height. |
| `prePost` | Elevation before terrain warp and the remaining post-processing pipeline. |
| `eroD` | Legacy generator `erosionDelta`: final elevation minus the snapshot taken **after terrain warp**. It includes smoothing, erosion, ridge sharpening, and soil creep, but excludes warp. |
| `postProcessDelta` | Added in v2: exact decimal `elev - prePost`; the combined net effect of terrain warp and later post-processing. |

### Canonical physical height (use this)

Physical height in km is **not** the stored `elev_km` field. It is the repository's
canonical **Earth-fitted power mapping** of the raw `elev` (`tools/height-mapping.mjs`):

```text
height_km = 4.574236096629359 · elev^1.4622457219144074   for elev > 0   (land; peak ≈ 7.66 km)
height_km = 10 · elev                                      for elev ≤ 0   (ocean; = the legacy field)
```

Its two land parameters were fitted (in the relief/coast diagnostic) to Earth's land
median and its share of land at or above 2 km, giving an Earth-plausible distribution
with no artificial ceiling: land mean ≈ 0.77 km, median ≈ 0.42 km, ~10.7 % of land
≥ 2 km, peak ≈ 7.66 km. All repository height products (atlas relief,
`continent_stats.mjs`, gazetteers, the tectonic inventory, the life-layer figures)
use this mapping.

**Climate note.** The generator's *exported* climate (`tS/tW`, `koppen`, precip,
winds) was computed by the generator on its own internal **S-curve** height curve
and is preserved unchanged as the planet's published climate; this mapping governs
physical relief, not the climate simulation's internal heights. The two curves
differ by a mean 0.35 km per land cell (an implied ~2.3 °C mean temperature
discrepancy, up to ~10 °C at the highest peaks) — within the climate model's own
error, and documented as an accepted caveat in
[`../reports/audit/relief_coast_diagnostic/`](../reports/audit/relief_coast_diagnostic/README.md).

## Tectonics and surface masks

| Field | Meaning |
|---|---|
| `plate` | Plate ID. |
| `isOcPlate` | `1` when the cell belongs to an oceanic plate. |
| `superPlate` | Super-plate group ID. |
| `plateSpeed` | Recovered dimensionless angular-speed magnitude after the plate-physics adjustments. It is invariant within each plate. |
| `isLand` | Final generator land mask: `1` land, `0` ocean. |
| `isCoastal` | Legacy tectonic collision/boundary seed flag. It is **not** the final geographic coastline. |
| `isSurfaceCoast` | Added in v2: `1` for final land cells with at least one ocean neighbor. |
| `isMountain` | Tectonic mountain-generation seed flag, not a final-elevation threshold. |
| `stress` | Tectonic stress magnitude. |
| `orogPow` | Orogenic power. |
| `tecAct` | Tectonic activity. |

## Elevation-component layers

| Fields | Meaning |
|---|---|
| `base`, `tectonic`, `noise` | Base terrain, tectonic contribution, and noise contribution. |
| `interior`, `coastal_l`, `ocean_l` | Continental-interior, tectonic-coastal, and ocean distance-field components. |
| `hotspot`, `margins`, `backArc`, `foldRidge`, `basin` | Hotspot, continental-margin, back-arc, fold-ridge, and basin layers. |

These layers participate in nonlinear terrain construction. Their simple sum is
not expected to equal final elevation after compression, isostasy, hypsometry,
terrain warp, erosion, sharpening, and soil creep.

## Climate and seasons

The `S` and `W` suffixes refer to the generator's global summer and winter
passes: `S` is Northern-Hemisphere summer / Southern-Hemisphere winter.

| Field | Meaning |
|---|---|
| `koppen` | Köppen class ID (`0` ocean; `1 … 30` land classes). |
| `contality` | BFS distance-from-main-ocean continentality index. |
| `tempContinentality` | Recovered thermal continentality zone/transition field. Ocean is `-1`; land is `0 … 1`. |
| `tS`, `tW` | Normalized seasonal temperature. °C = `-45 + t × 90`. |
| `pS`, `pW` | Seasonal precipitation index divided by its p95 and capped at `1`. A value of `1` means **greater than or equal to p95**, not an exact maximum. To millimetres: `mm = p × PRECIP_SCALE_MM` (`tools/precip-scale.mjs`, **813.7**). **Do not assume these millimetres agree with the `koppen` column beside them** — see the note below. |
| `wsS`, `wsW` | Seasonal wind speed divided by its p95 and capped at `1`. |
| `prS`, `prW` | Seasonal sea-level pressure deviation used by the generator. |
| `windES`, `windNS`, `windEW`, `windNW` | East/north surface-wind components. |
| `owS`, `owW` | Smoothed geographic coastal-warmth proxy. It affects climate, but is not vector heat transport and need not correlate with current direction. |
| `ocSpeedS`, `ocSpeedW` | Ocean-current vector magnitude divided by the oceanic p95 and capped at `1`. |
| `ocEastS`, `ocNorthS`, `ocEastW`, `ocNorthW` | Seasonal east/north ocean-current components. The meridional component is season-invariant in this generator snapshot. |
| `rsSummer`, `rsWinter` | Seasonal orographic rain-shadow factor. |

### Millimetres and `koppen` disagree for ~11 % of land

`koppen` was classified **by the generator**, which used a placeholder conversion
of `1000` mm per index unit. The repository reports millimetres on the calibrated
`PRECIP_SCALE_MM = 813.7`, fitted to the snapshot that produced this export
(`tools/precip-scale.mjs` explains the fit). Köppen's aridity test is *defined* in
millimetres, so the two do not agree.

Measured over all 534,840 land cells by `scripts/audit_koppen_scale.py`, which
reproduces the generator's own test (`js/koppen.js`) at both scales:

| | at 1000 (as classified) | at 813.7 (as reported) |
|---|---:|---:|
| Arid (B group) | 147,857 — 27.65 % of land | 185,300 — 34.65 % of land |

- **37,443 cells (7.00 % of land)** would newly be arid. They come mostly from the
  semi-arid margins: `Aw` 44 %, `Cfa` 23 %, `Csa` 18 %.
- **22,681 cells (4.24 % of land)** already arid would move steppe → desert.
- **60,124 cells — 11.24 % of land — carry a `koppen` label that disagrees with
  the millimetres reported beside them.**

The `Pthresh` term is a ratio-based function of temperature and seasonality, so it
is scale-invariant; only `Pann` moves, and it moves *down*, which is why the
disagreement is one-directional (the calibrated scale reads more arid).

**Practical guidance.** Use `koppen` when you want the generator's published
climate labels — they are the canon the biome, realm and life layers were built
on. Use millimetres when you need a physical quantity comparable to real-world
data (terrain classes, humidity bands, D-PLACE `Bio12`). Do not mix them within a
single threshold test, and do not expect a mm-derived aridity mask to reproduce
the B-group cells.

## V1 to v2 migration

| V1 | V2 | Change |
|---|---|---|
| `plateSpeed = 0` | `plateSpeed` | Replaced fallback zero with recovered per-plate values. |
| `tempContality = 0` | `tempContinentality` | Corrected spelling and restored the actual field. |
| no field | `isSurfaceCoast` | Added final geographic coastline flag. |
| no field | `postProcessDelta` | Added combined post-processing delta. |
| `lat`, `lon` documented as radians | same values | Correct unit is degrees. |

All other legacy column values are preserved text-for-text. Their clarified
semantics do not change the underlying numbers.

## Values that cannot be recovered from v1

The original export did not retain raw values above the p95 cap or the p95
scales for `pS/pW`, `wsS/wsW`, and `ocSpeedS/ocSpeedW`. It also omitted the
pre-erosion elevation needed to separate terrain warp from the remaining
post-processing. V2 preserves these fields honestly as censored values and does
not fabricate missing magnitudes.
