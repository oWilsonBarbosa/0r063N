// Streaming loader: gzipped CSV parts -> typed-array columns.
// Only the columns needed for regional analysis are kept in memory.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

export const EXPECTED_HEADER = 'id,lat,lon,x,y,z,elev,elev_km,prePost,eroD,plate,isOcPlate,superPlate,plateSpeed,isLand,isCoastal,isMountain,stress,orogPow,tecAct,base,tectonic,noise,interior,coastal_l,ocean_l,hotspot,margins,backArc,foldRidge,basin,koppen,contality,tempContality,tS,tW,pS,pW,wsS,wsW,prS,prW,windES,windNS,windEW,windNW,owS,owW,ocSpeedS,ocSpeedW,ocEastS,ocNorthS,ocEastW,ocNorthW,rsSummer,rsWinter';

// column name -> { array kind } ; indices resolved from the header at load time
// NOTE: pS/pW are PRECIPITATION half-year totals (meta: precip_mm = pS*1000);
// the prS/prW columns are sea-level pressure and are not used here.
const FLOAT_COLS = ['lat', 'lon', 'x', 'y', 'z', 'elev_km', 'tS', 'tW', 'wsS', 'wsW',
    'pS', 'pW', 'windES', 'windNS', 'windEW', 'windNW', 'rsSummer', 'rsWinter'];
const BYTE_COLS = ['isLand', 'isCoastal', 'isMountain', 'koppen'];

export function loadMeta(dataDir) {
    return JSON.parse(fs.readFileSync(path.join(dataDir, 'orogen_meta_full.json'), 'utf8'));
}

const CACHE_MAGIC = 0x4f524f47; // "OROG"
const CACHE_VERSION = 3;

function cacheColumns() { return [...FLOAT_COLS, ...BYTE_COLS]; }

export function tryLoadCache(cachePath, n) {
    try {
        const buf = fs.readFileSync(cachePath);
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        if (dv.getUint32(0) !== CACHE_MAGIC || dv.getUint32(4) !== CACHE_VERSION) return null;
        if (dv.getUint32(8) !== n) return null;
        const cols = {};
        let off = 12;
        for (const name of FLOAT_COLS) {
            cols[name] = new Float32Array(n);
            new Uint8Array(cols[name].buffer).set(buf.subarray(off, off + n * 4));
            off += n * 4;
        }
        for (const name of BYTE_COLS) {
            cols[name] = new Uint8Array(buf.subarray(off, off + n));
            off += n;
        }
        return { n, ...cols };
    } catch {
        return null;
    }
}

export function saveCache(cachePath, data) {
    const n = data.n;
    const head = Buffer.alloc(12);
    head.writeUInt32BE(CACHE_MAGIC, 0);
    head.writeUInt32BE(CACHE_VERSION, 4);
    head.writeUInt32BE(n, 8);
    const parts = [head];
    for (const name of cacheColumns()) {
        const a = data[name];
        parts.push(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    }
    fs.writeFileSync(cachePath, Buffer.concat(parts));
}

export async function loadData(dataDir, { log = () => {} } = {}) {
    const meta = loadMeta(dataDir);
    const n = meta.numRegions;

    const files = fs.readdirSync(dataDir)
        .filter(f => /^orogen_regions_full_part_\d+\.csv\.gz$/.test(f))
        .sort();
    if (files.length === 0) throw new Error(`no CSV parts found in ${dataDir}`);

    const cols = {};
    for (const name of FLOAT_COLS) cols[name] = new Float32Array(n);
    for (const name of BYTE_COLS) cols[name] = new Uint8Array(n);

    let headerIdx = null;   // column name -> CSV field index
    let row = 0;

    for (const file of files) {
        const t0 = Date.now();
        const rl = readline.createInterface({
            input: fs.createReadStream(path.join(dataDir, file)).pipe(zlib.createGunzip()),
            crlfDelay: Infinity,
        });
        let first = true;
        for await (const line of rl) {
            if (first) {
                first = false;
                if (line.trim() !== EXPECTED_HEADER) {
                    throw new Error(`unexpected header in ${file}:\n${line}`);
                }
                if (!headerIdx) {
                    headerIdx = {};
                    line.trim().split(',').forEach((name, i) => { headerIdx[name] = i; });
                    for (const name of [...FLOAT_COLS, ...BYTE_COLS]) {
                        if (!(name in headerIdx)) throw new Error(`column ${name} missing from header`);
                    }
                }
                continue;
            }
            if (line.length === 0) continue;
            const f = line.split(',');
            if (row >= n) throw new Error(`more rows than meta.numRegions (${n})`);
            for (const name of FLOAT_COLS) cols[name][row] = +f[headerIdx[name]];
            for (const name of BYTE_COLS) cols[name][row] = +f[headerIdx[name]];
            row++;
        }
        log(`  ${file}: rows so far ${row.toLocaleString()} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }

    if (row !== n) throw new Error(`row count ${row} != meta.numRegions ${n}`);
    return { n, meta, ...cols };
}

// Exact checks against the export metadata. Throws on mismatch.
export function verifyData(data, meta) {
    const errors = [];
    const check = (label, got, want) => {
        if (got !== want) errors.push(`${label}: got ${got}, want ${want}`);
    };

    check('row count', data.n, meta.numRegions);

    let landCount = 0;
    const koppenHist = new Array(32).fill(0);
    let minElev = Infinity, maxElev = -Infinity;
    for (let i = 0; i < data.n; i++) {
        if (data.isLand[i]) {
            landCount++;
            koppenHist[data.koppen[i]]++;
        }
        const e = data.elev_km[i];
        if (e < minElev) minElev = e;
        if (e > maxElev) maxElev = e;
    }
    check('land cells', landCount, meta.numLandCells);

    const wantHist = meta.koppenDistributionLand || {};
    for (let k = 1; k < 32; k++) {
        const want = wantHist[String(k)] || 0;
        check(`koppen[${k}] land count`, koppenHist[k], want);
    }
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    if (meta.elevPhysicalKm) {
        if (!near(minElev, meta.elevPhysicalKm.min, 0.01)) {
            errors.push(`min elev_km: got ${minElev.toFixed(3)}, want ${meta.elevPhysicalKm.min}`);
        }
        if (!near(maxElev, meta.elevPhysicalKm.max, 0.01)) {
            errors.push(`max elev_km: got ${maxElev.toFixed(3)}, want ${meta.elevPhysicalKm.max}`);
        }
    }

    if (errors.length) throw new Error('data verification failed:\n  ' + errors.join('\n  '));
    return { landCount, koppenHist, minElev, maxElev };
}
