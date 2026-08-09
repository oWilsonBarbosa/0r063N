#!/usr/bin/env python3
"""Rebuild (or verify) the v3 triangle centroid file from data already in the repo.

`orogen_triangles_xyz_elev.f32.gz` is ~72 MB — the single largest file in the
repository, and past GitHub's 50 MB advisory. It is also entirely DERIVED:

    xyz[t]  = centroid of the three corner regions' unit vectors
    elev[t] = mean of the three corner regions' elevations

Both come from `orogen_mesh_triangles.Int32Array.gz` (the Delaunay index: three
region ids per triangle) plus the `x`,`y`,`z`,`elev` columns of the region parts.
So the file carries no information the repo does not already hold — it is a cache.

    python3 scripts/rebuild_triangle_centroids.py --verify   # prove it reconstructs
    python3 scripts/rebuild_triangle_centroids.py            # write it out

`--verify` is the important one: run it BEFORE deleting the committed copy. It
reports the max absolute error against the real file and, because the metadata's
wording ("unnormalised arithmetic centroid") is ambiguous between the sum and the
mean of the corner vectors, it tests BOTH and tells you which the generator used.

Requires numpy (already a dependency of tools/tectonics-pipeline).
"""
import argparse
import gzip
import sys
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA = REPO_ROOT / "data" / "orogen_regions_v3_browser"
TRI_IDX = DATA / "orogen_mesh_triangles.Int32Array.gz"
TARGET = DATA / "orogen_triangles_xyz_elev.f32.gz"


def load_region_fields():
    """x, y, z, elev per region id, read from the 13 v3 parts."""
    parts = sorted(DATA.glob("orogen_regions_part_*.csv.gz"))
    if not parts:
        sys.exit(f"ERROR: no region parts in {DATA}")

    chunks = []
    total = 0
    for p in parts:
        with gzip.open(p, "rt", newline="", encoding="utf-8") as f:
            header = next(f).rstrip("\n").rstrip("\r").split(",")
            try:
                ix, iy, iz = header.index("x"), header.index("y"), header.index("z")
                ie, iid = header.index("elev"), header.index("id")
            except ValueError as e:
                sys.exit(f"ERROR: {p.name} missing a required column: {e}")
            want = (iid, ix, iy, iz, ie)
            rows = []
            for line in f:
                if not line.strip():
                    continue
                c = line.rstrip("\n").rstrip("\r").split(",")
                rows.append([float(c[i]) for i in want])
        arr = np.asarray(rows, dtype=np.float64)
        chunks.append(arr)
        total += len(arr)
        print(f"  read {p.name}: {len(arr):,} rows")

    allrows = np.concatenate(chunks, axis=0)
    ids = allrows[:, 0].astype(np.int64)
    n = int(ids.max()) + 1
    xyz = np.zeros((n, 3), dtype=np.float64)
    elev = np.zeros(n, dtype=np.float64)
    xyz[ids] = allrows[:, 1:4]
    elev[ids] = allrows[:, 4]
    print(f"  regions indexed: {n:,} (from {total:,} rows)")
    return xyz, elev


def load_triangle_index():
    with gzip.open(TRI_IDX, "rb") as f:
        raw = f.read()
    tri = np.frombuffer(raw, dtype="<i4")
    if tri.size % 3:
        sys.exit(f"ERROR: {TRI_IDX.name} length {tri.size} is not a multiple of 3")
    tri = tri.reshape(-1, 3)
    print(f"  triangles: {len(tri):,}")
    return tri


def build(xyz, elev, tri, use_mean):
    a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
    s = xyz[a] + xyz[b] + xyz[c]
    e = (elev[a] + elev[b] + elev[c]) / 3.0
    if use_mean:
        s = s / 3.0
    out = np.empty((len(tri), 4), dtype=np.float32)
    out[:, 0:3] = s
    out[:, 3] = e
    return out


def read_target():
    with gzip.open(TARGET, "rb") as f:
        raw = f.read()
    arr = np.frombuffer(raw, dtype="<f4")
    if arr.size % 4:
        sys.exit(f"ERROR: {TARGET.name} length {arr.size} is not a multiple of 4")
    return arr.reshape(-1, 4)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--verify", action="store_true",
                    help="compare the reconstruction against the committed file")
    ap.add_argument("--out", type=Path, help="destination (default: the canonical path)")
    args = ap.parse_args()

    if not TRI_IDX.exists():
        sys.exit(f"ERROR: {TRI_IDX} not found — the Delaunay index is required "
                 "and is NOT derivable; keep it.")

    print("Loading region fields …")
    xyz, elev = load_region_fields()
    print("Loading triangle index …")
    tri = load_triangle_index()

    if args.verify:
        if not TARGET.exists():
            sys.exit(f"ERROR: nothing to verify against — {TARGET.name} is absent.")
        want = read_target()
        if len(want) != len(tri):
            sys.exit(f"ERROR: file has {len(want):,} triangles, index has {len(tri):,}")

        print("\nTesting both readings of 'unnormalised arithmetic centroid':\n")
        best = None
        for use_mean, label in ((True, "mean  (v0+v1+v2)/3"), (False, "sum   v0+v1+v2")):
            got = build(xyz, elev, tri, use_mean)
            dxyz = float(np.abs(got[:, 0:3] - want[:, 0:3]).max())
            delev = float(np.abs(got[:, 3] - want[:, 3]).max())
            print(f"  {label}:  max|dxyz| = {dxyz:.3e}   max|delev| = {delev:.3e}")
            if best is None or dxyz < best[1]:
                best = (label, dxyz, delev, use_mean)

        label, dxyz, delev, _ = best
        # float32 carries ~7 significant digits; components are O(1).
        exact = dxyz < 1e-6 and delev < 1e-6
        print(f"\n  best match: {label}")
        if exact:
            print("  RESULT: RECONSTRUCTION IS EXACT (within float32 precision).")
            print(f"  -> {TARGET.name} is a pure cache and can be removed safely;")
            print("     rebuild it any time by re-running this script without --verify.")
            return 0
        print("  RESULT: NOT exact — do NOT delete the committed file.")
        print("     The generator applied something this script does not reproduce.")
        return 1

    out_path = args.out or TARGET
    print("\nBuilding …")
    got = build(xyz, elev, tri, use_mean=True)
    with gzip.open(out_path, "wb", compresslevel=6) as f:
        f.write(got.astype("<f4").tobytes())
    print(f"Wrote {out_path}  ({out_path.stat().st_size/1048576:.1f} MB, "
          f"{len(got):,} triangles)")
    print("NOTE: built with the MEAN reading. Run --verify against a known-good "
          "copy first if you have not already confirmed which reading applies.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
