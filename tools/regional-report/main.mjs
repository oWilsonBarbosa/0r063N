#!/usr/bin/env node
// Regional geography reports from the Orogen full CSV export.
//
//   node tools/regional-report/main.mjs [--data DIR] [--out DIR] [--grid DEG]
//        [--region N] [--no-maps] [--verify] [--no-cache]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, loadMeta, verifyData, tryLoadCache, saveCache } from './csv-load.mjs';
import { buildIcosahedron, assignAllRegions } from './icosahedron.mjs';
import { buildGrid } from './grid.mjs';
import { classifyAll } from './classify.mjs';
import { pixelFields, globalWaterBodies, nearestOceanField, analyzeRegion, planetMeanWindSpeed } from './analyze.mjs';
import { renderRegionMap, renderOverview, renderLegend } from './maps.mjs';
import { regionReport, indexReadme } from './report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

function parseArgs(argv) {
    const args = {
        data: path.join(repoRoot, 'data', 'orogen_regions_full'),
        out: path.join(repoRoot, 'output'),
        grid: 0.125,
        region: null,
        maps: true,
        verify: false,
        cache: true,
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--data') args.data = path.resolve(argv[++i]);
        else if (a === '--out') args.out = path.resolve(argv[++i]);
        else if (a === '--grid') args.grid = parseFloat(argv[++i]);
        else if (a === '--region') args.region = parseInt(argv[++i], 10);
        else if (a === '--no-maps') args.maps = false;
        else if (a === '--verify') args.verify = true;
        else if (a === '--no-cache') args.cache = false;
        else throw new Error(`unknown argument: ${a}`);
    }
    return args;
}

const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(1)}s]`;
const log = (msg) => console.log(`${stamp()} ${msg}`);

async function main() {
    const args = parseArgs(process.argv);
    const meta = loadMeta(args.data);

    // ---- load (with /tmp binary cache for fast re-runs) ----
    const cachePath = path.join('/tmp', `orogen-regional-cache-${meta.planetCode}.bin`);
    let data = args.cache ? tryLoadCache(cachePath, meta.numRegions) : null;
    if (data) {
        data.meta = meta;
        log(`loaded ${data.n.toLocaleString()} cells from cache ${cachePath}`);
    } else {
        log(`loading CSV parts from ${args.data} ...`);
        data = await loadData(args.data, { log });
        if (args.cache) {
            saveCache(cachePath, data);
            log(`cached columns to ${cachePath}`);
        }
    }

    // ---- verify against export metadata ----
    log('verifying against orogen_meta_full.json ...');
    const v = verifyData(data, meta);
    log(`verified: ${v.landCount.toLocaleString()} land cells, elev ${v.minElev.toFixed(3)}..${v.maxElev.toFixed(3)} km, Köppen histogram exact`);
    if (args.verify) { log('--verify only: done.'); return; }

    // ---- partition & raster ----
    const { faces } = buildIcosahedron();
    const regionByCell = assignAllRegions(faces, data.x, data.y, data.z);
    {
        const counts = new Array(20).fill(0);
        for (let i = 0; i < data.n; i++) counts[regionByCell[i]]++;
        const min = Math.min(...counts), max = Math.max(...counts);
        log(`region assignment: ${min.toLocaleString()}..${max.toLocaleString()} cells per face (expect ~${Math.round(data.n / 20).toLocaleString()})`);
        if (min < data.n / 20 * 0.9 || max > data.n / 20 * 1.1) {
            throw new Error('face assignment is unbalanced — orientation bug?');
        }
    }

    log(`rasterizing at ${args.grid}° ...`);
    const grid = buildGrid(data, args.grid);
    const cls = classifyAll(data);
    const px = pixelFields(grid, data, cls, regionByCell);
    {
        let landA = 0, totA = 0;
        for (let p = 0; p < grid.W * grid.H; p++) {
            const a = grid.rowArea[(p / grid.W) | 0];
            totA += a;
            if (px.landPx[p]) landA += a;
        }
        const landPct = 100 * landA / totA;
        log(`raster: ${grid.W}×${grid.H}, total ${(totA / 1e6).toFixed(2)}M km², land ${landPct.toFixed(2)} % (meta: ${meta.landFractionPct} %)`);
        if (Math.abs(landPct - meta.landFractionPct) > 0.3) {
            throw new Error('raster land fraction deviates from metadata');
        }
    }

    log('detecting water bodies (global ocean components) ...');
    const water = globalWaterBodies(grid, data, px);
    log(`world ocean + ${water.enclosed.length} enclosed water bodies ≥ 2,000 km²`);
    const nearestOcean = nearestOceanField(grid, water.oceanLabels, water.worldOceanId);

    const ctx = { grid, data, px, faces, water, nearestOcean, meanWindSpeed: planetMeanWindSpeed(grid, data) };

    // ---- output ----
    const regionsDir = path.join(args.out, 'regions');
    const mapsDir = path.join(args.out, 'maps');
    fs.mkdirSync(regionsDir, { recursive: true });
    fs.mkdirSync(mapsDir, { recursive: true });

    const wanted = args.region ? [args.region - 1] : [...Array(20).keys()];
    const results = [];
    for (const rid of wanted) {
        const r = analyzeRegion(rid, ctx);
        results.push(r);
        const nn = String(rid + 1).padStart(2, '0');
        fs.writeFileSync(path.join(regionsDir, `region_${nn}.md`), regionReport(r));
        if (args.maps) {
            fs.writeFileSync(path.join(mapsDir, `region_${nn}.png`), renderRegionMap(rid, ctx));
        }
        log(`region ${nn}: ${r.hydrography.label}, land ${(100 * r.landFrac).toFixed(1)} %, ${r.mountainSystems.length} mountain system(s)`);
    }

    if (args.maps) {
        log('rendering overview & legend ...');
        fs.writeFileSync(path.join(mapsDir, 'overview.png'), renderOverview(ctx));
        fs.writeFileSync(path.join(mapsDir, 'legend.png'), renderLegend());
    }

    if (!args.region) {
        const partitionNote = 'The globe is divided into the 20 triangular faces of an icosahedron with one vertex at each pole (the book\'s "polyhedral mapping system"): regions 01–05 ring the north pole, 06–15 span the equatorial belt, and 16–20 ring the south pole. Faces are numbered by descending center latitude, then ascending longitude; the partition\'s rotation about the polar axis is arbitrary (a north-cap face is centered on the 36° E meridian). Each face covers ~25.5 M km².';
        fs.writeFileSync(path.join(args.out, 'README.md'), indexReadme(meta, results, partitionNote));
    }
    log(`done — output in ${args.out}`);
}

main().catch(err => {
    console.error(err.stack || String(err));
    process.exit(1);
});
