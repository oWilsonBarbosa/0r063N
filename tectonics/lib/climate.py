"""Simplified zonal climate model, calibrated against the orogen.studio generator.

Constants and formulas are transcribed from the generator source
(temperature.js, heuristic-precip.js, koppen.js); simplifications vs the
generator: flat +/-8 deg seasonal ITCZ (no land weighting), no ocean currents,
no wind-direction orography, two-season year, BFS distance-to-coast bucketed to
the generator's five continentality zones. A uniform dT_global forcing offset
(the paleoclimate curve) enters the base temperature before lapse and clamping.

All functions are pure numpy on broadcastable arrays.
"""

import numpy as np

# ---- temperature constants (temperature.js) ----
T_EQ = 28.0          # deg C at the ITCZ core
T_DROP = 47.0        # cooling toward the pole
T_EXP = 1.4
PLATEAU_DEG = 13.0   # tropical plateau half-width
ITCZ_SHIFT = 8.0     # seasonal ITCZ excursion (flat, simplified)
LAPSE_BASE = 4.5     # C/km, saturated
LAPSE_DRY = 4.8      # extra C/km when dry
T_MIN, T_MAX = -45.0, 45.0

# Full annual swing (Twarm - Tcold) in deg C; rows = latitude bands,
# columns = zones HO/OC/SC/CO/HC (temperature.js SWING_TABLE).
SWING_TABLE = np.array([
    [3.0, 7.5, 13.5, 16.5, 19.5],   # 0-19
    [6.0, 10.5, 18.0, 24.0, 31.0],  # 20-29
    [7.5, 15.0, 24.0, 31.5, 38.5],  # 30-39
    [9.0, 16.5, 28.5, 37.5, 46.5],  # 40-49
    [9.0, 19.5, 31.5, 42.0, 52.5],  # 50-59
    [9.0, 21.0, 36.0, 45.0, 57.0],  # 60-69
    [9.0, 22.5, 37.5, 48.0, 60.0],  # 70-90
])
LAT_MIDS = np.array([9.5, 24.5, 34.5, 44.5, 54.5, 64.5, 80.0])

# ---- precipitation constants (heuristic-precip.js) ----
# zonal curve: precip fraction vs distance (deg) from the ITCZ
PRECIP_DIST = np.array([0.0, 5.0, 10.0, 28.0, 33.0, 55.0, 70.0, 90.0])
PRECIP_FRAC = np.array([1.0, 1.0, 0.35, 0.02, 0.5, 0.5, 0.3, 0.1])
ITCZ_BOOST = 1.2            # convective uplift multiplier near the ITCZ
LAPSE_ELEV_SCALE = 0.4      # effective-elevation factor fitted at T-0
COLD_CURRENT_SUPPRESS = 0.5 # year-round drying of subtropical west coasts
SEASONAL_PRECIP = 0.10      # +/-10% summer/winter
CONT_DRYNESS = 0.65         # 1 - cont^2 * 0.65
MED_SUPPRESS = 0.35         # west-coast summer suppression, 22-45 deg
PRECIP_MM_SCALE = 1000.0    # fraction 1.0 ~ 1000 mm per half-year
PRECIP_MIN = 0.05

# ---- Koppen codes (koppen.js KOPPEN_CLASSES, 1..30; 0 = ocean) ----
KOPPEN_CODES = [
    "Ocean", "Af", "Am", "Aw", "BWh", "BWk", "BSh", "BSk",
    "Cfa", "Cfb", "Cfc", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc",
    "Dfa", "Dfb", "Dfc", "Dfd", "Dsa", "Dsb", "Dsc", "Dsd",
    "Dwa", "Dwb", "Dwc", "Dwd", "ET", "EF",
]
KOPPEN_MAJOR = {}  # code -> 'A'/'B'/'C'/'D'/'E'
for _i, _c in enumerate(KOPPEN_CODES):
    if _i == 0:
        continue
    KOPPEN_MAJOR[_i] = "E" if _c in ("ET", "EF") else _c[0]


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def swing_amplitude(lat_deg, zone):
    """Half annual swing (deg C); bilinear over SWING_TABLE like the generator."""
    lat = np.abs(np.asarray(lat_deg, dtype=np.float64))
    zone = np.asarray(zone, dtype=np.float64)
    li = np.clip(np.searchsorted(LAT_MIDS, lat) - 1, 0, len(LAT_MIDS) - 2)
    lat_t = np.clip((lat - LAT_MIDS[li]) / (LAT_MIDS[li + 1] - LAT_MIDS[li]), 0, 1)
    z_idx = np.clip(zone * 4, 0, 4)
    zi = np.clip(z_idx.astype(int), 0, 3)
    z_t = z_idx - zi
    v_lo = SWING_TABLE[li, zi] * (1 - z_t) + SWING_TABLE[li, zi + 1] * z_t
    v_hi = SWING_TABLE[li + 1, zi] * (1 - z_t) + SWING_TABLE[li + 1, zi + 1] * z_t
    return (v_lo + (v_hi - v_lo) * lat_t) / 2.0


def base_temp(lat_deg, itcz_lat):
    """Annual-cycle base temperature for one season's ITCZ position."""
    d = np.abs(np.asarray(lat_deg, dtype=np.float64) - itcz_lat)
    d = np.maximum(d - PLATEAU_DEG, 0.0) / (90.0 - PLATEAU_DEG)
    return T_EQ - T_DROP * d ** T_EXP


def zonal_precip(lat_deg, itcz_lat, cont, season_warm, med_mask=None):
    """Precip in mm per half-year for one season.

    season_warm: boolean array, True where this season is the local summer.
    """
    lat = np.asarray(lat_deg, dtype=np.float64)
    d = np.abs(lat - itcz_lat)
    p = np.interp(d, PRECIP_DIST, PRECIP_FRAC)
    # ITCZ uplift (precipitation.js): convective boost within ~15 deg of the
    # ITCZ, strongest in the 5-deg core.
    p = p * (1 + ITCZ_BOOST * np.exp(-0.5 * (d / 9.0) ** 2))
    p = p * np.where(season_warm, 1 + SEASONAL_PRECIP, 1 - SEASONAL_PRECIP)
    # Subtropical high suppression at fixed latitudes (precipitation.js):
    # summer hemisphere: center 30 deg, width 16, peak 0.50;
    # winter hemisphere: center 24 deg, width 12, peak 0.30.
    lat_a = np.abs(lat)
    sup_s = 0.50 * np.exp(-0.5 * ((lat_a - 30.0) / 16.0) ** 2)
    sup_w = 0.30 * np.exp(-0.5 * ((lat_a - 24.0) / 12.0) ** 2)
    p = p * (1 - np.where(season_warm, sup_s, sup_w))
    p = p * (1 - np.asarray(cont, dtype=np.float64) ** 2 * CONT_DRYNESS)
    if med_mask is not None:
        # Mediterranean dry summers on 22-45 deg west coasts...
        med = med_mask & season_warm & (lat_a >= 22) & (lat_a <= 45)
        p = np.where(med, p * (1 - MED_SUPPRESS), p)
        # ...and an eastern-boundary cold-current proxy: year-round drying of
        # 15-40 deg west coasts (the generator gets this from ocean currents).
        cc = med_mask & (lat_a >= 15) & (lat_a <= 40)
        p = np.where(cc, p * (1 - COLD_CURRENT_SUPPRESS), p)
    return np.maximum(p, PRECIP_MIN) * PRECIP_MM_SCALE  # mm per half-year


def seasonal_temps(lat_deg, elev_km, zone, p_s_frac, p_w_frac, dT=0.0):
    """(tS, tW) in deg C. tS = northern-hemisphere summer (southern winter).

    The ITCZ shift already produces part of the annual swing; like the
    generator (temperature.js lines 911-954), only the EXTRA swing beyond
    that — capped at 50% of the gap to the table value — is added, split
    40% to the warm season and 60% to the cold season.
    """
    lat = np.asarray(lat_deg, dtype=np.float64)
    base_s = base_temp(lat, +ITCZ_SHIFT)
    base_w = base_temp(lat, -ITCZ_SHIFT)
    north = lat >= 0
    itcz_full = np.abs(base_s - base_w)
    table_full = 2 * swing_amplitude(lat, zone)
    extra = 0.5 * np.maximum(table_full - itcz_full, 0.0)
    warm_add = 0.4 * extra
    cold_sub = 0.6 * extra
    t_s = base_s + np.where(north, warm_add, -cold_sub) + dT
    t_w = base_w + np.where(north, -cold_sub, warm_add) + dT
    # Oceanic warming offset (temperature.js): up to +5 C at mid-high
    # latitudes for hyperoceanic zones (stands in for warm currents).
    ocean_warm = 5.0 * np.clip(1 - zone / 0.25, 0, 1) * smoothstep(35, 55, np.abs(lat))
    t_s += ocean_warm
    t_w += ocean_warm
    # Effective elevation for the lapse: the generator's output shows a much
    # weaker height-temperature coupling than the physical lapse on exported
    # elev_km (implied median ~2 C/km); LAPSE_ELEV_SCALE is fitted at T-0.
    elev = np.maximum(np.asarray(elev_km, dtype=np.float64), 0.0) * LAPSE_ELEV_SCALE
    # moisture for the lapse rate: floored so dry plateaus don't see the full
    # 9.3 C/km dry-adiabatic rate (the generator's normalized precip is wetter)
    moist_s = np.clip(np.asarray(p_s_frac, dtype=np.float64) / 0.8, 0.25, 1.0)
    moist_w = np.clip(np.asarray(p_w_frac, dtype=np.float64) / 0.8, 0.25, 1.0)
    t_s -= (LAPSE_BASE + LAPSE_DRY * (1 - moist_s)) * elev
    t_w -= (LAPSE_BASE + LAPSE_DRY * (1 - moist_w)) * elev
    return np.clip(t_s, T_MIN, T_MAX), np.clip(t_w, T_MIN, T_MAX)


def koppen(t_s, t_w, p_s, p_w, lat_deg):
    """Vectorized Koppen-Geiger codes 1..30, transcribed from koppen.js.

    t_s/t_w in deg C; p_s/p_w in mm per half-year; tS is NH-summer.
    """
    t_s = np.asarray(t_s, dtype=np.float64)
    t_w = np.asarray(t_w, dtype=np.float64)
    p_s = np.asarray(p_s, dtype=np.float64)
    p_w = np.asarray(p_w, dtype=np.float64)
    t_hot = np.maximum(t_s, t_w)
    t_cold = np.minimum(t_s, t_w)
    t_ann = (t_s + t_w) / 2
    t_shoulder = t_hot - (t_hot - t_cold) * 0.2

    # hemisphere-local seasons: local summer = the warmer half-year
    summer_first = t_s >= t_w
    p_summer = np.where(summer_first, p_s, p_w)
    p_winter = np.where(summer_first, p_w, p_s)
    p_ann = p_s + p_w
    ps_mon = p_summer / 6
    pw_mon = p_winter / 6
    ratio = np.maximum(p_summer, p_winter) / np.maximum(np.minimum(p_summer, p_winter), 1e-6)
    driest_frac = 0.60 - 0.35 * smoothstep(1, 4, ratio)
    p_dry = np.minimum(ps_mon, pw_mon) * driest_frac

    out = np.zeros(t_s.shape, dtype=np.int16)

    # E band
    ef = t_hot < 0
    et = (t_hot >= 0) & (t_hot < 10)
    out[ef] = 30
    out[et] = 29

    # B band (arid), applied where not E
    summer_frac = p_summer / np.maximum(p_ann, 1e-6)
    p_thresh = 20 * t_ann + np.where(summer_frac >= 0.7, 280,
                                     np.where(summer_frac <= 0.3, 0, 140))
    p_thresh = np.maximum(p_thresh, 0)
    not_e = ~(ef | et)
    bw = not_e & (p_ann < 0.5 * p_thresh)
    bs = not_e & ~bw & (p_ann < p_thresh)
    hot_arid = t_ann >= 18
    out[bw & hot_arid] = 4    # BWh
    out[bw & ~hot_arid] = 5   # BWk
    out[bs & hot_arid] = 6    # BSh
    out[bs & ~hot_arid] = 7   # BSk

    remaining = not_e & ~bw & ~bs

    # A band
    a = remaining & (t_cold >= 18)
    af = a & (p_dry >= 60)
    am = a & ~af & (p_ann >= 25 * (100 - p_dry))
    aw = a & ~af & ~am
    out[af] = 1
    out[am] = 2
    out[aw] = 3

    # C / D bands
    c = remaining & ~a & (t_cold >= 0)
    d = remaining & ~a & ~c

    pat_s = (ps_mon < pw_mon) & (ps_mon < 50) & (ps_mon < 0.5 * pw_mon)
    pat_w = (ps_mon >= pw_mon) & (pw_mon < ps_mon / 3)
    # letter: a if Thot>=22, else b if Tshoulder>=10, else c if Tcold>=-38, else d
    let_a = t_hot >= 22
    let_b = ~let_a & (t_shoulder >= 10)
    let_c = ~let_a & ~let_b & (t_cold >= -38)
    # C band codes: Cfa 8 Cfb 9 Cfc 10 | Csa 11 Csb 12 Csc 13 | Cwa 14 Cwb 15 Cwc 16
    # D band codes: Dfa 17 Dfb 18 Dfc 19 Dfd 20 | Ds 21-24 | Dw 25-28
    for band_mask, base_f, base_s, base_w, has_d in ((c, 8, 11, 14, False),
                                                     (d, 17, 21, 25, True)):
        for pat_mask, base in ((pat_s, base_s), (pat_w, base_w),
                               (~pat_s & ~pat_w, base_f)):
            m = band_mask & pat_mask
            if not m.any():
                continue
            code = np.full(t_s.shape, base + 2, dtype=np.int16)  # 'c' default
            code[let_a] = base
            code[let_b] = base + 1
            if has_d:
                code[~let_a & ~let_b & ~let_c] = base + 3
            out[m] = code[m]
    return out


def coast_distance_km(land_mask, lat_axis_deg):
    """Per-pixel distance to the nearest coast (km) by ring BFS, lon-wrapped."""
    h, w = land_mask.shape
    km_per_px = 2 * np.pi * 6371.0 / w * np.cos(np.radians(lat_axis_deg))[:, None]
    km_per_px = np.maximum(km_per_px, 2 * np.pi * 6371.0 / w * 0.05)
    km_per_px = np.broadcast_to(km_per_px, (h, w))
    dist = np.full((h, w), np.inf)
    dist[~land_mask] = 0.0
    frontier = ~land_mask
    cur = np.zeros((h, w))
    for _ in range(max(h, w)):
        grown = frontier.copy()
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.roll(frontier, (dr, dc), axis=(0, 1))
            if dr == 1:
                nb[0, :] = False
            elif dr == -1:
                nb[-1, :] = False
            grown |= nb
        newly = grown & np.isinf(dist)
        if not newly.any():
            break
        cur = cur + km_per_px
        dist[newly] = cur[newly]
        frontier = grown
    dist[~land_mask] = 0.0
    finite_max = np.max(dist[np.isfinite(dist)]) if np.isfinite(dist).any() else 0.0
    dist[np.isinf(dist)] = finite_max
    return dist


def zone_from_distance(dist_km, land_mask, thresholds_km, lat_deg=None):
    """Bucket coast distance to the generator's 5 zones (0, .25, .5, .75, 1).

    Latitude gates follow the generator's zone rules: Subcontinental needs
    35+ deg, Continental 40+, Hypercontinental 50+ — the tropics never get
    continental-scale temperature swings.
    """
    zone = np.zeros(dist_km.shape)
    for i, thr in enumerate(thresholds_km):
        zone = np.where(land_mask & (dist_km > thr), (i + 1) * 0.25, zone)
    if lat_deg is not None:
        lat_a = np.abs(np.asarray(lat_deg, dtype=np.float64))
        zone = np.minimum(zone, np.where(lat_a < 35, 0.25,
                          np.where(lat_a < 40, 0.5,
                          np.where(lat_a < 50, 0.75, 1.0))))
    return zone


def cont_from_distance(dist_km, range_km=2000.0):
    """Generator's r_continentality: smoothstep(0, 2000 km, distance)."""
    return smoothstep(0.0, range_km, dist_km)


def west_coast_mask(land_mask, reach_px=5):
    """Land pixels with ocean within reach_px to the west (lon-wrapped)."""
    ocean = ~land_mask
    near = np.zeros_like(land_mask)
    shifted = ocean
    for _ in range(reach_px):
        shifted = np.roll(shifted, 1, axis=1)  # ocean moves eastward over land
        near |= shifted
    return land_mask & near


def stage_climate(lat_grid, elev_grid, land_mask, cont_grid, zone_grid,
                  dT=0.0, med_mask=None):
    """Full climate solution for one stage. Returns dict of (H, W) grids.

    cont_grid: continuous continentality 0..1 (precip dryness);
    zone_grid: bucketed zone 0..1 (temperature swing table).
    """
    north = lat_grid >= 0
    # precip first (needed as lapse moisture proxy)
    p_s = zonal_precip(lat_grid, +ITCZ_SHIFT, cont_grid, season_warm=north, med_mask=med_mask)
    p_w = zonal_precip(lat_grid, -ITCZ_SHIFT, cont_grid, season_warm=~north, med_mask=med_mask)
    t_s, t_w = seasonal_temps(lat_grid, elev_grid, zone_grid,
                              p_s / PRECIP_MM_SCALE, p_w / PRECIP_MM_SCALE, dT=dT)
    kop = koppen(t_s, t_w, p_s, p_w, lat_grid)
    kop[~land_mask] = 0
    sea_ice = ~land_mask & (np.maximum(t_s, t_w) < 0)
    return {"tS": t_s, "tW": t_w, "pS": p_s, "pW": p_w,
            "koppen": kop, "sea_ice": sea_ice}
