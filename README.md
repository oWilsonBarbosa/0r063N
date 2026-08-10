# Orogen planet `06cy8w6z6a89kow6psje93`

This repository is the home of **one procedurally generated planet** and the
analyses derived from it. The planet was generated with
[World Orogen](https://www.orogen.studio/#06cy8w6z6a89kow6psje93) — a
browser-based tectonic-plate + climate simulator — and exported in full: every
one of its 2.56 million surface cells, with elevation, plates, climate, winds,
and ocean currents. Around that raw export we keep two independent studies of
the same world: a **physical-geography atlas with regional gazetteers**, and a
reconstructed **750-million-year geological + climate history**.

| | |
|---|---|
| Planet | [`06cy8w6z6a89kow6psje93`](https://www.orogen.studio/#06cy8w6z6a89kow6psje93) |
| Seed | 10673275 |
| Surface cells | 2,560,001 |
| Land fraction | 20.89 % |
| Physical relief | −9.28 … +7.66 km (canonical Earth-fitted power height mapping) |
| Exported | 2026-06-06 |

## Start here

| You want… | Go to |
|---|---|
| **The planet's physical geography** — 13-plate atlas (relief, tectonics, climate, currents, ecology) | [`reports/regional/atlas/`](reports/regional/atlas/README.md) |
| **Region-by-region write-ups** — 20 chapter-style gazetteers with maps | [`reports/regional/`](reports/regional/README.md) |
| **A continent-scale deep dive** — the Western Lands (Meridia + Selvana) and their shared ocean | [`docs/WESTERN_LANDS.md`](docs/WESTERN_LANDS.md) |
| **How the world came to be** — a 750-Myr plate-tectonic history | [`docs/GEOLOGICAL_HISTORY.md`](docs/GEOLOGICAL_HISTORY.md) |
| **How its climate evolved** — paleoclimate across the supercontinent cycle | [`docs/PALEOCLIMATE.md`](docs/PALEOCLIMATE.md) |
| **How life began** — origin, biochemistry, and the founding tree of life | [`docs/life/`](docs/life/README.md) |
| **The four continents** — Meridia, Sirocca, Selvana, Borea (area, climate, NPP) | [`docs/CONTINENTS.md`](docs/CONTINENTS.md) |
| **Life & habitats** — biogeographic provinces of the four continents | [`docs/BIOGEOGRAPHY.md`](docs/BIOGEOGRAPHY.md) |
| **What the world lets people do** — per-province climate/productivity envelopes with cross-cultural database queries | [`docs/culture/`](docs/culture/README.md) |
| **Subduction style** — Chilean vs Mariana margins | [`docs/SUBDUCTION_STYLE.md`](docs/SUBDUCTION_STYLE.md) |
| **Regions ↔ continents** — which of the 20 gazetteers map each continent | [`docs/REGION_CROSSWALK.md`](docs/REGION_CROSSWALK.md) |
| **The raw data** — what the columns mean | [`docs/DATA_DICTIONARY_V2.md`](docs/DATA_DICTIONARY_V2.md) (corrected v2) · [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) (original) · [`docs/DATA_DICTIONARY_V3.md`](docs/DATA_DICTIONARY_V3.md) (browser extract) |
| **Why v2 exists** — the dataset audit (69 tests, 15 alerts, 9 root causes) | [`reports/audit/`](reports/audit/README.md) |

## Repository map

| Path | What's inside |
|---|---|
| `data/orogen_regions_full/` | The original raw export (v1): 13 gzipped CSV parts (~408 MB), `orogen_meta_full.json`, and a checksummed parts manifest. |
| `data/orogen_regions_full_v2/` | **The corrected export (v2, 58 fields)** — recovered `plateSpeed` and `tempContinentality`, new `isSurfaceCoast` and `postProcessDelta` columns, corrected metadata. Built deterministically from v1 by `tools/export-v2/`. |
| `data/orogen_regions_v3_browser/` | **The browser extract (v3, 82 fields)** — captured live from the running generator by `tools/orogen-extract.js`, plus per-plate, Köppen, ITCZ and dual-mesh sidecars. Recovers the **uncensored** wind/current magnitudes v1 and v2 cannot represent. |
| `docs/` | Narrative documents: the data dictionary, geological history, and paleoclimate. |
| `docs/life/` | The life layer: origin of life, core biochemistry, and the founding tree from which all regional biota descends. Built root-first on the physical + deep-time canon. |
| `docs/culture/` | The culture layer: the physical envelope each biogeographic province imposes, expressed as query keys for eHRAF and D-PLACE. Constraints first — no societies invented yet. |
| `reports/regional/` | **Physical Atlas + 20 regional gazetteers** (Markdown + maps). Built by `tools/regional-report/`. |
| `reports/tectonics/` | Tectonic inventory, validation, and ~38 paleogeographic/climate maps. Built by `tools/tectonics-pipeline/`. |
| `reports/audit/` | The dataset audit that motivated the v2 export: field profile, coherence tests, code-level root-cause analysis, and the present-state atlas (source documents in Portuguese, summary in English). |
| `tools/export-v2/` | **Node.js** pipeline that rebuilds the corrected v2 export from the v1 parts and the pinned generator (single dependency: `delaunator`). |
| `tools/regional-report/` | Zero-dependency **Node.js** pipeline that generates the regional reports and atlas. |
| `tools/province-vectors/` | Zero-dependency **Node.js** script that derives the per-province constraint vectors in `docs/culture/`. |
| `tools/tectonics-pipeline/` | **Python** pipeline that reconstructs the tectonic history and paleoclimate. |
| `scripts/` | Dependency-free dataset helpers — verify checksums, reassemble the parts. |
| `third_party/planet_heightmap_generation/` | A pinned snapshot of the World Orogen generator (GPL-v3) that produced the data — kept for reproducibility and attribution. |

## Which export should I use?

**Use v2** (`data/orogen_regions_full_v2/`, 58 columns) for any new work. An
internal-coherence audit of the v1 export found that `plateSpeed` and
`tempContality` were exported as all-zeros fallbacks, `lat`/`lon` were
misdocumented as radians, and several field names suggested different
quantities than the generator computes. V2 recovers the two lost fields
deterministically from the pinned generator, adds `isSurfaceCoast` (the real
geographic coastline flag — v1 `isCoastal` is a tectonic seed mask) and
`postProcessDelta` (`elev − prePost`), and corrects the documentation. Every
other value is preserved text-for-text; v1 is kept as the provenance record.

**v3** (`data/orogen_regions_v3_browser/`, 82 columns) is a different kind of
artifact: not an export of the site, but a **live capture from the running
generator** taken by pasting `tools/orogen-extract.js` into the browser console.
Reach for it when you need something v1/v2 structurally cannot give you —
notably the **uncensored** wind and ocean-current magnitudes (v1/v2 store only
`min(1, hypot/p95)`), per-cell Voronoi areas, the local east/north basis that
turns the stored components back into 3-D vectors, and the dual-mesh geometry.
It is a *different schema*, not a drop-in replacement: see
[`docs/DATA_DICTIONARY_V3.md`](docs/DATA_DICTIONARY_V3.md), and read its caveats
section before analysis — in particular, region `2560000` is a synthetic mesh
vertex (flagged `isSyntheticPole`) that is present in **all three** datasets and
should be filtered out of any spatial statistic.

## Working with the data

Each export is split into 13 independent `.csv.gz` parts; each part carries the
full header and can be read on its own. To check integrity or stitch them back
together (no dependencies required):

```bash
python3 scripts/verify_parts.py --v2     # check every v2 part against the manifest checksums
python3 scripts/reassemble.py --v2       # merge the 13 v2 parts into one CSV (gitignored)
# same commands without --v2 operate on the original v1 export
# ...and with --v3 on the browser extract
```

The v3 extract ships no manifest of its own, so generate one before verifying it:

```bash
python3 scripts/make_manifest.py --v3    # once — hashes the 13 parts
python3 scripts/verify_parts.py --v3     # then any time
```

Column meanings, unit-conversion formulas, and the Köppen legend are in
[`docs/DATA_DICTIONARY_V2.md`](docs/DATA_DICTIONARY_V2.md) (v2),
[`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) (v1) and
[`docs/DATA_DICTIONARY_V3.md`](docs/DATA_DICTIONARY_V3.md) (v3).

## Regenerating the analyses

The corrected v2 export is reproducible byte-for-byte from the v1 parts and the
pinned generator:

```bash
cd tools/export-v2 && npm ci
node recover_plate_speed.mjs && node recover_spatial_fields.mjs
node rewrite_parts.mjs && node validate_corrected_export.mjs
```

Both studies are reproducible from the raw data:

```bash
# Regional reports + atlas (Node.js, zero dependencies)
node tools/regional-report/main.mjs       # -> reports/regional/
node tools/regional-report/atlas-main.mjs # -> reports/regional/atlas/

# Province constraint vectors (Node.js, zero dependencies)
node tools/province-vectors/main.mjs            # -> docs/culture/ table
node tools/province-vectors/main.mjs --json     # machine-readable

# Geological history + paleoclimate (Python)
pip install -r tools/tectonics-pipeline/requirements.txt
python3 tools/tectonics-pipeline/scripts/00_env_check.py   # then 10_… through 90_…
```

See each tool's own README for the full step-by-step
([regional](reports/regional/README.md#how-this-was-generated),
[tectonics](tools/tectonics-pipeline/README.md)).

## Licensing & provenance

- The **dataset and the analyses** in this repository (`data/`, `docs/`,
  `reports/`, `tools/`, `scripts/`) are released under
  [**CC BY 4.0**](LICENSE) — reuse freely with attribution.
- The **vendored generator** in `third_party/planet_heightmap_generation/` is
  **not** ours: it is World Orogen by
  [raguilar011095](https://github.com/raguilar011095/planet_heightmap_generation),
  under the **GNU GPL v3.0**. Its license is preserved in that directory; see
  [`third_party/planet_heightmap_generation/PROVENANCE.md`](third_party/planet_heightmap_generation/PROVENANCE.md).

## A note on the large files

The 39 data parts (~408 MB v1 + ~365 MB v2 + ~510 MB v3, each ≤42 MB) are stored
directly in git, alongside v3's two mesh binaries (~74 MB). That is within
GitHub's limits (100 MB per file) and keeps a plain `git clone` self-contained.

**Derived files are not committed.** v3's `orogen_triangles_xyz_elev.f32.gz`
(~72 MB) was deliberately left out: its per-triangle centroids and mean
elevations are reconstructible to float32 exactness from
`orogen_mesh_triangles.Int32Array.gz` plus the region parts' `x,y,z,elev`
columns. Rebuild it with `scripts/rebuild_triangle_centroids.py`, which also has
a `--verify` mode that proves the reconstruction against a reference copy. The
Delaunay index itself is **not** derivable and is kept.

If the datasets grow much larger, two standard next steps are
[Git LFS](https://git-lfs.com/) (stores big files as lightweight pointers) or
attaching the parts to a tagged
[GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github)
instead of committing them — both are documented options, not changes made here.
