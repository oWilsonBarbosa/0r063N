# Dataset helper scripts

Small, dependency-free (Python 3 standard library only) utilities for working
with the raw dataset in `data/orogen_regions_full/`. Run them from the
repository root.

## `verify_parts.py` — integrity check

Checks each `.csv.gz` part against the per-part SHA-256, file size, and row
counts recorded in the parts manifest.

```bash
python3 scripts/verify_parts.py          # SHA-256 + file size (fast, authoritative)
python3 scripts/verify_parts.py --rows   # also decompress and verify data-row counts
```

Exit code `0` = all parts pass, `1` = a mismatch was found.

## `reassemble.py` — merge parts into one CSV

Each part includes the full header; this stitches the 13 parts back into a
single CSV (header kept once). The output is gitignored.

```bash
python3 scripts/reassemble.py            # -> ./orogen_regions_full.csv (~uncompressed, large)
python3 scripts/reassemble.py --gzip     # -> ./orogen_regions_full.csv.gz
python3 scripts/reassemble.py --check    # count rows only; assert the 2,560,001 total
```

See `docs/DATA_DICTIONARY.md` for what the 56 columns mean.
