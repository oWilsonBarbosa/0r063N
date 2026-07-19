# Dataset audit — why the v2 export exists

This directory is the evidence trail behind `data/orogen_regions_full_v2/`.
It archives the four-stage audit of the original (v1) export that identified
the defects the v2 correction repairs. The source documents are in Portuguese;
this page summarizes their findings in English.

A later, separate audit resolved a **height-schema conflict** (three
incompatible `elev → km` mappings) and is archived in
[`relief_coast_diagnostic/`](relief_coast_diagnostic/README.md): the repository
now uses the generator's native S-curve as the one canonical physical-height
mapping.

| Stage | Document | What it did |
|---|---|---|
| Profile | [`Orogen_Perfil_Integral_56_Campos.xlsx`](Orogen_Perfil_Integral_56_Campos.xlsx) | Exact quantile/statistical profile of all 56 fields over the 13 canonical parts. First flagged: `plateSpeed` and `tempContality` all-zero, `lat`/`lon` in degrees (dictionary said radians), `ocNorthS` ≡ `ocNorthW`, and the exact-5 % ceilings on `pS/pW` and `ocSpeed*`. |
| Etapa 3 | [`Orogen_Etapa3_Coerencia_Interna.pdf`](Orogen_Etapa3_Coerencia_Interna.pdf) | Internal-coherence audit: 69 cross-field tests over all 2,560,001 cells. Result: 37 strong passes, **15 alerts, 0 unequivocal failures**. Core structure (geometry, conversions, masks, plate hierarchy, Köppen, relief, pressure–wind coupling) is strongly self-consistent. |
| Etapa 4 | [`Orogen_Etapa4_Interpretacao_por_Codigo.pdf`](Orogen_Etapa4_Interpretacao_por_Codigo.pdf) | Static reading of the pinned generator (snapshot `f9bb081224ee`) to explain each alert. The 15 alerts reduce to **9 root causes**; none remain unexplained. |
| Atlas | [`Orogen_Estado_Presente_Atlas.pdf`](Orogen_Estado_Presente_Atlas.pdf) | 226-page present-state atlas of the measured layer only (no inferred history), built with the corrected reading of the data. Independent visual companion to the audit. |

Audited commit: `9937ec63f74a` · planet `06cy8w6z6a89kow6psje93` · seed `10673275`.

## The nine root causes (Etapa 4)

| # | Root cause | Alerts | Class | Resolution in this repo |
|---|---|---|---|---|
| RC01 | `lat`/`lon` documented as radians but exported in degrees (internal unit copied into the external dictionary) | G04 | Documentation error | v2 dictionary states **degrees** |
| RC02 | Meridional current component has no seasonal term (`currentN` depends only on season-invariant inputs) | V05 | Structural model limitation | Documented in `docs/DATA_DICTIONARY_V2.md` |
| RC03 | `plateSpeed` missing from the export; the CSV zeros are a fallback, not plate immobility | H04 | Probable export defect | **Recovered** deterministically by `tools/export-v2/` (80 per-plate values) |
| RC04 | `tempContinentality` never exported; column misspelled `tempContality` and zero-filled | H05, V06 | Probable export defect | **Recovered** on the exact original mesh; column renamed |
| RC05 | `prePost` and `eroD` use different baselines (`elev = prePost + warpD + eroD`; `warpD` not exported) | R02 | Semantics/observability gap | v2 adds `postProcessDelta = elev − prePost`; `eroD` documented as post-warp delta |
| RC06 | `isCoastal` is a tectonic collision class, not the surface coastline | C02 | Misleading name | v2 adds **`isSurfaceCoast`** (true land/ocean adjacency, 40,772 cells) |
| RC07 | Seasonal-phase test applied too close to the equator (ITCZ effects dominate below ~25°) | S01, S02 | Excessive test premise | No data change needed |
| RC08 | Precipitation, wind and current speeds deliberately divided by p95 and capped at 1 (~5 % of cells censored per season) | S03–S06 | Intentional, lossy | Documented: a value of 1 means **≥ p95**, not an exact magnitude |
| RC09 | `owS`/`owW` is a smoothed geographic coastal-warmth proxy, independent of the current vectors | O01, O02 | Name/algorithm divergence | Documented; Atlas Plate 11 no longer draws warm/cold classes from it |

## What was irrecoverable

The v1 export discarded raw magnitudes above the p95 cap (precipitation, wind
speed, current speed) and the pre-erosion elevation needed to separate the
terrain warp from later post-processing. V2 preserves these fields as
documented censored values; nothing was invented.

## Downstream effect on the reports

Rebuilding `reports/regional/` from v2 changed three things: coastal wetlands
are now classified with `isSurfaceCoast` (previously hidden by the RC06
misnomer — the eligible cell count rose ~10×), Atlas Plate 4 shows the
erosion-only elevation change (`eroD`) instead of the warp-inclusive
`elev − prePost`, and Plate 11 colors current arrows by speed instead of by
the RC09 warmth proxy.
