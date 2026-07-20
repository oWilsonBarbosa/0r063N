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
| **How the world came to be** — a 750-Myr plate-tectonic history | [`docs/GEOLOGICAL_HISTORY.md`](docs/GEOLOGICAL_HISTORY.md) |
| **How its climate evolved** — paleoclimate across the supercontinent cycle | [`docs/PALEOCLIMATE.md`](docs/PALEOCLIMATE.md) |
| **How life began** — origin, biochemistry, and the founding tree of life | [`docs/life/`](docs/life/README.md) |
| **The raw data** — what the columns mean | [`docs/DATA_DICTIONARY_V2.md`](docs/DATA_DICTIONARY_V2.md) (corrected v2) · [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) (original) |
| **Why v2 exists** — the dataset audit (69 tests, 15 alerts, 9 root causes) | [`reports/audit/`](reports/audit/README.md) |

## Repository map

| Path | What's inside |
|---|---|
| `data/orogen_regions_full/` | The original raw export (v1): 13 gzipped CSV parts (~408 MB), `orogen_meta_full.json`, and a checksummed parts manifest. |
| `data/orogen_regions_full_v2/` | **The corrected export (v2, 58 fields)** — recovered `plateSpeed` and `tempContinentality`, new `isSurfaceCoast` and `postProcessDelta` columns, corrected metadata. Built deterministically from v1 by `tools/export-v2/`. |
| `docs/` | Narrative documents: the data dictionary, geological history, and paleoclimate. |
| `docs/life/` | The life layer: origin of life, core biochemistry, and the founding tree from which all regional biota descends. Built root-first on the physical + deep-time canon. |
| `reports/regional/` | **Physical Atlas + 20 regional gazetteers** (Markdown + maps). Built by `tools/regional-report/`. |
| `reports/tectonics/` | Tectonic inventory, validation, and ~38 paleogeographic/climate maps. Built by `tools/tectonics-pipeline/`. |
| `reports/audit/` | The dataset audit that motivated the v2 export: field profile, coherence tests, code-level root-cause analysis, and the present-state atlas (source documents in Portuguese, summary in English). |
| `tools/export-v2/` | **Node.js** pipeline that rebuilds the corrected v2 export from the v1 parts and the pinned generator (single dependency: `delaunator`). |
| `tools/regional-report/` | Zero-dependency **Node.js** pipeline that generates the regional reports and atlas. |
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

## Working with the data

Each export is split into 13 independent `.csv.gz` parts; each part carries the
full header and can be read on its own. To check integrity or stitch them back
together (no dependencies required):

```bash
python3 scripts/verify_parts.py --v2     # check every v2 part against the manifest checksums
python3 scripts/reassemble.py --v2       # merge the 13 v2 parts into one CSV (gitignored)
# same commands without --v2 operate on the original v1 export
```

Column meanings, unit-conversion formulas, and the Köppen legend are in
[`docs/DATA_DICTIONARY_V2.md`](docs/DATA_DICTIONARY_V2.md) (v2) and
[`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) (v1).

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

The 26 data parts (~408 MB v1 + ~365 MB v2, each ≤35 MB) are stored directly in git. That
is comfortably within GitHub's limits (100 MB per file) and keeps a plain
`git clone` self-contained. If the dataset grows much larger, two standard next
steps are [Git LFS](https://git-lfs.com/) (stores big files as lightweight
pointers) or attaching the parts to a tagged
[GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github)
instead of committing them — both are documented options, not changes made here.
