"""Render the paleoclimate figures:
  maps/climate/koppen_T###.png            - 16 per-stage Koppen maps
  maps/climate/koppen_present_model_vs_truth.png
  maps/climate/climate_curve.png          - 750-Myr forcing/temperature/ice curve
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from lib import data_io, history_schema, mapstyle, paleoclimate_schema, raster

OUT = data_io.MAPS_DIR / "climate"
OUT.mkdir(parents=True, exist_ok=True)

hist = history_schema.load(data_io.HISTORY_DIR / "history.yaml")
pc = paleoclimate_schema.load(data_io.HISTORY_DIR / "paleoclimate.yaml", history=hist)
with open(data_io.OUT_DIR / "climate_summary.json") as f:
    summary = json.load(f)
grids = dict(np.load(data_io.CACHE_DIR / "climate_stages.npz").items())

# ---------- per-stage Koppen maps ----------
for stage in pc["stages"]:
    t = stage["t"]
    kop = grids[f"koppen_{abs(t)}"]
    sea_ice = grids[f"seaice_{abs(t)}"]
    rgb = mapstyle.koppen_rgb(kop)
    rgb[sea_ice] = [0.92, 0.95, 1.0]
    era = paleoclimate_schema.era_of(pc, t)
    fig, ax = plt.subplots(figsize=(13, 7.2))
    ax.imshow(rgb, extent=[-180, 180, -90, 90], aspect="auto")
    ax.set_xticks(range(-180, 181, 60))
    ax.set_yticks(range(-90, 91, 30))
    ax.grid(color="black", alpha=0.12, linewidth=0.5)
    st = next(s for s in summary["stages"] if s["t"] == t)
    tag = f"T{t}" if t < 0 else "T-0 (present)"
    ax.set_title(f"Koppen climate, stage {tag} Myr — era: {era['name']} | "
                 f"dT {stage['dT_global']:+.1f} C, mean {st['global_mean_C']:.1f} C, "
                 f"land ice {100 * st['ice_land_frac']:.0f}%")
    handles = mapstyle.koppen_legend_handles(np.unique(kop))
    ax.legend(handles=handles, loc="lower left", fontsize=6, ncol=4, framealpha=0.9)
    fig.tight_layout()
    fig.savefig(OUT / f"koppen_T{abs(t):03d}.png", dpi=110, facecolor="white")
    plt.close(fig)
    print(f"wrote koppen_T{abs(t):03d}.png")

# ---------- model vs truth at present ----------
cols = data_io.load_columns(["lat", "lon", "isLand", "koppen"])
truth_grid = raster.fill_gaps_categorical(
    raster.rasterize_mode(cols["lat"], cols["lon"], cols["koppen"].astype(int),
                          w=800, h=400))
truth_grid[truth_grid < 0] = 0
fig, axes = plt.subplots(2, 1, figsize=(12, 12))
for ax, grid, label in ((axes[0], grids["koppen_0"], "zonal model (T-0)"),
                        (axes[1], truth_grid, "generator ground truth")):
    ax.imshow(mapstyle.koppen_rgb(grid), extent=[-180, 180, -90, 90], aspect="auto")
    ax.set_title(label)
    ax.set_xticks(range(-180, 181, 60))
    ax.set_yticks(range(-90, 91, 30))
fig.suptitle("Present-day Koppen: simplified zonal model vs generator", fontsize=14)
fig.tight_layout()
fig.savefig(OUT / "koppen_present_model_vs_truth.png", dpi=110, facecolor="white")
plt.close(fig)
print("wrote koppen_present_model_vs_truth.png")

# ---------- climate curve ----------
ts = [s["t"] for s in summary["stages"]]
meanT = [s["global_mean_C"] for s in summary["stages"]]
ice = [100 * s["ice_land_frac"] for s in summary["stages"]]
dTs = [s["dT_global"] for s in summary["stages"]]

fig, ax = plt.subplots(figsize=(14, 7))
era_colors = plt.get_cmap("Pastel2")
for i, era in enumerate(pc["eras"]):
    ax.axvspan(era["span"][0], era["span"][1], color=era_colors(i % 8), alpha=0.5)
    ax.text((era["span"][0] + era["span"][1]) / 2, ax.get_ylim()[1], era["name"],
            ha="center", va="bottom", fontsize=8, rotation=0, clip_on=False)
ax.plot(ts, meanT, "-o", color="#c0392b", lw=2.5, label="global mean temperature (modeled)")
ax.plot(ts, dTs, "--s", color="#7f8c8d", lw=1.2, ms=4, label="authored forcing dT")
anchor = summary["anchor_t0"]["global_mean_C"]
ax.plot([0], [anchor], "*", ms=18, color="#2c3e50", zorder=5,
        label=f"present-day anchor from data ({anchor:.1f} C)")
ax2 = ax.twinx()
ax2.fill_between(ts, ice, color="#5dade2", alpha=0.35)
ax2.plot(ts, ice, "-", color="#2e86c1", lw=1.5, label="land under ice (EF+ET, %)")
ax2.set_ylabel("land under ice / tundra (%)", color="#2e86c1")
ax2.set_ylim(0, max(ice) * 2.5)

# event annotations from the tectonic history
for s in hist["stages"]:
    for e in s.get("events", []):
        if e["type"] == "LIP":
            ax.plot([s["t"]], [ax.get_ylim()[0] + 1], "^", color="#8b0000", ms=9, clip_on=False)
        elif e["type"] == "orogeny" and e.get("class") in ("himalayan", "laramide", "ural"):
            ax.plot([s["t"]], [ax.get_ylim()[0] + 1], "*", color="#b8860b", ms=10, clip_on=False)
meta_h = hist["meta"]
for x, lbl in ((meta_h["assembled"], "S1 assembled"), (meta_h["breakup"], "breakup")):
    ax.axvline(x, color="black", ls=":", lw=1)
    ax.text(x, ax.get_ylim()[0] + 0.5, f" {lbl}", fontsize=8, rotation=90, va="bottom")
ax.plot([], [], "^", color="#8b0000", label="LIP")
ax.plot([], [], "*", color="#b8860b", label="major orogeny")
ax.set_xlabel("time (Myr before present)")
ax.set_ylabel("temperature (C)")
ax.set_title("750 Myr climate history: forcing, global temperature, and ice")
ax.legend(loc="upper right", fontsize=9, framealpha=0.95)
fig.tight_layout()
fig.savefig(OUT / "climate_curve.png", dpi=120, facecolor="white")
plt.close(fig)
print("wrote climate_curve.png")
