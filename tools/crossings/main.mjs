// Crossings — how far apart two landmasses actually are, and how hard the gap
// between them is to cross.
//
// The province tools (../province-vectors, ../province-ecology) describe land.
// This one describes the water between land, which is what decides dispersal:
//
//   * the narrowest coast-to-coast gap between two continents, and where it is
//   * that gap broken down by latitude, so a "narrow sea" can be checked
//     against the latitude its name claims
//   * the same crossing re-solved with islands as stepping stones, minimising
//     the LONGEST single open-water leg rather than the total distance — the
//     quantity that actually gates a crossing
//   * whether two points on one continent are connected by land below a given
//     height, and the lowest ceiling that connects them (the pass)
//   * the Köppen composition of a shore box, for what a departure coast is like
//
// Continent assignment is ../continents.mjs (connected landmass), identical to
// the province tools, so every figure here agrees with the published vectors.
//
// Zero dependencies.
//
//   node tools/crossings/main.mjs --pair Meridia,Selvana
//   node tools/crossings/main.mjs --pair Meridia,Selvana --hops --frame 20,36,-160,-140
//   node tools/crossings/main.mjs --corridor --from 21,-97 --to 27.5,-148.4 --band 20,34
//   node tools/crossings/main.mjs --shore 25,30,-152,-144

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { elevToHeightKm } from '../height-mapping.mjs';
import { KOPPEN_CLASSES } from '../regional-report/classify.mjs';
import { buildContinentIndex, ISLANDS } from '../continents.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'data/orogen_regions_full_v2');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);
const nums = (s, d) => (s ? s.split(',').map(Number) : d);

const PAIR = flag('--pair', 'Meridia,Selvana').split(',');
const FRAME = nums(flag('--frame'), null);          // lat0,lat1,lon0,lon1 for --hops
const FROM = nums(flag('--from'), null);
const TO = nums(flag('--to'), null);
const BAND = nums(flag('--band'), [20, 34]);
const SHORE = nums(flag('--shore'), null);

const R = 6371, D = Math.PI / 180;
const haversine = (a, b) => {
    const dLat = (b.lat - a.lat) * D, dLon = (b.lon - a.lon) * D;
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * D) * Math.cos(b.lat * D) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
};

// --- one pass over the export -----------------------------------------------
const continents = await buildContinentIndex();
const coast = new Map([[PAIR[0], []], [PAIR[1], []]]);   // continent -> coastal cells
const islands = [];                                       // island cells (any)
const land = [];                                          // land in the corridor band
const shoreCells = [];

let idx = null;
for (const part of fs.readdirSync(DATA).filter(f => f.endsWith('.csv.gz')).sort()) {
    const rl = readline.createInterface({
        input: fs.createReadStream(path.join(DATA, part)).pipe(zlib.createGunzip()),
        crlfDelay: Infinity,
    });
    let header = true;
    for await (const line of rl) {
        if (header) { header = false; if (!idx) idx = Object.fromEntries(line.split(',').map((k, i) => [k, i])); continue; }
        const f = line.split(',');
        if (+f[idx.isLand] !== 1) continue;
        const lat = +f[idx.lat], lon = +f[idx.lon];
        const nm = continents.at(lat, lon);
        const heightKm = elevToHeightKm(+f[idx.elev]);
        const code = (KOPPEN_CLASSES[+f[idx.koppen]] || {}).code || '??';
        const onCoast = +f[idx.isSurfaceCoast] === 1;

        if (onCoast && coast.has(nm)) coast.get(nm).push({ lat, lon });
        if (nm === ISLANDS) islands.push({ lat, lon });
        if (FROM && lat >= BAND[0] && lat <= BAND[1] && nm === PAIR[0]) land.push({ lat, lon, heightKm });
        if (SHORE && lat >= SHORE[0] && lat <= SHORE[1] && lon >= SHORE[2] && lon <= SHORE[3] && nm === PAIR[0]) {
            shoreCells.push({ code });
        }
    }
}

const A = coast.get(PAIR[0]), B = coast.get(PAIR[1]);
console.log(`coastal cells: ${PAIR[0]} ${A.length} · ${PAIR[1]} ${B.length} · islands ${islands.length}`);

// --- the narrowest gap, overall and by latitude ------------------------------
if (!has('--corridor') && !has('--shore-only')) {
    let best = null;
    for (const a of A) for (const b of B) {
        const d = haversine(a, b);
        if (!best || d < best.d) best = { d, a, b };
    }
    console.log(`\nnarrowest ${PAIR[0]} -> ${PAIR[1]} gap: ${best.d.toFixed(0)} km`);
    console.log(`  ${best.a.lat.toFixed(1)} N ${best.a.lon.toFixed(1)} E  ->  ${best.b.lat.toFixed(1)} N ${best.b.lon.toFixed(1)} E`);

    console.log(`\nby 10-degree latitude band of the ${PAIR[0]} shore:`);
    for (let la = -80; la < 80; la += 10) {
        const band = A.filter(a => a.lat >= la && a.lat < la + 10);
        if (!band.length) continue;
        let m = Infinity, at = null;
        for (const a of band) for (const b of B) { const d = haversine(a, b); if (d < m) { m = d; at = a; } }
        console.log(`  ${String(la).padStart(4)}..${String(la + 10).padEnd(4)} ${m.toFixed(0).padStart(6)} km   (${at.lat.toFixed(1)}, ${at.lon.toFixed(1)})`);
    }
}

// --- the crossing with islands as stepping stones ----------------------------
// Minimax, not shortest-path: a crossing is gated by its worst leg, so the route
// that matters is the one whose longest single open-water hop is smallest.
if (has('--hops')) {
    const inFrame = c => !FRAME || (c.lat >= FRAME[0] && c.lat <= FRAME[1] && c.lon >= FRAME[2] && c.lon <= FRAME[3]);
    const src = A.filter(inFrame), dst = B.filter(inFrame), mid = islands.filter(inFrame);
    const nodes = [...src, ...mid, ...dst];
    const isDst = new Set(dst);
    console.log(`\nstepping-stone frame: ${src.length} ${PAIR[0]} · ${mid.length} island · ${dst.length} ${PAIR[1]} cells`);

    const worst = new Map(nodes.map(n => [n, Infinity]));
    for (const s of src) worst.set(s, 0);
    const pending = new Set(nodes);
    while (pending.size) {
        let cur = null, cv = Infinity;
        for (const n of pending) if (worst.get(n) < cv) { cv = worst.get(n); cur = n; }
        if (!cur || cv === Infinity) break;
        pending.delete(cur);
        if (isDst.has(cur)) break;                       // first destination settled wins
        for (const n of pending) {
            const w = Math.max(cv, haversine(cur, n));
            if (w < worst.get(n)) worst.set(n, w);
        }
    }
    const longest = Math.min(...dst.map(d => worst.get(d)));
    console.log(`longest single open-water leg, islands used: ${longest.toFixed(0)} km`);
}

// --- land corridor: is there a route below a height ceiling? -----------------
if (has('--corridor')) {
    if (!FROM || !TO) { console.error('--corridor needs --from lat,lon and --to lat,lon'); process.exit(1); }
    const RES = 0.25;
    const [lat0, lat1] = [Math.min(FROM[0], TO[0]) - 20, Math.max(FROM[0], TO[0]) + 20];
    const [lon0, lon1] = [Math.min(FROM[1], TO[1]) - 20, Math.max(FROM[1], TO[1]) + 20];
    const W = Math.round((lon1 - lon0) / RES), H = Math.round((lat1 - lat0) / RES);
    const cellOf = (lat, lon) => {
        const x = Math.floor((lon - lon0) / RES), y = Math.floor((lat1 - lat) / RES);
        return (x < 0 || x >= W || y < 0 || y >= H) ? -1 : y * W + x;
    };
    const hgt = new Float32Array(W * H).fill(Infinity);
    for (const c of land) {
        const p = cellOf(c.lat, c.lon);
        if (p >= 0 && c.heightKm < hgt[p]) hgt[p] = c.heightKm;      // lowest ground wins
    }
    const S = cellOf(FROM[0], FROM[1]), T = cellOf(TO[0], TO[1]);
    const NB = [-1, 1, -W, W];
    const reaches = ceil => {
        if (hgt[S] > ceil || hgt[T] > ceil) return false;
        const seen = new Uint8Array(W * H); const q = [S]; seen[S] = 1;
        for (let i = 0; i < q.length; i++) {
            const c = q[i], x = c % W;
            for (const d of NB) {
                const n = c + d;
                if (n < 0 || n >= W * H || seen[n] || hgt[n] > ceil) continue;
                if (Math.abs((n % W) - x) > 1) continue;             // no row wrap
                seen[n] = 1; q.push(n);
            }
        }
        return !!seen[T];
    };
    console.log(`\ncorridor ${FROM} -> ${TO}, band ${BAND[0]}..${BAND[1]} N, straight-line ${haversine({ lat: FROM[0], lon: FROM[1] }, { lat: TO[0], lon: TO[1] }).toFixed(0)} km`);
    for (const ceil of [1.0, 1.5, 2.0, 2.5, 3.0, Infinity]) {
        console.log(`  ceiling ${String(ceil).padStart(8)} km -> connected: ${reaches(ceil) ? 'YES' : 'no'}`);
    }
    if (reaches(Infinity)) {
        let lo = 0, hi = 8;
        for (let i = 0; i < 40 && hi - lo > 0.05; i++) { const m = (lo + hi) / 2; if (reaches(m)) hi = m; else lo = m; }
        console.log(`  lowest connecting ceiling (the pass): ~${hi.toFixed(2)} km`);
    }
}

// --- shore composition -------------------------------------------------------
if (SHORE) {
    const k = {};
    for (const c of shoreCells) k[c.code] = (k[c.code] || 0) + 1;
    const n = shoreCells.length;
    console.log(`\nshore box ${SHORE.join(',')} on ${PAIR[0]}: ${n} cells`);
    console.log('  ' + Object.entries(k).sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `${c} ${(100 * v / n).toFixed(0)}%`).join(' · '));
}
