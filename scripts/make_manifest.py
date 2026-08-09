#!/usr/bin/env python3
"""Generate a checksummed parts manifest for a dataset.

The v1 and v2 exports ship with a manifest written by whatever produced them.
The v3 browser extract (scripts pasted into the DevTools console at
orogen.studio) does not — it writes `orogen_meta.json` instead. This script
produces a manifest in the SAME table format the other two use, so that
`scripts/verify_parts.py --v3` gives the v3 data the same integrity guarantee
v1 and v2 already have.

    python3 scripts/make_manifest.py --v3     # -> data/orogen_regions_v3_browser/...manifest.md
    python3 scripts/make_manifest.py --v3 --force   # overwrite an existing manifest

It reads every part once (decompressing to count rows and land/coast cells) and
hashes the raw file, so expect a couple of minutes over ~520 MB.

Exit code 0 = manifest written, 1 = a problem (nothing written).
"""
import argparse
import gzip
import hashlib
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# key -> (directory under data/, part stem, manifest filename, human title)
DATASETS = {
    "v1": ("orogen_regions_full", "orogen_regions_full",
           "orogen_regions_full_csv_parts_manifest.md",
           "Orogen regions full — CSV parts manifest"),
    "v2": ("orogen_regions_full_v2", "orogen_regions_full_v2",
           "orogen_regions_full_v2_manifest.md",
           "Orogen regions full v2 — corrected CSV parts manifest"),
    "v3": ("orogen_regions_v3_browser", "orogen_regions",
           "orogen_regions_v3_manifest.md",
           "Orogen regions v3 — browser extract CSV parts manifest"),
}


def sha256_of(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def find_meta(data_dir):
    """planetCode + field count from whichever *meta*.json the export shipped."""
    for p in sorted(data_dir.glob("*meta*.json")):
        try:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            continue
    return {}


def scan_part(path):
    """One pass over a part: header, row count, id range, land/coast counts."""
    rows = first_id = last_id = 0
    land = coast = 0
    have_land = have_coast = False
    with gzip.open(path, "rt", newline="", encoding="utf-8") as f:
        header = next(f).rstrip("\n").rstrip("\r").split(",")
        idx = {name: i for i, name in enumerate(header)}
        i_id = idx.get("id")
        # v3 renamed the tectonic flag and added a true coastline; support both.
        i_land = idx.get("isLand")
        i_coast = idx.get("isSurfaceCoast", idx.get("isCoastal"))
        have_land, have_coast = i_land is not None, i_coast is not None
        for line in f:
            if not line.strip():
                continue
            cells = line.rstrip("\n").rstrip("\r").split(",")
            if rows == 0 and i_id is not None:
                first_id = int(float(cells[i_id]))
            if i_id is not None:
                last_id = int(float(cells[i_id]))
            if have_land and cells[i_land] not in ("", "0"):
                land += 1
            if have_coast and cells[i_coast] not in ("", "0"):
                coast += 1
            rows += 1
    return {
        "header": header, "rows": rows, "first_id": first_id, "last_id": last_id,
        "land": land if have_land else None,
        "coast": coast if have_coast else None,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--v1", action="store_true", help="the original export")
    ap.add_argument("--v2", action="store_true", help="the corrected export")
    ap.add_argument("--v3", action="store_true", help="the browser extract")
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing manifest (refused by default)")
    args = ap.parse_args()

    chosen = [k for k in ("v1", "v2", "v3") if getattr(args, k)]
    if len(chosen) != 1:
        print("ERROR: pass exactly one of --v1 / --v2 / --v3", file=sys.stderr)
        return 1
    key = chosen[0]

    dir_name, part_stem, manifest_name, title = DATASETS[key]
    data_dir = REPO_ROOT / "data" / dir_name
    manifest = data_dir / manifest_name

    if not data_dir.is_dir():
        print(f"ERROR: no such directory: {data_dir}", file=sys.stderr)
        return 1

    # v1/v2 manifests are authoritative committed artifacts — never clobber silently.
    if manifest.exists() and not args.force:
        print(f"ERROR: {manifest.name} already exists; refusing to overwrite.",
              file=sys.stderr)
        print("       pass --force if you really mean to regenerate it.", file=sys.stderr)
        return 1

    parts = sorted(data_dir.glob(f"{part_stem}_part_*.csv.gz"))
    if not parts:
        print(f"ERROR: no {part_stem}_part_*.csv.gz in {data_dir}", file=sys.stderr)
        return 1

    meta = find_meta(data_dir)
    print(f"Scanning {len(parts)} parts in {data_dir.name} …\n")

    rows_out, total_rows, header0 = [], 0, None
    for i, path in enumerate(parts):
        info = scan_part(path)
        if header0 is None:
            header0 = info["header"]
        elif info["header"] != header0:
            print(f"ERROR: header mismatch in {path.name}", file=sys.stderr)
            return 1
        size = path.stat().st_size
        digest = sha256_of(path)
        total_rows += info["rows"]
        rows_out.append(
            f"| {i:02d} | `{path.name}` | {info['rows']} | {info['first_id']} | "
            f"{info['last_id']} | {info['land'] if info['land'] is not None else '—'} | "
            f"{info['coast'] if info['coast'] is not None else '—'} | {size} | `{digest}` |"
        )
        print(f"  {path.name}: {info['rows']:,} rows, {size:,} bytes")

    planet = meta.get("planetCode", "—")
    lines = [
        f"# {title}", "",
        f"Planet: `{planet}`  ",
        f"Rows: **{total_rows:,}**  ",
        f"Fields: **{len(header0)}**  ",
        f"Parts: **{len(parts)}** independent `.csv.gz` files; each contains the full header.",
        "",
        "Generated by `scripts/make_manifest.py`.",
        "",
        "| Part | File | Rows | First id | Last id | Land | Surface coast | Size bytes | SHA-256 |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---|",
        *rows_out,
        "",
        f"Fields ({len(header0)}): `{', '.join(header0)}`",
        "",
    ]
    manifest.write_text("\n".join(lines), encoding="utf-8")

    print(f"\nWrote {manifest}")
    print(f"  parts {len(parts)}   rows {total_rows:,}   fields {len(header0)}")
    print(f"\nVerify with:  python3 scripts/verify_parts.py --{key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
