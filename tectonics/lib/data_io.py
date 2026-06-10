"""Streaming loader for the orogen_regions_full csv.gz parts, with an npz cache."""

import json
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data" / "orogen_regions_full"
OUT_DIR = REPO_ROOT / "tectonics" / "out"
CACHE_DIR = OUT_DIR / "cache"
MAPS_DIR = REPO_ROOT / "tectonics" / "maps"
HISTORY_DIR = REPO_ROOT / "tectonics" / "history"

EXPECTED_ROWS = 2_560_001

# Tectonics-relevant column subset (of the 56 exported fields) and dtypes.
TECTONIC_COLUMNS = {
    "lat": np.float32,
    "lon": np.float32,
    "x": np.float32,
    "y": np.float32,
    "z": np.float32,
    "elev": np.float32,
    "elev_km": np.float32,
    "prePost": np.float32,
    "eroD": np.float32,
    "plate": np.int32,
    "isOcPlate": np.int8,
    "superPlate": np.int16,
    "isLand": np.int8,
    "isCoastal": np.int8,
    "isMountain": np.int8,
    "stress": np.float32,
    "orogPow": np.float32,
    "tecAct": np.float32,
    "tectonic": np.float32,
    "interior": np.float32,
    "hotspot": np.float32,
    "margins": np.float32,
    "backArc": np.float32,
    "foldRidge": np.float32,
    "basin": np.float32,
}


def part_paths():
    paths = sorted(DATA_DIR.glob("orogen_regions_full_part_*.csv.gz"))
    if len(paths) != 13:
        raise FileNotFoundError(f"expected 13 csv.gz parts in {DATA_DIR}, found {len(paths)}")
    return paths


def load_meta():
    with open(DATA_DIR / "orogen_meta_full.json") as f:
        return json.load(f)


def load_columns(columns=None, use_cache=True):
    """Return {name: np.ndarray} for the requested columns across all parts.

    Caches the full TECTONIC_COLUMNS set to out/cache/columns.npz on first load.
    """
    columns = list(columns or TECTONIC_COLUMNS)
    cache = CACHE_DIR / "columns.npz"
    if use_cache and cache.exists():
        with np.load(cache) as npz:
            if all(c in npz.files for c in columns):
                return {c: npz[c] for c in columns}

    wanted = dict(TECTONIC_COLUMNS)
    for c in columns:
        if c not in wanted:
            wanted[c] = np.float32
    chunks = []
    for p in part_paths():
        df = pd.read_csv(p, compression="gzip", usecols=list(wanted))
        chunks.append(df.astype(wanted))
    df = pd.concat(chunks, ignore_index=True)
    if len(df) != EXPECTED_ROWS:
        raise ValueError(f"expected {EXPECTED_ROWS} rows, got {len(df)}")
    arrays = {c: df[c].to_numpy() for c in wanted}
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache, **arrays)
    return {c: arrays[c] for c in columns}


def load_rasters():
    cache = CACHE_DIR / "rasters.npz"
    if not cache.exists():
        raise FileNotFoundError("run scripts/15_rasterize.py first")
    with np.load(cache) as npz:
        return {k: npz[k] for k in npz.files}


def load_inventory():
    with open(OUT_DIR / "inventory.json") as f:
        return json.load(f)
