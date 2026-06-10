"""Shared map styling: hypsometric tints, graticules, annotation helpers."""

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

EXTENT = [-180, 180, -90, 90]

OCEAN_COLORS = ["#0a1e3f", "#123a6b", "#1d5a96", "#3c80b4", "#7fb2d4"]
LAND_COLORS = ["#3d7a47", "#7aa85f", "#c2b280", "#a07a50", "#7a5a44", "#f0f0f0"]

ocean_cmap = LinearSegmentedColormap.from_list("ocean", OCEAN_COLORS)
land_cmap = LinearSegmentedColormap.from_list("land", LAND_COLORS)


def hypsometric_rgb(elev_km, land_mask):
    """RGB image from elevation (km) with separate ocean/land ramps."""
    h, w = elev_km.shape
    rgb = np.zeros((h, w, 3))
    oc = ~land_mask
    od = np.clip(-elev_km / 9.0, 0, 1)
    rgb[oc] = ocean_cmap(1 - od[oc])[:, :3]
    ld = np.clip(elev_km / 6.0, 0, 1) ** 0.6
    rgb[land_mask] = land_cmap(ld[land_mask])[:, :3]
    return rgb


def new_map(title, figsize=(16, 8.6)):
    fig, ax = plt.subplots(figsize=figsize)
    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)
    ax.set_xticks(range(-180, 181, 30))
    ax.set_yticks(range(-90, 91, 30))
    ax.grid(color="white", alpha=0.25, linewidth=0.5)
    ax.set_title(title, fontsize=14)
    ax.set_xlabel("longitude")
    ax.set_ylabel("latitude")
    return fig, ax


def save(fig, path, dpi=128):
    fig.tight_layout()
    fig.savefig(path, dpi=dpi, facecolor="white")
    plt.close(fig)
    print(f"wrote {path}")


def coastline_overlay(ax, land_mask):
    ax.contour(np.linspace(-180, 180, land_mask.shape[1]),
               np.linspace(90, -90, land_mask.shape[0]),
               land_mask.astype(float), levels=[0.5], colors="black", linewidths=0.4)
