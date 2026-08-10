import fs from 'node:fs/promises';
import path from 'node:path';
import Delaunator from 'delaunator';
import { setDelaunator } from '../../third_party/planet_heightmap_generation/js/sphere-mesh.js';
import { generateCoarsePlates } from '../../third_party/planet_heightmap_generation/js/coarse-plates.js';
import { applyPlatePhysics } from '../../third_party/planet_heightmap_generation/js/plate-physics.js';
import { decodePlanetCode } from '../../third_party/planet_heightmap_generation/js/planet-code.js';

setDelaunator(Delaunator);

const root = path.resolve(import.meta.dirname);
const outDir = path.join(root, 'intermediate');
await fs.mkdir(outDir, { recursive: true });

const planetCode = process.argv[2] ?? '06cy8w6z6a89kow6psje93';
const cfg = decodePlanetCode(planetCode);
if (!cfg) throw new Error(`Unable to decode planet code: ${planetCode}`);

const {
  coarseMesh,
  coarse_xyz,
  coarse_r_plate,
  coarsePlateSeeds,
  coarsePlateVec,
  coarsePlateIsOcean,
} = generateCoarsePlates(
  cfg.seed,
  cfg.P,
  cfg.numContinents,
  cfg.continentSizeVariety,
  cfg.landCoverage,
);

if (cfg.toggledIndices?.length) {
  const seedArr = Array.from(coarsePlateSeeds);
  for (const i of cfg.toggledIndices) {
    if (i >= seedArr.length) continue;
    const pid = seedArr[i];
    if (coarsePlateIsOcean.has(pid)) coarsePlateIsOcean.delete(pid);
    else coarsePlateIsOcean.add(pid);
  }
}

const { plateDebug } = applyPlatePhysics(
  coarsePlateVec,
  coarsePlateSeeds,
  coarsePlateIsOcean,
  coarse_r_plate,
  coarseMesh,
  coarse_xyz,
  cfg.seed,
);

const speedByPlate = {};
for (const pid of Array.from(coarsePlateSeeds).sort((a, b) => a - b)) {
  const speed = plateDebug[pid]?.omegaAfter;
  if (!Number.isFinite(speed)) throw new Error(`Missing plate speed for plate ${pid}`);
  speedByPlate[String(pid)] = speed;
}

const payload = {
  planetCode,
  seed: cfg.seed,
  plateCount: Object.keys(speedByPlate).length,
  speedByPlate,
};
const outPath = path.join(outDir, 'plate_speed_by_plate.json');
await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ outPath, plateCount: payload.plateCount }));
