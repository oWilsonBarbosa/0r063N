#!/usr/bin/env python3
"""Verify the orogen_regions_full CSV parts against the committed manifest.

Reads per-part SHA-256, file size, and data-row counts from
`data/orogen_regions_full/orogen_regions_full_csv_parts_manifest.md` (the single
source of truth) and checks each `.csv.gz` against them.

    python3 scripts/verify_parts.py          # SHA-256 + file size (fast, authoritative)
    python3 scripts/verify_parts.py --rows    # also decompress and count data rows
    python3 scripts/verify_parts.py --v2      # check the corrected v2 export instead

Exit code 0 = all parts pass, 1 = at least one mismatch.
"""
import argparse
import gzip
import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATASETS = {
    "v1": ("orogen_regions_full", "orogen_regions_full_csv_parts_manifest.md"),
    "v2": ("orogen_regions_full_v2", "orogen_regions_full_v2_manifest.md"),
}

# Manifest row: | 00 | `file.csv.gz` | 200,000 | 0 | 199999 | .. | .. | 31,627,636 | `sha` |
ROW_RE = re.compile(
    r"^\|\s*\d+\s*\|\s*`([^`]+\.csv\.gz)`\s*\|\s*([\d,]+)\s*\|"  # file, rows
    r"[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d,]+)\s*\|\s*`([0-9a-f]{64})`\s*\|"  # size, sha
)


def parse_manifest(manifest):
    parts = []
    for line in manifest.read_text().splitlines():
        m = ROW_RE.match(line.strip())
        if m:
            parts.append({
                "file": m.group(1),
                "rows": int(m.group(2).replace(",", "")),
                "size": int(m.group(3).replace(",", "")),
                "sha256": m.group(4),
            })
    return parts


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def count_data_rows(path):
    with gzip.open(path, "rt", newline="") as f:
        return sum(1 for _ in f) - 1  # minus the header row


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rows", action="store_true",
                    help="also decompress each part and verify the data-row count")
    ap.add_argument("--v2", action="store_true",
                    help="verify the corrected v2 export (data/orogen_regions_full_v2/)")
    args = ap.parse_args()

    dir_name, manifest_name = DATASETS["v2" if args.v2 else "v1"]
    data_dir = REPO_ROOT / "data" / dir_name
    manifest = data_dir / manifest_name

    parts = parse_manifest(manifest)
    if not parts:
        print(f"ERROR: no parts parsed from {manifest}", file=sys.stderr)
        return 2

    print(f"Verifying {len(parts)} parts against {manifest.name}\n")
    header = f"{'part':<40} {'size':>6} {'sha256':>8}" + ("  rows" if args.rows else "")
    print(header)
    print("-" * len(header))

    ok = True
    for p in parts:
        path = data_dir / p["file"]
        if not path.exists():
            print(f"{p['file']:<40} MISSING")
            ok = False
            continue
        size_ok = path.stat().st_size == p["size"]
        sha_ok = sha256_of(path) == p["sha256"]
        line = f"{p['file']:<40} {'PASS' if size_ok else 'FAIL':>6} {'PASS' if sha_ok else 'FAIL':>8}"
        part_ok = size_ok and sha_ok
        if args.rows:
            rows_ok = count_data_rows(path) == p["rows"]
            line += f"  {'PASS' if rows_ok else 'FAIL'}"
            part_ok = part_ok and rows_ok
        print(line)
        ok = ok and part_ok

    total_rows = sum(p["rows"] for p in parts)
    print(f"\nTotal data rows in manifest: {total_rows:,}")
    print("RESULT:", "ALL PASS" if ok else "FAILURES DETECTED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
