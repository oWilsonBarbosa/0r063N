"""Shared per-land-cell continent membership.

A land cell belongs to one of the four major continents if it sits on that
continent's connected landmass; detached islands and microcontinents fall in the
`Islands` bucket. Both the per-continent profiles (95) and the biogeography (97)
use this so their continent cell counts and areas agree exactly.
"""
import numpy as np

from lib import data_io, raster

ISLANDS = "Islands"


def assign(lat_deg, lon_deg):
    """Continent name for each (lat, lon) in degrees.

    Returns (names, name_to_cratons) where names is an object array aligned to the
    inputs and name_to_cratons maps each continent name (and 'Islands') to a
    centre-dotted craton string.
    """
    inv = data_io.load_inventory()
    land_ras = data_io.load_rasters()["isLand"] == 1
    labels, _ = raster.connected_components(land_ras)

    label2name = {}
    name2cratons = {ISLANDS: "—"}
    for key, c in inv["continents"].items():
        nm = c.get("name", key)
        r, col = raster.pixel_indices(np.array([c["centroid"][0]]), np.array([c["centroid"][1]]))
        lab = int(labels[r[0], col[0]])
        if lab == 0:  # centroid fell on an ocean pixel: take the nearest land label
            rr, cc = np.nonzero(labels > 0)
            j = int(np.argmin((rr - r[0]) ** 2 + (cc - col[0]) ** 2))
            lab = int(labels[rr[j], cc[j]])
        label2name[lab] = nm
        name2cratons[nm] = "·".join(c["cratons"])

    rr, cc = raster.pixel_indices(np.asarray(lat_deg), np.asarray(lon_deg))
    names = np.array([label2name.get(int(l), ISLANDS) for l in labels[rr, cc]], dtype=object)
    return names, name2cratons
