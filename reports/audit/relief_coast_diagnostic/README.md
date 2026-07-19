# Relief & coastline diagnostic — the height-schema resolution

This folder archives the **Atlas v2 relief & coastline diagnostic** (dated
2026-07-19) and records how the repository resolved it. The full diagnostic is
[`ATLAS_V2_RELIEF_COAST_DIAGNOSTIC.md`](ATLAS_V2_RELIEF_COAST_DIAGNOSTIC.md); its
key machine-readable outputs and figures are alongside it.

## What it found

The planet's data carried **three incompatible conversions** from the
dimensionless model elevation `elev` to physical height in km:

| Consumer | Land mapping | Peak |
|---|---|---|
| exported `elev_km` / old data dictionary | linear `6·elev` | 8.54 km |
| generator `js/color-map.js` `elevToHeightKm` (S-curve `6t⁴(5−4t)`) | **used by the climate physics** | 6.0 km |
| generator `js/import-main.js` hover | `6·elev²` | ~12 km |
| generator `js/terrain-metrics.js` bands | raw cutoffs (S-curve-consistent) | — |

The decisive fact, verified against `main`: `js/temperature.js` computes the
lapse-rate term as `T -= lapse * elevToHeightKm(elev)`, so the **climate fields
`tS`/`tW` (and thus Köppen and everything downstream) were computed with the
S-curve**, while the repository's reported heights (atlas relief, continent
stats, skill "Key Locked Facts," life-layer figures) used the **linear** `elev_km`.
The km heights we reported did not match the heights the climate used.

This was an **inherited** conflict (generator + original export choice), not a
regression from the v2 corrections. Data integrity was intact throughout.

## Decision

Adopt the **generator's native S-curve** (`elevToHeightKm`) as the single
canonical `elev → height_km` mapping — the mapping the climate physics already
used, so **no climate/Köppen/precip/wind regeneration was required**. The
alternative Earth-fitted power candidate proposed in the diagnostic
([`v2_1_parameter_proposal.json`](v2_1_parameter_proposal.json)) was **not**
adopted: it would have required regenerating every climate-dependent field under
a height the generator never used, and the diagnostic itself flags it as a
candidate needing further validation.

Under the canonical mapping the world is genuinely flatter: land mean ≈ 0.53 km,
median ≈ 0.04 km, ~9 % of land ≥ 2 km, and high terrain clamps to a **6 km
ceiling** (`elev ≥ 1`). See [`height_mapping_comparison.csv`](height_mapping_comparison.csv).

## What changed in the repository

- **No data-parts rewrite.** `elev` (raw) is the primary field and canonical
  height is the pure function `elevToHeightKm(elev)`, so the 13 `.csv.gz` parts
  were left untouched (avoids a third ~365 MB copy in git history). The stored
  `elev_km` column is now **documented as legacy linear / non-canonical**.
- **Metadata + dictionary.** `data/orogen_regions_full_v2/orogen_meta_full_v2.json`
  gained a `heightMapping` block; `docs/DATA_DICTIONARY_V2.md` marks `elev_km`
  legacy and states the canonical formula.
- **Consumers repointed** to `elevToHeightKm(data.elev …)`: atlas relief/erosion,
  hypsometry, cross-sections, records, region relief-band and mountain-height
  stats, and terrain classification (`tools/regional-report/`), plus
  `tools/export-v2/continent_stats.mjs`. Ocean-depth sites (`elev ≤ 0`, identical
  in both mappings) were left as-is.
- **Hydrology left on the raw terrain ordering.** The drainage solver keeps using
  the well-separated legacy field as its internal DEM (an ordering-only role its
  priority-flood epsilon and lake water-balance were tuned for); feeding the
  compressed S-curve km degraded lowland routing and lake counts. River and basin
  networks are therefore unchanged.
- **Canon text** (skill "Key Locked Facts," mountain-wall thread, the four
  continent elevation lines; life docs 01/02 height labels) recomputed to the
  6 km-ceiling world.
- **Regenerated** `reports/regional/` and `reports/regional/atlas/`. Only the four
  relief-derived atlas plates (relief, hypsometry, cross-sections, erosion) and
  the terrain-class tables/maps changed; **climate and drainage products are
  byte-identical**.

## Consequence

The physical structure (continents, coastlines, climate zones, tectonics, the
divergence tree, all realm logic) is unchanged. What changed is the absolute
height scale: peaks are 6 km not 8.5 km, ~9 % of land is above 2 km not 28 %, and
the terrain tables shift toward lowland classes. Coastline realism was found to
be within the plausibility band at matched resolutions and required no terrain
tuning.
