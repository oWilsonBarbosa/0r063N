"""Per-continent clipped maps: each major continent centred and isolated.

The global atlas and the per-face gazetteer maps never show a single continent on
its own. This renders, for each of Meridia / Sirocca / Selvana / Borea, an
orthographic view centred on the continent's centroid (so it sits unwrapped and
undistorted, even when it straddles the antimeridian), with the continent drawn
in full colour against a muted ocean and muted other-land. Three layers per
continent: relief, Köppen climate, and native habitat (the biogeography macro
classes). Which faces fall in each continent comes from the region crosswalk;
the per-cell continent membership is the shared connected-landmass assignment.

Inputs : reports/tectonics/{cache/columns.npz (10_ingest), cache/rasters.npz
         (15_rasterize), inventory.json, continent_profiles.json}
Outputs: reports/tectonics/maps/continents/{Meridia,Sirocca,Selvana,Borea}.png
         reports/tectonics/maps/continents/continents_overview.png
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
from matplotlib.cm import ScalarMappable
from matplotlib.colors import Normalize

from lib import biogeo, continents, data_io, mapstyle

DEG = np.pi / 180.0
OCEAN_RGB = np.array([0.81, 0.89, 0.95])    # muted background ocean
LAND_RGB = np.array([0.85, 0.85, 0.85])     # muted other-continent land
SIZE = 560                                  # px per panel
SPLAT = 2                                   # half-width of the cell splat
BAND_WORD = {"A": "tropical", "B": "arid", "C": "temperate",
             "D": "continental", "E": "polar"}
OUT = data_io.MAPS_DIR / "continents"


def unit(v):
    return v / np.linalg.norm(v)


def from_lat_lon(lat_deg, lon_deg):
    la, lo = lat_deg * DEG, lon_deg * DEG
    return np.array([np.cos(la) * np.sin(lo), np.sin(la), np.cos(la) * np.cos(lo)])


def project(x, y, z, centroid):
    """Orthographic screen coords (sx, sy) and view depth for centroid-centred view."""
    v0 = unit(from_lat_lon(*centroid))
    east = unit(np.cross([0.0, 1.0, 0.0], v0))
    north = unit(np.cross(v0, east))
    sx = x * east[0] + y * east[1] + z * east[2]
    sy = x * north[0] + y * north[1] + z * north[2]
    depth = x * v0[0] + y * v0[1] + z * v0[2]
    return sx, sy, depth


def splat(sx, sy, depth, rgb, win, size=SIZE, r=SPLAT):
    """Depth-buffered orthographic raster: front-most cell wins each pixel."""
    xlo, xhi, ylo, yhi = win
    sel = (depth > 0) & (sx >= xlo) & (sx <= xhi) & (sy >= ylo) & (sy <= yhi)
    px = ((sx[sel] - xlo) / (xhi - xlo) * (size - 1)).astype(np.int32)
    py = ((yhi - sy[sel]) / (yhi - ylo) * (size - 1)).astype(np.int32)
    d, col = depth[sel], rgb[sel]

    # build all splat offsets, then a single global depth sort so the nearest
    # surface wins regardless of which cell's splat covered the pixel.
    offs = [(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1)]
    PX = np.concatenate([np.clip(px + dx, 0, size - 1) for dx, _ in offs])
    PY = np.concatenate([np.clip(py + dy, 0, size - 1) for _, dy in offs])
    D = np.tile(d, len(offs))
    COL = np.tile(col, (len(offs), 1))
    order = np.argsort(D, kind="stable")
    img = np.ones((size, size, 3))
    img[PY[order], PX[order]] = COL[order]
    return img


def layer_rgb(layer_land, land_idx, target_local, n_cells, ocean_mask):
    """Full-length RGB: target continent in layer colour, else muted land/ocean."""
    rgb = np.empty((n_cells, 3))
    rgb[:] = LAND_RGB
    rgb[ocean_mask] = OCEAN_RGB
    rgb[land_idx[target_local]] = layer_land[target_local]
    return rgb


def render_continent(name, prof, cols, land_idx, cont_local, layers, ocean_mask):
    centroid = prof[name]["centroid"]
    sx, sy, depth = project(cols["x"], cols["y"], cols["z"], centroid)
    target_local = cont_local == name
    target_global = np.zeros(len(sx), bool)
    target_global[land_idx[target_local]] = True

    near = target_global & (depth > 0)
    txs, tys = sx[near], sy[near]
    cx, cy = (txs.min() + txs.max()) / 2, (tys.min() + tys.max()) / 2
    half = max(txs.max() - txs.min(), tys.max() - tys.min()) / 2 * 1.18
    win = (cx - half, cx + half, cy - half, cy + half)

    imgs = {}
    for key, layer_land in layers.items():
        if key.startswith("_"):
            continue
        rgb = layer_rgb(layer_land, land_idx, target_local, len(sx), ocean_mask)
        imgs[key] = splat(sx, sy, depth, rgb, win)

    # ---- figure ----
    p = prof[name]
    band = max(p["koppen_band_pct"], key=p["koppen_band_pct"].get)
    fig, axes = plt.subplots(1, 3, figsize=(15, 5.6))
    fig.suptitle(
        f"{name} — {p['area_Mkm2']} Mkm² · mean elev {p['mean_elev_km']} km · "
        f"{BAND_WORD[band]}-dominant ({p['koppen_band_pct'][band]:.0f}% {band}) · "
        f"NPP {p['mean_npp_g_m2_yr']:.0f} g/m²/yr",
        fontsize=13, fontweight="bold")
    for ax, (key, title) in zip(axes, [("relief", "Relief"),
                                        ("koppen", "Köppen climate"),
                                        ("habitat", "Native habitats")]):
        ax.imshow(imgs[key], origin="upper")
        ax.set_title(title, fontsize=11)
        ax.set_xticks([])
        ax.set_yticks([])

    # relief colourbar (land ramp, 0..6 km)
    sm = ScalarMappable(norm=Normalize(0, 6), cmap=mapstyle.land_cmap)
    cb = fig.colorbar(sm, ax=axes[0], fraction=0.046, pad=0.02)
    cb.set_label("elevation (km)", fontsize=8)
    cb.ax.tick_params(labelsize=7)

    # köppen legend (classes ≥ 1% of the continent)
    k_land = cols["koppen"][land_idx][target_local].astype(int)
    counts = np.bincount(k_land, minlength=31)
    present = [c for c in range(1, 31) if counts[c] >= 0.01 * counts.sum()]
    axes[1].legend(handles=mapstyle.koppen_legend_handles(present),
                   loc="lower left", fontsize=6, framealpha=0.9, ncol=2)

    # habitat legend (macros present)
    macro_land = layers["_macro"][target_local]
    present_m = [m for m in biogeo.MACRO_COLOR if (macro_land == m).any()]
    axes[2].legend(handles=[mpatches.Patch(color=biogeo.MACRO_COLOR[m], label=m)
                            for m in present_m],
                   loc="lower left", fontsize=6, framealpha=0.9, ncol=2)

    fig.tight_layout(rect=[0, 0, 1, 0.96])
    OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT / f"{name}.png", dpi=128, facecolor="white")
    plt.close(fig)
    print(f"wrote {OUT / f'{name}.png'}")
    return imgs["relief"]


def main():
    prof = json.load(open(data_io.OUT_DIR / "continent_profiles.json"))["continents"]
    cols = data_io.load_columns(["lat", "lon", "x", "y", "z", "elev_km", "koppen",
                                 "isLand", "isCoastal", "tS", "tW", "pS", "pW"])
    land_idx = np.flatnonzero(cols["isLand"] == 1)
    ocean_mask = cols["isLand"] != 1

    cont_local, _ = continents.assign(cols["lat"][land_idx], cols["lon"][land_idx])

    # per-land-cell layer colours
    elev_l = cols["elev_km"][land_idx]
    k_l = cols["koppen"][land_idx].astype(int)
    pann_l = (np.maximum(0, cols["pS"][land_idx]) + np.maximum(0, cols["pW"][land_idx])) * 1000.0
    coastal_l = cols["isCoastal"][land_idx] == 1
    terr_l = biogeo.classify_terrain(k_l, elev_l, pann_l, coastal_l)
    macro_l = np.array([biogeo.MACRO_OF[int(t)] for t in terr_l], dtype=object)
    macro_lut = {m: np.array([int(biogeo.MACRO_COLOR[m][i:i + 2], 16) / 255
                              for i in (1, 3, 5)]) for m in biogeo.MACRO_COLOR}

    layers = {
        "relief": mapstyle.land_cmap(np.clip(elev_l / 6.0, 0, 1) ** 0.6)[:, :3],
        "koppen": mapstyle.koppen_rgb(k_l),
        "habitat": np.array([macro_lut[m] for m in macro_l]),
        "_macro": macro_l,
    }

    order = sorted(prof, key=lambda n: -prof[n]["area_Mkm2"])  # Meridia, Sirocca, Selvana, Borea
    reliefs = {}
    for name in order:
        reliefs[name] = render_continent(name, prof, cols, land_idx, cont_local,
                                         layers, ocean_mask)

    # ---- 2x2 relief overview ----
    fig, axes = plt.subplots(2, 2, figsize=(11, 11))
    fig.suptitle("The four continents — relief, each centred and clipped",
                 fontsize=14, fontweight="bold")
    for ax, name in zip(axes.ravel(), order):
        ax.imshow(reliefs[name], origin="upper")
        ax.set_title(f"{name} · {prof[name]['area_Mkm2']} Mkm²", fontsize=11)
        ax.set_xticks([])
        ax.set_yticks([])
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(OUT / "continents_overview.png", dpi=120, facecolor="white")
    plt.close(fig)
    print(f"wrote {OUT / 'continents_overview.png'}")


if __name__ == "__main__":
    main()
