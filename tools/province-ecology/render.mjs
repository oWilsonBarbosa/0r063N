// Province ecology plates — the visual companion to docs/life/04+.
//
// Renders three equirectangular plates for the M3 Arid Interior Plateau using
// the repository's own zero-dependency PNG writer, in the same visual idiom as
// reports/regional/maps:
//
//   plate-m3-01-province.png   M3 within Meridia, provinces colour-coded,
//                              the cradle box outlined, the three great lakes
//                              marked at true area-equivalent radius
//   plate-m3-02-cradle.png     the cradle at 4x, in Table-18 terrain classes
//   plate-m3-03-ecotone.png    the 2-degree bins of the M3/M4 interdigitation
//
// Province rules are identical to ../province-vectors/main.mjs.
//
//   node tools/province-ecology/render.mjs [--out DIR] [--res 0.1]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { elevToHeightKm } from '../height-mapping.mjs';
import { KOPPEN_CLASSES, TERRAIN_CLASSES, classifyTerrain } from '../regional-report/classify.mjs';
import { precipAnnualMm } from '../precip-scale.mjs';
import { makeCanvas, encodePNG, fillRect, drawText, textWidth } from '../regional-report/render-png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'data/orogen_regions_full_v2');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', path.join(ROOT, 'reports/life/maps')));
const RES = Number(flag('--res', 0.1));

// crop covering Meridia with a margin of context
const LAT0 = -20, LAT1 = 70, LON0 = -160, LON1 = -70;
const W = Math.round((LON1 - LON0) / RES), H = Math.round((LAT1 - LAT0) / RES);
const px = (lat, lon) => {
    const x = Math.floor((lon - LON0) / RES), y = Math.floor((LAT1 - lat) / RES);
    return (x < 0 || x >= W || y < 0 || y >= H) ? -1 : y * W + x;
};

// The three great closed-basin lakes of the cradle (reports/regional/atlas
// README, "the ten great lakes"): area km2, surface m, max depth m.
const LAKES = [
    { name: 'THE SUMP',    lat: 17.3, lon: -101.8, areaKm2: 128383, surfaceM: 247,  depthM: 198 },
    { name: 'THE SHALLOW', lat: 20.1, lon: -95.1,  areaKm2: 33200,  surfaceM: 287,  depthM: 36  },
    { name: 'THE DEEP',    lat: 21.8, lon: -89.7,  areaKm2: 18664,  surfaceM: 2090, depthM: 821 },
];
const CRADLE = { lat0: 15, lat1: 28, lon0: -110, lon1: -85 };

const PROV_COLOR = {
    M1: [162, 155, 148], M2: [102, 150, 158], M3: [216, 178, 96], M4: [56, 116, 70],
};
const OTHER_LAND = [176, 174, 168];
const OCEAN = [128, 158, 190], OCEAN_DEEP = [96, 128, 164];
const INK = [26, 34, 46], PAPER = [244, 243, 239], HEADER_TEXT = [236, 238, 242];
const ACCENT = [188, 60, 48];

function continentOf(lat, lon) {
    const west = lon >= -180 && lon <= -60;
    if (!west) return lat > 15 ? 'Borea' : 'Sirocca';
    if (lat < 23 && lon < -128) return 'Selvana';
    if (lat < -16) return null;
    return 'Meridia';
}
function provinceOf(cont, heightKm, lat, code) {
    const g = code[0];
    switch (cont) {
        case 'Meridia':
            if (heightKm >= 2.0) return 'M1';
            if (lat >= 45) return 'M2';
            return g === 'B' ? 'M3' : 'M4';
        case 'Sirocca': return lat <= -50 ? 'S3' : (g === 'B' ? 'S2' : 'S1');
        case 'Borea': return (heightKm >= 1.5 || code === 'EF') ? 'B3' : ((g === 'C' || g === 'B') ? 'B1' : 'B2');
        case 'Selvana':
            if (heightKm >= 2.0 && Math.abs(lat) < 20) return 'V2';
            if (lat <= -42) return 'V4';
            if (g === 'B' && lat <= -15) return 'V3';
            return lat <= -15 ? 'V1b' : 'V1a';
        default: return null;
    }
}

// ---- pass 1: rasterise the crop -------------------------------------------
const prov = new Array(W * H).fill(null);
const terr = new Int16Array(W * H).fill(-1);
const elev = new Float32Array(W * H);
const land = new Uint8Array(W * H);
const seen = new Uint8Array(W * H);
const bins = new Map();                            // 2-degree, for plate 3
const m3Terrain = new Map();                       // per-cell M3 terrain histogram
const binKey = (lat, lon) => `${Math.floor(lat / 2)},${Math.floor(lon / 2)}`;

const parts = fs.readdirSync(DATA).filter(f => f.endsWith('.csv.gz')).sort();
let idx = null;
for (const part of parts) {
    const rl = readline.createInterface({
        input: fs.createReadStream(path.join(DATA, part)).pipe(zlib.createGunzip()),
        crlfDelay: Infinity,
    });
    let header = true;
    for await (const line of rl) {
        if (header) { header = false; if (!idx) idx = Object.fromEntries(line.split(',').map((k, i) => [k, i])); continue; }
        const f = line.split(',');
        const lat = +f[idx.lat], lon = +f[idx.lon];
        const isLand = +f[idx.isLand] === 1;

        // Tally per cell and globally, *before* the crop test, so the plate
        // legends match tools/province-ecology/main.mjs and doc 04 exactly.
        // Counting dilated raster pixels inside the crop instead would give
        // both a different denominator and a different projection weighting.
        let pv = null, tc = -1;
        if (isLand) {
            const h = elevToHeightKm(+f[idx.elev]);
            const k = +f[idx.koppen];
            const code = (KOPPEN_CLASSES[k] || {}).code || '??';
            pv = provinceOf(continentOf(lat, lon), h, lat, code);
            tc = classifyTerrain(k, h, precipAnnualMm(+f[idx.pS], +f[idx.pW]), +f[idx.isSurfaceCoast] === 1);
            if (pv === 'M3' || pv === 'M4') {
                const b = binKey(lat, lon);
                if (!bins.has(b)) bins.set(b, new Set());
                bins.get(b).add(pv);
            }
            if (pv === 'M3') m3Terrain.set(tc, (m3Terrain.get(tc) || 0) + 1);
        }

        const p = px(lat, lon);
        if (p < 0) continue;
        if (!seen[p] || isLand) {                  // land wins ties within a pixel
            seen[p] = 1; elev[p] = +f[idx.elev_km]; land[p] = isLand ? 1 : 0;
            prov[p] = pv; terr[p] = tc;
        }
    }
}

// ---- gap fill --------------------------------------------------------------
// The export is a 2.56 M-cell Fibonacci sphere (~14 km spacing, ~0.13 deg at
// the equator), so a raster finer than that leaves unsampled pixels. Dilate
// from the sampled pixels until the crop is closed, which keeps boundary
// detail while removing the salt-and-pepper.
{
    const NB = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];
    let pending = [];
    for (let i = 0; i < W * H; i++) if (!seen[i]) pending.push(i);
    for (let pass = 0; pass < 24 && pending.length; pass++) {
        const next = [];
        const writes = [];
        for (const i of pending) {
            const x = i % W;
            let src = -1;
            for (const d of NB) {
                const j = i + d;
                if (j < 0 || j >= W * H || !seen[j]) continue;
                if (Math.abs((j % W) - x) > 1) continue;      // no wrap across the seam
                src = j; break;
            }
            if (src >= 0) writes.push([i, src]); else next.push(i);
        }
        if (!writes.length) break;
        for (const [i, src] of writes) {
            elev[i] = elev[src]; land[i] = land[src]; prov[i] = prov[src]; terr[i] = terr[src];
        }
        for (const [i] of writes) seen[i] = 1;
        pending = next;
    }
}

// ---- drawing helpers -------------------------------------------------------
const HEADER_H = 30;
function plate(title, right, w, h) {
    const cv = makeCanvas(w, h + HEADER_H, PAPER);
    fillRect(cv, 0, 0, w, HEADER_H, INK);
    drawText(cv, 10, 10, title, HEADER_TEXT, 2);
    if (right) drawText(cv, w - textWidth(right, 1) - 10, 13, right, [150, 160, 175], 1);
    return cv;
}
const put = (cv, x, y, c) => { if (x >= 0 && y >= 0 && x < cv.width && y < cv.height - 0) fillRect(cv, x, y, 1, 1, c); };
function box(cv, x0, y0, x1, y1, color, dash = 0) {
    for (let x = x0; x <= x1; x++) {
        if (!dash || ((x / dash) | 0) % 2 === 0) { put(cv, x, y0, color); put(cv, x, y1, color); }
    }
    for (let y = y0; y <= y1; y++) {
        if (!dash || ((y / dash) | 0) % 2 === 0) { put(cv, x0, y, color); put(cv, x1, y, color); }
    }
}
function ring(cv, cx, cy, r, color, thickness = 2) {
    for (let a = 0; a < 2880; a++) {
        const t = a * Math.PI / 1440;
        for (let d = 0; d < thickness; d++) {
            put(cv, Math.round(cx + (r + d) * Math.cos(t)), Math.round(cy + (r + d) * Math.sin(t)), color);
        }
    }
}
function crosshair(cv, cx, cy, color, arm = 5) {
    for (let d = -arm; d <= arm; d++) { put(cv, cx + d, cy, color); put(cv, cx, cy + d, color); }
}
const oceanColor = e => (e < -4 ? OCEAN_DEEP : OCEAN);

function legend(cv, x, y, rows, scale = 1) {
    let yy = y;
    for (const [color, label] of rows) {
        fillRect(cv, x, yy, 11, 11, color);
        fillRect(cv, x, yy, 11, 1, INK); fillRect(cv, x, yy + 10, 11, 1, INK);
        fillRect(cv, x, yy, 1, 11, INK); fillRect(cv, x + 10, yy, 1, 11, INK);
        drawText(cv, x + 17, yy + 2, label, INK, scale);
        yy += 16;
    }
    return yy;
}
const write = (name, cv) => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, name), encodePNG(cv.width, cv.height, cv.rgb));
    console.log(`wrote ${path.relative(ROOT, path.join(OUT, name))}  ${cv.width}x${cv.height}`);
};
// area-equivalent radius in pixels, for a lake of the given area at that latitude
function areaRadiusPx(areaKm2, lat) {
    const kmPerDeg = 111.32;
    const rKm = Math.sqrt(areaKm2 / Math.PI);
    return Math.max(3, Math.round(rKm / (kmPerDeg * RES) / Math.sqrt(Math.cos(lat * Math.PI / 180))));
}

// ---- plate 1: M3 within Meridia -------------------------------------------
{
    const cv = plate('M3  MERIDIAN ARID INTERIOR', `PROVINCES OF MERIDIA / EQUIRECTANGULAR / ${LAT0} TO ${LAT1} N, ${LON0} TO ${LON1} E`, W, H);
    for (let i = 0; i < W * H; i++) {
        const x = i % W, y = (i / W) | 0;
        let c;
        if (!land[i]) c = oceanColor(elev[i]);
        else c = PROV_COLOR[prov[i]] || OTHER_LAND;
        put(cv, x, y + HEADER_H, c);
    }
    // cradle box
    const bx0 = Math.floor((CRADLE.lon0 - LON0) / RES), bx1 = Math.floor((CRADLE.lon1 - LON0) / RES);
    const by0 = Math.floor((LAT1 - CRADLE.lat1) / RES) + HEADER_H, by1 = Math.floor((LAT1 - CRADLE.lat0) / RES) + HEADER_H;
    box(cv, bx0, by0, bx1, by1, ACCENT, 4);
    box(cv, bx0 - 1, by0 - 1, bx1 + 1, by1 + 1, ACCENT, 4);
    drawText(cv, bx0, by0 - 13, 'THE CRADLE', ACCENT, 1);
    // lakes, at true area-equivalent radius
    for (const L of LAKES) {
        const x = Math.floor((L.lon - LON0) / RES), y = Math.floor((LAT1 - L.lat) / RES) + HEADER_H;
        ring(cv, x, y, areaRadiusPx(L.areaKm2, L.lat), INK, 2);
        crosshair(cv, x, y, INK, 4);
    }
    const ly = legend(cv, 12, HEADER_H + 12, [
        [PROV_COLOR.M3, 'M3 ARID INTERIOR PLATEAU  9.5 MKM2'],
        [PROV_COLOR.M4, 'M4 S. TROPICAL LOWLANDS   9.5 MKM2'],
        [PROV_COLOR.M1, 'M1 W. CORDILLERA'],
        [PROV_COLOR.M2, 'M2 NORTHERN COLD HIGHLANDS'],
        [OTHER_LAND,    'OTHER CONTINENTS'],
    ]);
    drawText(cv, 12, ly + 6, 'RINGS: THE THREE GREAT LAKES,', INK, 1);
    drawText(cv, 12, ly + 18, 'AT TRUE AREA-EQUIVALENT RADIUS', INK, 1);
    write('plate-m3-01-province.png', cv);
}

// ---- plate 2: the cradle, in terrain classes -------------------------------
{
    const Z = 4;                                   // zoom
    const c0 = { lat0: 11, lat1: 32, lon0: -116, lon1: -82 };
    const cw = Math.round((c0.lon1 - c0.lon0) / RES) * Z, ch = Math.round((c0.lat1 - c0.lat0) / RES) * Z;
    const cv = plate('THE CRADLE  AU1 TROUGH AND THE THREE LAKES', 'TABLE-18 TERRAIN CLASSES', cw, ch);
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const lat = c0.lat1 - (y / Z) * RES, lon = c0.lon0 + (x / Z) * RES;
            const p = px(lat, lon);
            if (p < 0) continue;
            let c;
            if (!land[p]) c = oceanColor(elev[p]);
            else if (terr[p] >= 0) c = TERRAIN_CLASSES[terr[p]].color;
            else c = OTHER_LAND;
            if (land[p] && prov[p] !== 'M3' && prov[p] !== 'M4') {
                c = [(c[0] + 300) / 2 | 0, (c[1] + 300) / 2 | 0, (c[2] + 300) / 2 | 0].map(v => Math.min(235, v));
            }
            put(cv, x, y + HEADER_H, c);
        }
    }
    for (const L of LAKES) {
        const x = Math.round((L.lon - c0.lon0) / RES) * Z, y = Math.round((c0.lat1 - L.lat) / RES) * Z + HEADER_H;
        ring(cv, x, y, areaRadiusPx(L.areaKm2, L.lat) * Z, INK, 3);
        crosshair(cv, x, y, INK, 7);
        const lbl = `${L.name}  ${L.surfaceM}M ELEV  ${L.depthM}M DEEP`;
        const tx = Math.min(cw - textWidth(lbl, 1) - 6, x + 12);
        fillRect(cv, tx - 3, y - 20, textWidth(lbl, 1) + 6, 12, PAPER);
        drawText(cv, tx, y - 18, lbl, INK, 1);
    }
    const tot = [...m3Terrain.values()].reduce((a, b) => a + b, 0);
    legend(cv, 12, HEADER_H + 12, [...m3Terrain].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([t, n]) => [TERRAIN_CLASSES[t].color,
            `${TERRAIN_CLASSES[t].name.toUpperCase()}  ${(100 * n / tot).toFixed(1)}% OF M3`]));
    write('plate-m3-02-cradle.png', cv);
}

// ---- plate 3: the M3/M4 ecotone --------------------------------------------
{
    const cv = plate('THE M3 / M4 ECOTONE', 'TWO-DEGREE BINS', W, H);
    const MIXED = [188, 60, 48], ONLY3 = PROV_COLOR.M3, ONLY4 = PROV_COLOR.M4;
    for (let i = 0; i < W * H; i++) {
        const x = i % W, y = (i / W) | 0;
        put(cv, x, y + HEADER_H, land[i] ? [232, 231, 226] : [214, 222, 232]);
    }
    let both = 0, o3 = 0, o4 = 0;
    for (const [key, set] of bins) {
        const [blat, blon] = key.split(',').map(Number);
        const mixed = set.has('M3') && set.has('M4');
        if (mixed) both++; else if (set.has('M3')) o3++; else o4++;
        const color = mixed ? MIXED : set.has('M3') ? ONLY3 : ONLY4;
        const x0 = Math.floor((blon * 2 - LON0) / RES), y0 = Math.floor((LAT1 - (blat * 2 + 2)) / RES) + HEADER_H;
        const w = Math.round(2 / RES);
        for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) {
            if (x < 0 || x >= W) continue;
            const p = (y - HEADER_H) * W + x;
            if (p < 0 || p >= W * H || !land[p]) continue;
            put(cv, x, y, color);
        }
    }
    const ly = legend(cv, 12, HEADER_H + 12, [
        [MIXED, `BOTH M3 AND M4   ${both} BINS`],
        [ONLY3, `M3 ONLY          ${o3} BINS`],
        [ONLY4, `M4 ONLY          ${o4} BINS`],
    ]);
    drawText(cv, 12, ly + 6, `MIXED SHARE OF OCCUPIED BINS: ${(100 * both / (both + o3 + o4)).toFixed(1)}%`, INK, 1);
    write('plate-m3-03-ecotone.png', cv);
}
