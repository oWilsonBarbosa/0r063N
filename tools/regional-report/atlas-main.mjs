#!/usr/bin/env node
// Physical Atlas generator: global plates + records gazetteer.
//
//   node tools/regional-report/atlas-main.mjs [--data DIR] [--out DIR] [--grid DEG]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, loadMeta, verifyData, tryLoadCache, saveCache } from './csv-load.mjs';
import { buildIcosahedron, assignRegion } from './icosahedron.mjs';
import { buildGrid, labelComponents, greatCircleKm } from './grid.mjs';
import { classifyAll, tempC, precipAnnualMm, KOPPEN_CLASSES } from './classify.mjs';
import { pixelFields, globalWaterBodies } from './analyze.mjs';
import { buildHydrology } from './hydrology.mjs';
import {
    plateRelief, plateErosion, plateTectonics, plateActivity, plateKoppen,
    plateTemperature, platePrecipitation, plateWinds, plateCurrents,
    plateBasins, plateNpp,
} from './atlas-plates.mjs';
import { profileChart, hypsometryChart, encodePNG } from './charts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

function parseArgs(argv) {
    const args = {
        data: path.join(repoRoot, 'data', 'orogen_regions_full'),
        out: path.join(repoRoot, 'reports', 'regional', 'atlas'),
        grid: 0.125,
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--data') args.data = path.resolve(argv[++i]);
        else if (a === '--out') args.out = path.resolve(argv[++i]);
        else if (a === '--grid') args.grid = parseFloat(argv[++i]);
        else throw new Error(`unknown argument: ${a}`);
    }
    return args;
}

const fmtInt = x => Math.round(x).toLocaleString('en-US');
const fmtDeg = (lat, lon) =>
    `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

async function main() {
    const args = parseArgs(process.argv);
    const meta = loadMeta(args.data);

    const cachePath = path.join('/tmp', `orogen-regional-cache-${meta.planetCode}.bin`);
    let data = tryLoadCache(cachePath, meta.numRegions);
    if (data) {
        data.meta = meta;
        log(`loaded ${data.n.toLocaleString()} cells from cache`);
    } else {
        log('loading CSV parts ...');
        data = await loadData(args.data, { log });
        saveCache(cachePath, data);
        log('cached');
    }
    verifyData(data, meta);
    log('data verified against metadata');

    const { faces } = buildIcosahedron();
    const grid = buildGrid(data, args.grid);
    const cls = classifyAll(data);
    // region assignment only needed for gazetteer references
    const regionByCell = new Uint8Array(data.n);
    for (let i = 0; i < data.n; i++) regionByCell[i] = assignRegion(faces, data.x[i], data.y[i], data.z[i]);
    const px = pixelFields(grid, data, cls, regionByCell);
    const water = globalWaterBodies(grid, data, px);
    const hydro = buildHydrology(grid, data, px, { log });
    const ctx = { grid, data, px, faces, water, hydro };
    log('raster, classification and hydrology ready');

    fs.mkdirSync(args.out, { recursive: true });
    const writePlate = (name, buf) => {
        fs.writeFileSync(path.join(args.out, name), buf);
        log(`  ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
    };

    log('rendering plates ...');
    writePlate('plate-01-relief.png', plateRelief(ctx));
    writePlate('plate-02-hypsometry.png', renderHypsometry(ctx));
    writePlate('plate-03-cross-sections.png', renderCrossSections(ctx));
    writePlate('plate-04-erosion.png', plateErosion(ctx));
    writePlate('plate-05-tectonic-plates.png', plateTectonics(ctx));
    writePlate('plate-06-tectonic-activity.png', plateActivity(ctx));
    writePlate('plate-07-koppen.png', plateKoppen(ctx));
    writePlate('plate-08-temperature.png', plateTemperature(ctx));
    writePlate('plate-09-precipitation.png', platePrecipitation(ctx));
    writePlate('plate-10-pressure-winds.png', plateWinds(ctx));
    writePlate('plate-11-ocean-currents.png', plateCurrents(ctx));
    writePlate('plate-12-drainage-basins.png', plateBasins(ctx));
    writePlate('plate-13-npp.png', plateNpp(ctx));

    log('compiling records gazetteer ...');
    const records = gazetteer(ctx, regionByCell);
    fs.writeFileSync(path.join(args.out, 'README.md'), atlasReadme(meta, records, hydro));
    log(`done — atlas in ${args.out}`);
}

// ---- Plate 02: hypsometry chart ----------------------------------------------

function renderHypsometry(ctx) {
    const { grid, data } = ctx;
    const { W, H, cellGrid, rowArea } = grid;
    // area-weighted elevation distribution in 250 m bins, -10..9 km
    const lo = -10, hi = 9, binKm = 0.25;
    const nBins = Math.round((hi - lo) / binKm);
    const bins = new Float64Array(nBins);
    let total = 0;
    for (let p = 0; p < W * H; p++) {
        const e = data.elev_km[cellGrid[p]];
        const a = rowArea[(p / W) | 0];
        const b = Math.max(0, Math.min(nBins - 1, Math.floor((e - lo) / binKm)));
        bins[b] += a;
        total += a;
    }
    const histBins = [...bins].map((a, i) => ({
        lo: lo + i * binKm, hi: lo + (i + 1) * binKm, frac: a / total,
    }));
    // cumulative: fraction of surface above elevation
    const cumPoints = [];
    let above = 0;
    for (let i = nBins - 1; i >= 0; i--) {
        above += bins[i];
        cumPoints.push({ elevKm: lo + i * binKm, frac: above / total });
    }
    const cv = hypsometryChart({
        title: 'PLATE 2 - HYPSOMETRIC CURVE',
        cumPoints, histBins,
    });
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 03: cross-sections --------------------------------------------------

function renderCrossSections(ctx) {
    const { grid, data, px } = ctx;
    const { W, H, cellGrid, rowArea } = grid;
    // meridian with the most land area
    const landByCol = new Float64Array(W);
    for (let p = 0; p < W * H; p++) {
        if (px.landPx[p]) landByCol[p % W] += rowArea[(p / W) | 0];
    }
    let bestCol = 0;
    for (let x = 0; x < W; x++) if (landByCol[x] > landByCol[bestCol]) bestCol = x;
    const bestLon = (bestCol + 0.5) * grid.resDeg - 180;

    const elevAt = (py, pxx) => data.elev_km[cellGrid[py * W + ((pxx % W) + W) % W]];

    const equator = [];
    const eqRow = Math.floor(H / 2);
    for (let x = 0; x < W; x++) equator.push({ t: x / (W - 1), elevKm: elevAt(eqRow, x) });

    const meridian = [];
    for (let y = 0; y < H; y++) meridian.push({ t: y / (H - 1), elevKm: elevAt(y, bestCol) });

    const cvA = profileChart({
        title: 'PLATE 3A - EQUATORIAL CROSS-SECTION (LAT 0, WEST TO EAST)',
        samples: equator,
        xTickLabels: [0, 0.25, 0.5, 0.75, 1].map(t => ({ t, label: `${Math.round(t * 360 - 180)}` })),
    });
    const cvB = profileChart({
        title: `PLATE 3B - MERIDIONAL CROSS-SECTION (LON ${bestLon.toFixed(1)}, NORTH TO SOUTH)`,
        samples: meridian,
        xTickLabels: [0, 0.25, 0.5, 0.75, 1].map(t => ({ t, label: `${Math.round(90 - t * 180)}` })),
    });
    // stack the two charts
    const wOut = Math.max(cvA.width, cvB.width);
    const out = { width: wOut, height: cvA.height + cvB.height, rgb: new Uint8Array(wOut * (cvA.height + cvB.height) * 3).fill(248) };
    for (let y = 0; y < cvA.height; y++) out.rgb.set(cvA.rgb.subarray(y * cvA.width * 3, (y + 1) * cvA.width * 3), y * wOut * 3);
    for (let y = 0; y < cvB.height; y++) out.rgb.set(cvB.rgb.subarray(y * cvB.width * 3, (y + 1) * cvB.width * 3), (cvA.height + y) * wOut * 3);
    return encodePNG(out.width, out.height, out.rgb);
}

// ---- records gazetteer ----------------------------------------------------------

function gazetteer(ctx, regionByCell) {
    const { grid, data, px, hydro } = ctx;
    const n = data.n;
    const reg = i => `Region ${String(regionByCell[i] + 1).padStart(2, '0')}`;
    const place = i => `${fmtDeg(data.lat[i], data.lon[i])} (${reg(i)})`;

    let hiI = 0, loI = 0, hotI = -1, coldI = -1, wetI = -1, dryI = -1;
    let hot = -Infinity, cold = Infinity, wet = -Infinity, dry = Infinity;
    for (let i = 0; i < n; i++) {
        if (data.elev_km[i] > data.elev_km[hiI]) hiI = i;
        if (data.elev_km[i] < data.elev_km[loI]) loI = i;
        if (!data.isLand[i]) continue;
        const tMax = Math.max(tempC(data.tS[i]), tempC(data.tW[i]));
        const tMin = Math.min(tempC(data.tS[i]), tempC(data.tW[i]));
        const pann = precipAnnualMm(data.pS[i], data.pW[i]);
        if (tMax > hot) { hot = tMax; hotI = i; }
        if (tMin < cold) { cold = tMin; coldI = i; }
        if (pann > wet) { wet = pann; wetI = i; }
        if (pann < dry) { dry = pann; dryI = i; }
    }

    // continents & islands from global land components
    const comps = labelComponents(grid, p => px.landPx[p] === 1).comps
        .sort((a, b) => b.areaKm2 - a.areaKm2);
    const continents = comps.filter(c => c.areaKm2 >= 3e6);
    const largestIsland = comps.find(c => c.areaKm2 < 3e6);

    const rivers = hydro.rivers;
    const longest = [...rivers].sort((a, b) => b.lengthKm - a.lengthKm)[0];
    const lakes = hydro.lakes;   // reported lakes are closed-basin (endorheic) only

    return {
        rows: [
            ['Highest peak', `${data.elev_km[hiI].toFixed(2)} km`, place(hiI)],
            ['Deepest trench', `${data.elev_km[loI].toFixed(2)} km`, place(loI)],
            ['Hottest place (seasonal mean)', `${hot.toFixed(1)} °C`, place(hotI)],
            ['Coldest place (seasonal mean)', `${cold.toFixed(1)} °C`, place(coldI)],
            ['Wettest place', `${fmtInt(wet)} mm/yr`, place(wetI)],
            ['Driest place', `${fmtInt(dry)} mm/yr`, place(dryI)],
            ['Continents (≥ 3 M km²)', `${continents.length}`,
                continents.map(c => `${fmtInt(c.areaKm2 / 1e6)}M km²`).join(', ')],
            ['Largest island', largestIsland ? `${fmtInt(largestIsland.areaKm2)} km²` : '—',
                largestIsland ? fmtDeg(largestIsland.centroidLat, largestIsland.centroidLon) : ''],
            ['Greatest river (discharge)', `${fmtInt(rivers[0].dischargeKm3)} km³/yr`,
                `mouth ${fmtDeg(rivers[0].mouthLat, rivers[0].mouthLon)}`],
            ['Longest river (main stem)', `${fmtInt(longest.lengthKm)} km`,
                `mouth ${fmtDeg(longest.mouthLat, longest.mouthLon)}`],
            ['Largest lake (endorheic)', lakes[0] ? `${fmtInt(lakes[0].areaKm2)} km²` : '—',
                lakes[0] ? fmtDeg(lakes[0].centroidLat, lakes[0].centroidLon) : ''],
            ['Major rivers planet-wide', `${rivers.length}`, '≥ 15 km³/yr at the mouth'],
            ['Lakes ≥ 2,000 km²', `${lakes.length}`, 'closed-basin (endorheic); see HYDROLOGY_VALIDATION.md'],
        ],
        topRivers: rivers.slice(0, 10),
        topLakes: hydro.lakes.slice(0, 10),
    };
}

function atlasReadme(meta, records, hydro) {
    const L = [];
    L.push(`# Physical Atlas of Planet \`${meta.planetCode}\``);
    L.push('');
    L.push(`A natural-physical atlas derived from the [World Orogen](${meta.url}) full export (seed ${meta.seed}, ${meta.numRegions.toLocaleString('en-US')} cells, ${meta.landFractionPct} % land). Everything below is computed from the simulation data; hydrology (rivers, lakes, basins) and NPP are derived by this tool — see the method notes at the end.`);
    L.push('');
    L.push('## I. Relief & Hypsometry');
    L.push('');
    L.push('![Plate 1 — Shaded relief](plate-01-relief.png)');
    L.push('');
    L.push('![Plate 2 — Hypsometric curve](plate-02-hypsometry.png)');
    L.push('');
    L.push('![Plate 3 — Cross-sections](plate-03-cross-sections.png)');
    L.push('');
    L.push('![Plate 4 — Erosion](plate-04-erosion.png)');
    L.push('');
    L.push('## II. Tectonics');
    L.push('');
    L.push('![Plate 5 — Tectonic plates](plate-05-tectonic-plates.png)');
    L.push('');
    L.push('![Plate 6 — Tectonic activity](plate-06-tectonic-activity.png)');
    L.push('');
    L.push('## III. Climate');
    L.push('');
    L.push('![Plate 7 — Köppen](plate-07-koppen.png)');
    L.push('');
    L.push('![Plate 8 — Temperature](plate-08-temperature.png)');
    L.push('');
    L.push('![Plate 9 — Precipitation](plate-09-precipitation.png)');
    L.push('');
    L.push('![Plate 10 — Pressure and winds](plate-10-pressure-winds.png)');
    L.push('');
    L.push('![Plate 11 — Ocean currents](plate-11-ocean-currents.png)');
    L.push('');
    L.push('## IV. Hydrography');
    L.push('');
    L.push('![Plate 12 — Drainage basins](plate-12-drainage-basins.png)');
    L.push('');
    L.push('## V. Ecology');
    L.push('');
    L.push('![Plate 13 — NPP](plate-13-npp.png)');
    L.push('');
    L.push('## VI. Planetary Records');
    L.push('');
    L.push('| Record | Value | Where |');
    L.push('|---|---|---|');
    for (const [a, b, c] of records.rows) L.push(`| ${a} | ${b} | ${c} |`);
    L.push('');
    L.push('### The ten great rivers');
    L.push('');
    L.push('| # | Discharge | Main stem | Mouth | Empties into |');
    L.push('|---|---|---|---|---|');
    records.topRivers.forEach((rv, i) => {
        L.push(`| ${i + 1} | ${fmtInt(rv.dischargeKm3)} km³/yr | ${fmtInt(rv.lengthKm)} km | ${fmtDeg(rv.mouthLat, rv.mouthLon)} | ${rv.terminus} |`);
    });
    L.push('');
    L.push('### The ten great lakes (closed-basin / endorheic)');
    L.push('');
    L.push('| # | Area | Surface | Max. depth | Where |');
    L.push('|---|---|---|---|---|');
    records.topLakes.forEach((lk, i) => {
        L.push(`| ${i + 1} | ${fmtInt(lk.areaKm2)} km² | ${fmtInt(lk.surfaceKm * 1000)} m | ${fmtInt(lk.maxDepthKm * 1000)} m | ${fmtDeg(lk.centroidLat, lk.centroidLon)} |`);
    });
    L.push('');
    L.push('## Method notes');
    L.push('');
    L.push('- Rasterized at 0.125° from the 2.56 M-cell Fibonacci-sphere export; all areas are cos-latitude weighted.');
    L.push('- **Relief, erosion, tectonics, Köppen, temperature, precipitation, pressure, winds, currents** come directly from exported per-cell fields (`elev_km`, `prePost`, `plate`, `stress`, `foldRidge`, `backArc`, `hotspot`, `koppen`, `tS/tW`, `pS/pW`, `prS/prW` [pressure], `wind*`, `oc*`, `ow*`).');
    L.push('- **Hydrology** is derived: priority-flood depression filling, steepest-descent routing, Ol\'dekop runoff, per-depression water balance. Only closed-basin (endorheic) lakes are reported; exorheic filled-depression lakes are suppressed as a coarse-DEM artifact — see [HYDROLOGY_VALIDATION.md](../HYDROLOGY_VALIDATION.md).');
    L.push('- **NPP** uses the Miami model: `min(3000/(1+e^(1.315−0.119T)), 3000(1−e^(−0.000664P)))` g/m²/yr, ice-corrected (Köppen-EF ice caps set to 0).');
    L.push('- Plate-boundary types on Plate 5 are heuristic: ridge field → divergent, high collision stress → convergent, otherwise transform.');
    L.push('- Seasons follow the northern-hemisphere convention (June vs December half-years).');
    L.push('');
    L.push('Regenerate with: `node tools/regional-report/atlas-main.mjs`');
    L.push('');
    return L.join('\n');
}

main().catch(err => {
    console.error(err.stack || String(err));
    process.exit(1);
});
