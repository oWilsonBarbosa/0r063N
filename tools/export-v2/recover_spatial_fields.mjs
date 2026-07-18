import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import Delaunator from 'delaunator';
import { setDelaunator, buildSphere } from '../../third_party/planet_heightmap_generation/js/sphere-mesh.js';
import { makeRng } from '../../third_party/planet_heightmap_generation/js/rng.js';
import { decodePlanetCode } from '../../third_party/planet_heightmap_generation/js/planet-code.js';
import { computeTempContinentality } from './vendor/temperature.js';

setDelaunator(Delaunator);

const root = path.resolve(import.meta.dirname);
const sourceDir = path.resolve(root, '..', '..', 'data', 'orogen_regions_full');
const outDir = path.join(root, 'intermediate');
await fsp.mkdir(outDir, { recursive: true });

const planetCode = process.argv[2] ?? '06cy8w6z6a89kow6psje93';
const cfg = decodePlanetCode(planetCode);
if (!cfg) throw new Error(`Unable to decode planet code: ${planetCode}`);
const n = cfg.N + 1;

const partFiles = fs.readdirSync(sourceDir)
  .filter((f) => /orogen_regions_full_part_\d+\.csv\.gz$/.test(f))
  .sort((a, b) => Number(a.match(/part_(\d+)/)[1]) - Number(b.match(/part_(\d+)/)[1]));
if (partFiles.length !== 13) throw new Error(`Expected 13 CSV parts, found ${partFiles.length}`);

console.log(`[recover] reading ${n.toLocaleString()} rows`);
const isLand = new Uint8Array(n);
const oceanWarmthSummer = new Float32Array(n);
const plateIds = new Set();
let row = 0;
let warmthNearThreshold = 0;

for (const file of partFiles) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(sourceDir, file)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let first = true;
  let idx = null;
  for await (const line of rl) {
    if (first) {
      first = false;
      const header = line.split(',');
      idx = Object.fromEntries(header.map((name, i) => [name, i]));
      for (const name of ['id', 'plate', 'isLand', 'owS']) {
        if (!(name in idx)) throw new Error(`${file}: missing ${name}`);
      }
      continue;
    }
    if (!line) continue;
    const f = line.split(',');
    const id = Number(f[idx.id]);
    if (id !== row) throw new Error(`${file}: expected id ${row}, got ${id}`);
    isLand[row] = f[idx.isLand] === '1' ? 1 : 0;
    const warmth = Number(f[idx.owS]);
    oceanWarmthSummer[row] = warmth;
    if (Math.abs(warmth - 0.3) <= 5e-7) warmthNearThreshold++;
    plateIds.add(Number(f[idx.plate]));
    row++;
  }
  console.log(`[recover] ${file}: ${row.toLocaleString()} rows total`);
}
if (row !== n) throw new Error(`Expected ${n} rows, got ${row}`);

console.log('[recover] rebuilding exact sphere mesh');
const tMesh = performance.now();
const { mesh, r_xyz } = buildSphere(cfg.N, cfg.jitter, makeRng(cfg.seed));
console.log(`[recover] mesh ready in ${((performance.now() - tMesh) / 1000).toFixed(1)}s; adjacency=${mesh.adjList.length.toLocaleString()}`);

const lat = new Float32Array(n);
const lon = new Float32Array(n);
const eastX = new Float32Array(n);
const eastY = new Float32Array(n);
const eastZ = new Float32Array(n);
const northX = new Float32Array(n);
const northY = new Float32Array(n);
const northZ = new Float32Array(n);

for (let r = 0; r < n; r++) {
  const x = r_xyz[3 * r];
  const y = r_xyz[3 * r + 1];
  const z = r_xyz[3 * r + 2];
  lat[r] = Math.asin(Math.max(-1, Math.min(1, y)));
  lon[r] = Math.atan2(x, z);

  let ex = z;
  const ey = 0;
  let ez = -x;
  let eLen = Math.sqrt(ex * ex + ez * ez);
  if (eLen < 1e-10) {
    ex = 1;
    ez = 0;
    eLen = 1;
  }
  ex /= eLen;
  ez /= eLen;

  let nx = y * ez - z * ey;
  let ny = z * ex - x * ez;
  let nz = x * ey - y * ex;
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;

  eastX[r] = ex;
  eastY[r] = ey;
  eastZ[r] = ez;
  northX[r] = nx;
  northY[r] = ny;
  northZ[r] = nz;
}

function coastDistanceFromMainOcean(meshArg, land) {
  const { numRegions, adjOffset, adjList } = meshArg;
  const oceanLabel = new Int32Array(numRegions).fill(-1);
  const queue = new Int32Array(numRegions);
  let mainOceanLabel = -1;
  let mainOceanSize = 0;
  let nextLabel = 0;

  for (let r = 0; r < numRegions; r++) {
    if (land[r] || oceanLabel[r] >= 0) continue;
    const label = nextLabel++;
    let qLen = 1;
    let head = 0;
    let size = 0;
    queue[0] = r;
    oceanLabel[r] = label;
    while (head < qLen) {
      const cur = queue[head++];
      size++;
      for (let i = adjOffset[cur]; i < adjOffset[cur + 1]; i++) {
        const nb = adjList[i];
        if (!land[nb] && oceanLabel[nb] === -1) {
          oceanLabel[nb] = label;
          queue[qLen++] = nb;
        }
      }
    }
    if (size > mainOceanSize) {
      mainOceanSize = size;
      mainOceanLabel = label;
    }
  }

  const coastDist = new Int32Array(numRegions).fill(-1);
  let qLen = 0;
  for (let r = 0; r < numRegions; r++) {
    if (!land[r]) continue;
    for (let i = adjOffset[r]; i < adjOffset[r + 1]; i++) {
      const nb = adjList[i];
      if (!land[nb] && oceanLabel[nb] === mainOceanLabel) {
        coastDist[r] = 0;
        queue[qLen++] = r;
        break;
      }
    }
  }
  let head = 0;
  while (head < qLen) {
    const r = queue[head++];
    const d = coastDist[r] + 1;
    for (let i = adjOffset[r]; i < adjOffset[r + 1]; i++) {
      const nb = adjList[i];
      if (land[nb] && coastDist[nb] === -1) {
        coastDist[nb] = d;
        queue[qLen++] = nb;
      }
    }
  }
  return { coastDist, mainOceanSize, oceanComponentCount: nextLabel };
}

console.log('[recover] computing main-ocean coast distance');
const { coastDist, mainOceanSize, oceanComponentCount } = coastDistanceFromMainOcean(mesh, isLand);

console.log('[recover] recovering temperature continentality');
const avgEdgeKm = (Math.PI * 6371) / Math.sqrt(n);
const tempContinentality = computeTempContinentality(
  mesh,
  r_xyz,
  isLand,
  lat,
  lon,
  eastX,
  eastY,
  eastZ,
  northX,
  northY,
  northZ,
  oceanWarmthSummer,
  coastDist,
  avgEdgeKm,
);

console.log('[recover] deriving final surface coastline');
const isSurfaceCoast = new Uint8Array(n);
let surfaceCoastCount = 0;
let landCount = 0;
let tempLandMin = Infinity;
let tempLandMax = -Infinity;
const tempDistinct = new Set();
for (let r = 0; r < n; r++) {
  if (isLand[r]) {
    landCount++;
    const v = tempContinentality[r];
    if (v < tempLandMin) tempLandMin = v;
    if (v > tempLandMax) tempLandMax = v;
    tempDistinct.add(v.toFixed(6));
    for (let i = mesh.adjOffset[r]; i < mesh.adjOffset[r + 1]; i++) {
      if (!isLand[mesh.adjList[i]]) {
        isSurfaceCoast[r] = 1;
        surfaceCoastCount++;
        break;
      }
    }
  } else if (tempContinentality[r] !== -1) {
    throw new Error(`Ocean cell ${r} has tempContinentality=${tempContinentality[r]}`);
  }
}

if (landCount !== 534840) throw new Error(`Land count mismatch: ${landCount}`);
if (surfaceCoastCount !== 40772) {
  throw new Error(`Surface coastline mismatch: ${surfaceCoastCount}, expected 40772`);
}
if (tempLandMin < 0 || tempLandMax > 1 || tempDistinct.size < 20) {
  throw new Error(`Invalid temperature continentality: min=${tempLandMin}, max=${tempLandMax}, distinct=${tempDistinct.size}`);
}
if (warmthNearThreshold !== 0) {
  throw new Error(`Cannot guarantee exact warm-current threshold recovery: ${warmthNearThreshold} values round to 0.300000`);
}

const tempPath = path.join(outDir, 'temp_continentality.f32');
const coastPath = path.join(outDir, 'is_surface_coast.u8');
await fsp.writeFile(tempPath, Buffer.from(tempContinentality.buffer));
await fsp.writeFile(coastPath, Buffer.from(isSurfaceCoast.buffer));

const summary = {
  planetCode,
  seed: cfg.seed,
  rows: n,
  platesObserved: plateIds.size,
  landCount,
  surfaceCoastCount,
  expectedSurfaceCoastCount: 40772,
  oceanComponentCount,
  mainOceanSize,
  avgEdgeKm,
  warmthValuesAtRoundingThreshold: warmthNearThreshold,
  tempContinentality: {
    oceanValue: -1,
    landMin: tempLandMin,
    landMax: tempLandMax,
    distinctAt6Decimals: tempDistinct.size,
  },
  files: {
    tempContinentality: tempPath,
    isSurfaceCoast: coastPath,
  },
};
const summaryPath = path.join(outDir, 'spatial_recovery_summary.json');
await fsp.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ summaryPath, ...summary }, null, 2));
