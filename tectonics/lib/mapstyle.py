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


# Standard Koppen-Geiger colors keyed by the generator's numeric codes (1..30);
# 0 = ocean.
KOPPEN_COLORS = {
    0: "#d4e6f1",
    1: "#0000fe", 2: "#00777d", 3: "#46a9fa",            # Af Am Aw
    4: "#fe0000", 5: "#fe9695", 6: "#f5a300", 7: "#ffdb63",  # BWh BWk BSh BSk
    8: "#c6ff4e", 9: "#66ff33", 10: "#33c701",           # Cfa Cfb Cfc
    11: "#ffff00", 12: "#c6c700", 13: "#969600",         # Csa Csb Csc
    14: "#96ff96", 15: "#63c764", 16: "#329633",         # Cwa Cwb Cwc
    17: "#00ffff", 18: "#38c7ff", 19: "#007e7d", 20: "#00455e",  # Dfa-Dfd
    21: "#ff00fe", 22: "#c600c7", 23: "#963295", 24: "#966495",  # Dsa-Dsd
    25: "#aabfff", 26: "#5a77db", 27: "#4c51b5", 28: "#320087",  # Dwa-Dwd
    29: "#b2b2b2", 30: "#686868",                        # ET EF
}


def koppen_rgb(codes):
    """RGB image from a grid of Koppen codes (0..30)."""
    lut = np.ones((31, 3))
    for k, hexc in KOPPEN_COLORS.items():
        lut[k] = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return lut[np.clip(codes, 0, 30)]


def koppen_legend_handles(codes_present):
    """Legend patches for the Koppen classes present in a map."""
    import matplotlib.patches as mpatches

    from lib.climate import KOPPEN_CODES

    return [mpatches.Patch(color=KOPPEN_COLORS[c], label=KOPPEN_CODES[c])
            for c in sorted(set(int(c) for c in codes_present) - {0})]


def coastline_overlay(ax, land_mask):
    ax.contour(np.linspace(-180, 180, land_mask.shape[1]),
               np.linspace(90, -90, land_mask.shape[0]),
               land_mask.astype(float), levels=[0.5], colors="black", linewidths=0.4)
