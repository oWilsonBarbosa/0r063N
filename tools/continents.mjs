// Per-land-cell continent membership by connected landmass.
//
// A Node port of `tools/tectonics-pipeline/lib/continents.py`, kept in sync
// with it — the same relationship `tools/tectonics-pipeline/lib/biogeo.py` has
// to `tools/regional-report/classify.mjs`, in the other direction.
//
// Why this exists: the culture layer's province rules originally separated
// Meridia from Selvana on a **meridian** (`lat < 23 && lon < -128`) because the
// export carries no continent id and a naive flood fill merges them across the
// Equatorial Western Sea island chain. That proxy drops 1.80 Mkm2 of land
// planet-wide (1.69 % of all land) and undercounts Selvana by 1.39 Mkm2
// (-5.1 %) against reports/tectonics/inventory.json — see docs/life/05 section 7.
//
// The tectonics pipeline already had the right answer and the Node tools simply
// could not reach it: connected components of the rasterised land mask, keyed to
// the authoritative continent centroids in inventory.json. This module makes
// that definition available to the zero-dependency Node tools, so the culture
// layer, the regional ecologies and the biogeography all partition the planet
// the same way.
//
// Faithful to the Python in every detail that changes the answer: the same
// 2048x1024 equirectangular grid, the same majority rasterisation (ties to
// land), the same 8-neighbour categorical gap fill (16 passes, longitude wrap,
// row clamp), and the same 4-connected labelling with longitude wrap.
//
//   import { buildContinentIndex, ISLANDS } from '../continents.mjs';
//   const cont = await buildContinentIndex();
//   cont.at(lat, lon);        // 'Meridia' | 'Sirocca' | 'Selvana' | 'Borea' | 'Islands'

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data/orogen_regions_full_v2');
const INVENTORY = path.join(ROOT, 'reports/tectonics/inventory.json');

export const ISLANDS = 'Islands';
const GW = 2048, GH = 1024;                       // raster.py W, H

const col = lon => Math.min(GW - 1, Math.max(0, Math.floor((lon + 180) / 360 * GW)));
const row = lat => Math.min(GH - 1, Math.max(0, Math.floor((90 - lat) / 180 * GH)));

// raster.py NEIGHBORS, in the same order (it decides gap-fill ties)
const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

export async function buildContinentIndex({ dataDir = DATA, inventoryPath = INVENTORY } = {}) {
    // ---- rasterize_mode(isLand) --------------------------------------------
    // Majority vote per pixel; ties go to land, matching the Python lexsort,
    // where the higher category code wins an equal count.
    const nLand = new Int32Array(GW * GH);
    const nSea = new Int32Array(GW * GH);

    let idx = null;
    for (const part of fs.readdirSync(dataDir).filter(f => f.endsWith('.csv.gz')).sort()) {
        const rl = readline.createInterface({
            input: fs.createReadStream(path.join(dataDir, part)).pipe(zlib.createGunzip()),
            crlfDelay: Infinity,
        });
        let header = true;
        for await (const line of rl) {
            if (header) { header = false; if (!idx) idx = Object.fromEntries(line.split(',').map((k, i) => [k, i])); continue; }
            const f = line.split(',');
            const p = row(+f[idx.lat]) * GW + col(+f[idx.lon]);
            if (+f[idx.isLand] === 1) nLand[p]++; else nSea[p]++;
        }
    }

    const EMPTY = -1;
    let grid = new Int8Array(GW * GH);
    for (let i = 0; i < grid.length; i++) {
        grid[i] = (nLand[i] === 0 && nSea[i] === 0) ? EMPTY : (nLand[i] >= nSea[i] ? 1 : 0);
    }

    // ---- fill_gaps_categorical(grid, empty=-1, passes=16) -------------------
    for (let pass = 0; pass < 16; pass++) {
        let holes = 0;
        for (let i = 0; i < grid.length; i++) if (grid[i] === EMPTY) { holes = 1; break; }
        if (!holes) break;
        for (const [dr, dc] of NEIGHBORS) {
            const next = grid.slice();
            for (let r = 0; r < GH; r++) {
                const sr = Math.min(GH - 1, Math.max(0, r - dr));   // row clamp, as _shift
                for (let c = 0; c < GW; c++) {
                    const i = r * GW + c;
                    if (next[i] !== EMPTY) continue;
                    const sc = ((c - dc) % GW + GW) % GW;            // longitude wrap
                    const v = grid[sr * GW + sc];
                    if (v !== EMPTY) next[i] = v;
                }
            }
            grid = next;
        }
    }

    // ---- connected_components(land): 4-connected, longitude wrap -----------
    const labels = new Int32Array(GW * GH);
    let count = 0;
    const stack = new Int32Array(GW * GH);
    for (let r0 = 0; r0 < GH; r0++) {
        for (let c0 = 0; c0 < GW; c0++) {
            const start = r0 * GW + c0;
            if (grid[start] !== 1 || labels[start]) continue;
            count++;
            let sp = 0;
            stack[sp++] = start;
            labels[start] = count;
            while (sp) {
                const i = stack[--sp];
                const r = (i / GW) | 0, c = i % GW;
                for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const nr = r + dr;
                    if (nr < 0 || nr >= GH) continue;
                    const nc = ((c + dc) % GW + GW) % GW;
                    const j = nr * GW + nc;
                    if (grid[j] === 1 && !labels[j]) { labels[j] = count; stack[sp++] = j; }
                }
            }
        }
    }

    // ---- label -> authored continent name, via inventory centroids ---------
    const inv = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const label2name = new Map();
    const nameToCratons = new Map([[ISLANDS, '—']]);
    for (const [key, c] of Object.entries(inv.continents)) {
        const name = c.name || key;
        const r = row(c.centroid[0]), cc = col(c.centroid[1]);
        let lab = labels[r * GW + cc];
        if (lab === 0) {                                  // centroid on ocean: nearest land label
            let best = Infinity;
            for (let rr = 0; rr < GH; rr++) for (let ccc = 0; ccc < GW; ccc++) {
                const l = labels[rr * GW + ccc];
                if (!l) continue;
                const d = (rr - r) ** 2 + (ccc - cc) ** 2;
                if (d < best) { best = d; lab = l; }
            }
        }
        label2name.set(lab, name);
        nameToCratons.set(name, c.cratons.join('·'));
    }

    const at = (lat, lon) => label2name.get(labels[row(lat) * GW + col(lon)]) ?? ISLANDS;
    return { at, labels, nameToCratons, gridW: GW, gridH: GH, componentCount: count };
}
