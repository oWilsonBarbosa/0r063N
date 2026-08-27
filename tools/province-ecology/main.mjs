// Province ecology profiler — the measured backbone of the docs/life/04+
// regional ecologies.
//
// Streams the 13 gzipped v2 CSV parts and reports, for any biogeographic
// province, the composition a regional ecology has to be written against:
// Köppen and Table-18 terrain breakdown, the seasonal temperature and water
// regime, the frost-free share, the productivity, and the elevation spread.
//
// It reuses the continent/province rules of ../province-vectors/main.mjs
// verbatim, so province totals reproduce the published constraint vectors in
// docs/culture/00_PROVINCE_CONSTRAINT_VECTORS.md — which is the check that the
// sub-province figures, which that table does not carry, are computed the same
// way.
//
// Zero dependencies.
//
//   node tools/province-ecology/main.mjs M3
//   node tools/province-ecology/main.mjs M3 --box 15,28,-110,-85 --label cradle
//   node tools/province-ecology/main.mjs V3 --compare V1b
//   node tools/province-ecology/main.mjs M3 --json
//
// --box    profiles a lat/lon sub-region separately from the remainder, for
//          provinces with a locally important sub-area (the AU1 cradle in M3).
// --compare  additionally reports how interdigitated the province is with
//          another, as the share of 2-degree bins containing both.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { elevToHeightKm } from '../height-mapping.mjs';
import { KOPPEN_CLASSES, TERRAIN_CLASSES, classifyTerrain } from '../regional-report/classify.mjs';
import { precipAnnualMm } from '../precip-scale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'data/orogen_regions_full_v2');
const CELL_AREA_KM2 = 510.072e6 / 2560001;

const degC = t => -45 + t * 90;
const miamiNpp = (tC, pMm) => Math.min(
    3000 / (1 + Math.exp(1.315 - 0.119 * tC)),
    3000 * (1 - Math.exp(-0.000664 * pMm)),
);

// --- continent + province assignment (identical to ../province-vectors) ----
function continentOf(lat, lon) {
    const west = lon >= -180 && lon <= -60;
    if (!west) return lat > 15 ? 'Borea' : 'Sirocca';
    if (lat < 23 && lon < -128) return 'Selvana';
    if (lat < -16) return null;                    // offshore islands
    return 'Meridia';
}
function provinceOf(cont, heightKm, lat, code) {
    const group = code[0];
    switch (cont) {
        case 'Meridia':
            if (heightKm >= 2.0) return 'M1';
            if (lat >= 45) return 'M2';
            return group === 'B' ? 'M3' : 'M4';
        case 'Sirocca':
            if (lat <= -50) return 'S3';
            return group === 'B' ? 'S2' : 'S1';
        case 'Borea':
            if (heightKm >= 1.5 || code === 'EF') return 'B3';
            return (group === 'C' || group === 'B') ? 'B1' : 'B2';
        case 'Selvana':
            if (heightKm >= 2.0 && Math.abs(lat) < 20) return 'V2';
            if (lat <= -42) return 'V4';
            if (group === 'B' && lat <= -15) return 'V3';
            if (lat <= -15) return 'V1b';
            return 'V1a';
        default: return null;
    }
}

// --- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const target = argv.find(a => !a.startsWith('--'));
if (!target) {
    console.error('usage: node tools/province-ecology/main.mjs <PROVINCE> [--box lat0,lat1,lon0,lon1] [--label NAME] [--compare PROVINCE] [--json]');
    process.exit(1);
}
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const asJson = argv.includes('--json');
const compare = flag('--compare');
const boxLabel = flag('--label') || 'box';
const box = flag('--box')?.split(',').map(Number) ?? null;
if (box && box.length !== 4) { console.error('--box needs lat0,lat1,lon0,lon1'); process.exit(1); }
const inBox = (lat, lon) => box && lat >= box[0] && lat <= box[1] && lon >= box[2] && lon <= box[3];

// --- accumulation ---------------------------------------------------------
const acc = () => ({
    n: 0, koppen: new Map(), terrain: new Map(), elev: [],
    tAnn: 0, tWarm: 0, tCold: 0, p: 0, wet: 0, npp: 0, frostFree: 0,
    pMin: Infinity, pMax: -Infinity, tWarmMax: -Infinity,
});
const groups = { whole: acc() };
if (box) { groups[boxLabel] = acc(); groups.remainder = acc(); }

function add(a, r) {
    a.n++; a.elev.push(r.h);
    a.tAnn += r.tAnn; a.tWarm += r.tWarm; a.tCold += r.tCold;
    a.p += r.pann; a.wet += r.wetShare; a.npp += r.npp;
    if (r.tCold > 0) a.frostFree++;
    a.pMin = Math.min(a.pMin, r.pann); a.pMax = Math.max(a.pMax, r.pann);
    a.tWarmMax = Math.max(a.tWarmMax, r.tWarm);
    a.koppen.set(r.code, (a.koppen.get(r.code) || 0) + 1);
    a.terrain.set(r.terrain, (a.terrain.get(r.terrain) || 0) + 1);
}

const bins = new Map();                       // 2-degree bins, for --compare
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
        if (header) {
            header = false;
            if (!idx) idx = Object.fromEntries(line.split(',').map((k, i) => [k, i]));
            continue;
        }
        const f = line.split(',');
        if (+f[idx.isLand] !== 1) continue;
        const lat = +f[idx.lat], lon = +f[idx.lon];
        const cont = continentOf(lat, lon);
        if (!cont) continue;
        const h = elevToHeightKm(+f[idx.elev]);
        const k = +f[idx.koppen];
        const code = (KOPPEN_CLASSES[k] || {}).code || '??';
        const prov = provinceOf(cont, h, lat, code);

        if (compare && (prov === target || prov === compare)) {
            const b = binKey(lat, lon);
            if (!bins.has(b)) bins.set(b, new Set());
            bins.get(b).add(prov);
        }
        if (prov !== target) continue;

        const tS = degC(+f[idx.tS]), tW = degC(+f[idx.tW]);
        const pS = +f[idx.pS], pW = +f[idx.pW];
        const pann = precipAnnualMm(pS, pW);
        const tAnn = (tS + tW) / 2;
        const rec = {
            h, code, pann, tAnn,
            tWarm: Math.max(tS, tW), tCold: Math.min(tS, tW),
            wetShare: Math.max(pS, pW) / Math.max(1e-9, pS + pW),
            npp: miamiNpp(tAnn, pann),
            terrain: TERRAIN_CLASSES[classifyTerrain(k, h, pann, +f[idx.isSurfaceCoast] === 1)].name,
        };
        add(groups.whole, rec);
        if (box) add(inBox(lat, lon) ? groups[boxLabel] : groups.remainder, rec);
    }
}

// --- report ---------------------------------------------------------------
function summarise(a) {
    if (!a.n) return null;
    a.elev.sort((x, y) => x - y);
    const q = p => a.elev[Math.floor(p * (a.elev.length - 1))];
    const share = m => Object.fromEntries([...m].sort((x, y) => y[1] - x[1])
        .map(([k, v]) => [k, +(100 * v / a.n).toFixed(1)]));
    return {
        cells: a.n,
        areaMkm2: +(a.n * CELL_AREA_KM2 / 1e6).toFixed(2),
        tAnnC: +(a.tAnn / a.n).toFixed(1),
        tWarmC: +(a.tWarm / a.n).toFixed(1),
        tColdC: +(a.tCold / a.n).toFixed(1),
        tAnnRangeC: +((a.tWarm - a.tCold) / a.n).toFixed(1),
        tWarmMaxC: +a.tWarmMax.toFixed(1),
        frostFreePct: +(100 * a.frostFree / a.n).toFixed(1),
        precipMm: Math.round(a.p / a.n),
        precipMinMm: Math.round(a.pMin),
        precipMaxMm: Math.round(a.pMax),
        wetSeasonPct: +(100 * a.wet / a.n).toFixed(1),
        npp: Math.round(a.npp / a.n),
        elevP05Km: +q(0.05).toFixed(2),
        elevP50Km: +q(0.50).toFixed(2),
        elevP95Km: +q(0.95).toFixed(2),
        koppenPct: share(a.koppen),
        terrainPct: share(a.terrain),
    };
}

const out = { province: target, groups: {} };
for (const [name, a] of Object.entries(groups)) {
    const s = summarise(a);
    if (s) out.groups[name] = s;
}
if (compare) {
    let both = 0, onlyT = 0, onlyC = 0;
    for (const s of bins.values()) {
        if (s.has(target) && s.has(compare)) both++;
        else if (s.has(target)) onlyT++; else onlyC++;
    }
    out.interdigitation = {
        against: compare, binDegrees: 2, bothBins: both,
        targetOnlyBins: onlyT, compareOnlyBins: onlyC,
        mixedPct: +(100 * both / (both + onlyT + onlyC)).toFixed(1),
    };
}

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const top = (o, n = 6) => Object.entries(o).slice(0, n).map(([k, v]) => `${k} ${v}%`).join(' · ');
for (const [name, s] of Object.entries(out.groups)) {
    console.log(`\n=== ${target}${name === 'whole' ? '' : ` — ${name}`} ===`);
    console.log(`area ${s.areaMkm2} Mkm² · ${s.cells} cells`);
    console.log(`T ann ${s.tAnnC} °C · warm ${s.tWarmC} (max ${s.tWarmMaxC}) · cold ${s.tColdC} · range ${s.tAnnRangeC} · frost-free ${s.frostFreePct}%`);
    console.log(`precip ${s.precipMm} mm (${s.precipMinMm}–${s.precipMaxMm}) · wet-season share ${s.wetSeasonPct}%`);
    console.log(`NPP ${s.npp} · elev p05/50/95 ${s.elevP05Km}/${s.elevP50Km}/${s.elevP95Km} km`);
    console.log(`köppen : ${top(s.koppenPct)}`);
    console.log(`terrain: ${top(s.terrainPct)}`);
}
if (out.interdigitation) {
    const i = out.interdigitation;
    console.log(`\n=== ${target}/${i.against} interdigitation (${i.binDegrees}° bins) ===`);
    console.log(`both ${i.bothBins} · ${target} only ${i.targetOnlyBins} · ${i.against} only ${i.compareOnlyBins}`);
    console.log(`mixed share of occupied bins: ${i.mixedPct}%`);
}
