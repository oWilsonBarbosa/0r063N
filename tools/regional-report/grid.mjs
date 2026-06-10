// Equirectangular raster of the Fibonacci-sphere cells.
// Rasterizing makes area weighting, connected components, quadrant stats and
// map rendering trivial; default 0.125 deg slightly oversamples the
// ~0.13 deg mean cell spacing of the 2.56M-cell export.

const EARTH_R = 6371; // km

export function buildGrid(data, resDeg = 0.125) {
    const W = Math.round(360 / resDeg);
    const H = Math.round(180 / resDeg);
    const cellGrid = new Int32Array(W * H).fill(-1);

    const { lat, lon, n } = data;
    for (let i = 0; i < n; i++) {
        let px = Math.floor((lon[i] + 180) / resDeg);
        if (px >= W) px -= W;
        if (px < 0) px += W;
        let py = Math.floor((90 - lat[i]) / resDeg);
        if (py < 0) py = 0;
        if (py >= H) py = H - 1;
        cellGrid[py * W + px] = i;
    }

    fillRowGaps(cellGrid, W, H);
    fillRemaining(cellGrid, W, H);

    let empty = 0;
    for (let p = 0; p < cellGrid.length; p++) if (cellGrid[p] === -1) empty++;
    if (empty > 0) throw new Error(`raster fill left ${empty} empty pixels`);

    // per-row pixel area (km^2), and row-center latitude
    const rowArea = new Float64Array(H);
    const rowLat = new Float64Array(H);
    const k = (resDeg * Math.PI / 180);
    for (let py = 0; py < H; py++) {
        const latC = 90 - (py + 0.5) * resDeg;
        rowLat[py] = latC;
        rowArea[py] = EARTH_R * EARTH_R * k * k * Math.cos(latC * Math.PI / 180);
    }
    return { W, H, resDeg, cellGrid, rowArea, rowLat };
}

// nearest-filled-pixel fill along each row, with longitude wraparound —
// handles the 1/cos(lat) longitude sparsity at high latitudes exactly.
function fillRowGaps(g, W, H) {
    const dist = new Int32Array(W);
    const src = new Int32Array(W);
    for (let py = 0; py < H; py++) {
        const base = py * W;
        let any = false;
        for (let px = 0; px < W; px++) {
            if (g[base + px] !== -1) { any = true; break; }
        }
        if (!any) continue;
        const BIG = 1 << 29;
        for (let px = 0; px < W; px++) {
            if (g[base + px] !== -1) { dist[px] = 0; src[px] = g[base + px]; }
            else { dist[px] = BIG; src[px] = -1; }
        }
        // two wrapped forward passes + two wrapped backward passes
        for (let pass = 0; pass < 2; pass++) {
            for (let px = 0; px < W; px++) {
                const prev = (px + W - 1) % W;
                if (dist[prev] + 1 < dist[px]) { dist[px] = dist[prev] + 1; src[px] = src[prev]; }
            }
            for (let px = W - 1; px >= 0; px--) {
                const next = (px + 1) % W;
                if (dist[next] + 1 < dist[px]) { dist[px] = dist[next] + 1; src[px] = src[next]; }
            }
        }
        for (let px = 0; px < W; px++) if (g[base + px] === -1) g[base + px] = src[px];
    }
}

// vertical copy for rows that had no cells at all (immediately at the poles)
function fillRemaining(g, W, H) {
    for (let iter = 0; iter < H; iter++) {
        let changed = false;
        for (let py = 0; py < H; py++) {
            const base = py * W;
            if (g[base] !== -1) continue; // row fill means rows are all-or-nothing
            const from = (py < H / 2) ? py + 1 : py - 1;
            if (g[from * W] === -1) continue;
            g.copyWithin(base, from * W, from * W + W);
            changed = true;
        }
        if (!changed) break;
    }
}

// Generic connected-component labeling on the raster with longitude wrap.
//   pred(p)      -> pixel belongs to the mask
//   connect8     -> 8-connectivity (else 4)
// Returns { labels: Int32Array (-1 outside mask), comps: [stats...] }
// Component stats: pixels, areaKm2, sumLat/sumLonX/sumLonY (for circular-mean
// centroid), maxVal/sumVal of an optional value(p) channel, bbox in pixels,
// touchesOutside (any neighbor passes outsidePred).
export function labelComponents(grid, pred, { connect8 = false, value = null, outsidePred = null } = {}) {
    const { W, H, rowArea, rowLat, resDeg } = grid;
    const N = W * H;
    const labels = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    const comps = [];

    for (let start = 0; start < N; start++) {
        if (labels[start] !== -1 || !pred(start)) continue;
        const id = comps.length;
        const c = {
            id, pixels: 0, areaKm2: 0,
            sumLatA: 0, sumCosA: 0, sumSinA: 0, areaSum: 0,
            maxVal: -Infinity, maxValPx: -1, sumValA: 0,
            minPX: W, maxPX: 0, minPY: H, maxPY: 0,
            touchesOutside: false,
        };
        let top = 0;
        stack[top++] = start;
        labels[start] = id;
        while (top > 0) {
            const p = stack[--top];
            const py = (p / W) | 0, px = p - py * W;
            const a = rowArea[py];
            c.pixels++;
            c.areaKm2 += a;
            const lonDeg = (px + 0.5) * resDeg - 180;
            const lonRad = lonDeg * Math.PI / 180;
            c.sumLatA += rowLat[py] * a;
            c.sumCosA += Math.cos(lonRad) * a;
            c.sumSinA += Math.sin(lonRad) * a;
            c.areaSum += a;
            if (value) {
                const v = value(p);
                c.sumValA += v * a;
                if (v > c.maxVal) { c.maxVal = v; c.maxValPx = p; }
            }
            if (px < c.minPX) c.minPX = px;
            if (px > c.maxPX) c.maxPX = px;
            if (py < c.minPY) c.minPY = py;
            if (py > c.maxPY) c.maxPY = py;

            const pushN = (q) => {
                if (labels[q] === -1 && pred(q)) { labels[q] = id; stack[top++] = q; }
                else if (outsidePred && labels[q] === -1 && outsidePred(q)) c.touchesOutside = true;
            };
            const left = px === 0 ? p + W - 1 : p - 1;
            const right = px === W - 1 ? p - W + 1 : p + 1;
            pushN(left); pushN(right);
            if (py > 0) pushN(p - W);
            if (py < H - 1) pushN(p + W);
            if (connect8) {
                const lpx = px === 0 ? W - 1 : px - 1;
                const rpx = px === W - 1 ? 0 : px + 1;
                if (py > 0) { pushN((py - 1) * W + lpx); pushN((py - 1) * W + rpx); }
                if (py < H - 1) { pushN((py + 1) * W + lpx); pushN((py + 1) * W + rpx); }
            }
        }
        c.centroidLat = c.sumLatA / c.areaSum;
        c.centroidLon = Math.atan2(c.sumSinA, c.sumCosA) * 180 / Math.PI;
        c.meanVal = value ? c.sumValA / c.areaSum : 0;
        comps.push(c);
    }
    return { labels, comps };
}

export function greatCircleKm(lat1, lon1, lat2, lon2) {
    const d = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * d / 2) ** 2
        + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin((lon2 - lon1) * d / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export { EARTH_R };
