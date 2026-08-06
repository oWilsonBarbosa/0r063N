// Province constraint vectors — regenerates the table in
// docs/culture/00_PROVINCE_CONSTRAINT_VECTORS.md.
//
// Streams the 13 gzipped v2 CSV parts, assigns every land cell to one of the
// biogeographic provinces of docs/life/01_BIOGEOGRAPHIC_REALMS.md (using the
// operational rules documented in §2 of the culture doc), and reports the
// climate/productivity envelope of each.
//
// Zero dependencies.  Usage:  node tools/province-vectors/main.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { elevToHeightKm } from '../height-mapping.mjs';
import { KOPPEN_CLASSES } from '../regional-report/classify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'data/orogen_regions_full_v2');
const CELL_AREA_KM2 = 510.072e6 / 2560001;

// Millimetres of precipitation per unit of normalized seasonal index, per
// half-year.  This is the generator's own CLIMATE.KOPPEN_PRECIP_SCALE_MM
// (js/climate-config.js) — the scale its Köppen classifier feeds into the
// standard real-millimetre Köppen thresholds, fitted against observed
// Köppen-Geiger data by tuning/climate/optimize.mjs.
//
// Independently verified here by running the generator's climate chain on
// assets/earth.png at N=160,001: it yields a global land mean of 720 mm/yr
// against Earth's observed ~715 mm/yr, and solving the scale directly from
// that land mean gives 832.9 — a 0.7 % difference from the constant below.
//
// NOTE the regional-report pipeline uses a different, uncalibrated convention
// (`precipAnnualMm` in ../regional-report/classify.mjs hardcodes 1000), which
// overstates precipitation by ~19 %.  See docs/culture/ §2.
const PRECIP_SCALE_MM = 838.5683;
const precipAnnualMm = (pS, pW) => (Math.max(0, pS) + Math.max(0, pW)) * PRECIP_SCALE_MM;

// Normalized seasonal temperature -> degrees Celsius (data dictionary).
const degC = t => -45 + t * 90;

// Miami NPP model, g/m2/yr (same form as the atlas' plate 13).
const miamiNpp = (tC, pMm) => Math.min(
    3000 / (1 + Math.exp(1.315 - 0.119 * tC)),
    3000 * (1 - Math.exp(-0.000664 * pMm)),
);

// --- continent assignment -------------------------------------------------
// The export carries no continent id.  Meridia and Selvana are joined by an
// island chain across the Equatorial Western Sea, so a flood fill merges them;
// they are separated here on the strait longitude instead.  Western-hemisphere
// land below 16 S is offshore island, not Meridia.
function continentOf(lat, lon) {
    const west = lon >= -180 && lon <= -60;
    if (!west) return lat > 15 ? 'Borea' : 'Sirocca';
    if (lat < 23 && lon < -128) return 'Selvana';
    if (lat < -16) return null;                    // offshore islands
    return 'Meridia';
}

// --- province assignment (priority order; see culture doc section 2) -------
function provinceOf(cont, heightKm, lat, code) {
    const group = code[0];
    switch (cont) {
        case 'Meridia':
            if (heightKm >= 2.0) return 'M1 Western Cordillera & Central Massif';
            if (lat >= 45) return 'M2 Northern Cold Highlands';
            if (group === 'B') return 'M3 Arid Interior Plateau';
            return 'M4 Southern Tropical Lowlands & SW Trunk River';
        case 'Sirocca':
            if (lat <= -50) return 'S3 Southern Cold Fringe';
            if (group === 'B') return 'S2 The Arid Heart';
            return 'S1 Northern Range & SW Wet Coast';
        case 'Borea':
            if (heightKm >= 1.5 || code === 'EF') return 'B3 Eastern Range & Northern Ice Highlands';
            if (group === 'C' || group === 'B') return 'B1 Southern Maritime Coast';
            return 'B2 Subarctic Interior';
        case 'Selvana':
            if (heightKm >= 2.0 && Math.abs(lat) < 20) return 'V2 Equatorial Ranges (sky-islands)';
            if (lat <= -42) return 'V4 Southern Cordillera & Cold South';
            if (group === 'B' && lat <= -15) return 'V3 Interior Dry Basin';
            if (lat <= -15) return 'V1b Subtropical Belt (operational)';
            return 'V1a Tropical North';
        default:
            return null;
    }
}

const acc = new Map();
function bucket(name) {
    let a = acc.get(name);
    if (!a) {
        a = {
            n: 0, cold: 0, warm: 0, tann: 0, precip: 0, wetShare: 0, npp: 0,
            elev: 0, elevMax: 0, over2km: 0, frostFree: 0, growing: 0, coastal: 0,
            lats: [], koppen: new Map(),
        };
        acc.set(name, a);
    }
    return a;
}

const parts = fs.readdirSync(DATA).filter(f => f.endsWith('.csv.gz')).sort();
let idx = null;

for (const part of parts) {
    const rl = readline.createInterface({
        input: fs.createReadStream(path.join(DATA, part)).pipe(zlib.createGunzip()),
        crlfDelay: Infinity,
    });
    for await (const line of rl) {
        if (!line) continue;
        if (line.startsWith('id,')) {
            if (!idx) {
                idx = {};
                line.split(',').forEach((h, i) => { idx[h] = i; });
            }
            continue;
        }
        const f = line.split(',');
        if (f[idx.isLand] !== '1') continue;

        const lat = +f[idx.lat], lon = +f[idx.lon];
        const cont = continentOf(lat, lon);
        if (!cont) continue;

        const heightKm = elevToHeightKm(+f[idx.elev]);
        const code = KOPPEN_CLASSES[+f[idx.koppen]].code;
        const name = provinceOf(cont, heightKm, lat, code);
        if (!name) continue;

        const tS = degC(+f[idx.tS]), tW = degC(+f[idx.tW]);
        const cold = Math.min(tS, tW), warm = Math.max(tS, tW), tann = (tS + tW) / 2;
        const pS = +f[idx.pS], pW = +f[idx.pW];
        const pMm = precipAnnualMm(pS, pW);

        const a = bucket(name);
        a.n++;
        a.cold += cold; a.warm += warm; a.tann += tann;
        a.precip += pMm;
        a.wetShare += pMm > 0 ? Math.max(pS, pW) * PRECIP_SCALE_MM / pMm : 0.5;
        a.npp += miamiNpp(tann, pMm);
        a.elev += heightKm;
        a.elevMax = Math.max(a.elevMax, heightKm);
        if (heightKm > 2) a.over2km++;
        if (cold > 0) a.frostFree++;
        if (warm >= 10) a.growing++;
        if (f[idx.isSurfaceCoast] === '1') a.coastal++;
        a.lats.push(lat);
        a.koppen.set(code, (a.koppen.get(code) || 0) + 1);
    }
    process.stderr.write(`${part} done\n`);
}

const quantile = (sorted, p) => sorted[Math.floor(p * (sorted.length - 1))];
const rows = [...acc.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([name, a]) => {
    a.lats.sort((x, y) => x - y);
    const pct = v => 100 * v / a.n;
    return {
        province: name,
        areaMkm2: +(a.n * CELL_AREA_KM2 / 1e6).toFixed(1),
        latP05: +quantile(a.lats, 0.05).toFixed(0),
        latP95: +quantile(a.lats, 0.95).toFixed(0),
        elevMeanKm: +(a.elev / a.n).toFixed(2),
        elevMaxKm: +a.elevMax.toFixed(2),
        pctOver2km: +pct(a.over2km).toFixed(0),
        tColdC: +(a.cold / a.n).toFixed(1),
        tWarmC: +(a.warm / a.n).toFixed(1),
        tAnnC: +(a.tann / a.n).toFixed(1),
        precipMm: Math.round(a.precip / a.n),
        wetSeasonPct: +(100 * a.wetShare / a.n).toFixed(0),
        npp: Math.round(a.npp / a.n),
        frostFreePct: +pct(a.frostFree).toFixed(0),
        growingPct: +pct(a.growing).toFixed(0),
        coastalPct: +pct(a.coastal).toFixed(1),
        topKoppen: [...a.koppen.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)
            .map(([k, v]) => `${k} ${Math.round(100 * v / a.n)}%`).join(', '),
    };
});

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
} else {
    console.log('| Province | Area | Lat 5-95% | Elev mean/max | >2km | T cold | T warm | T ann | Precip | Wet | NPP | Frost-free | Growing | Coastal |');
    console.log('|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
        console.log(`| ${r.province} | ${r.areaMkm2} | ${r.latP05}..${r.latP95} | ${r.elevMeanKm} / ${r.elevMaxKm} | ${r.pctOver2km}% | ${r.tColdC} | ${r.tWarmC} | ${r.tAnnC} | ${r.precipMm} | ${r.wetSeasonPct}% | ${r.npp} | ${r.frostFreePct}% | ${r.growingPct}% | ${r.coastalPct}% |`);
    }
}
