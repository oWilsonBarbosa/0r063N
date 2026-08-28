// Validate the connected-landmass continent assignment against the
// authoritative inventory, and report what changes if the province rules adopt
// it in place of the longitude proxy.
//
//   node tools/province-vectors/validate-continents.mjs [--json]
//
// Prints three things:
//   1. per-continent land area, proxy vs connected-landmass vs inventory.json
//   2. the land the proxy drops or misassigns, and where it goes
//   3. per-province area under each rule, with the delta
//
// Zero dependencies.

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
const CELL_AREA_KM2 = 510.072e6 / 2560001;
const asJson = process.argv.includes('--json');

// the current, documented rule (culture doc section 2)
function proxyContinent(lat, lon) {
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

const cont = await buildContinentIndex();

const proxyCont = new Map(), realCont = new Map();
const proxyProv = new Map(), realProv = new Map();
const flow = new Map();                       // "proxy -> real" -> cells
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

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
        const h = elevToHeightKm(+f[idx.elev]);
        const code = (KOPPEN_CLASSES[+f[idx.koppen]] || {}).code || '??';

        const pc = proxyContinent(lat, lon);
        const rc = cont.at(lat, lon);
        bump(proxyCont, pc ?? '(dropped)');
        bump(realCont, rc);
        bump(flow, `${pc ?? '(dropped)'} -> ${rc}`);

        const pp = provinceOf(pc, h, lat, code);
        const rp = provinceOf(rc === ISLANDS ? null : rc, h, lat, code);
        if (pp) bump(proxyProv, pp);
        if (rp) bump(realProv, rp);
    }
}

const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/tectonics/inventory.json'), 'utf8'));
const authoritative = Object.fromEntries(Object.values(inv.continents).map(c => [c.name, c.area_Mkm2]));
const mk = n => +(n * CELL_AREA_KM2 / 1e6).toFixed(2);

const out = {
    continents: {}, flow: {}, provinces: {},
    componentCount: cont.componentCount,
};
for (const name of [...new Set([...proxyCont.keys(), ...realCont.keys()])].sort()) {
    out.continents[name] = {
        proxyMkm2: mk(proxyCont.get(name) || 0),
        connectedMkm2: mk(realCont.get(name) || 0),
        inventoryMkm2: authoritative[name] ?? null,
    };
}
for (const [k, v] of [...flow].sort((a, b) => b[1] - a[1])) if (k.split(' -> ')[0] !== k.split(' -> ')[1]) out.flow[k] = mk(v);
for (const p of [...new Set([...proxyProv.keys(), ...realProv.keys()])].sort()) {
    const a = mk(proxyProv.get(p) || 0), b = mk(realProv.get(p) || 0);
    out.provinces[p] = { proxyMkm2: a, connectedMkm2: b, deltaMkm2: +(b - a).toFixed(2), deltaPct: a ? +(100 * (b - a) / a).toFixed(1) : null };
}

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`connected land components: ${cont.componentCount}\n`);
console.log('continent land area (Mkm2)');
console.log('  name          proxy   connected   inventory   connected-inventory');
for (const [n, v] of Object.entries(out.continents)) {
    const d = v.inventoryMkm2 == null ? '' : (v.connectedMkm2 - v.inventoryMkm2).toFixed(2).padStart(9);
    console.log(`  ${n.padEnd(12)} ${String(v.proxyMkm2).padStart(6)} ${String(v.connectedMkm2).padStart(11)} ${String(v.inventoryMkm2 ?? '—').padStart(11)} ${d}`);
}
console.log('\nland the proxy misassigns (Mkm2)');
for (const [k, v] of Object.entries(out.flow)) console.log(`  ${k.padEnd(28)} ${String(v).padStart(6)}`);
console.log('\nprovince area under each rule (Mkm2)');
console.log('  prov     proxy   connected    delta      %');
for (const [p, v] of Object.entries(out.provinces)) {
    console.log(`  ${p.padEnd(6)} ${String(v.proxyMkm2).padStart(7)} ${String(v.connectedMkm2).padStart(11)} ${String(v.deltaMkm2).padStart(8)} ${String(v.deltaPct ?? '—').padStart(6)}`);
}
