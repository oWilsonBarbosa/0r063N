#!/usr/bin/env python3
"""Reassemble the 13 CSV parts into one CSV.

Each part carries the full 56-column header; this streams them in order, keeps
the header once, and writes a single `orogen_regions_full.csv` (gitignored).

    python3 scripts/reassemble.py             # -> ./orogen_regions_full.csv
    python3 scripts/reassemble.py --gzip      # -> ./orogen_regions_full.csv.gz
    python3 scripts/reassemble.py --v2        # corrected v2 export -> ./orogen_regions_full_v2.csv
    python3 scripts/reassemble.py --out PATH  # custom destination
    python3 scripts/reassemble.py --check     # count rows only, assert the expected total

Exit code 0 = success / counts match, 1 = mismatch.
"""
import argparse
import gzip
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROWS = 2_560_001


def part_paths(data_dir, stem):
    parts = sorted(data_dir.glob(f"{stem}_part_*.csv.gz"))
    if not parts:
        sys.exit(f"ERROR: no parts found in {data_dir}")
    return parts


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, help="destination path")
    ap.add_argument("--gzip", action="store_true", help="write gzip-compressed output")
    ap.add_argument("--check", action="store_true",
                    help="don't write; just count data rows and verify the expected total")
    ap.add_argument("--v2", action="store_true",
                    help="reassemble the corrected v2 export (data/orogen_regions_full_v2/)")
    args = ap.parse_args()

    stem = "orogen_regions_full_v2" if args.v2 else "orogen_regions_full"
    parts = part_paths(REPO_ROOT / "data" / stem, stem)

    if args.check:
        total = 0
        header = None
        for path in parts:
            with gzip.open(path, "rt", newline="") as f:
                h = next(f)
                if header is None:
                    header = h
                elif h != header:
                    sys.exit(f"ERROR: header mismatch in {path.name}")
                total += sum(1 for _ in f)
        print(f"Parts: {len(parts)}   data rows: {total:,}   expected: {EXPECTED_ROWS:,}")
        if total != EXPECTED_ROWS:
            print("RESULT: MISMATCH")
            return 1
        print("RESULT: OK")
        return 0

    out = args.out or (REPO_ROOT / (f"{stem}.csv.gz" if args.gzip else f"{stem}.csv"))
    opener = (lambda p: gzip.open(p, "wt", newline="")) if args.gzip else (lambda p: open(p, "w", newline=""))

    total = 0
    with opener(out) as w:
        for i, path in enumerate(parts):
            with gzip.open(path, "rt", newline="") as f:
                header = next(f)
                if i == 0:
                    w.write(header)
                for line in f:
                    w.write(line)
                    total += 1
            print(f"  + {path.name}  (running rows: {total:,})")

    print(f"\nWrote {total:,} data rows to {out}")
    if total != EXPECTED_ROWS:
        print(f"WARNING: expected {EXPECTED_ROWS:,} rows")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
