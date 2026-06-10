// Per-region geography analysis on the raster grid.
// All statistics are area-weighted (pixel area ~ cos latitude).

import { labelComponents, greatCircleKm, EARTH_R } from './grid.mjs';
import { fromLatLon, gnomonicForward, QUADRANT_NAMES } from './icosahedron.mjs';
import {
    TERRAIN_CLASSES, TERRAIN_OCEAN, BANDS, BAND_OCEAN, KOPPEN_CLASSES,
    tempC, precipAnnualMm,
} from './classify.mjs';

const RAIN_SHADOW_THRESHOLD = 0.15;
const MIN_ISLAND_KM2 = 600;          // ignore smaller specks as raster noise
const MAJOR_MASS_KM2 = 400_000;      // "continental" scale for hydrography
const MIN_MOUNTAIN_SYSTEM_KM2 = 5000;
const MIN_ENCLOSED_WATER_KM2 = 2000;
const INLAND_SEA_KM2 = 100_000;

// Per-pixel lookups resolved once (the raster stores cell indices).
export function pixelFields(grid, data, cls, regionByCell) {
    const { W, H, cellGrid } = grid;
    const N = W * H;
    const regionPx = new Uint8Array(N);
    const landPx = new Uint8Array(N);
    const mountainPx = new Uint8Array(N);
    const terrainPx = new Uint8Array(N);
    const bandPx = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
        const c = cellGrid[p];
        regionPx[p] = regionByCell[c];
        landPx[p] = data.isLand[c];
        mountainPx[p] = data.isMountain[c];
        terrainPx[p] = cls.terrain[c];
        bandPx[p] = cls.band[c];
    }
    return { regionPx, landPx, mountainPx, terrainPx, bandPx };
}

// Ocean connected components; the largest is the World Ocean, all others are
// enclosed seas / great lakes (below-sea-level water with no ocean outlet).
export function globalWaterBodies(grid, data, px) {
    const { cellGrid } = grid;
    const { labels, comps } = labelComponents(grid, p => !px.landPx[p], {
        value: p => -data.elev_km[cellGrid[p]],   // depth
    });
    let worldOceanId = 0;
    for (const c of comps) if (c.areaKm2 > comps[worldOceanId].areaKm2) worldOceanId = c.id;
    const enclosed = comps
        .filter(c => c.id !== worldOceanId && c.areaKm2 >= MIN_ENCLOSED_WATER_KM2)
        .map(c => ({
            id: c.id,
            areaKm2: c.areaKm2,
            maxDepthKm: c.maxVal,
            centroidLat: c.centroidLat,
            centroidLon: c.centroidLon,
            kind: c.areaKm2 >= INLAND_SEA_KM2 ? 'inland sea' : 'great lake',
        }));
    return { oceanLabels: labels, worldOceanId, enclosed };
}

// Multi-source BFS from World-Ocean pixels: nearest ocean pixel for every
// pixel (used only to phrase "likely drains <direction>" river inferences).
export function nearestOceanField(grid, oceanLabels, worldOceanId) {
    const { W, H } = grid;
    const N = W * H;
    const nearest = new Int32Array(N).fill(-1);
    const queue = new Int32Array(N);
    let head = 0, tail = 0;
    for (let p = 0; p < N; p++) {
        if (oceanLabels[p] === worldOceanId) { nearest[p] = p; queue[tail++] = p; }
    }
    while (head < tail) {
        const p = queue[head++];
        const py = (p / W) | 0, px = p - py * W;
        const left = px === 0 ? p + W - 1 : p - 1;
        const right = px === W - 1 ? p - W + 1 : p + 1;
        const visit = q => { if (nearest[q] === -1) { nearest[q] = nearest[p]; queue[tail++] = q; } };
        visit(left); visit(right);
        if (py > 0) visit(p - W);
        if (py < H - 1) visit(p + W);
    }
    return nearest;
}

// planet-wide area-weighted mean wind speed per season (normalizes the
// export's simulation-unit speeds for qualitative strength labels)
export function planetMeanWindSpeed(grid, data) {
    const { W, H, cellGrid, rowArea } = grid;
    let sS = 0, sW = 0, aSum = 0;
    for (let p = 0; p < W * H; p++) {
        const a = rowArea[(p / W) | 0];
        const c = cellGrid[p];
        sS += data.wsS[c] * a;
        sW += data.wsW[c] * a;
        aSum += a;
    }
    return { summer: sS / aSum, winter: sW / aSum };
}

function pxLatLon(grid, p) {
    const { W, resDeg, rowLat } = grid;
    const py = (p / W) | 0, px = p - py * W;
    return [rowLat[py], (px + 0.5) * resDeg - 180];
}

export function compassFrom(eMean, nMean) {
    // wind vector (toward) -> 16-point compass FROM-direction
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const bearing = (Math.atan2(eMean, nMean) * 180 / Math.PI + 180 + 360) % 360;
    return dirs[Math.round(bearing / 22.5) % 16];
}

export function compassToward(eMean, nMean) {
    const dirs = ['north', 'north-east', 'east', 'south-east',
        'south', 'south-west', 'west', 'north-west'];
    const bearing = (Math.atan2(eMean, nMean) * 180 / Math.PI + 360) % 360;
    return dirs[Math.round(bearing / 45) % 8];
}

function humidityClass(pannMm) {
    if (pannMm < 250) return 'arid';
    if (pannMm < 500) return 'semi-arid';
    if (pannMm < 1000) return 'sub-humid';
    return 'humid';
}

const trendName = (angleDeg) => {
    // angle of principal axis measured from north, folded to [0,180)
    const a = ((angleDeg % 180) + 180) % 180;
    if (a < 22.5 || a >= 157.5) return 'N-S';
    if (a < 67.5) return 'NE-SW';
    if (a < 112.5) return 'E-W';
    return 'NW-SE';
};

export function analyzeRegion(regionId, ctx) {
    const { grid, data, px, faces, water, nearestOcean } = ctx;
    const { W, H, cellGrid, rowArea } = grid;
    const N = W * H;
    const face = faces[regionId];

    // ---- single stats sweep over the region's pixels ----
    const quadPx = new Int8Array(N).fill(-1);
    let areaTotal = 0, areaLand = 0;
    const bandArea = new Float64Array(BANDS.length);
    const terrainArea = new Float64Array(TERRAIN_CLASSES.length);
    const koppenArea = new Float64Array(32);
    const reliefArea = new Float64Array(4); // lowland / hills / highlands / mountains
    // per-quadrant accumulators
    const q = Array.from({ length: 4 }, () => ({
        area: 0, landArea: 0,
        windES: 0, windNS: 0, windEW: 0, windNW: 0, wsS: 0, wsW: 0,
        pannA: 0, pSA: 0, pWA: 0, rsSA: 0, rsWA: 0,
    }));
    let tSsum = 0, tWsum = 0, pannSum = 0;
    let enclosedWaterArea = 0;

    for (let p = 0; p < N; p++) {
        if (px.regionPx[p] !== regionId) continue;
        const py = (p / W) | 0;
        const a = rowArea[py];
        const c = cellGrid[p];
        const [plat, plon] = pxLatLon(grid, p);
        const g = gnomonicForward(face, fromLatLon(plat, plon));
        const quad = g ? ((g[1] >= 0 ? 0 : 2) + (g[0] >= 0 ? 1 : 0)) : 0;
        quadPx[p] = quad;
        const Q = q[quad];

        areaTotal += a;
        Q.area += a;
        Q.windES += data.windES[c] * a; Q.windNS += data.windNS[c] * a;
        Q.windEW += data.windEW[c] * a; Q.windNW += data.windNW[c] * a;
        Q.wsS += data.wsS[c] * a; Q.wsW += data.wsW[c] * a;

        if (px.landPx[p]) {
            areaLand += a;
            Q.landArea += a;
            bandArea[px.bandPx[p]] += a;
            terrainArea[px.terrainPx[p]] += a;
            koppenArea[data.koppen[c]] += a;
            const e = data.elev_km[c];
            reliefArea[e < 0.3 ? 0 : e < 0.8 ? 1 : e < 2.0 ? 2 : 3] += a;
            const pann = precipAnnualMm(data.pS[c], data.pW[c]);
            Q.pannA += pann * a;
            Q.pSA += Math.max(0, data.pS[c]) * 1000 * a;
            Q.pWA += Math.max(0, data.pW[c]) * 1000 * a;
            if (data.rsSummer[c] > RAIN_SHADOW_THRESHOLD) Q.rsSA += a;
            if (data.rsWinter[c] > RAIN_SHADOW_THRESHOLD) Q.rsWA += a;
            tSsum += tempC(data.tS[c]) * a;
            tWsum += tempC(data.tW[c]) * a;
            pannSum += pann * a;
        } else if (water.oceanLabels[p] !== water.worldOceanId) {
            enclosedWaterArea += a;
        }
    }
    const landFrac = areaLand / areaTotal;

    // ---- land masses & hydrography ----
    const isReg = p => px.regionPx[p] === regionId;
    const landComps = labelComponents(grid,
        p => isReg(p) && px.landPx[p] === 1,
        { outsidePred: p => !isReg(p) && px.landPx[p] === 1 }).comps
        .filter(c => c.areaKm2 >= MIN_ISLAND_KM2);
    landComps.sort((a, b) => b.areaKm2 - a.areaKm2);
    const majorMasses = landComps.filter(c => c.touchesOutside || c.areaKm2 >= MAJOR_MASS_KM2);
    const islands = landComps.filter(c => !c.touchesOutside && c.areaKm2 < MAJOR_MASS_KM2);
    const largest = landComps[0] || null;

    const hydrography = classifyHydrography({
        landFrac, landComps, majorMasses, islands, largest, enclosedWaterArea, areaTotal,
    });

    // ---- mountain systems ----
    // dilate the mountain mask by one pixel (8-neighborhood) to bridge gaps
    const mDil = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
        if (!px.mountainPx[p] || px.regionPx[p] !== regionId) continue;
        const py = (p / W) | 0, pxc = p - py * W;
        for (let dy = -1; dy <= 1; dy++) {
            const ny = py + dy;
            if (ny < 0 || ny >= H) continue;
            for (let dx = -1; dx <= 1; dx++) {
                let nx = pxc + dx;
                if (nx < 0) nx = W - 1; else if (nx >= W) nx = 0;
                const np = ny * W + nx;
                if (px.landPx[np]) mDil[np] = 1;   // keep the mask on land
            }
        }
    }
    const mLabel = labelComponents(grid,
        p => mDil[p] === 1 && isReg(p),
        { connect8: true, value: p => data.elev_km[cellGrid[p]] });
    const sysComps = mLabel.comps.filter(c => c.areaKm2 >= MIN_MOUNTAIN_SYSTEM_KM2);
    sysComps.sort((a, b) => b.areaKm2 - a.areaKm2);

    // second pass: gnomonic PCA + mean precip per kept system
    const sysStats = new Map(sysComps.map(c => [c.id, {
        sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, aSum: 0, pann: 0, landA: 0,
    }]));
    for (let p = 0; p < N; p++) {
        const id = mLabel.labels[p];
        if (id === -1) continue;
        const s = sysStats.get(id);
        if (!s) continue;
        const py = (p / W) | 0;
        const a = rowArea[py];
        const [plat, plon] = pxLatLon(grid, p);
        const g = gnomonicForward(face, fromLatLon(plat, plon));
        if (!g) continue;
        s.sx += g[0] * a; s.sy += g[1] * a;
        s.sxx += g[0] * g[0] * a; s.syy += g[1] * g[1] * a; s.sxy += g[0] * g[1] * a;
        s.aSum += a;
        const c = cellGrid[p];
        if (px.landPx[p]) {
            s.pann += precipAnnualMm(data.pS[c], data.pW[c]) * a;
            s.landA += a;
        }
    }

    const mountainSystems = sysComps.map(c => {
        const s = sysStats.get(c.id);
        const mx = s.sx / s.aSum, my = s.sy / s.aSum;
        const vxx = s.sxx / s.aSum - mx * mx;
        const vyy = s.syy / s.aSum - my * my;
        const vxy = s.sxy / s.aSum - mx * my;
        const tr = vxx + vyy, det = vxx * vyy - vxy * vxy;
        const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
        const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
        // principal axis angle from north (gnomonic Y)
        const angle = Math.atan2(vxy, l1 - vyy) * 180 / Math.PI; // angle from X(east)
        const fromNorth = 90 - angle;
        const lengthKm = Math.sqrt(12 * l1) * EARTH_R;
        const widthKm = Math.sqrt(12 * l2) * EARTH_R;
        const [peakLat, peakLon] = c.maxValPx >= 0 ? pxLatLon(grid, c.maxValPx) : [c.centroidLat, c.centroidLon];
        return {
            areaKm2: c.areaKm2,
            quadrant: QUADRANT_NAMES[((my >= 0 ? 0 : 2) + (mx >= 0 ? 1 : 0))],
            centroidLat: c.centroidLat, centroidLon: c.centroidLon,
            lengthKm, widthKm,
            trend: trendName(fromNorth),
            peakKm: c.maxVal, meanElevKm: c.meanVal,
            peakLat, peakLon,
            meanPannMm: s.landA > 0 ? s.pann / s.landA : 0,
        };
    });

    // ---- river inference for humid mountain systems ----
    const rivers = [];
    const riverKeys = new Set();
    for (const m of mountainSystems.slice(0, 5)) {
        if (m.meanPannMm < 600) continue;
        // centroid pixel -> nearest world-ocean pixel -> drainage direction
        let cpx = Math.floor((m.centroidLon + 180) / grid.resDeg);
        if (cpx >= W) cpx -= W; if (cpx < 0) cpx += W;
        let cpy = Math.floor((90 - m.centroidLat) / grid.resDeg);
        cpy = Math.max(0, Math.min(H - 1, cpy));
        const target = nearestOcean[cpy * W + cpx];
        if (target < 0) continue;
        const [tlat, tlon] = pxLatLon(grid, target);
        let dLon = tlon - m.centroidLon;
        if (dLon > 180) dLon -= 360; else if (dLon < -180) dLon += 360;
        const e = dLon * Math.cos(m.centroidLat * Math.PI / 180);
        const nrt = tlat - m.centroidLat;
        const distKm = greatCircleKm(m.centroidLat, m.centroidLon, tlat, tlon);
        const toward = compassToward(e, nrt);
        const key = `${m.quadrant}:${toward}`;
        if (riverKeys.has(key)) continue;   // one statement per quadrant+direction
        riverKeys.add(key);
        rivers.push({ system: m, toward, coastKm: distKm });
        if (rivers.length >= 3) break;
    }

    // ---- enclosed water bodies in this region ----
    const regionWaters = [];
    for (const wbody of water.enclosed) {
        // area of this body inside the region
        let inside = 0;
        // cheap: classify by centroid; exact overlap only when centroid is in-region
        let cpx = Math.floor((wbody.centroidLon + 180) / grid.resDeg);
        if (cpx >= W) cpx -= W; if (cpx < 0) cpx += W;
        let cpy = Math.max(0, Math.min(H - 1, Math.floor((90 - wbody.centroidLat) / grid.resDeg)));
        if (px.regionPx[cpy * W + cpx] === regionId) inside = wbody.areaKm2;
        if (inside > 0) {
            regionWaters.push({ ...wbody, quadrant: QUADRANT_NAMES[quadPx[cpy * W + cpx] === -1 ? 0 : quadPx[cpy * W + cpx]] });
        }
    }
    regionWaters.sort((a, b) => b.areaKm2 - a.areaKm2);

    // ---- notable single-terrain expanses ----
    const groups = {
        desert: [1, 2], jungle: [10, 11], forest: [7, 8, 9],
        grassland: [4, 5, 6], glacier: [15],
    };
    const expanses = [];
    for (const [gname, ids] of Object.entries(groups)) {
        const set = new Set(ids);
        const comps = labelComponents(grid,
            p => isReg(p) && px.landPx[p] === 1 && set.has(px.terrainPx[p])).comps
            .filter(c => c.areaKm2 >= 100_000)
            .sort((a, b) => b.areaKm2 - a.areaKm2);
        if (comps.length) {
            const c = comps[0];
            const qd = quadrantOfLatLon(face, c.centroidLat, c.centroidLon);
            expanses.push({ group: gname, areaKm2: c.areaKm2, quadrant: QUADRANT_NAMES[qd] });
        }
    }

    // ---- quadrant wind/moisture summaries ----
    // wind strength is reported relative to the planet's area-weighted mean
    // speed for the season (the export's wind speeds are in simulation units)
    const quadrants = q.map((Q, i) => {
        const mkSeason = (es, ns, ws, planetMean) => {
            const e = es / Q.area, n0 = ns / Q.area, spd = ws / Q.area;
            const mag = Math.hypot(e, n0);
            const rel = spd / planetMean;
            return {
                from: compassFrom(e, n0),
                strength: rel < 0.7 ? 'light' : rel < 1.4 ? 'moderate' : 'strong',
                variable: mag < 0.4 * spd,
            };
        };
        return {
            name: QUADRANT_NAMES[i],
            landFrac: Q.area > 0 ? Q.landArea / Q.area : 0,
            summer: Q.area > 0 ? mkSeason(Q.windES, Q.windNS, Q.wsS, ctx.meanWindSpeed.summer) : null,
            winter: Q.area > 0 ? mkSeason(Q.windEW, Q.windNW, Q.wsW, ctx.meanWindSpeed.winter) : null,
            pannMm: Q.landArea > 0 ? Q.pannA / Q.landArea : null,
            humidity: Q.landArea > 0 ? humidityClass(Q.pannA / Q.landArea) : null,
            seasonality: Q.landArea > 0 ? seasonality(Q.pSA, Q.pWA) : null,
            rainShadowFrac: Q.landArea > 0
                ? Math.max(Q.rsSA, Q.rsWA) / Q.landArea : 0,
        };
    });

    // top koppen classes on land
    const koppenTop = [...koppenArea.keys()]
        .filter(k => koppenArea[k] > 0)
        .sort((a, b) => koppenArea[b] - koppenArea[a])
        .slice(0, 6)
        .map(k => ({
            code: KOPPEN_CLASSES[k].code, name: KOPPEN_CLASSES[k].name,
            frac: koppenArea[k] / areaLand,
        }));

    return {
        regionId, face,
        areaTotal, areaLand, landFrac,
        hydrography,
        landComps, majorMasses, islands,
        mountainSystems, reliefArea,
        bandArea, terrainArea, koppenTop,
        meanTsummerC: areaLand > 0 ? tSsum / areaLand : null,
        meanTwinterC: areaLand > 0 ? tWsum / areaLand : null,
        meanPannMm: areaLand > 0 ? pannSum / areaLand : null,
        quadrants,
        regionWaters, enclosedWaterArea,
        rivers, expanses,
    };
}

function quadrantOfLatLon(face, lat, lon) {
    const g = gnomonicForward(face, fromLatLon(lat, lon));
    if (!g) return 0;
    return (g[1] >= 0 ? 0 : 2) + (g[0] >= 0 ? 1 : 0);
}

function seasonality(pSA, pWA) {
    const tot = pSA + pWA;
    if (tot <= 0) return 'negligible';
    if (pSA / tot > 0.65) return 'summer-wet';
    if (pWA / tot > 0.65) return 'winter-wet';
    return 'year-round';
}

function classifyHydrography({ landFrac, majorMasses, islands, largest, enclosedWaterArea, areaTotal }) {
    const numbers = { landFrac, islandCount: islands.length, largestKm2: largest ? largest.areaKm2 : 0, enclosedWaterArea };
    let label;
    if (landFrac < 0.005 || !largest) {
        label = 'Open ocean';
    } else if (landFrac < 0.15) {
        if (majorMasses.length === 0) {
            if (islands.length >= 6 && largest.areaKm2 < 25_000) label = 'Archipelago';
            else if (largest.areaKm2 >= MAJOR_MASS_KM2) label = 'Island-continent';
            else if (largest.areaKm2 >= 25_000) label = 'Major island(s)';
            else label = 'Archipelago';
        } else {
            label = islands.length >= 3 ? 'Coastline with offshore islands' : 'Coastline, no significant islands';
        }
    } else if (landFrac < 0.70) {
        if (majorMasses.length >= 2) label = 'Multiple coastlines';
        else if (islands.filter(i => i.areaKm2 >= 500).length >= 3) label = 'Coastline with offshore islands';
        else label = 'Coastline, no significant islands';
    } else {
        const waterFrac = 1 - landFrac;
        if (enclosedWaterArea >= 50_000) label = 'Land with inland sea';
        else if (waterFrac > 0.01) label = 'Land with minor bodies of water';
        else label = 'Land, no significant water';
    }
    return { label, ...numbers };
}
