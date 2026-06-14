"""Render the five present-day tectonic maps into maps/present/."""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

from lib import data_io, mapstyle, raster

OUT = data_io.MAPS_DIR / "present"
OUT.mkdir(parents=True, exist_ok=True)

g = data_io.load_rasters()
inv = data_io.load_inventory()
with np.load(data_io.CACHE_DIR / "boundaries.npz") as npz:
    bcls, bmask = npz["cls"], npz["mask"]
land = g["isLand"] == 1
elev = g["elev_km"]
H, Wd = land.shape
lon_ax = np.linspace(-180, 180, Wd)
lat_ax = np.linspace(90, -90, H)

# ---------- (a) elevation ----------
fig, ax = mapstyle.new_map("Present day — elevation (hypsometric)")
ax.imshow(mapstyle.hypsometric_rgb(elev, land), extent=mapstyle.EXTENT, aspect="auto")
mapstyle.save(fig, OUT / "present_elevation.png")

# ---------- (b) plates ----------
fig, ax = mapstyle.new_map("Present day — super-plates, names and inferred motions")
sp = g["superPlate"].astype(float)
cmap = plt.get_cmap("tab20")
ax.imshow(cmap(sp.astype(int) % 20), extent=mapstyle.EXTENT, aspect="auto", alpha=0.85)
mapstyle.coastline_overlay(ax, land)
ax.contour(lon_ax, lat_ax, sp, levels=np.arange(-0.5, 20.5, 1.0),
           colors="black", linewidths=0.8)
for pid, p in inv["plates"].items():
    clat, clon = p["centroid"]
    ax.text(clon, clat, p["name"], fontsize=12, fontweight="bold",
            ha="center", va="center",
            bbox=dict(boxstyle="round,pad=0.2", fc="white", alpha=0.75, ec="none"))
    mo = p["motion"]
    if mo["azimuth_deg"] is not None and mo["confidence"] >= 0.2:
        az = np.radians(mo["azimuth_deg"])
        scale = {"1": 18, "2": 9, "<": 4}[mo["speed_class"][0]]
        ax.annotate("", xy=(clon + scale * np.sin(az), clat + scale * np.cos(az)),
                    xytext=(clon, clat),
                    arrowprops=dict(arrowstyle="-|>", color="crimson", lw=2))
for c, v in inv["cratons"].items():
    ax.text(v["centroid"][1], v["centroid"][0] - 4, f"[{c}]", fontsize=9,
            ha="center", color="black")
mapstyle.save(fig, OUT / "present_plates.png")

# ---------- (c) boundary types ----------
fig, ax = mapstyle.new_map("Present day — plate boundary types")
base = np.where(land, 0.75, 0.92)
ax.imshow(base, extent=mapstyle.EXTENT, aspect="auto", cmap="gray", vmin=0, vmax=1)
mapstyle.coastline_overlay(ax, land)
colors = {1: "#d62728", 2: "#1f77b4", 3: "#2ca02c", 0: "#999999"}
labels = {1: "convergent", 2: "divergent (ridge)", 3: "transform", 0: "indeterminate"}
rows, cols_ = np.nonzero(bmask)
blat = 90.0 - (rows + 0.5) * 180.0 / H
blon = (cols_ + 0.5) * 360.0 / Wd - 180.0
cvals = bcls[rows, cols_]
for code in (0, 2, 3, 1):
    s = cvals == code
    ax.scatter(blon[s], blat[s], s=1.2, c=colors[code], label=labels[code], rasterized=True)
for key, s in json.loads((data_io.OUT_DIR / "boundary_segments.json").read_text())["segments"].items():
    if "overriding" in s and s["boundary_px"] > 150:
        ov = inv["plates"][str(s["overriding"])]["name"]
        sb = inv["plates"][str(s["subducting"])]["name"]
        ax.text(s["mean_lon"], s["mean_lat"], f"{sb}→{ov}", fontsize=7,
                ha="center", color="#7f1d1d")
ax.legend(loc="lower left", markerscale=8, framealpha=0.9)
mapstyle.save(fig, OUT / "present_boundaries.png")

# ---------- (d) tectonic features ----------
fig, ax = mapstyle.new_map("Present day — tectonic features")
ax.imshow(np.where(land, 0.8, 0.95), extent=mapstyle.EXTENT, aspect="auto",
          cmap="gray", vmin=0, vmax=1)
mapstyle.coastline_overlay(ax, land)
orog = np.where(land & (g["orogPow"] > np.nanpercentile(g["orogPow"][land], 85)),
                g["orogPow"], np.nan)
ax.imshow(orog, extent=mapstyle.EXTENT, aspect="auto", cmap="YlOrBr", alpha=0.9)
tr = ~land & (g["tectonic"] <= np.nanpercentile(g["tectonic"][~land], 2))
ax.contourf(lon_ax, lat_ax, tr.astype(float), levels=[0.5, 1.5], colors=["#4b0082"], alpha=0.8)
ba = g["backArc"] <= np.nanpercentile(g["backArc"][g["backArc"] < 0], 25)
ax.contourf(lon_ax, lat_ax, ba.astype(float), levels=[0.5, 1.5], colors=["#00bcd4"], alpha=0.45)
fr = land & (g["foldRidge"] > np.nanpercentile(g["foldRidge"][land], 92))
ax.contourf(lon_ax, lat_ax, fr.astype(float), levels=[0.5, 1.5], colors=["#8b4513"], alpha=0.5)
for i, h_ in enumerate(inv["features"]["hotspots"]):
    clat, clon = h_["centroid"]
    ax.plot(clon, clat, "^", ms=9, mfc="red", mec="black")
    ax.text(clon + 2, clat + 2, f"H{i + 1}", fontsize=8, color="darkred")
for i, o in enumerate(inv["features"]["orogens"]):
    ax.text(o["centroid"][1], o["centroid"][0], f"O{i + 1}", fontsize=10, fontweight="bold",
            ha="center", bbox=dict(boxstyle="round,pad=0.15", fc="yellow", alpha=0.7, ec="none"))
for i, t in enumerate(inv["features"]["trenches"]):
    ax.text(t["centroid"][1], t["centroid"][0], f"T{i + 1}", fontsize=8, color="white",
            ha="center", bbox=dict(boxstyle="round,pad=0.1", fc="#4b0082", alpha=0.8, ec="none"))
handles = [Line2D([], [], color="#c8860a", lw=6, label="orogens (orogPow ≥ p85)"),
           Line2D([], [], color="#4b0082", lw=6, label="trenches"),
           Line2D([], [], color="#00bcd4", lw=6, label="back-arc basins"),
           Line2D([], [], color="#8b4513", lw=6, label="fold ridges"),
           Line2D([], [], marker="^", color="none", mfc="red", mec="black", ms=9,
                  label="hotspots")]
ax.legend(handles=handles, loc="lower left", framealpha=0.9)
mapstyle.save(fig, OUT / "present_features.png")

# ---------- (e) margins ----------
fig, ax = mapstyle.new_map("Present day — coastline margin character")
ax.imshow(np.where(land, 0.8, 0.95), extent=mapstyle.EXTENT, aspect="auto",
          cmap="gray", vmin=0, vmax=1)
coast_mask = np.zeros_like(land)
for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    coast_mask |= land & ~raster._shift(land, dr, dc)
m_s = raster.neighborhood_mean(g["margins"], radius=3)
rows, cols_ = np.nonzero(coast_mask)
clat = 90.0 - (rows + 0.5) * 180.0 / H
clon = (cols_ + 0.5) * 360.0 / Wd - 180.0
mval = m_s[rows, cols_]
active = mval >= 0.5
ax.scatter(clon[active], clat[active], s=1.5, c="#d62728", label="active margin", rasterized=True)
ax.scatter(clon[~active], clat[~active], s=1.5, c="#1f77b4", label="passive margin", rasterized=True)
shelf = ~land & (elev > -0.5)
ax.contourf(lon_ax, lat_ax, shelf.astype(float), levels=[0.5, 1.5], colors=["#9fc5e8"], alpha=0.5)
ax.legend(loc="lower left", markerscale=8, framealpha=0.9)
mapstyle.save(fig, OUT / "present_margins.png")

frac_active = float(active.mean())
print(f"coastline active fraction: {frac_active:.2f}")
