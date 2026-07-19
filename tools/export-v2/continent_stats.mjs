import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import Delaunator from 'delaunator';
import { setDelaunator, buildSphere } from '/home/user/0r063N/third_party/planet_heightmap_generation/js/sphere-mesh.js';
import { makeRng } from '/home/user/0r063N/third_party/planet_heightmap_generation/js/rng.js';
import { decodePlanetCode } from '/home/user/0r063N/third_party/planet_heightmap_generation/js/planet-code.js';
import { elevToHeightKm } from '/home/user/0r063N/third_party/planet_heightmap_generation/js/color-map.js';

setDelaunator(Delaunator);
const cfg = decodePlanetCode('06cy8w6z6a89kow6psje93');
const n = cfg.N + 1;

const dataDir = '/home/user/0r063N/data/orogen_regions_full_v2';
const files = fs.readdirSync(dataDir).filter(f => /_part_\d+\.csv\.gz$/.test(f)).sort();

const isLand = new Uint8Array(n);
const elevKm = new Float32Array(n);
const kop = new Uint8Array(n);
const tAnnC = new Float32Array(n);
const latDeg = new Float32Array(n);
const plateOf = new Int32Array(n);
const isOc = new Uint8Array(n);
const superP = new Int16Array(n);

let row = 0;
for (const file of files) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(dataDir, file)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let idx = null;
  for await (const line of rl) {
    if (!idx) {
      idx = Object.fromEntries(line.split(',').map((c, i) => [c, i]));
      continue;
    }
    if (!line) continue;
    const f = line.split(',');
    isLand[row] = f[idx.isLand] === '1' ? 1 : 0;
    // Canonical height: the generator's own S-curve mapping (the one the
    // climate physics used), derived from the raw dimensionless elev — not the
    // legacy linear elev_km field.
    elevKm[row] = elevToHeightKm(+f[idx.elev]);
    kop[row] = +f[idx.koppen];
    tAnnC[row] = -45 + ((+f[idx.tS] + +f[idx.tW]) / 2) * 90;
    latDeg[row] = +f[idx.lat];
    plateOf[row] = +f[idx.plate];
    isOc[row] = f[idx.isOcPlate] === '1' ? 1 : 0;
    superP[row] = +f[idx.superPlate];
    row++;
  }
}
if (row !== n) throw new Error(`rows ${row} != ${n}`);
console.error('csv loaded');

const { mesh } = buildSphere(cfg.N, cfg.jitter, makeRng(cfg.seed));
console.error('mesh built');

// label land components
const label = new Int32Array(n).fill(-1);
const queue = new Int32Array(n);
let nextLabel = 0;
const compCells = [];
for (let r = 0; r < n; r++) {
  if (!isLand[r] || label[r] >= 0) continue;
  const L = nextLabel++;
  let qLen = 1, head = 0, size = 0;
  queue[0] = r; label[r] = L;
  while (head < qLen) {
    const cur = queue[head++]; size++;
    for (let i = mesh.adjOffset[cur]; i < mesh.adjOffset[cur + 1]; i++) {
      const nb = mesh.adjList[i];
      if (isLand[nb] && label[nb] === -1) { label[nb] = L; queue[qLen++] = nb; }
    }
  }
  compCells.push(size);
}
const order = compCells.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
const big4 = order.slice(0, 4).map(x => x[1]);
const totalLand = compCells.reduce((a, b) => a + b, 0);
const big4Cells = order.slice(0, 4).reduce((a, x) => a + x[0], 0);

// planet areas: 4*pi*R^2 / n per cell
const cellKm2 = 4 * Math.PI * 6371 * 6371 / n;

// per-continent stats
const stats = big4.map(() => ({
  cells: 0, latMin: 90, latMax: -90, elevSum: 0, elevMax: -99, elevMaxLat: 0,
  kopGroup: [0, 0, 0, 0, 0, 0], tSum: 0, above2: 0,
}));
const groupOf = k => (k === 0 ? 0 : k <= 3 ? 1 : k <= 7 ? 2 : k <= 16 ? 3 : k <= 28 ? 4 : 5);
let landAbove2 = 0, landB = 0;
for (let r = 0; r < n; r++) {
  if (!isLand[r]) continue;
  if (elevKm[r] > 2) landAbove2++;
  if (groupOf(kop[r]) === 2) landB++;
  const bi = big4.indexOf(label[r]);
  if (bi < 0) continue;
  const s = stats[bi];
  s.cells++;
  if (latDeg[r] < s.latMin) s.latMin = latDeg[r];
  if (latDeg[r] > s.latMax) s.latMax = latDeg[r];
  s.elevSum += elevKm[r];
  if (elevKm[r] > s.elevMax) { s.elevMax = elevKm[r]; s.elevMaxLat = latDeg[r]; }
  s.kopGroup[groupOf(kop[r])]++;
  s.tSum += tAnnC[r];
  if (elevKm[r] > 2) s.above2++;
}

// plate composition
const plateOcean = new Map();
const supers = new Set();
for (let r = 0; r < n; r++) {
  plateOcean.set(plateOf[r], isOc[r]);
  supers.add(superP[r]);
}
let ocP = 0, contP = 0;
for (const v of plateOcean.values()) (v ? ocP++ : contP++);

const out = {
  planet: {
    cells: n, landCells: totalLand, landPct: (totalLand / n * 100).toFixed(2),
    plates: plateOcean.size, continentalPlates: contP, oceanicPlates: ocP, superPlates: supers.size,
    landAbove2kmPct: (landAbove2 / totalLand * 100).toFixed(1),
    landBPct: (landB / totalLand * 100).toFixed(1),
    big4SharePct: (big4Cells / totalLand * 100).toFixed(1),
    islands: compCells.length - 4,
  },
  continents: stats.map((s, i) => ({
    label: big4[i], cells: s.cells, areaMkm2: (s.cells * cellKm2 / 1e6).toFixed(1),
    latMin: s.latMin.toFixed(1), latMax: s.latMax.toFixed(1),
    meanElevKm: (s.elevSum / s.cells).toFixed(2), peakKm: s.elevMax.toFixed(2),
    peakLat: s.elevMaxLat.toFixed(1),
    meanTempC: (s.tSum / s.cells).toFixed(2),
    above2kmPct: (s.above2 / s.cells * 100).toFixed(1),
    koppenPct: {
      A: (s.kopGroup[1] / s.cells * 100).toFixed(0), B: (s.kopGroup[2] / s.cells * 100).toFixed(0),
      C: (s.kopGroup[3] / s.cells * 100).toFixed(0), D: (s.kopGroup[4] / s.cells * 100).toFixed(0),
      E: (s.kopGroup[5] / s.cells * 100).toFixed(0),
    },
  })),
};
console.log(JSON.stringify(out, null, 2));
