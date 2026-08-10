# Export v2 — corrected dataset pipeline

This pipeline produces `data/orogen_regions_full_v2/` (58 fields) from the
original raw export in `data/orogen_regions_full/` (56 fields). It repairs the
export defects identified by the internal-coherence audit (Etapa 3) and
explained by the code reading (Etapa 4), without altering any other value:

1. **`plateSpeed`** — the v1 export contains a zero fallback for every cell.
   The 80 per-plate angular-speed magnitudes are recovered deterministically by
   re-running the pinned generator's plate physics from the planet code.
2. **`tempContality` → `tempContinentality`** — the v1 field is zero
   everywhere. The thermal-continentality field is recovered by rebuilding the
   exact original sphere mesh and re-running the generator's continentality
   routine over the exported land mask and summer ocean-warmth field.
3. **`isSurfaceCoast`** (new) — final land cells adjacent to ocean. The v1
   `isCoastal` is a tectonic seed flag, not the geographic coastline.
4. **`postProcessDelta`** (new) — the exact decimal identity `elev - prePost`
   at the exported precision.

Latitude/longitude are documented as **degrees** (the v1 dictionary wrongly
said radians), and the p95-censored fields (`pS/pW`, `wsS/wsW`,
`ocSpeedS/ocSpeedW`) are documented as censored rather than re-invented. See
`docs/DATA_DICTIONARY_V2.md` for the full field reference.

## Running

Requires Node.js ≥ 20 and the single dependency `delaunator` (used by the
generator's mesh builder):

```bash
cd tools/export-v2
npm ci

node recover_plate_speed.mjs        # -> intermediate/plate_speed_by_plate.json
node recover_spatial_fields.mjs     # -> intermediate/temp_continentality.f32, is_surface_coast.u8
node rewrite_parts.mjs              # -> ../../data/orogen_regions_full_v2/ (13 parts + meta + manifest)
node validate_corrected_export.mjs  # row-by-row v1↔v2 validation -> validation_v2.json
```

Optional checks and analyses:

```bash
node inspect_planet.mjs             # decode the planet code
node verify_geometry.mjs            # sample-check exported x,y,z against the regenerated mesh
node continent_stats.mjs            # per-continent profile (extent, elevation, Köppen, temperature)
```

`continent_stats.mjs` rebuilds the mesh, labels the landmasses, and prints
planet-level counts plus a profile of the four continents — the source of the
numbers in `.claude/skills/orogen-worldbuilding/SKILL.md`.

Every step is deterministic: rebuilding from the same v1 parts reproduces the
13 v2 `.csv.gz` parts byte-for-byte (SHA-256s are recorded in
`data/orogen_regions_full_v2/orogen_regions_full_v2_manifest.md`).

## Generator code

The pipeline imports the pinned generator snapshot from
`third_party/planet_heightmap_generation/` (GPL v3, see its `PROVENANCE.md`).
That snapshot is kept verbatim, so the one module that needed a modification
lives here instead: `vendor/temperature.js` is a copy of the snapshot's
`js/temperature.js` whose only changes are an added `export` keyword on
`computeTempContinentality` and three import specifiers repointed at
`third_party/`. Being a derivative of the generator, `vendor/temperature.js`
is likewise governed by the GPL v3.

## Validation guarantees

`validate_corrected_export.mjs` re-reads both exports in lockstep and asserts:

- every v1 value outside `plateSpeed`/`tempContality` is unchanged text-for-text;
- every row has 58 fields and ids stay continuous `0 … 2,560,000`;
- all 80 plates carry a nonzero recovered speed;
- `isSurfaceCoast` marks exactly 40,772 cells, matching the generator's
  `terrainMetrics.coastline_cells`;
- `elev = prePost + postProcessDelta` holds exactly at the exported precision.
