# Dataset helper scripts

Small, dependency-free (Python 3 standard library only) utilities for working
with the raw datasets. Run them from the repository root.

| Flag | Dataset | Columns |
|---|---|---:|
| *(none)* | `data/orogen_regions_full/` — the original export | 56 |
| `--v2` | `data/orogen_regions_full_v2/` — the corrected export | 58 |
| `--v3` | `data/orogen_regions_v3_browser/` — the in-browser DevTools extract | 82 |

**Use v2 for analysis.** v1 is the provenance record; v3 is an independent
capture taken live from the generator (it recovers uncensored wind/ocean
magnitudes that v1/v2 cannot represent, but it is a different schema — see
`docs/DATA_DICTIONARY_V3.md`).

## `verify_parts.py` — integrity check

Checks each `.csv.gz` part against the per-part SHA-256, file size, and row
counts recorded in the parts manifest.

```bash
python3 scripts/verify_parts.py          # SHA-256 + file size (fast, authoritative)
python3 scripts/verify_parts.py --rows   # also decompress and verify data-row counts
python3 scripts/verify_parts.py --v2     # check the corrected v2 export instead
```

Exit code `0` = all parts pass, `1` = a mismatch was found.

## `reassemble.py` — merge parts into one CSV

Each part includes the full header; this stitches the 13 parts back into a
single CSV (header kept once). The output is gitignored.

```bash
python3 scripts/reassemble.py            # -> ./orogen_regions_full.csv (~uncompressed, large)
python3 scripts/reassemble.py --gzip     # -> ./orogen_regions_full.csv.gz
python3 scripts/reassemble.py --v2       # -> ./orogen_regions_full_v2.csv
python3 scripts/reassemble.py --check    # count rows only; assert the 2,560,001 total
```

## `make_manifest.py` — generate a checksummed manifest

v1 and v2 ship with a parts manifest. The v3 browser extract does **not** — it
writes `orogen_meta.json` instead — so its manifest has to be generated once
before `verify_parts.py --v3` can check anything:

```bash
python3 scripts/make_manifest.py --v3          # -> orogen_regions_v3_manifest.md
python3 scripts/make_manifest.py --v3 --force  # regenerate an existing one
```

It reads every part once (counting rows and land/coast cells) and hashes the raw
file, so allow a couple of minutes over ~520 MB. Output matches the v1/v2 table
format exactly, so `verify_parts.py` parses all three identically.

It **refuses to overwrite an existing manifest** without `--force`, so it cannot
silently replace the authoritative v1/v2 manifests with regenerated ones.

## `make_data_dictionary.py` — regenerate the v3 column reference

The v3 extract ships a self-describing `fields` block in `orogen_meta.json`
(name, dtype, units, source, semantics per column). This renders it into
`docs/DATA_DICTIONARY_V3.md` rather than hand-maintaining an 82-row table that
would drift on the next extract:

```bash
python3 scripts/make_data_dictionary.py
```

Re-run it after any fresh extract — the doc is a build artefact of the metadata.

## `rebuild_triangle_centroids.py` — regenerate the largest v3 file

`orogen_triangles_xyz_elev.f32.gz` (~72 MB) is the biggest file in the repo and
past GitHub's 50 MB advisory — but it is **pure cache**: per-triangle centroid
`xyz` and mean `elev`, both derivable from `orogen_mesh_triangles.Int32Array.gz`
(the Delaunay index, which is *not* derivable — keep it) plus the region parts'
`x,y,z,elev` columns.

```bash
python3 scripts/rebuild_triangle_centroids.py --verify   # prove it reconstructs exactly
python3 scripts/rebuild_triangle_centroids.py            # rebuild it locally
```

Run `--verify` **before** removing the committed copy: it reports the max error
against the real file, and tests both readings of the metadata's ambiguous
"unnormalised arithmetic centroid" (sum vs mean) to report which one applies. It
only green-lights deletion if the match is exact to float32 precision.

The file is gitignored so it is not re-committed by accident.

## Column meanings

`docs/DATA_DICTIONARY.md` (56, v1) · `docs/DATA_DICTIONARY_V2.md` (58, v2) ·
`docs/DATA_DICTIONARY_V3.md` (82, v3).

The v3 extract itself is produced by `tools/orogen-extract.js` — paste it into
the browser console at orogen.studio with the planet loaded. See the header
comment in that file for the procedure and its config flags.
