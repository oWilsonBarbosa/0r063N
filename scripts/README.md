# Dataset helper scripts

Small, dependency-free (Python 3 standard library only) utilities for working
with the raw datasets in `data/orogen_regions_full/` (original v1) and
`data/orogen_regions_full_v2/` (corrected v2). Run them from the repository
root. Both scripts accept `--v2` to operate on the corrected export.

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

See `docs/DATA_DICTIONARY_V2.md` for what the 58 v2 columns mean
(`docs/DATA_DICTIONARY.md` covers the original 56-column export).
