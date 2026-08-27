// Province ecology plates — the visual companion to docs/life/04+.
//
// Renders equirectangular plates for a province using the repository's own
// zero-dependency PNG writer, in the same visual idiom as
// reports/regional/maps (dark header, Table-18 terrain palette, muted
// out-of-subject context):
//
//   plate-<p>-01-province.png   the province in its continent, provinces
//                               colour-coded, optional sub-box outlined, and
//                               any annotated lakes at true area-equivalent
//                               radius
//   plate-<p>-02-<detail>.png   a detail crop in Table-18 terrain classes
//   plate-<p>-03-ecotone.png    interdigitation with the neighbour province,
//                               in 2-degree bins
//
// and, for the homologous desert pair, one comparison plate:
//
//   plate-m3-v3-mirror.png      M3 and V3 at identical scale, V3 mirrored on
//                               the equator so the two deserts' mirror-image
//                               latitude bands line up
//
// Province rules are identical to ../province-vectors/main.mjs. Every legend
// figure is tallied per cell over the whole export, before cropping or
// rasterisation, so the plates agree exactly with ./main.mjs and the docs.
//
//   node tools/province-ecology/render.mjs            # every configured plate
//   node tools/province-ecology/render.mjs M3         # one province
//   node tools/province-ecology/render.mjs --out DIR --res 0.1

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
const only = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--res');

const INK = [26, 34, 46], PAPER = [244, 243, 239], HEADER_TEXT = [236, 238, 242];
const ACCENT = [188, 60, 48];
const OTHER_LAND = [176, 174, 168];
const OCEAN = [128, 158, 190], OCEAN_DEEP = [96, 128, 164];
const ARID = [216, 178, 96];                    // the hero colour, shared by M3 and V3

// --- plate configuration ----------------------------------------------------
const PLATES = {
    M3: {
        hero: 'M3', neighbour: 'M4', slug: 'm3',
        title: 'M3  MERIDIAN ARID INTERIOR',
        crop: { lat0: -20, lat1: 70, lon0: -160, lon1: -70 },
        palette: { M1: [162, 155, 148], M2: [102, 150, 158], M3: ARID, M4: [56, 116, 70] },
        legend: [
            ['M3', 'M3 ARID INTERIOR PLATEAU  9.5 MKM2'],
            ['M4', 'M4 S. TROPICAL LOWLANDS   9.5 MKM2'],
            ['M1', 'M1 W. CORDILLERA'],
            ['M2', 'M2 NORTHERN COLD HIGHLANDS'],
        ],
        subBox: { label: 'THE CRADLE', lat0: 15, lat1: 28, lon0: -110, lon1: -85 },
        lakes: [
            { name: 'THE SUMP',    lat: 17.3, lon: -101.8, areaKm2: 128383, surfaceM: 247,  depthM: 198 },
            { name: 'THE SHALLOW', lat: 20.1, lon: -95.1,  areaKm2: 33200,  surfaceM: 287,  depthM: 36  },
            { name: 'THE DEEP',    lat: 21.8, lon: -89.7,  areaKm2: 18664,  surfaceM: 2090, depthM: 821 },
        ],
        detail: {
            slug: 'cradle', zoom: 4,
            title: 'THE CRADLE  AU1 TROUGH AND THE THREE LAKES',
            lat0: 11, lat1: 32, lon0: -116, lon1: -82,
        },
    },
    V3: {
        hero: 'V3', neighbour: 'V1b', slug: 'v3',
        title: 'V3  SELVANAN INTERIOR DRY BASIN',
        crop: { lat0: -70, lat1: 30, lon0: -180, lon1: -120 },
        palette: {
            V1a: [46, 110, 66], V1b: [96, 146, 88], V2: [162, 155, 148],
            V3: ARID, V4: [130, 148, 160],
        },
        legend: [
            ['V3',  'V3 INTERIOR DRY BASIN   4.8 MKM2'],
            ['V1b', 'V1B SUBTROPICAL BELT    4.7 MKM2'],
            ['V1a', 'V1A TROPICAL NORTH     10.0 MKM2'],
            ['V2',  'V2 EQUATORIAL RANGES'],
            ['V4',  'V4 SOUTHERN CORDILLERA'],
        ],
        // no sub-box and no annotated lakes: Selvana holds none of the planet's
        // ten great closed-basin lakes, which is the point doc 05 turns on.
        lakes: [],
        // The continent proxy defines Selvana as lon < -128, so the province
        // ends on a meridian rather than on a coast. Draw the cut, so the hard
        // edge on these plates reads as the definition it is. See doc 05 and
        // reports/life/README.md: the rule drops 1.80 Mkm2 of land planet-wide
        // and undercounts Selvana by 1.39 Mkm2 against inventory.json.
        ruleCut: { lon: -128, label: 'CONTINENT RULE CUT AT 128 W  (NOT A COAST)' },
        detail: {
            slug: 'basin', zoom: 3,
            title: 'THE INTERIOR DRY BASIN  NO GREAT LAKE, NO RELIEF',
            lat0: -44, lat1: -12, lon0: -178, lon1: -126,
        },
    },
};

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

// --- one shared global raster ----------------------------------------------
// Covers every configured crop, so the whole export is streamed once.
const G = {
    lat0: Math.min(...Object.values(PLATES).map(p => p.crop.lat0)),
    lat1: Math.max(...Object.values(PLATES).map(p => p.crop.lat1)),
    lon0: Math.min(...Object.values(PLATES).map(p => p.crop.lon0)),
    lon1: Math.max(...Object.values(PLATES).map(p => p.crop.lon1)),
};
const W = Math.round((G.lon1 - G.lon0) / RES), H = Math.round((G.lat1 - G.lat0) / RES);
const at = (lat, lon) => {
    const x = Math.floor((lon - G.lon0) / RES), y = Math.floor((G.lat1 - lat) / RES);
    return (x < 0 || x >= W || y < 0 || y >= H) ? -1 : y * W + x;
};

const prov = new Array(W * H).fill(null);
const terr = new Int16Array(W * H).fill(-1);
const elev = new Float32Array(W * H);
const land = new Uint8Array(W * H);
const seen = new Uint8Array(W * H);
const bins = new Map();                          // key -> Set(province)
const terrainOf = new Map();                     // province -> Map(terrainIdx -> cells)
const binKey = (lat, lon) => `${Math.floor(lat / 2)},${Math.floor(lon / 2)}`;
const HEROES = new Set(Object.values(PLATES).flatMap(p => [p.hero, p.neighbour]));

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
        const lat = +f[idx.lat], lon = +f[idx.lon];
        const isLand = +f[idx.isLand] === 1;

        // Tally per cell, globally, *before* any crop test — counting dilated
        // raster pixels inside a crop would change both the denominator and the
        // projection weighting, and would disagree with ./main.mjs.
        let pv = null, tc = -1;
        if (isLand) {
            const h = elevToHeightKm(+f[idx.elev]);
            const k = +f[idx.koppen];
            const code = (KOPPEN_CLASSES[k] || {}).code || '??';
            pv = provinceOf(continentOf(lat, lon), h, lat, code);
            tc = classifyTerrain(k, h, precipAnnualMm(+f[idx.pS], +f[idx.pW]), +f[idx.isSurfaceCoast] === 1);
            if (HEROES.has(pv)) {
                const b = binKey(lat, lon);
                if (!bins.has(b)) bins.set(b, new Set());
                bins.get(b).add(pv);
                if (!terrainOf.has(pv)) terrainOf.set(pv, new Map());
                const m = terrainOf.get(pv);
                m.set(tc, (m.get(tc) || 0) + 1);
            }
        }
        const p = at(lat, lon);
        if (p < 0) continue;
        if (!seen[p] || isLand) {
            seen[p] = 1; elev[p] = +f[idx.elev_km]; land[p] = isLand ? 1 : 0;
            prov[p] = pv; terr[p] = tc;
        }
    }
}

// --- gap fill ---------------------------------------------------------------
// The export is a 2.56 M-cell Fibonacci sphere (~14 km spacing, ~0.13 deg at
// the equator), so a raster finer than that leaves unsampled pixels. Dilate
// from the sampled pixels, which keeps boundary detail while removing the
// salt-and-pepper.
{
    const NB = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];
    let pending = [];
    for (let i = 0; i < W * H; i++) if (!seen[i]) pending.push(i);
    for (let pass = 0; pass < 24 && pending.length; pass++) {
        const next = [], writes = [];
        for (const i of pending) {
            const x = i % W;
            let src = -1;
            for (const d of NB) {
                const j = i + d;
                if (j < 0 || j >= W * H || !seen[j]) continue;
                if (Math.abs((j % W) - x) > 1) continue;
                src = j; break;
            }
            if (src >= 0) writes.push([i, src]); else next.push(i);
        }
        if (!writes.length) break;
        for (const [i, src] of writes) { elev[i] = elev[src]; land[i] = land[src]; prov[i] = prov[src]; terr[i] = terr[src]; }
        for (const [i] of writes) seen[i] = 1;
        pending = next;
    }
}

// --- drawing helpers --------------------------------------------------------
const HEADER_H = 30;
function plate(title, right, w, h) {
    const cv = makeCanvas(w, h + HEADER_H, PAPER);
    fillRect(cv, 0, 0, w, HEADER_H, INK);
    drawText(cv, 10, 10, title, HEADER_TEXT, 2);
    // only if it clears the title — narrow plates would otherwise overprint
    if (right && textWidth(title, 2) + textWidth(right, 1) + 30 < w) {
        drawText(cv, w - textWidth(right, 1) - 10, 13, right, [150, 160, 175], 1);
    }
    return cv;
}
// paper panel behind an overlay text block, so legends stay readable on any map
function panel(cv, x, y, w, h) {
    fillRect(cv, x, y, w, h, PAPER);
    fillRect(cv, x, y, w, 1, [206, 204, 198]); fillRect(cv, x, y + h - 1, w, 1, [206, 204, 198]);
    fillRect(cv, x, y, 1, h, [206, 204, 198]); fillRect(cv, x + w - 1, y, 1, h, [206, 204, 198]);
}
const put = (cv, x, y, c) => { if (x >= 0 && y >= 0 && x < cv.width && y < cv.height) fillRect(cv, x, y, 1, 1, c); };
function box(cv, x0, y0, x1, y1, color, dash = 0) {
    for (let x = x0; x <= x1; x++) if (!dash || ((x / dash) | 0) % 2 === 0) { put(cv, x, y0, color); put(cv, x, y1, color); }
    for (let y = y0; y <= y1; y++) if (!dash || ((y / dash) | 0) % 2 === 0) { put(cv, x0, y, color); put(cv, x1, y, color); }
}
function ring(cv, cx, cy, r, color, thickness = 2) {
    for (let a = 0; a < 2880; a++) {
        const t = a * Math.PI / 1440;
        for (let d = 0; d < thickness; d++) put(cv, Math.round(cx + (r + d) * Math.cos(t)), Math.round(cy + (r + d) * Math.sin(t)), color);
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
function areaRadiusPx(areaKm2, lat, scale = 1) {
    const rKm = Math.sqrt(areaKm2 / Math.PI);
    return Math.max(3, Math.round(scale * rKm / (111.32 * RES) / Math.sqrt(Math.cos(lat * Math.PI / 180))));
}
const pctOf = m => {
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m].sort((a, b) => b[1] - a[1]).map(([t, n]) => [t, 100 * n / tot]);
};

// --- plate builders ---------------------------------------------------------
function plateProvince(cfg) {
    const { crop } = cfg;
    const w = Math.round((crop.lon1 - crop.lon0) / RES), h = Math.round((crop.lat1 - crop.lat0) / RES);
    const cv = plate(cfg.title, `PROVINCES / EQUIRECTANGULAR / ${crop.lat0} TO ${crop.lat1} N, ${crop.lon0} TO ${crop.lon1} E`, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = at(crop.lat1 - y * RES, crop.lon0 + x * RES);
        if (p < 0) continue;
        put(cv, x, y + HEADER_H, land[p] ? (cfg.palette[prov[p]] || OTHER_LAND) : oceanColor(elev[p]));
    }
    if (cfg.subBox) {
        const b = cfg.subBox;
        const x0 = Math.floor((b.lon0 - crop.lon0) / RES), x1 = Math.floor((b.lon1 - crop.lon0) / RES);
        const y0 = Math.floor((crop.lat1 - b.lat1) / RES) + HEADER_H, y1 = Math.floor((crop.lat1 - b.lat0) / RES) + HEADER_H;
        box(cv, x0, y0, x1, y1, ACCENT, 4);
        box(cv, x0 - 1, y0 - 1, x1 + 1, y1 + 1, ACCENT, 4);
        drawText(cv, x0, y0 - 13, b.label, ACCENT, 1);
    }
    for (const L of cfg.lakes) {
        const x = Math.floor((L.lon - crop.lon0) / RES), y = Math.floor((crop.lat1 - L.lat) / RES) + HEADER_H;
        ring(cv, x, y, areaRadiusPx(L.areaKm2, L.lat), INK, 2);
        crosshair(cv, x, y, INK, 4);
    }
    if (cfg.ruleCut) {
        const x = Math.floor((cfg.ruleCut.lon - crop.lon0) / RES);
        for (let y = HEADER_H; y < HEADER_H + h; y++) if (((y / 5) | 0) % 2 === 0) put(cv, x, y, ACCENT);
        drawText(cv, Math.max(4, x - textWidth(cfg.ruleCut.label, 1) - 6), HEADER_H + h - 16, cfg.ruleCut.label, ACCENT, 1);
    }
    const rows = cfg.legend.map(([k, label]) => [cfg.palette[k], label]).concat([[OTHER_LAND, 'OTHER CONTINENTS']]);
    const notes = cfg.lakes.length
        ? ['RINGS: GREAT CLOSED-BASIN LAKES,', 'AT TRUE AREA-EQUIVALENT RADIUS']
        : ['NO GREAT CLOSED-BASIN LAKE HERE:', 'SELVANA HOLDS NONE OF THE PLANET TEN', 'LARGEST IS 6,001 KM2, 44 M DEEP'];
    const pw2 = Math.max(...rows.map(r => textWidth(r[1], 1)), ...notes.map(t => textWidth(t, 1))) + 34;
    panel(cv, 6, HEADER_H + 6, pw2, rows.length * 16 + notes.length * 12 + 16);
    const ly = legend(cv, 12, HEADER_H + 12, rows);
    notes.forEach((t, i) => drawText(cv, 12, ly + 2 + i * 12, t, INK, 1));
    write(`plate-${cfg.slug}-01-province.png`, cv);
}

function plateDetail(cfg) {
    const d = cfg.detail, Z = d.zoom;
    const w = Math.round((d.lon1 - d.lon0) / RES) * Z, h = Math.round((d.lat1 - d.lat0) / RES) * Z;
    const cv = plate(d.title, 'TABLE-18 TERRAIN CLASSES', w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = at(d.lat1 - (y / Z) * RES, d.lon0 + (x / Z) * RES);
        if (p < 0) continue;
        let c = land[p] ? (terr[p] >= 0 ? TERRAIN_CLASSES[terr[p]].color : OTHER_LAND) : oceanColor(elev[p]);
        if (land[p] && prov[p] !== cfg.hero && prov[p] !== cfg.neighbour) {
            c = c.map(v => Math.min(226, ((v * 2 + 255) / 3) | 0));   // gentle mute
        }
        put(cv, x, y + HEADER_H, c);
    }
    for (const L of cfg.lakes) {
        const x = Math.round((L.lon - d.lon0) / RES) * Z, y = Math.round((d.lat1 - L.lat) / RES) * Z + HEADER_H;
        ring(cv, x, y, areaRadiusPx(L.areaKm2, L.lat, Z), INK, 3);
        crosshair(cv, x, y, INK, 7);
        const lbl = `${L.name}  ${L.surfaceM}M ELEV  ${L.depthM}M DEEP`;
        const tx = Math.min(w - textWidth(lbl, 1) - 6, x + 12);
        fillRect(cv, tx - 3, y - 20, textWidth(lbl, 1) + 6, 12, PAPER);
        drawText(cv, tx, y - 18, lbl, INK, 1);
    }
    if (cfg.ruleCut) {
        const x = Math.round((cfg.ruleCut.lon - d.lon0) / RES) * Z;
        for (let y = HEADER_H; y < HEADER_H + h; y++) if (((y / 6) | 0) % 2 === 0) { put(cv, x, y, ACCENT); put(cv, x + 1, y, ACCENT); }
        drawText(cv, Math.max(4, x - textWidth(cfg.ruleCut.label, 1) - 8), HEADER_H + 14, cfg.ruleCut.label, ACCENT, 1);
    }
    const trows = pctOf(terrainOf.get(cfg.hero)).slice(0, 6)
        .map(([t, p]) => [TERRAIN_CLASSES[t].color, `${TERRAIN_CLASSES[t].name.toUpperCase()}  ${p.toFixed(1)}% OF ${cfg.hero}`]);
    panel(cv, 6, HEADER_H + 6, Math.max(...trows.map(r => textWidth(r[1], 1))) + 34, trows.length * 16 + 8);
    legend(cv, 12, HEADER_H + 12, trows);
    write(`plate-${cfg.slug}-02-${d.slug}.png`, cv);
}

function plateEcotone(cfg) {
    const { crop } = cfg;
    const w = Math.round((crop.lon1 - crop.lon0) / RES), h = Math.round((crop.lat1 - crop.lat0) / RES);
    const cv = plate(`THE ${cfg.hero} / ${cfg.neighbour} ECOTONE`, 'TWO-DEGREE BINS', w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = at(crop.lat1 - y * RES, crop.lon0 + x * RES);
        put(cv, x, y + HEADER_H, (p >= 0 && land[p]) ? [232, 231, 226] : [214, 222, 232]);
    }
    const MIXED = ACCENT, A = cfg.palette[cfg.hero], B = cfg.palette[cfg.neighbour];
    let both = 0, oa = 0, ob = 0;
    for (const [key, set] of bins) {
        const hasA = set.has(cfg.hero), hasB = set.has(cfg.neighbour);
        if (!hasA && !hasB) continue;
        if (hasA && hasB) both++; else if (hasA) oa++; else ob++;
        const color = (hasA && hasB) ? MIXED : hasA ? A : B;
        const [blat, blon] = key.split(',').map(Number);
        const span = Math.round(2 / RES);
        const x0 = Math.floor((blon * 2 - crop.lon0) / RES), y0 = Math.floor((crop.lat1 - (blat * 2 + 2)) / RES);
        for (let y = y0; y < y0 + span; y++) for (let x = x0; x < x0 + span; x++) {
            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            const p = at(crop.lat1 - y * RES, crop.lon0 + x * RES);
            if (p < 0 || !land[p]) continue;
            put(cv, x, y + HEADER_H, color);
        }
    }
    const erows = [
        [MIXED, `BOTH ${cfg.hero} AND ${cfg.neighbour}`.padEnd(20) + `${both} BINS`],
        [A, `${cfg.hero} ONLY`.padEnd(20) + `${oa} BINS`],
        [B, `${cfg.neighbour} ONLY`.padEnd(20) + `${ob} BINS`],
    ];
    const note = `MIXED SHARE OF OCCUPIED BINS: ${(100 * both / (both + oa + ob)).toFixed(1)}%`;
    panel(cv, 6, HEADER_H + 6, Math.max(...erows.map(r => textWidth(r[1], 1)), textWidth(note, 1)) + 34, erows.length * 16 + 22);
    const ly = legend(cv, 12, HEADER_H + 12, erows);
    drawText(cv, 12, ly + 2, note, INK, 1);
    write(`plate-${cfg.slug}-03-ecotone.png`, cv);
}

// The homology plate: the two west-flank deserts at identical scale, V3
// mirrored on the equator so their mirror-image latitude bands (M3 16-42 N,
// V3 18-40 S) line up for direct comparison.
function plateMirror() {
    const BAND = { lat: 46, lon: 62 };             // degrees shown per panel
    const pw = Math.round(BAND.lon / RES), ph = Math.round(BAND.lat / RES);
    const GAP = 26;
    const cv = plate('THE HOMOLOGOUS DESERTS  M3 AND V3', 'SAME BRANCH / MIRROR-IMAGE LATITUDES / V3 FLIPPED ON THE EQUATOR', pw * 2 + GAP, ph + 116);
    const panels = [
        { lat1: 46, lon0: -132, hero: 'M3', flip: false, label: 'M3  MERIDIA  16 TO 42 N' },
        { lat1: 46, lon0: -180, hero: 'V3', flip: true,  label: 'V3  SELVANA  18 TO 40 S  (MIRRORED)' },
    ];
    panels.forEach((pan, i) => {
        const ox = i * (pw + GAP);
        for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
            const lat = pan.lat1 - y * RES;
            const p = at(pan.flip ? -lat : lat, pan.lon0 + x * RES);
            if (p < 0) continue;
            let c;
            if (!land[p]) c = oceanColor(elev[p]);
            else if (prov[p] === pan.hero) c = ARID;
            else c = terr[p] >= 0
                ? TERRAIN_CLASSES[terr[p]].color.map(v => Math.min(238, ((v + 330) / 2) | 0))
                : OTHER_LAND;
            put(cv, ox + x, y + HEADER_H, c);
        }
        box(cv, ox, HEADER_H, ox + pw - 1, HEADER_H + ph - 1, INK);
        drawText(cv, ox + 4, HEADER_H + ph + 8, pan.label, INK, 1);
    });
    const facts = [
        ['AREA',                 '9.5 MKM2',  '4.8 MKM2'],
        ['MEAN ANNUAL TEMP',     '22.3 C',    '22.1 C'],
        ['ANNUAL TEMP RANGE',    '9.1 C',     '14.3 C'],
        ['PRECIPITATION',        '304 MM',    '353 MM'],
        ['MEDIAN ELEVATION',     '620 M',     '90 M'],
        ['SCRUB SHARE',          '54.1%',     '85.2%'],
        ['GREAT LAKES OF THE TEN', '3',       '0'],
    ];
    const fy = HEADER_H + ph + 26;
    facts.forEach(([k, a, b], i) => {
        const y = fy + i * 11;
        drawText(cv, 12, y, k, [110, 118, 130], 1);
        drawText(cv, pw - textWidth(a, 1) - 14, y, a, INK, 1);
        drawText(cv, pw + GAP + pw - textWidth(b, 1) - 14, y, b, INK, 1);
    });
    write('plate-m3-v3-mirror.png', cv);
}

for (const [key, cfg] of Object.entries(PLATES)) {
    if (only && only !== key) continue;
    plateProvince(cfg); plateDetail(cfg); plateEcotone(cfg);
}
if (!only) plateMirror();
