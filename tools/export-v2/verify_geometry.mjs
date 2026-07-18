import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { generateFibonacciSphere } from '../../third_party/planet_heightmap_generation/js/sphere-mesh.js';
import { makeRng } from '../../third_party/planet_heightmap_generation/js/rng.js';
import { decodePlanetCode } from '../../third_party/planet_heightmap_generation/js/planet-code.js';

const root = path.resolve(import.meta.dirname);
const sourceDir = path.resolve(root, '..', '..', 'data', 'orogen_regions_full');
const cfg = decodePlanetCode(process.argv[2] ?? '06cy8w6z6a89kow6psje93');
if (!cfg) throw new Error('Unable to decode planet code');

const xyz = generateFibonacciSphere(cfg.N, cfg.jitter, makeRng(cfg.seed));
const sampleIds = new Set([0, 1, 2, 199999, 200000, 399999, 800000, 1599999, 2399999, 2559999]);
const checked = [];

const files = fs.readdirSync(sourceDir)
  .filter((f) => /orogen_regions_full_part_\d+\.csv\.gz$/.test(f))
  .sort((a, b) => Number(a.match(/part_(\d+)/)[1]) - Number(b.match(/part_(\d+)/)[1]));

for (const file of files) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(sourceDir, file)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let header = null;
  let idx = null;
  for await (const line of rl) {
    if (!header) {
      header = line.split(',');
      idx = Object.fromEntries(header.map((name, i) => [name, i]));
      continue;
    }
    const idEnd = line.indexOf(',');
    const id = Number(line.slice(0, idEnd));
    if (!sampleIds.has(id)) continue;
    const f = line.split(',');
    const expected = [xyz[3 * id], xyz[3 * id + 1], xyz[3 * id + 2]];
    const observed = [Number(f[idx.x]), Number(f[idx.y]), Number(f[idx.z])];
    const maxAbsError = Math.max(...expected.map((v, i) => Math.abs(v - observed[i])));
    checked.push({ id, maxAbsError });
  }
}

const maxAbsError = Math.max(...checked.map((x) => x.maxAbsError));
if (checked.length !== sampleIds.size || maxAbsError > 6e-7) {
  throw new Error(`Geometry mismatch: checked=${checked.length}/${sampleIds.size}, maxAbsError=${maxAbsError}`);
}
console.log(JSON.stringify({ checked: checked.length, maxAbsError, samples: checked }, null, 2));
