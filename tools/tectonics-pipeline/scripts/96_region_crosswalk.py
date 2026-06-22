"""Region <-> continent crosswalk: bridge the two partitions of the planet.

Two pipelines cut the same 2.56 M-cell export differently:

* the **regional gazetteers** (`tools/regional-report/`, `reports/regional/`) cut
  the globe into the 20 triangular faces of an icosahedron (regions 01-20);
* the **continent analyses** (`docs/CONTINENTS.md`, `docs/BIOGEOGRAPHY.md`) group
  land into the four connected landmasses Meridia / Sirocca / Selvana / Borea,
  plus an `Islands` bucket.

This joins them per cell: a cell's region is its icosahedral face (the exact
argmax-dot-product partition from `tools/regional-report/icosahedron.mjs`), and
its continent is the shared connected-landmass assignment (`lib/continents`).
Because the continent side reuses `lib/continents`, the per-continent totals here
match `reports/tectonics/continent_profiles.json` (and `docs/CONTINENTS.md`)
cell-for-cell. The mesh is uniform-on-sphere, so cell counts are an area proxy.

Region *numbering* is bound to the published gazetteers by matching each face to
the centre printed in its `region_NN.md` header (rather than re-deriving the
sort), so region 07 here is region 07 there — robust to the gazetteers' sort
tie-breaking.

Inputs : reports/tectonics/{cache/columns.npz (10_ingest), cache/rasters.npz
         (15_rasterize), continent_profiles.json (95)};
         reports/regional/regions/region_NN.md (the gazetteers; run
         `node tools/regional-report/main.mjs` first)
Outputs: reports/tectonics/region_continent_crosswalk.json
         reports/tectonics/region_continent_crosswalk.csv
         docs/REGION_CROSSWALK.md
"""
import csv
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import continents, data_io

EARTH_R_KM = 6371.0
CONTS = ["Meridia", "Sirocca", "Selvana", "Borea", continents.ISLANDS]  # table column order
_HDR = re.compile(r"centered at (([\d.]+)°([NS])\s+([\d.]+)°([EW]))")


# ---- icosahedral faces (geometry from tools/regional-report/icosahedron.mjs) -
def _from_lat_lon(lat_deg, lon_deg):
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    return np.array([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)])


def build_faces():
    """20 face-centre unit vectors and their (lat, lon), in raw construction order."""
    ring = np.degrees(np.arctan(0.5))  # ~26.565 deg
    verts = [_from_lat_lon(90.0, 0.0)]
    verts += [_from_lat_lon(ring, 72.0 * i) for i in range(5)]          # 1..5 upper ring
    verts += [_from_lat_lon(-ring, 72.0 * i + 36.0) for i in range(5)]  # 6..10 lower ring
    verts.append(_from_lat_lon(-90.0, 0.0))                            # 11 south pole

    U = lambda i: 1 + (i % 5)
    L = lambda i: 6 + (i % 5)
    tris = ([[0, U(i), U(i + 1)] for i in range(5)] +        # north cap
            [[U(i), L(i), U(i + 1)] for i in range(5)] +     # upper equatorial
            [[L(i), L(i + 1), U(i + 1)] for i in range(5)] +  # lower equatorial
            [[11, L(i + 1), L(i)] for i in range(5)])        # south cap

    centers, lats, lons = [], [], []
    for tri in tris:
        c = verts[tri[0]] + verts[tri[1]] + verts[tri[2]]
        c = c / np.linalg.norm(c)
        centers.append(c)
        lats.append(np.degrees(np.arcsin(c[1])))
        lons.append(np.degrees(np.arctan2(c[0], c[2])))
    return np.array(centers), np.array(lats), np.array(lons)


def gazetteer_centers(regions_dir):
    """Authoritative region numbering: {region0: (lat, lon, raw_str)} from headers."""
    out = {}
    for r in range(20):
        p = regions_dir / f"region_{r + 1:02d}.md"
        if not p.exists():
            raise FileNotFoundError(
                f"{p} not found — run `node tools/regional-report/main.mjs` first")
        m = _HDR.search(p.read_text())
        if not m:
            raise ValueError(f"could not parse a face centre from {p}")
        lat = float(m.group(2)) * (1 if m.group(3) == "N" else -1)
        lon = float(m.group(4)) * (1 if m.group(5) == "E" else -1)
        out[r] = (lat, lon, m.group(1))
    return out


def _ang_dist_deg(la1, lo1, la2, lo2):
    a, b, c, d = map(np.radians, (la1, lo1, la2, lo2))
    cosd = np.sin(a) * np.sin(c) + np.cos(a) * np.cos(c) * np.cos(b - d)
    return np.degrees(np.arccos(np.clip(cosd, -1.0, 1.0)))


def bind_faces_to_regions(face_lat, face_lon, gaz):
    """Map each face index -> region index (0..19) by nearest published centre."""
    face2region = np.full(20, -1, dtype=np.int64)
    used, max_resid = set(), 0.0
    for r, (glat, glon, _) in gaz.items():
        dists = [_ang_dist_deg(glat, glon, face_lat[f], face_lon[f]) for f in range(20)]
        f = int(np.argmin(dists))
        assert f not in used, f"two regions matched face {f} — centre matching ambiguous"
        used.add(f)
        face2region[f] = r
        max_resid = max(max_resid, float(dists[f]))
    assert (face2region >= 0).all(), "some face matched no region"
    assert max_resid < 0.5, f"face/region centre residual {max_resid:.3f}° too large"
    return face2region


def assign_faces(x, y, z, centers):
    """Face index 0..19 per cell: argmax dot(face_centre, cell) (exact partition)."""
    xyz = np.stack([x, y, z], axis=1).astype(np.float64)
    return np.argmax(xyz @ centers.T, axis=1).astype(np.int64)


# ---- formatting helpers ------------------------------------------------------
def rlink(r0):  # region link to the gazetteer (doc lives in docs/)
    nn = f"{r0 + 1:02d}"
    return f"[{nn}](../reports/regional/regions/region_{nn}.md)"


# ---- build -------------------------------------------------------------------
def main():
    centers, face_lat, face_lon = build_faces()
    gaz = gazetteer_centers(data_io.REPO_ROOT / "reports" / "regional" / "regions")
    face2region = bind_faces_to_regions(face_lat, face_lon, gaz)

    cols = data_io.load_columns(["lat", "lon", "x", "y", "z", "isLand"])
    region_all = face2region[assign_faces(cols["x"], cols["y"], cols["z"], centers)]

    land = np.flatnonzero(cols["isLand"] == 1)
    region_land = region_all[land]
    cont_land, _ = continents.assign(cols["lat"][land], cols["lon"][land])

    n_total = len(region_all)
    cell_area_km2 = 4.0 * np.pi * EARTH_R_KM ** 2 / n_total

    # region x continent count matrix (rows 0..19, cols CONTS)
    col_idx = np.full(len(cont_land), -1, dtype=np.int64)
    for j, c in enumerate(CONTS):
        col_idx[cont_land == c] = j
    assert (col_idx >= 0).all(), "a land cell fell outside every continent/Islands bucket"
    M = np.zeros((20, len(CONTS)), dtype=np.int64)
    np.add.at(M, (region_land, col_idx), 1)

    total_by_region = np.bincount(region_all, minlength=20)
    land_by_region = M.sum(axis=1)
    cont_totals = {c: int(M[:, j].sum()) for j, c in enumerate(CONTS)}

    # ---- validation ----------------------------------------------------------
    prof = json.load(open(data_io.OUT_DIR / "continent_profiles.json"))["continents"]
    for c in ["Meridia", "Sirocca", "Selvana", "Borea"]:
        assert cont_totals[c] == prof[c]["land_cells"], \
            f"{c}: crosswalk {cont_totals[c]} != profiles {prof[c]['land_cells']}"
    assert int(land_by_region.sum()) == len(land), "region land counts do not sum to total land"
    assert int(total_by_region.sum()) == n_total, "region cell counts do not sum to total cells"
    lo, hi = int(total_by_region.min()), int(total_by_region.max())
    assert lo > n_total / 20 * 0.9 and hi < n_total / 20 * 1.1, \
        f"face assignment unbalanced ({lo}..{hi}); expected ~{n_total // 20}"

    # ---- assemble records ----------------------------------------------------
    regions = []
    for r in range(20):
        land_r = int(land_by_region[r])
        split = {c: int(M[r, j]) for j, c in enumerate(CONTS)}
        dom = max(CONTS, key=lambda c: split[c]) if land_r else None
        regions.append({
            "region": r + 1,
            "centre": [gaz[r][0], gaz[r][1]],
            "centre_str": gaz[r][2],
            "total_cells": int(total_by_region[r]),
            "land_cells": land_r,
            "land_pct": round(100.0 * land_r / total_by_region[r], 1),
            "land_area_km2": round(land_r * cell_area_km2),
            "dominant_continent": dom,
            "continent_cells": split,
            "continent_pct_of_region_land": {
                c: (round(100.0 * split[c] / land_r, 1) if land_r else 0.0) for c in CONTS},
        })

    continents_out = {}
    order_by_area = sorted(["Meridia", "Sirocca", "Selvana", "Borea"],
                           key=lambda c: -prof[c]["area_Mkm2"])
    for c in order_by_area + [continents.ISLANDS]:
        j = CONTS.index(c)
        tot = cont_totals[c]
        per_region = [{"region": r + 1, "cells": int(M[r, j]),
                       "pct_of_continent": round(100.0 * M[r, j] / tot, 1)}
                      for r in range(20) if M[r, j] > 0]
        per_region.sort(key=lambda d: -d["cells"])
        continents_out[c] = {
            "land_cells": tot,
            "area_Mkm2": (prof[c]["area_Mkm2"] if c in prof
                          else round(tot * cell_area_km2 / 1e6, 2)),
            "n_regions": len(per_region),
            "regions": per_region,
        }

    # ---- write json ----------------------------------------------------------
    out = {
        "method": ("region = icosahedral face (argmax face-centre dot product, "
                   "tools/regional-report/icosahedron.mjs), numbered to match the "
                   "published gazetteers; continent = connected-landmass assignment "
                   "(lib/continents.py). Mesh is uniform-on-sphere, so cell counts "
                   f"are an area proxy (~{cell_area_km2:.1f} km^2/cell)."),
        "n_cells": n_total,
        "n_land_cells": int(len(land)),
        "cell_area_km2": round(float(cell_area_km2), 3),
        "regions": regions,
        "continents": continents_out,
    }
    with open(data_io.OUT_DIR / "region_continent_crosswalk.json", "w") as f:
        json.dump(out, f, indent=1)

    # ---- write tidy csv (one row per region x continent with cells > 0) ------
    with open(data_io.OUT_DIR / "region_continent_crosswalk.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["region", "centre_lat", "centre_lon", "region_total_cells",
                    "region_land_cells", "continent", "cells",
                    "pct_of_region_land", "pct_of_continent_land"])
        for r in range(20):
            for j, c in enumerate(CONTS):
                if M[r, j] == 0:
                    continue
                w.writerow([r + 1, gaz[r][0], gaz[r][1],
                            int(total_by_region[r]), int(land_by_region[r]), c, int(M[r, j]),
                            round(100.0 * M[r, j] / land_by_region[r], 1),
                            round(100.0 * M[r, j] / cont_totals[c], 1)])

    # ---- write docs/REGION_CROSSWALK.md --------------------------------------
    write_doc(regions, continents_out, out, order_by_area)

    # ---- console summary -----------------------------------------------------
    print("region -> continent crosswalk:")
    print(f"  {n_total:,} cells, {len(land):,} land; faces {lo:,}..{hi:,} cells "
          f"(~{n_total // 20:,} expected)")
    print("  region numbering bound to gazetteers; continent totals match "
          "continent_profiles.json: OK")
    for c in order_by_area:
        regs = continents_out[c]["regions"]
        top = " ".join(f"{d['region']:02d}({d['pct_of_continent']:.0f}%)" for d in regs[:4])
        print(f"  {c:8} {continents_out[c]['land_cells']:>7,} cells across "
              f"{continents_out[c]['n_regions']:2d} regions; top: {top}")


def write_doc(regions, continents_out, out, order_by_area):
    L = [
        "# Regions ↔ Continents",
        "",
        "Two independent partitions of the same planet, joined cell-for-cell.",
        "",
        "- The **regional gazetteers** ([`reports/regional/`](../reports/regional/README.md)) "
        "cut the globe into the **20 triangular faces of an icosahedron** "
        "(regions 01–20, each ≈25.5 Mkm²): regions 01–05 ring the north pole, "
        "06–15 span the equatorial belt, 16–20 ring the south pole.",
        "- The **continent analyses** ([`CONTINENTS.md`](CONTINENTS.md), "
        "[`BIOGEOGRAPHY.md`](BIOGEOGRAPHY.md)) group land into the four connected "
        "landmasses **Meridia, Sirocca, Selvana, Borea**, plus an `Islands` bucket "
        "of detached land.",
        "",
        "Every land cell has both a region (its icosahedral face) and a continent "
        "(its connected landmass), so the two frames join exactly. The continent "
        "totals below match [`CONTINENTS.md`](CONTINENTS.md) cell-for-cell; the mesh "
        "is uniform-on-sphere, so cell counts are an area proxy "
        f"(≈{out['cell_area_km2']:.0f} km²/cell).",
        "",
        "## Each region → its continents",
        "",
        "For every face: centre, land share (of the whole face), and how that land "
        "splits across the continents. The **dominant** continent is bold; "
        "percentages are of the region's *land*.",
        "",
        "| Region | Centre | Land share | Meridia | Sirocca | Selvana | Borea | Islands |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for rec in regions:
        pct = rec["continent_pct_of_region_land"]
        dom = rec["dominant_continent"]
        cells = []
        for c in CONTS:
            v = pct[c]
            s = "–" if rec["continent_cells"][c] == 0 else f"{v:.1f}"
            if c == dom and rec["land_cells"] > 0:
                s = f"**{s}**"
            cells.append(s)
        L.append(f"| {rlink(rec['region'] - 1)} | {rec['centre_str']} | {rec['land_pct']:.1f} % "
                 f"| {cells[0]} | {cells[1]} | {cells[2]} | {cells[3]} | {cells[4]} |")

    L += [
        "",
        "## Each continent → its regions",
        "",
        "Which gazetteers to open for each continent, with the share of the "
        "continent's land each face holds (descending). Faces holding < 1 % are "
        "folded into “+ n more”.",
        "",
        "| Continent | Area (Mkm²) | Land cells | Gazetteers (share of continent land) |",
        "|---|---:|---:|---|",
    ]
    for c in order_by_area:
        info = continents_out[c]
        big = [d for d in info["regions"] if d["pct_of_continent"] >= 1.0]
        small = info["n_regions"] - len(big)
        span = " · ".join(f"{rlink(d['region'] - 1)} {d['pct_of_continent']:.0f} %" for d in big)
        if small:
            span += f" · + {small} more"
        L.append(f"| **{c}** | {info['area_Mkm2']} | {info['land_cells']:,} | {span} |")

    def regs_for(c, thr=5.0):
        return " · ".join(f"{rlink(d['region'] - 1)} ({d['pct_of_continent']:.0f} %)"
                          for d in continents_out[c]["regions"] if d["pct_of_continent"] >= thr)

    ocean = ", ".join(rlink(rec["region"] - 1) for rec in regions if rec["land_pct"] < 1.0)
    L += [
        "",
        "## The Western Lands, located",
        "",
        f"For the [Western Lands deep dive](WESTERN_LANDS.md): **Meridia**'s land sits "
        f"mainly in {regs_for('Meridia')}; **Selvana**'s in {regs_for('Selvana')} "
        "(shares of each continent's land). The near-landless **open-ocean faces** "
        f"above — {ocean} — carry the basins around them, including the Western Ocean "
        "that rifted the two apart; the deep dive ties that ocean to its tectonic "
        "stage. This crosswalk is what lets that chapter send a reader from a "
        "continent straight to the gazetteers that map it.",
        "",
        "---",
        "",
        "Generated by `tools/tectonics-pipeline/scripts/96_region_crosswalk.py` "
        "(data: `reports/tectonics/region_continent_crosswalk.{json,csv}`). Region "
        "definition: `tools/regional-report/icosahedron.mjs`; continent definition: "
        "`tools/tectonics-pipeline/lib/continents.py`.",
        "",
    ]
    (data_io.REPO_ROOT / "docs" / "REGION_CROSSWALK.md").write_text("\n".join(L))


if __name__ == "__main__":
    main()
