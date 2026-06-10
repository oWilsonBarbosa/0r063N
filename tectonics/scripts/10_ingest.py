"""Load the tectonic column subset from all 13 parts into out/cache/columns.npz,
and run basic sanity checks (row count, plate counts, mesh density vs latitude)."""

import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io

t0 = time.time()
cols = data_io.load_columns()
print(f"loaded {len(cols['lat']):,} rows x {len(cols)} cols in {time.time() - t0:.1f}s")

plates = np.unique(cols["plate"])
supers = np.unique(cols["superPlate"])
print(f"distinct plates: {len(plates)}  distinct super-plates: {len(supers)}")
land = int(cols["isLand"].sum())
print(f"land cells: {land:,} ({100 * land / len(cols['isLand']):.2f}%)")

# Mesh density vs latitude: if cells are uniform on the sphere, counts per
# latitude band should be proportional to the band's true area (~cos lat).
lat = cols["lat"]
bands = np.arange(-90, 91, 5)
counts, _ = np.histogram(lat, bins=bands)
mid = np.radians((bands[:-1] + bands[1:]) / 2)
expected = np.cos(mid)
expected = expected / expected.sum() * counts.sum()
ratio = counts / np.maximum(expected, 1)
print(f"cells-per-band / cos-lat ratio: min {ratio.min():.3f} max {ratio.max():.3f}")
if ratio.min() > 0.9 and ratio.max() < 1.1:
    print("mesh is uniform-on-sphere: cell counts are a valid area proxy")
else:
    print("WARNING: mesh density varies with latitude; use cos-lat weighting for areas")
