"""Equirectangular rasterization of the region point cloud, gap fill, boundary ops."""

import numpy as np

W, H = 2048, 1024


def pixel_indices(lat, lon, w=W, h=H):
    col = np.clip(((np.asarray(lon) + 180.0) / 360.0 * w).astype(np.int64), 0, w - 1)
    row = np.clip(((90.0 - np.asarray(lat)) / 180.0 * h).astype(np.int64), 0, h - 1)
    return row, col


def rasterize_mean(lat, lon, values, w=W, h=H):
    row, col = pixel_indices(lat, lon, w, h)
    flat = row * w + col
    total = np.bincount(flat, weights=values.astype(np.float64), minlength=w * h)
    count = np.bincount(flat, minlength=w * h)
    out = np.full(w * h, np.nan)
    nz = count > 0
    out[nz] = total[nz] / count[nz]
    return out.reshape(h, w).astype(np.float32)


def rasterize_mode(lat, lon, values, w=W, h=H):
    """Categorical rasterization: the highest-count value wins per pixel."""
    row, col = pixel_indices(lat, lon, w, h)
    flat = row * w + col
    vals = np.asarray(values)
    codes, inv = np.unique(vals, return_inverse=True)
    pair = flat * len(codes) + inv
    pair_u, pair_c = np.unique(pair, return_counts=True)
    pix = pair_u // len(codes)
    code = pair_u % len(codes)
    order = np.lexsort((pair_c, pix))  # per pixel, last entry has the max count
    pix_o, code_o = pix[order], code[order]
    last = np.r_[pix_o[1:] != pix_o[:-1], True]
    out = np.full(w * h, -1, dtype=np.int64)
    out[pix_o[last]] = codes[code_o[last]]
    return out.reshape(h, w)


def _shift(a, dr, dc):
    """Shift with longitude wrap (columns) and edge clamp (rows)."""
    out = np.roll(a, dc, axis=1)
    if dr > 0:
        out = np.vstack([out[:1].repeat(dr, axis=0), out[:-dr]])
    elif dr < 0:
        out = np.vstack([out[-dr:], out[-1:].repeat(-dr, axis=0)])
    return out


NEIGHBORS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def fill_gaps_categorical(grid, empty=-1, passes=16):
    g = grid.copy()
    for _ in range(passes):
        holes = g == empty
        if not holes.any():
            break
        for dr, dc in NEIGHBORS:
            nb = _shift(g, dr, dc)
            take = holes & (nb != empty)
            g[take] = nb[take]
            holes = g == empty
    return g


def fill_gaps_mean(grid, passes=16):
    g = grid.copy()
    for _ in range(passes):
        holes = np.isnan(g)
        if not holes.any():
            break
        acc = np.zeros_like(g)
        cnt = np.zeros_like(g)
        for dr, dc in NEIGHBORS:
            nb = _shift(g, dr, dc)
            ok = ~np.isnan(nb)
            acc[ok] += nb[ok]
            cnt[ok] += 1
        fill = holes & (cnt > 0)
        g[fill] = acc[fill] / cnt[fill]
    return g


def boundary_pixels(plate_grid):
    """Mask of pixels whose plate differs from the right or down neighbor,
    plus the neighboring plate id at each boundary pixel."""
    right = _shift(plate_grid, 0, -1)
    down = _shift(plate_grid, -1, 0)
    diff_r = plate_grid != right
    diff_d = plate_grid != down
    mask = diff_r | diff_d
    other = np.where(diff_r, right, down)
    return mask, other


def neighborhood_mean(grid, radius=2):
    """Box-filter mean ignoring NaNs, lon-wrapped."""
    acc = np.zeros_like(grid, dtype=np.float64)
    cnt = np.zeros_like(grid, dtype=np.float64)
    for dr in range(-radius, radius + 1):
        for dc in range(-radius, radius + 1):
            nb = _shift(grid, dr, dc)
            ok = ~np.isnan(nb)
            acc[ok] += nb[ok]
            cnt[ok] += 1
    out = np.full_like(grid, np.nan, dtype=np.float64)
    nz = cnt > 0
    out[nz] = acc[nz] / cnt[nz]
    return out


def connected_components(mask):
    """4-connected labeling with longitude wrap. Returns (labels, count);
    labels are 1..count, 0 = background."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    for sr in range(h):
        row_hits = np.flatnonzero(mask[sr] & (labels[sr] == 0))
        for sc in row_hits:
            if labels[sr, sc]:
                continue
            current += 1
            stack = [(sr, sc)]
            labels[sr, sc] = current
            while stack:
                r, c = stack.pop()
                for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nr, nc = r + dr, (c + dc) % w
                    if 0 <= nr < h and mask[nr, nc] and labels[nr, nc] == 0:
                        labels[nr, nc] = current
                        stack.append((nr, nc))
    return labels, current


def pixel_area_weights(h=H):
    """cos(lat) weight per row, normalized so the mean over the sphere is 1."""
    lat = np.radians(90.0 - (np.arange(h) + 0.5) * 180.0 / h)
    w = np.cos(lat)
    return w / w.mean()
