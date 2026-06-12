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
COLD_CURRENT_SUPPRESS = 0.5 # drying where a cold eastern-boundary current runs
CONT_DRYNESS_ADV = 0.0      # static cont^2 term off when advection is active
MOIST_FLOOR = 0.45          # precip share that survives with zero moisture
OCEAN_WARMTH_T = 16.0       # max current temperature effect over ocean (deg C)
LAND_WARMTH_T = 14.0        # max diffused current effect on coastal land
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


def zonal_precip(lat_deg, itcz_lat, cont, season_warm, med_mask=None,
                 moisture=None, cc_mask=None):
    """Precip in mm per half-year for one season.

    season_warm: boolean array, True where this season is the local summer.
    itcz_lat: scalar or broadcastable array (per-longitude ITCZ).
    moisture: optional advected-moisture field 0..1; when given, interior
    drying comes mostly from moisture transport and the static cont^2 term is
    softened. cc_mask: coastal land dried year-round by a cold current.
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
    dryness = CONT_DRYNESS_ADV if moisture is not None else CONT_DRYNESS
    p = p * (1 - np.asarray(cont, dtype=np.float64) ** 2 * dryness)
    if moisture is not None:
        p = p * (MOIST_FLOOR + (1 - MOIST_FLOOR) * moisture)
    if med_mask is not None:
        med = med_mask & season_warm & (lat_a >= 22) & (lat_a <= 45)
        p = np.where(med, p * (1 - MED_SUPPRESS), p)
    if cc_mask is not None:
        p = np.where(cc_mask, p * (1 - COLD_CURRENT_SUPPRESS), p)
    return np.maximum(p, PRECIP_MIN) * PRECIP_MM_SCALE  # mm per half-year


def seasonal_temps(lat_deg, elev_km, zone, p_s_frac, p_w_frac, dT=0.0,
                   itcz_s=None, itcz_w=None, warmth_T=None):
    """(tS, tW) in deg C. tS = northern-hemisphere summer (southern winter).

    The ITCZ shift already produces part of the annual swing; like the
    generator (temperature.js lines 911-954), only the EXTRA swing beyond
    that — capped at 50% of the gap to the table value — is added, split
    40% to the warm season and 60% to the cold season.

    itcz_s/itcz_w: scalar or broadcastable per-longitude ITCZ latitudes
    (default flat +/-ITCZ_SHIFT). warmth_T: optional ocean-current
    temperature field (deg C), added to both seasons.
    """
    lat = np.asarray(lat_deg, dtype=np.float64)
    base_s = base_temp(lat, +ITCZ_SHIFT if itcz_s is None else itcz_s)
    base_w = base_temp(lat, -ITCZ_SHIFT if itcz_w is None else itcz_w)
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
    if warmth_T is not None:
        t_s = t_s + warmth_T
        t_w = t_w + warmth_T
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


def _box_filter(grid, radius_r, radius_c):
    """Separable box mean, lon-wrapped in columns, clamped in rows."""
    g = np.asarray(grid, dtype=np.float64)
    acc = g.copy()
    for k in range(1, radius_c + 1):
        acc += np.roll(g, k, axis=1) + np.roll(g, -k, axis=1)
    acc /= (2 * radius_c + 1)
    out = acc.copy()
    cnt = np.ones_like(acc)
    for k in range(1, radius_r + 1):
        up = np.vstack([acc[k:], np.repeat(acc[-1:], k, axis=0)])
        dn = np.vstack([np.repeat(acc[:1], k, axis=0), acc[:-k]])
        out += up + dn
        cnt += 2
    return out / cnt


def itcz_latitudes(land_mask, lat_axis_deg, tilt=23.5):
    """Per-longitude ITCZ latitude for (NH-summer, NH-winter), land-following.

    Simplified version of the generator's scan (wind.js): score candidate
    latitudes within +/-32 deg by solar insolation (gaussian at the subsolar
    latitude), an ocean prior near +/-7 deg, and a local land-fraction thermal
    boost; take the argmax per longitude and smooth along longitude.
    Returns two arrays of shape (W,), clamped to +/-28 deg.
    """
    h, w = land_mask.shape
    lr = max(1, int(7 / (180.0 / h)))
    cr = max(1, int(15 / (360.0 / w)))
    land_f = _box_filter(land_mask, lr, cr)
    band = np.abs(lat_axis_deg) <= 32
    rows = np.flatnonzero(band)
    lats = lat_axis_deg[rows]
    out = []
    for sign in (+1, -1):  # NH summer, NH winter (subsolar in the south)
        solar = np.exp(-0.5 * ((lats - sign * tilt) / 25.0) ** 2)
        ocean_prior = 0.35 * np.exp(-0.5 * ((lats - sign * 7.0) / 10.0) ** 2)
        score = (solar + ocean_prior)[:, None] + 1.1 * land_f[rows, :]
        itcz = lats[np.argmax(score, axis=0)]
        for _ in range(12):  # smooth along longitude, wrap-aware
            itcz = 0.25 * np.roll(itcz, 1) + 0.5 * itcz + 0.25 * np.roll(itcz, -1)
        out.append(np.clip(itcz, -28.0, 28.0))
    return out[0], out[1]


def ocean_warmth(land_mask, lat_axis_deg):
    """Gyre-current warmth field in [-1, 1] over the ocean.

    Western-boundary currents (west side of each ocean basin, i.e. along the
    east coast of the continent to the west) carry warm water poleward;
    eastern-boundary currents carry cold water equatorward; poleward of ~50
    deg the warm current crosses the basin and warms its eastern side (North
    Atlantic Drift analog). Parameterized purely from the land mask.
    """
    h, w = land_mask.shape
    warmth = np.zeros((h, w))
    for r in range(h):
        ocean = ~land_mask[r]
        if ocean.all():
            continue  # no boundaries: no gyre asymmetry on this row
        if not ocean.any():
            continue
        a = abs(lat_axis_deg[r])
        warm_west = smoothstep(8, 20, a) * (1 - smoothstep(50, 68, a))
        cold_east = smoothstep(4, 12, a) * (1 - smoothstep(32, 48, a))
        warm_east_polar = smoothstep(48, 60, a) * (1 - smoothstep(72, 82, a))
        # circular runs of ocean: rotate so the row starts on land
        start = int(np.argmax(~ocean))
        oc = np.roll(ocean, -start)
        idx = np.flatnonzero(oc)
        if len(idx) == 0:
            continue
        breaks = np.flatnonzero(np.diff(idx) > 1)
        seg_starts = np.r_[0, breaks + 1]
        seg_ends = np.r_[breaks, len(idx) - 1]
        for s0, s1 in zip(seg_starts, seg_ends):
            seg = idx[s0:s1 + 1]
            L = len(seg)
            if L < 4:
                continue
            x = (np.arange(L) + 0.5) / L  # 0 = west edge of basin, 1 = east edge
            west_side = np.exp(-x / 0.12)
            east_side = np.exp(-(1 - x) / 0.12)
            v = (west_side * warm_west - east_side * cold_east
                 + 0.8 * east_side * warm_east_polar)
            warmth[r, (seg + start) % w] = np.clip(v, -1, 1)
    return warmth


def diffuse_to_land(field, land_mask, passes=12, decay=0.82):
    """Carry an ocean field onto coastal land, fading inland ring by ring."""
    out = np.where(land_mask, 0.0, field)
    known = ~land_mask
    for _ in range(passes):
        acc = np.zeros_like(out)
        cnt = np.zeros_like(out)
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.roll(out, (dr, dc), axis=(0, 1))
            kb = np.roll(known, (dr, dc), axis=(0, 1))
            if dr == 1:
                nb[0, :] = 0
                kb[0, :] = False
            elif dr == -1:
                nb[-1, :] = 0
                kb[-1, :] = False
            acc += np.where(kb, nb, 0.0)
            cnt += kb
        newly = land_mask & ~known & (cnt > 0)
        out[newly] = decay * acc[newly] / cnt[newly]
        known |= newly
    return out


def advected_moisture(land_mask, lat_grid, itcz_cols, passes=55, decay=0.96):
    """Downwind moisture penetration from the ocean, 0..1.

    Wind direction per pixel from the zonal bands relative to the local ITCZ
    (wind.js): trades (within 30 deg of the ITCZ) and polar easterlies carry
    moisture westward; the westerlies (30-58 deg) carry it eastward.
    """
    d = np.abs(lat_grid - itcz_cols[None, :])
    westerly = (d >= 30) & (d < 58)
    m = np.where(land_mask, 0.0, 1.0)
    for _ in range(passes):
        from_west = np.roll(m, 1, axis=1)   # westerlies blow west -> east
        from_east = np.roll(m, -1, axis=1)  # trades blow east -> west
        upwind = np.where(westerly, from_west, from_east)
        m = np.where(land_mask, np.maximum(m, upwind * decay), m)
    # ITCZ convective moisture recycling: deep convection keeps the rain belt
    # wet over land regardless of distance to the ocean (rainforest recycling)
    conv = 0.85 * np.exp(-0.5 * (d / 12.0) ** 2)
    return np.maximum(m, conv)


def stage_climate(lat_grid, elev_grid, land_mask, cont_grid, zone_grid,
                  dT=0.0, med_mask=None):
    """Full climate solution for one stage. Returns dict of (H, W) grids.

    cont_grid: continuous continentality 0..1 (precip dryness);
    zone_grid: bucketed zone 0..1 (temperature swing table).
    Computes land-following per-longitude ITCZ, gyre ocean currents, and
    downwind moisture advection from the land mask.
    """
    north = lat_grid >= 0
    lat_axis = lat_grid[:, 0]
    itcz_s, itcz_w = itcz_latitudes(land_mask, lat_axis)
    itcz_s_b, itcz_w_b = itcz_s[None, :], itcz_w[None, :]

    # gyre currents -> temperature field (ocean directly, coasts by diffusion)
    warmth = ocean_warmth(land_mask, lat_axis)
    warmth_land = diffuse_to_land(warmth, land_mask)
    warmth_T = np.where(land_mask,
                        warmth_land * LAND_WARMTH_T * (1 - cont_grid),
                        warmth * OCEAN_WARMTH_T)

    # cold-current coastal drying: land with a cold eastern-boundary current
    # in the adjacent ocean to its west
    west_ocean_w = np.zeros_like(warmth)
    cnt = np.zeros_like(warmth)
    probe = np.where(land_mask, np.nan, warmth)
    for k in range(1, 5):
        nb = np.roll(probe, k, axis=1)
        ok = ~np.isnan(nb)
        west_ocean_w[ok] += nb[ok]
        cnt[ok] += 1
    with np.errstate(invalid="ignore"):
        west_ocean_w = np.where(cnt > 0, west_ocean_w / np.maximum(cnt, 1), 0.0)
    cc_mask = land_mask & (west_ocean_w < -0.25)

    moist_s = advected_moisture(land_mask, lat_grid, itcz_s)
    moist_w = advected_moisture(land_mask, lat_grid, itcz_w)

    p_s = zonal_precip(lat_grid, itcz_s_b, cont_grid, season_warm=north,
                       med_mask=med_mask, moisture=moist_s, cc_mask=cc_mask)
    p_w = zonal_precip(lat_grid, itcz_w_b, cont_grid, season_warm=~north,
                       med_mask=med_mask, moisture=moist_w, cc_mask=cc_mask)
    t_s, t_w = seasonal_temps(lat_grid, elev_grid, zone_grid,
                              p_s / PRECIP_MM_SCALE, p_w / PRECIP_MM_SCALE,
                              dT=dT, itcz_s=itcz_s_b, itcz_w=itcz_w_b,
                              warmth_T=warmth_T)
    kop = koppen(t_s, t_w, p_s, p_w, lat_grid)
    kop[~land_mask] = 0
    sea_ice = ~land_mask & (np.maximum(t_s, t_w) < 0)
    return {"tS": t_s, "tW": t_w, "pS": p_s, "pW": p_w,
            "koppen": kop, "sea_ice": sea_ice}
