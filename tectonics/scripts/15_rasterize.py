"""Bin the region point cloud to 2048x1024 equirectangular rasters -> out/cache/rasters.npz."""

import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import data_io, raster

CONTINUOUS = ["elev", "elev_km", "margins", "tectonic", "stress", "orogPow",
              "backArc", "foldRidge", "hotspot", "interior", "basin", "tecAct"]
CATEGORICAL = ["plate", "superPlate", "isOcPlate", "isLand", "isMountain"]

t0 = time.time()
cols = data_io.load_columns()
lat, lon = cols["lat"], cols["lon"]

grids = {}
for name in CONTINUOUS:
    grids[name] = raster.fill_gaps_mean(raster.rasterize_mean(lat, lon, cols[name]))
    print(f"rasterized {name} ({time.time() - t0:.0f}s)")
for name in CATEGORICAL:
    grids[name] = raster.fill_gaps_categorical(raster.rasterize_mode(lat, lon, cols[name]))
    print(f"rasterized {name} ({time.time() - t0:.0f}s)")

empty = int((grids["plate"] == -1).sum())
nan = int(np.isnan(grids["elev"]).sum())
print(f"unfilled pixels after dilation: categorical={empty} continuous={nan}")

data_io.CACHE_DIR.mkdir(parents=True, exist_ok=True)
np.savez_compressed(data_io.CACHE_DIR / "rasters.npz", **grids)
print(f"wrote rasters.npz in {time.time() - t0:.0f}s total")
