import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { once } from 'node:events';

const root = path.resolve(import.meta.dirname);
const sourceDir = path.resolve(root, '..', '..', 'data', 'orogen_regions_full');
const intermediateDir = path.join(root, 'intermediate');
const outputDir = path.resolve(root, '..', '..', 'data', 'orogen_regions_full_v2');
await fsp.mkdir(outputDir, { recursive: true });

const platePayload = JSON.parse(await fsp.readFile(path.join(intermediateDir, 'plate_speed_by_plate.json'), 'utf8'));
const speedByPlate = platePayload.speedByPlate;
const tempBuffer = await fsp.readFile(path.join(intermediateDir, 'temp_continentality.f32'));
const tempArrayBuffer = tempBuffer.buffer.slice(tempBuffer.byteOffset, tempBuffer.byteOffset + tempBuffer.byteLength);
const tempContinentality = new Float32Array(tempArrayBuffer);
const isSurfaceCoast = await fsp.readFile(path.join(intermediateDir, 'is_surface_coast.u8'));
const recovery = JSON.parse(await fsp.readFile(path.join(intermediateDir, 'spatial_recovery_summary.json'), 'utf8'));
const n = recovery.rows;
if (tempContinentality.length !== n || isSurfaceCoast.length !== n) {
  throw new Error('Recovered arrays have the wrong length');
}

const sourceFiles = fs.readdirSync(sourceDir)
  .filter((f) => /orogen_regions_full_part_\d+\.csv\.gz$/.test(f))
  .sort((a, b) => Number(a.match(/part_(\d+)/)[1]) - Number(b.match(/part_(\d+)/)[1]));
if (sourceFiles.length !== 13) throw new Error(`Expected 13 parts, found ${sourceFiles.length}`);

function formatFloat(value, digits = 6) {
  if (!Number.isFinite(value)) return '';
  const v = Object.is(value, -0) ? 0 : value;
  const fixed = v.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

function parseMicro(text) {
  let s = text;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const [whole, frac = ''] = s.split('.');
  return sign * (Number(whole || '0') * 1_000_000 + Number((frac + '000000').slice(0, 6)));
}

function formatMicro(value) {
  if (value === 0) return '0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 1_000_000);
  const frac = String(abs % 1_000_000).padStart(6, '0').replace(/0+$/, '');
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

const partSummaries = [];
let globalRow = 0;
let globalLand = 0;
let globalSurfaceCoast = 0;

for (const sourceFile of sourceFiles) {
  const partNo = Number(sourceFile.match(/part_(\d+)/)[1]);
  const outName = `orogen_regions_full_v2_part_${String(partNo).padStart(2, '0')}.csv.gz`;
  const outPath = path.join(outputDir, outName);
  const gzip = zlib.createGzip({ level: 9 });
  const outStream = fs.createWriteStream(outPath);
  gzip.pipe(outStream);

  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(sourceDir, sourceFile)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  let first = true;
  let idx = null;
  let rows = 0;
  let firstId = null;
  let lastId = null;
  let land = 0;
  let surfaceCoast = 0;

  for await (const line of rl) {
    if (first) {
      first = false;
      const header = line.split(',');
      idx = Object.fromEntries(header.map((name, i) => [name, i]));
      for (const name of ['id', 'elev', 'prePost', 'plate', 'plateSpeed', 'isLand', 'tempContality']) {
        if (!(name in idx)) throw new Error(`${sourceFile}: missing ${name}`);
      }
      header[idx.tempContality] = 'tempContinentality';
      header.push('isSurfaceCoast', 'postProcessDelta');
      if (!gzip.write(`${header.join(',')}\n`)) await once(gzip, 'drain');
      continue;
    }
    if (!line) continue;
    const f = line.split(',');
    const id = Number(f[idx.id]);
    if (id !== globalRow) throw new Error(`${sourceFile}: expected id ${globalRow}, got ${id}`);
    const speed = speedByPlate[f[idx.plate]];
    if (!Number.isFinite(speed)) throw new Error(`${sourceFile}: no recovered speed for plate ${f[idx.plate]}`);

    f[idx.plateSpeed] = formatFloat(Math.fround(speed));
    f[idx.tempContality] = formatFloat(tempContinentality[id]);
    const surface = isSurfaceCoast[id] ? 1 : 0;
    const postDeltaMicro = parseMicro(f[idx.elev]) - parseMicro(f[idx.prePost]);
    f.push(String(surface), formatMicro(postDeltaMicro));

    if (!gzip.write(`${f.join(',')}\n`)) await once(gzip, 'drain');
    if (firstId === null) firstId = id;
    lastId = id;
    rows++;
    if (f[idx.isLand] === '1') land++;
    if (surface) surfaceCoast++;
    globalRow++;
  }

  gzip.end();
  await once(outStream, 'close');
  const stat = await fsp.stat(outPath);
  const sha256 = await sha256File(outPath);
  globalLand += land;
  globalSurfaceCoast += surfaceCoast;
  partSummaries.push({
    part: partNo,
    file: outName,
    rows,
    firstId,
    lastId,
    land,
    surfaceCoast,
    sizeBytes: stat.size,
    sha256,
  });
  console.log(`[rewrite] ${outName}: ${rows.toLocaleString()} rows, ${(stat.size / 1e6).toFixed(1)} MB`);
}

if (globalRow !== n) throw new Error(`Row count ${globalRow} != ${n}`);
if (globalLand !== recovery.landCount) throw new Error(`Land count ${globalLand} != ${recovery.landCount}`);
if (globalSurfaceCoast !== recovery.surfaceCoastCount) {
  throw new Error(`Surface coast count ${globalSurfaceCoast} != ${recovery.surfaceCoastCount}`);
}

const metadata = {
  schema: 'orogen_regions_full_v2',
  schemaVersion: '2.0.0',
  planetCode: recovery.planetCode,
  seed: recovery.seed,
  numRegions: n,
  numFields: 58,
  numLandCells: globalLand,
  numSurfaceCoastCells: globalSurfaceCoast,
  source: {
    repository: 'oWilsonBarbosa/0r063N',
    auditedCommit: '9937ec63f74a5485344d0348c8a86480360c61c4',
    originalDatasetZipSha256: '41a839e9fc32867713520fd5beefeb49acb814f3297ba7497fed97a7dead1e29',
    generatorSnapshotObject: 'f9bb081224ee80adea5bd1bb7c012d05786c4f9f',
    generatorSnapshotDate: '2026-04-15',
  },
  representation: {
    lat: 'degrees',
    lon: 'degrees',
    floatTextPrecision: 'up to 6 decimal places',
  },
  corrections: [
    {
      field: 'plateSpeed',
      change: 'replaced zero fallback with deterministic Float32 angular-speed magnitude after plate physics',
      proof: '80 recovered plate IDs match the 80 observed plate IDs',
    },
    {
      field: 'tempContinentality',
      change: 'renamed from tempContality and recovered from the exact mesh, land mask, and summer ocean-warmth field',
      proof: 'exact regenerated geometry; no warmth values at the 0.3 rounding threshold; 149543 distinct land values at 6 decimals',
    },
    {
      field: 'isSurfaceCoast',
      change: 'added final land/ocean adjacency flag',
      proof: '40772 cells, exactly matching generator terrainMetrics.coastline_cells',
    },
    {
      field: 'postProcessDelta',
      change: 'added exact decimal difference elev - prePost from the exported values',
      proof: 'decimal identity checked during export and validation',
    },
  ],
  clarifiedLegacySemantics: {
    isCoastal: 'tectonic collision/boundary seed flag; not the final surface coastline',
    isMountain: 'tectonic mountain-generation seed flag; not an elevation threshold',
    eroD: 'net change after the terrain-warp snapshot: smoothing, erosion, ridge sharpening, and soil creep; excludes terrain warp',
    owS_owW: 'smoothed geographic coastal warmth proxy; not vector heat transport',
    pS_pW: 'p95-normalized and capped precipitation index; 1 means greater than or equal to the seasonal p95',
    wsS_wsW: 'p95-normalized and capped wind speed; 1 means greater than or equal to the seasonal p95',
    ocSpeedS_ocSpeedW: 'p95-normalized and capped current speed; 1 means greater than or equal to the oceanic seasonal p95',
  },
  unavailableFromLegacyExport: [
    'raw precipitation above the p95 cap and its p95 scale',
    'raw wind speed above the p95 cap and its p95 scale',
    'raw ocean-current speed above the p95 cap and its p95 scale',
    'pre-erosion elevation and terrain-warp-only delta',
  ],
  recoveryValidation: recovery,
  parts: partSummaries,
};

await fsp.writeFile(path.join(outputDir, 'orogen_meta_full_v2.json'), `${JSON.stringify(metadata, null, 2)}\n`);

const manifestLines = [
  '# Orogen regions full v2 — corrected CSV parts manifest',
  '',
  `Planet: \`${recovery.planetCode}\`  `,
  `Rows: **${n.toLocaleString('en-US')}**  `,
  'Fields: **58**  ',
  'Parts: **13** independent `.csv.gz` files; each contains the full header.',
  '',
  '| Part | File | Rows | First id | Last id | Land | Surface coast | Size bytes | SHA-256 |',
  '|---:|---|---:|---:|---:|---:|---:|---:|---|',
  ...partSummaries.map((p) => `| ${String(p.part).padStart(2, '0')} | \`${p.file}\` | ${p.rows} | ${p.firstId} | ${p.lastId} | ${p.land} | ${p.surfaceCoast} | ${p.sizeBytes} | \`${p.sha256}\` |`),
  '',
  'Corrections: recovered `plateSpeed`; recovered and renamed `tempContinentality`; added `isSurfaceCoast`; added `postProcessDelta`; corrected units and semantics in the metadata and data dictionary.',
  '',
];
await fsp.writeFile(path.join(outputDir, 'orogen_regions_full_v2_manifest.md'), `${manifestLines.join('\n')}\n`);

console.log(JSON.stringify({ outputDir, rows: globalRow, fields: 58, parts: partSummaries.length }, null, 2));
