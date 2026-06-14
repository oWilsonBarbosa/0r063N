"""Render the 16 paleogeographic stage maps from history/history.yaml.

Method: the present-day land cells (point cloud) are grouped by block
(craton/microcontinent terranes from 25_inventory) and rigidly rotated to each
stage's paleo-position, then binned to a 1600x800 raster. No polygon topology.
"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

from lib import data_io, history_schema
from lib.spherical import xyz_to_latlon

SW, SH = 1600, 800
OUT = data_io.MAPS_DIR / "stages"
OUT.mkdir(parents=True, exist_ok=True)

hist = history_schema.load(data_io.HISTORY_DIR / "history.yaml")
inv = data_io.load_inventory()
with np.load(data_io.CACHE_DIR / "blocks.npz") as npz:
    cell_block = npz["cell_block"]
    cell_land_idx = npz["cell_land_idx"]
block_names = {int(k): v for k, v in inv["block_names"].items()}

cols = data_io.load_columns(["x", "y", "z"])
pts = np.stack([cols["x"][cell_land_idx], cols["y"][cell_land_idx],
                cols["z"][cell_land_idx]], axis=1).astype(np.float64)
pts /= np.linalg.norm(pts, axis=1, keepdims=True)

block_pts = {}
for bid, name in block_names.items():
    sel = cell_block == bid
    if sel.any() and name in hist["blocks"]:
        block_pts[name] = pts[sel]
missing = [block_names[b] for b in np.unique(cell_block) if block_names[int(b)] not in hist["blocks"]]
if missing:
    print(f"WARNING: blocks without history entries: {missing}")

cmap = plt.get_cmap("tab20")
block_color = {name: cmap(i % 20) for i, name in enumerate(sorted(hist["blocks"]))}

EVENT_STYLE = {
    "orogeny": ("*", "#b8860b", 320),
    "arc_accretion": ("D", "#2e8b57", 120),
    "LIP": ("o", "#8b0000", 260),
    "rift": ("|", "#d62728", 200),
    "failed_rift": ("x", "#d62728", 110),
    "ridge_birth": ("_", "#1f77b4", 200),
    "ridge_death": ("x", "#1f77b4", 110),
    "subduction_init": ("v", "#6a0dad", 130),
    "subduction_jump": ("v", "#9932cc", 130),
    "reversal": ("^", "#6a0dad", 130),
    "triple_junction": ("1", "#d62728", 260),
    "hotspot_track": ("^", "red", 70),
}


def render_stage(stage):
    t = stage["t"]
    grid = np.full((SH, SW), -1, dtype=np.int16)
    ids = {name: i for i, name in enumerate(sorted(hist["blocks"]))}
    for name, p in block_pts.items():
        b = hist["blocks"][name]
        if t < b.get("appears", -1e9):
            continue
        R = history_schema.block_rotation(name, hist["blocks"], t)
        lat, lon = xyz_to_latlon(p @ R.T)
        cc = np.clip(((lon + 180) / 360 * SW).astype(int), 0, SW - 1)
        rr = np.clip(((90 - lat) / 180 * SH).astype(int), 0, SH - 1)
        grid[rr, cc] = ids[name]
    # one dilation pass to close pinholes
    g = grid.copy()
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            nb = np.roll(np.roll(grid, dr, axis=0), dc, axis=1)
            fill = (g == -1) & (nb != -1)
            g[fill] = nb[fill]
    rgb = np.full((SH, SW, 3), [0.82, 0.90, 0.96])
    for name, i in ids.items():
        rgb[g == i] = block_color[name][:3]

    fig, ax = plt.subplots(figsize=(13, 7))
    ax.imshow(rgb, extent=[-180, 180, -90, 90], aspect="auto")
    ax.set_xticks(range(-180, 181, 60))
    ax.set_yticks(range(-90, 91, 30))
    ax.grid(color="white", alpha=0.4, linewidth=0.5)
    for name in block_pts:
        b = hist["blocks"][name]
        if t < b.get("appears", -1e9):
            continue
        qlat, qlon = history_schema.rotated_centroid(name, hist["blocks"], t)
        label = name.replace("micro_", "m")
        ax.text(qlon, qlat, label, fontsize=9 if len(label) == 1 else 7,
                fontweight="bold", ha="center", va="center")
    seen = {}
    for e in stage.get("events", []):
        st = EVENT_STYLE.get(e["type"])
        if not st or "where" not in e:
            continue
        m, c, s = st
        lat0, lon0 = e["where"]
        ax.scatter([lon0], [lat0], marker=m, c=c, s=s, zorder=5,
                   linewidths=2, edgecolors="black" if m in "*oD" else None)
        seen[e["type"]] = st
    handles = [Line2D([], [], marker=m, color="none", markerfacecolor=c,
                      markeredgecolor=c, markersize=10, label=k)
               for k, (m, c, _) in seen.items()]
    if handles:
        ax.legend(handles=handles, loc="lower left", fontsize=8, framealpha=0.9)
    age = f"T{t}" if t < 0 else "T-0 (present)"
    ax.set_title(f"Stage {age} Myr")
    fig.tight_layout()
    name = OUT / f"stage_T{abs(t):03d}.png"
    fig.savefig(name, dpi=110, facecolor="white")
    plt.close(fig)
    print(f"wrote {name}")
    return g


last = None
for stage in hist["stages"]:
    last = render_stage(stage)

# Sanity: stage T-0 must reproduce the present-day land silhouette.
present = np.full((SH, SW), False)
lat, lon = xyz_to_latlon(pts)
cc = np.clip(((lon + 180) / 360 * SW).astype(int), 0, SW - 1)
rr = np.clip(((90 - lat) / 180 * SH).astype(int), 0, SH - 1)
present[rr, cc] = True
g0 = np.full((SH, SW), False)
g0[last != -1] = True
inter = (present & g0).sum()
union = (present | g0).sum()
print(f"T-0 vs present land IoU: {inter / union:.3f} (dilation makes this <1; expect >0.6)")
