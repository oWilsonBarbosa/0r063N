"""Paleoclimate pipeline: calibrate the zonal climate model at T-0 against the
generator's real climate, then compute climate for all 16 stages of the
tectonic history under the authored forcing curve (history/paleoclimate.yaml).

Outputs:
  out/climate_summary.json      - anchors, calibration, per-stage stats
  out/cache/climate_stages.npz  - per-stage grids (koppen, tS, tW, land, sea_ice)
  out/cache/orogen_cells.npz    - per-land-cell orogen belt id (-1 = none)

Exit nonzero on: invalid paleoclimate.yaml; T-0 major-class deviation > 20 pp;
T-0 stage-geometry land IoU < 0.6.
"""

import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import climate, data_io, history_schema, paleoclimate_schema, raster
from lib.spherical import xyz_to_latlon

CW, CH = 800, 400  # climate grid
ZONE_THRESHOLDS_KM = [150.0, 600.0, 1200.0, 2200.0]  # HO/OC/SC/CO/HC split

t0 = time.time()
hist = history_schema.load(data_io.HISTORY_DIR / "history.yaml")
pc = paleoclimate_schema.load(data_io.HISTORY_DIR / "paleoclimate.yaml", history=hist)
inv = data_io.load_inventory()

cols = data_io.load_columns(["lat", "lon", "x", "y", "z", "elev_km", "isLand",
                             "orogPow", "koppen", "contality", "tS", "tW",
                             "pS", "pW"])
print(f"columns loaded ({time.time() - t0:.0f}s)")
lat_c, lon_c = cols["lat"], cols["lon"]
land_c = cols["isLand"] == 1
true_tS = -45 + cols["tS"] * 90
true_tW = -45 + cols["tW"] * 90
true_pS = cols["pS"] * 1000
true_pW = cols["pW"] * 1000
true_kop = cols["koppen"].astype(int)

summary = {"model": pc["meta"]["model"], "zone_thresholds_km": ZONE_THRESHOLDS_KM}

# ---------- present-day anchors (cells are equal-area) ----------
global_mean_T = float(np.mean((true_tS + true_tW) / 2))
land_mean_T = float(np.mean(((true_tS + true_tW) / 2)[land_c]))


def major_fractions(codes):
    out = {}
    n = max(1, (codes > 0).sum())
    for m in "ABCDE":
        sel = np.isin(codes, [k for k, v in climate.KOPPEN_MAJOR.items() if v == m])
        out[m] = round(float(sel.sum() / n), 4)
    return out


truth_fracs = major_fractions(true_kop[land_c])
summary["anchor_t0"] = {"global_mean_C": round(global_mean_T, 2),
                        "land_mean_C": round(land_mean_T, 2),
                        "koppen_major_land_fractions": truth_fracs}
print(f"anchors: global mean {global_mean_T:.1f} C, land Koppen fractions {truth_fracs}")

# ---------- orogen belt cell labels (for paleo elevation modulation) ----------
g = data_io.load_rasters()
land_r = g["isLand"] == 1
orog_thr = np.nanpercentile(g["orogPow"][land_r], 85)
labels, n = raster.connected_components(land_r & (g["orogPow"] >= orog_thr))
area_w = raster.pixel_area_weights()[:, None] * np.ones(labels.shape)
px_area = 4 * np.pi * 6371.0**2 / labels.size * area_w
sizes = np.bincount(labels.ravel(), weights=px_area.ravel(), minlength=n + 1)
belt_of_label = np.full(n + 1, -1, dtype=np.int8)
cent_rc = [(int((90 - o["centroid"][0]) / 180 * labels.shape[0]),
            int((o["centroid"][1] + 180) / 360 * labels.shape[1]))
           for o in inv["features"]["orogens"]]
for L in range(1, n + 1):
    if sizes[L] < 1e5:
        continue
    rows, cls_ = np.nonzero(labels == L)
    rm, cm = rows.mean(), cls_.mean()
    d = [(rm - r) ** 2 + (cm - c) ** 2 for r, c in cent_rc]
    belt_of_label[L] = int(np.argmin(d))
rr, cc = raster.pixel_indices(lat_c, lon_c)
cell_belt = belt_of_label[labels[rr, cc]]
np.savez_compressed(data_io.CACHE_DIR / "orogen_cells.npz", cell_belt=cell_belt)
print(f"belt cells: {dict(zip(*np.unique(cell_belt[cell_belt >= 0], return_counts=True)))}")

# Belt elevation factor F(belt, t): erosion model in reverse (validator's rule).
orogen_ages = hist["orogen_ages"]


def belt_factor(belt_idx, t):
    spec = orogen_ages[f"O{belt_idx + 1}"]
    formed = spec["formed"]
    if t < formed - 50:
        return 0.0
    if t < formed:
        return (t - (formed - 50)) / 50.0  # ramp up while building
    if spec.get("active"):
        return 1.0  # active belts held at present height once formed

    def pred(age):
        return max(2500 - 5 * age, 300.0)

    age_t = t - formed   # Myr since formation at stage t (>= 0)
    age_now = -formed    # Myr since formation today
    return min(pred(age_t) / pred(age_now), 2.5)


def belt_factor_at(t):
    return np.array([belt_factor(i, t) for i in range(len(inv["features"]["orogens"]))])


# sanity: F == 1 at t=0 for every belt
f0 = belt_factor_at(0)
assert np.allclose(f0, 1.0), f"belt factors at T-0 must be 1.0 (got {f0})"

lat_axis = 90.0 - (np.arange(CH) + 0.5) * 180.0 / CH
lat_grid = np.broadcast_to(lat_axis[:, None], (CH, CW))
area_row = np.cos(np.radians(lat_axis))
area_grid = np.broadcast_to((area_row / area_row.mean())[:, None], (CH, CW))


def bin_cells(lat, lon, elev=None):
    """Bin cells to the climate grid: land mask (any cell) + mean elevation."""
    cgrid = np.clip(((lon + 180) / 360 * CW).astype(int), 0, CW - 1)
    rgrid = np.clip(((90 - lat) / 180 * CH).astype(int), 0, CH - 1)
    flat = rgrid * CW + cgrid
    land = np.zeros(CH * CW, dtype=bool)
    land[flat] = True
    land = land.reshape(CH, CW)
    if elev is None:
        return land, None
    tot = np.bincount(flat, weights=elev, minlength=CH * CW)
    cnt = np.bincount(flat, minlength=CH * CW)
    eg = np.zeros(CH * CW)
    nz = cnt > 0
    eg[nz] = tot[nz] / cnt[nz]
    return land, eg.reshape(CH, CW)


def run_grid(land, elev_grid, dT):
    dist = climate.coast_distance_km(land, lat_axis)
    cont = climate.cont_from_distance(dist)
    zone = climate.zone_from_distance(dist, land, ZONE_THRESHOLDS_KM, lat_deg=lat_grid)
    med = climate.west_coast_mask(land)
    return climate.stage_climate(lat_grid, np.where(land, elev_grid, 0.0), land,
                                 cont, zone, dT=dT, med_mask=med)


def land_stats(res, land):
    kop = res["koppen"]
    fr = major_fractions(kop[land])
    tmean = float(np.average((res["tS"] + res["tW"]) / 2, weights=area_grid))
    ice_land = float((area_grid * land * np.isin(kop, [29, 30])).sum()
                     / max((area_grid * land).sum(), 1e-9))
    ef_land = float((area_grid * land * (kop == 30)).sum()
                    / max((area_grid * land).sum(), 1e-9))
    sea_ice = float((area_grid * res["sea_ice"]).sum() / area_grid.sum())
    rows = np.nonzero(land.any(axis=1))[0]
    return {"koppen_major": fr, "global_mean_C": round(tmean, 2),
            "ice_land_frac": round(ice_land, 4), "EF_land_frac": round(ef_land, 4),
            "sea_ice_frac": round(sea_ice, 4),
            "land_lat_range": [round(float(lat_axis[rows.max()]), 1),
                               round(float(lat_axis[rows.min()]), 1)]}


# ---------- calibration A: formula-only, per-cell on true geography ----------
dist_cell = 2000.0 * np.clip(cols["contality"], 0, 1) ** 0.5  # rough inverse smoothstep
zone_cell = climate.zone_from_distance(dist_cell, land_c, ZONE_THRESHOLDS_KM, lat_deg=lat_c)
north_c = lat_c >= 0
pS_m = climate.zonal_precip(lat_c, +climate.ITCZ_SHIFT, cols["contality"], north_c)
pW_m = climate.zonal_precip(lat_c, -climate.ITCZ_SHIFT, cols["contality"], ~north_c)
tS_m, tW_m = climate.seasonal_temps(lat_c, cols["elev_km"], zone_cell,
                                    pS_m / 1000, pW_m / 1000)
kop_m = climate.koppen(tS_m, tW_m, pS_m, pW_m, lat_c)
agree = float(np.mean([climate.KOPPEN_MAJOR.get(int(a), "?") ==
                       climate.KOPPEN_MAJOR.get(int(b), "?")
                       for a, b in zip(kop_m[land_c][::13], true_kop[land_c][::13])]))
calA = {
    "tS_rmse_C": round(float(np.sqrt(np.mean((tS_m[land_c] - true_tS[land_c]) ** 2))), 2),
    "tW_rmse_C": round(float(np.sqrt(np.mean((tW_m[land_c] - true_tW[land_c]) ** 2))), 2),
    "pAnn_rmse_mm": round(float(np.sqrt(np.mean(
        ((pS_m + pW_m)[land_c] - (true_pS + true_pW)[land_c]) ** 2))), 0),
    "major_class_agreement": round(agree, 3),
    "model_fractions": major_fractions(kop_m[land_c]),
}
summary["calibration_formula_only"] = calA
print(f"calibration A (formula-only): {calA}")

# ---------- calibration B: full pipeline at T-0 ----------
land0, elev0 = bin_cells(lat_c[land_c], lon_c[land_c], cols["elev_km"][land_c])
res0 = run_grid(land0, elev0, dT=0.0)
st0 = land_stats(res0, land0)
dev = {m: round(abs(st0["koppen_major"][m] - truth_fracs[m]) * 100, 1) for m in "ABCDE"}
# per-pixel agreement against the rasterized ground truth
truth_grid = raster.fill_gaps_categorical(
    raster.rasterize_mode(lat_c, lon_c, true_kop, w=CW, h=CH))
truth_grid[truth_grid < 0] = 0
both = land0 & (truth_grid > 0)
major_lut = np.zeros(31, dtype="U1")
for k, v in climate.KOPPEN_MAJOR.items():
    major_lut[k] = v
grid_major_agree = float(np.mean(major_lut[res0["koppen"][both]]
                                 == major_lut[truth_grid[both]]))
grid_full_agree = float(np.mean(res0["koppen"][both] == truth_grid[both]))
summary["calibration_full_t0"] = {"stats": st0, "deviation_pp": dev,
                                  "grid_major_agreement": round(grid_major_agree, 3),
                                  "grid_full_agreement": round(grid_full_agree, 3)}
print(f"per-pixel agreement vs truth: major {grid_major_agree:.3f}, "
      f"full class {grid_full_agree:.3f}")
print(f"calibration B (full pipeline T-0): {st0['koppen_major']}")
print(f"deviation vs truth (pp): {dev}")
fail = [m for m, d in dev.items() if d > 20]
warn = [m for m, d in dev.items() if 10 < d <= 20]
if warn:
    print(f"WARN: classes off by >10 pp: {warn}")

# ---------- per-stage loop ----------
with np.load(data_io.CACHE_DIR / "blocks.npz") as npz:
    cell_block = npz["cell_block"]
    cell_land_idx = npz["cell_land_idx"]
pts = np.stack([cols["x"][cell_land_idx], cols["y"][cell_land_idx],
                cols["z"][cell_land_idx]], axis=1).astype(np.float64)
pts /= np.linalg.norm(pts, axis=1, keepdims=True)
elev_land = cols["elev_km"][cell_land_idx].astype(np.float64)
belt_land = cell_belt[cell_land_idx]
block_names = {int(k): v for k, v in inv["block_names"].items()}

stage_grids = {}
stage_stats = []
for stage in pc["stages"]:
    t = stage["t"]
    lat_all, lon_all, elev_all = [], [], []
    for bid, name in block_names.items():
        if name not in hist["blocks"]:
            continue
        b = hist["blocks"][name]
        if t < b.get("appears", -1e9):
            continue
        sel = cell_block == bid
        if not sel.any():
            continue
        R = history_schema.block_rotation(name, hist["blocks"], t)
        la, lo = xyz_to_latlon(pts[sel] @ R.T)
        ele = elev_land[sel].copy()
        bb = belt_land[sel]
        if t < 0:
            F = belt_factor_at(t)
            in_belt = bb >= 0
            base = 0.5  # km; only the orogenic excess above this is modulated
            excess = np.maximum(ele[in_belt] - base, 0.0)
            ele[in_belt] = np.minimum(ele[in_belt], base) + excess * F[bb[in_belt]]
        lat_all.append(la)
        lon_all.append(lo)
        elev_all.append(ele)
    la = np.concatenate(lat_all)
    lo = np.concatenate(lon_all)
    ele = np.concatenate(elev_all)
    land, elev_grid = bin_cells(la, lo, ele)
    # close pinholes in the land mask + elevation
    grown = land.copy()
    for dr, dc in raster.NEIGHBORS:
        grown |= raster._shift(land, dr, dc)
    holes = grown & ~land
    fill_e = raster.neighborhood_mean(np.where(land, elev_grid, np.nan), radius=1)
    land = land | (holes & ~np.isnan(fill_e) &
                   (sum(raster._shift(land, dr, dc) for dr, dc in raster.NEIGHBORS) >= 5))
    elev_grid = np.where(land & (elev_grid == 0) & ~np.isnan(fill_e), fill_e, elev_grid)
    res = run_grid(land, elev_grid, dT=stage["dT_global"])
    st = land_stats(res, land)
    st["t"] = t
    st["dT_global"] = stage["dT_global"]
    hint = stage.get("ice_hint", "none")
    ice = st["ice_land_frac"]
    expected = {"none": ice < 0.06, "polar": 0.02 <= ice <= 0.30,
                "major_glaciation": ice > 0.15}[hint]
    st["ice_hint"] = hint
    st["ice_hint_met"] = bool(expected)
    if not expected:
        print(f"WARN stage T{t}: ice_hint '{hint}' vs modeled ice fraction {ice:.2f}")
    stage_stats.append(st)
    stage_grids[f"koppen_{abs(t)}"] = res["koppen"].astype(np.int16)
    stage_grids[f"tS_{abs(t)}"] = res["tS"].astype(np.float32)
    stage_grids[f"tW_{abs(t)}"] = res["tW"].astype(np.float32)
    stage_grids[f"land_{abs(t)}"] = land
    stage_grids[f"seaice_{abs(t)}"] = res["sea_ice"]
    print(f"stage T{t}: dT {stage['dT_global']:+.1f} -> mean {st['global_mean_C']:.1f} C, "
          f"ice {100 * ice:.1f}% of land, classes {st['koppen_major']}")

# T-0 geometry check: stage land vs true land
iou = float((stage_grids["land_0"] & land0).sum() / max((stage_grids["land_0"] | land0).sum(), 1))
summary["t0_land_iou"] = round(iou, 3)
print(f"T-0 stage land IoU vs true geography: {iou:.3f}")

summary["stages"] = stage_stats
np.savez_compressed(data_io.CACHE_DIR / "climate_stages.npz", **stage_grids)
with open(data_io.OUT_DIR / "climate_summary.json", "w") as f:
    json.dump(summary, f, indent=1)
print(f"done in {time.time() - t0:.0f}s")

if fail:
    print(f"FAIL: T-0 major-class deviation >20 pp for {fail}")
    sys.exit(1)
if iou < 0.6:
    print("FAIL: T-0 land IoU < 0.6")
    sys.exit(1)
