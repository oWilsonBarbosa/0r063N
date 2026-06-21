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
| Physical relief | −9.281 … +8.538 km |
| Exported | 2026-06-06 |

## Start here

| You want… | Go to |
|---|---|
| **The planet's physical geography** — 13-plate atlas (relief, tectonics, climate, currents, ecology) | [`reports/regional/atlas/`](reports/regional/atlas/README.md) |
| **Region-by-region write-ups** — 20 chapter-style gazetteers with maps | [`reports/regional/`](reports/regional/README.md) |
| **How the world came to be** — a 750-Myr plate-tectonic history | [`docs/GEOLOGICAL_HISTORY.md`](docs/GEOLOGICAL_HISTORY.md) |
| **How its climate evolved** — paleoclimate across the supercontinent cycle | [`docs/PALEOCLIMATE.md`](docs/PALEOCLIMATE.md) |
| **The four continents** — Meridia, Sirocca, Selvana, Borea (area, climate, NPP) | [`docs/CONTINENTS.md`](docs/CONTINENTS.md) |
| **Subduction style** — Chilean vs Mariana margins | [`docs/SUBDUCTION_STYLE.md`](docs/SUBDUCTION_STYLE.md) |
| **Life & habitats** — biogeographic provinces of the four continents | [`docs/BIOGEOGRAPHY.md`](docs/BIOGEOGRAPHY.md) |
| **The raw data** — what the columns mean | [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) |

## Repository map

| Path | What's inside |
|---|---|
| `data/orogen_regions_full/` | The raw export: 13 gzipped CSV parts (~408 MB), `orogen_meta_full.json`, and a checksummed parts manifest. |
| `docs/` | Narrative documents: the data dictionary, geological history, and paleoclimate. |
| `reports/regional/` | **Physical Atlas + 20 regional gazetteers** (Markdown + maps). Built by `tools/regional-report/`. |
| `reports/tectonics/` | Tectonic inventory, validation, and ~38 paleogeographic/climate maps. Built by `tools/tectonics-pipeline/`. |
| `tools/regional-report/` | Zero-dependency **Node.js** pipeline that generates the regional reports and atlas. |
| `tools/tectonics-pipeline/` | **Python** pipeline that reconstructs the tectonic history and paleoclimate. |
| `scripts/` | Dependency-free dataset helpers — verify checksums, reassemble the parts. |
| `third_party/planet_heightmap_generation/` | A pinned snapshot of the World Orogen generator (GPL-v3) that produced the data — kept for reproducibility and attribution. |

## Working with the data

The export is split into 13 independent `.csv.gz` parts; each carries the full
56-column header and can be read on its own. To check integrity or stitch them
back together (no dependencies required):

```bash
python3 scripts/verify_parts.py     # check every part against the manifest checksums
python3 scripts/reassemble.py       # merge the 13 parts into one CSV (gitignored)
```

Column meanings, unit-conversion formulas, and the Köppen legend are in
[`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md).

## Regenerating the analyses

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

The 13 data parts (~408 MB total, each ≤33 MB) are stored directly in git. That
is comfortably within GitHub's limits (100 MB per file) and keeps a plain
`git clone` self-contained. If the dataset grows much larger, two standard next
steps are [Git LFS](https://git-lfs.com/) (stores big files as lightweight
pointers) or attaching the parts to a tagged
[GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github)
instead of committing them — both are documented options, not changes made here.
