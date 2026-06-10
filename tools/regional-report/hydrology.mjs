// Derived hydrology: depression filling, flow routing, discharge
// accumulation, river extraction, and above-sea-level lakes with a simple
// water balance (none of this is in the export — it is computed here from
// elevation, precipitation and temperature).
//
// Method: priority-flood (Barnes et al. 2014) seeded from all water pixels at
// sea level with an epsilon gradient; steepest-descent receivers on the
// filled surface; runoff from a Budyko-type P/PET curve; depressions become
// freshwater lakes (inflow >= evaporation, filled to the spill) or shrunken
// endorheic salt lakes (evaporation-limited equilibrium area).

import { greatCircleKm } from './grid.mjs';
import { tempC, precipAnnualMm } from './classify.mjs';

const EPS_KM = 1e-5;             // enforced gradient across flats
const MIN_LAKE_DEPTH_KM = 0.025; // ignore shallower depressions (raster noise)
const MIN_LAKE_KM2 = 2000;       // report lakes at least this large
const DRAW_LAKE_KM2 = 2000;      // draw lakes at least this large on maps
const RIVER_KM3 = 5;             // discharge threshold for the river network
const MAJOR_RIVER_KM3 = 15;      // "major river" mouths; also the map drawing threshold
const MOUTH_DEDUPE_KM = 60;      // one mouth per delta/coast cluster

// potential evapotranspiration (mm/yr) from mean annual temperature —
// a coarse Thornthwaite-flavored fit, clamped for cold climates
function petMm(tMeanC) {
    return Math.max(80, 300 + 38 * tMeanC);
}

// annual runoff (mm) via Ol'dekop's evaporation curve: AET = PET*tanh(P/PET)
function runoffMm(pannMm, pet) {
    if (pannMm <= 0) return 0;
    const aet = Math.min(pannMm, pet * Math.tanh(pannMm / pet));
    return Math.max(0, pannMm - aet);
}

// binary min-heap over (key, idx)
class MinHeap {
    constructor(cap) {
        this.keys = new Float64Array(cap);
        this.idx = new Int32Array(cap);
        this.size = 0;
    }
    push(key, i) {
        let c = this.size++;
        const { keys, idx } = this;
        keys[c] = key; idx[c] = i;
        while (c > 0) {
            const par = (c - 1) >> 1;
            if (keys[par] <= keys[c]) break;
            const tk = keys[par], ti = idx[par];
            keys[par] = keys[c]; idx[par] = idx[c];
            keys[c] = tk; idx[c] = ti;
            c = par;
        }
    }
    pop() {
        const { keys, idx } = this;
        const top = idx[0];
        this.size--;
        if (this.size > 0) {
            keys[0] = keys[this.size]; idx[0] = idx[this.size];
            let p = 0;
            for (;;) {
                const l = 2 * p + 1, r = l + 1;
                let m = p;
                if (l < this.size && keys[l] < keys[m]) m = l;
                if (r < this.size && keys[r] < keys[m]) m = r;
                if (m === p) break;
                const tk = keys[p], ti = idx[p];
                keys[p] = keys[m]; idx[p] = idx[m];
                keys[m] = tk; idx[m] = ti;
                p = m;
            }
        }
        return top;
    }
}

function neighbors8(p, W, H, out) {
    const py = (p / W) | 0, px = p - py * W;
    const lpx = px === 0 ? W - 1 : px - 1;
    const rpx = px === W - 1 ? 0 : px + 1;
    let n = 0;
    out[n++] = py * W + lpx;
    out[n++] = py * W + rpx;
    if (py > 0) { out[n++] = (py - 1) * W + px; out[n++] = (py - 1) * W + lpx; out[n++] = (py - 1) * W + rpx; }
    if (py < H - 1) { out[n++] = (py + 1) * W + px; out[n++] = (py + 1) * W + lpx; out[n++] = (py + 1) * W + rpx; }
    return n;
}

export function buildHydrology(grid, data, px, { log = () => {} } = {}) {
    const { W, H, cellGrid, rowArea, rowLat, resDeg } = grid;
    const N = W * H;

    // per-pixel elevation, runoff and PET
    const elevPx = new Float32Array(N);
    const runoffPx = new Float32Array(N);
    const petPx = new Float32Array(N);
    for (let p = 0; p < N; p++) {
        const c = cellGrid[p];
        elevPx[p] = data.elev_km[c];
        const t = (tempC(data.tS[c]) + tempC(data.tW[c])) / 2;
        petPx[p] = petMm(t);
        if (px.landPx[p]) runoffPx[p] = runoffMm(precipAnnualMm(data.pS[c], data.pW[c]), petPx[p]);
    }

    // ---- priority flood from all water pixels (surface at sea level) ----
    const fill = new Float32Array(N).fill(Infinity);
    const closed = new Uint8Array(N);
    const popOrder = new Int32Array(N);
    const heap = new MinHeap(N);
    for (let p = 0; p < N; p++) {
        if (!px.landPx[p]) { fill[p] = Math.max(0, elevPx[p]); closed[p] = 1; heap.push(fill[p], p); }
    }
    const nb = new Int32Array(8);
    let nPop = 0;
    while (heap.size > 0) {
        const p = heap.pop();
        popOrder[nPop++] = p;
        const cnt = neighbors8(p, W, H, nb);
        for (let k = 0; k < cnt; k++) {
            const n = nb[k];
            if (closed[n]) continue;
            closed[n] = 1;
            fill[n] = Math.max(elevPx[n], fill[p] + EPS_KM);
            heap.push(fill[n], n);
        }
    }
    log(`  priority flood: ${nPop.toLocaleString()} pixels filled`);

    // ---- steepest-descent receivers on the filled surface ----
    const receiver = new Int32Array(N).fill(-1);
    for (let p = 0; p < N; p++) {
        if (!px.landPx[p]) continue;
        const cnt = neighbors8(p, W, H, nb);
        let best = -1, bestFill = fill[p];
        for (let k = 0; k < cnt; k++) {
            if (fill[nb[k]] < bestFill) { bestFill = fill[nb[k]]; best = nb[k]; }
        }
        receiver[p] = best;   // guaranteed >= 0: the flood parent is lower
    }

    // ---- discharge accumulation (km^3/yr), high fill -> low fill ----
    const discharge = new Float64Array(N);
    for (let p = 0; p < N; p++) {
        if (px.landPx[p]) discharge[p] = runoffPx[p] * rowArea[(p / W) | 0] / 1e6;
    }
    for (let i = nPop - 1; i >= 0; i--) {
        const p = popOrder[i];
        const r = receiver[p];
        if (r >= 0) discharge[r] += discharge[p];
    }

    // ---- lakes: depression pixels grouped into components ----
    const lakeCand = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
        if (px.landPx[p] && fill[p] - elevPx[p] >= MIN_LAKE_DEPTH_KM) lakeCand[p] = 1;
    }
    const lakeId = new Int32Array(N).fill(-1);
    const lakes = [];
    const stack = new Int32Array(N);
    for (let start = 0; start < N; start++) {
        if (!lakeCand[start] || lakeId[start] !== -1) continue;
        const id = lakes.length;
        let top = 0;
        stack[top++] = start;
        lakeId[start] = id;
        const pixels = [];
        while (top > 0) {
            const p = stack[--top];
            pixels.push(p);
            const cnt = neighbors8(p, W, H, nb);
            for (let k = 0; k < cnt; k++) {
                const n = nb[k];
                if (lakeCand[n] && lakeId[n] === -1) { lakeId[n] = id; stack[top++] = n; }
            }
        }
        lakes.push(makeLake(id, pixels, grid, { fill, elevPx, petPx, discharge }));
    }

    // endorheic lakes shrink to their evaporation-balanced area: un-mark
    // pixels outside the equilibrium extent
    for (const lake of lakes) {
        if (!lake.endorheic) continue;
        for (const p of lake.dropped) lakeId[p] = -1;
    }
    const keptLakes = lakes
        .filter(l => l.areaKm2 >= MIN_LAKE_KM2)
        .sort((a, b) => b.areaKm2 - a.areaKm2);
    log(`  lakes: ${lakes.length} depressions, ${keptLakes.length} ≥ ${MIN_LAKE_KM2} km² after water balance`);

    const saltyAt = p => lakeId[p] !== -1 && lakes[lakeId[p]].endorheic;

    // ---- rivers ----
    // the river NETWORK includes freshwater-lake pixels (rivers thread
    // through lakes); the drawn river mask excludes them
    const lakeVisible = new Uint8Array(lakes.length);
    for (const lake of lakes) if (lake.areaKm2 >= DRAW_LAKE_KM2) lakeVisible[lake.id] = 1;

    const netPx = new Uint8Array(N);
    const riverPx = new Uint8Array(N);
    let riverCount = 0;
    for (let p = 0; p < N; p++) {
        if (!px.landPx[p] || discharge[p] < RIVER_KM3) continue;
        netPx[p] = 1;
        // drawn rivers: majors only, and not under a drawn lake
        if (discharge[p] >= MAJOR_RIVER_KM3 && (lakeId[p] === -1 || !lakeVisible[lakeId[p]])) {
            riverPx[p] = 1; riverCount++;
        }
    }
    // largest tributary upstream of each network pixel (for main-stem tracing)
    const bestUp = new Int32Array(N).fill(-1);
    for (let p = 0; p < N; p++) {
        if (!netPx[p]) continue;
        const r = receiver[p];
        if (r >= 0 && netPx[r] &&
            (bestUp[r] === -1 || discharge[p] > discharge[bestUp[r]])) {
            bestUp[r] = p;
        }
    }
    // mouths: network pixels draining into the sea or a terminal salt lake
    let candidates = [];
    for (let p = 0; p < N; p++) {
        if (!netPx[p] || discharge[p] < MAJOR_RIVER_KM3) continue;
        const r = receiver[p];
        const intoSea = r >= 0 && !px.landPx[r];
        const intoSalt = r >= 0 && saltyAt(r) && !saltyAt(p);
        if (!intoSea && !intoSalt) continue;
        candidates.push({ p, intoSalt });
    }
    candidates.sort((a, b) => discharge[b.p] - discharge[a.p]);
    // one mouth per delta: suppress weaker mouths near an accepted one
    const rivers = [];
    for (const cand of candidates) {
        const [mLat, mLon] = pxLL(grid, cand.p);
        let dup = false;
        for (const rv of rivers) {
            if (greatCircleKm(mLat, mLon, rv.mouthLat, rv.mouthLon) < MOUTH_DEDUPE_KM) { dup = true; break; }
        }
        if (dup) continue;
        // trace the main stem upstream along the largest tributary
        let lengthKm = 0, cur = cand.p, steps = 0;
        while (bestUp[cur] !== -1 && steps++ < 100000) {
            const up = bestUp[cur];
            const [aLat, aLon] = pxLL(grid, cur);
            const [bLat, bLon] = pxLL(grid, up);
            lengthKm += greatCircleKm(aLat, aLon, bLat, bLon);
            cur = up;
        }
        const [sLat, sLon] = pxLL(grid, cur);
        rivers.push({
            mouthPx: cand.p, mouthLat: mLat, mouthLon: mLon,
            srcLat: sLat, srcLon: sLon,
            dischargeKm3: discharge[cand.p], lengthKm,
            terminus: cand.intoSalt ? 'salt lake' : 'sea',
        });
    }
    log(`  rivers: ${riverCount.toLocaleString()} river pixels, ${candidates.length} mouth candidates -> ${rivers.length} major rivers (≥ ${MAJOR_RIVER_KM3} km³/yr)`);

    const saltyLake = new Uint8Array(lakes.length);
    for (const lake of lakes) if (lake.endorheic) saltyLake[lake.id] = 1;

    return {
        fill, receiver, discharge, riverPx, lakeId, saltyLake, lakeVisible,
        lakes: keptLakes, rivers,
        thresholds: { RIVER_KM3, MAJOR_RIVER_KM3, MIN_LAKE_KM2 },
    };
}

function pxLL(grid, p) {
    const { W, resDeg, rowLat } = grid;
    const py = (p / W) | 0, px = p - py * W;
    return [rowLat[py], (px + 0.5) * resDeg - 180];
}

function makeLake(id, pixels, grid, f) {
    const { W, rowArea } = grid;
    let areaKm2 = 0, surface = -Infinity, minElev = Infinity, pet = 0, inflow = 0;
    let sumLatA = 0, sumCosA = 0, sumSinA = 0, areaSum = 0;
    for (const p of pixels) {
        const a = rowArea[(p / W) | 0];
        areaKm2 += a;
        areaSum += a;
        if (f.fill[p] > surface) surface = f.fill[p];
        if (f.elevPx[p] < minElev) minElev = f.elevPx[p];
        pet += f.petPx[p] * a;
        if (f.discharge[p] > inflow) inflow = f.discharge[p]; // through-flowing main channel
        const [lat, lon] = pxLL(grid, p);
        const lr = lon * Math.PI / 180;
        sumLatA += lat * a; sumCosA += Math.cos(lr) * a; sumSinA += Math.sin(lr) * a;
    }
    const petMean = pet / areaKm2;
    const evapKm3 = petMean * areaKm2 / 1e6;
    const endorheic = inflow < evapKm3;
    let dropped = [];
    if (endorheic) {
        // keep only the deepest pixels up to the evaporation-balanced area
        const eqArea = Math.max(0, inflow * 1e6 / petMean);
        const sorted = [...pixels].sort((a, b) => f.elevPx[a] - f.elevPx[b]);
        let acc = 0;
        const kept = [];
        for (const p of sorted) {
            const a = rowArea[(p / W) | 0];
            if (acc + a <= eqArea || kept.length === 0) { acc += a; kept.push(p); }
            else dropped.push(p);
        }
        areaKm2 = acc;
        surface = kept.length ? Math.max(...kept.map(p => f.elevPx[p])) : minElev;
    }
    return {
        id, areaKm2,
        surfaceKm: surface, maxDepthKm: Math.max(0, surface - minElev),
        centroidLat: sumLatA / areaSum,
        centroidLon: Math.atan2(sumSinA, sumCosA) * 180 / Math.PI,
        inflowKm3: inflow, evapKm3,
        endorheic, dropped,
    };
}
