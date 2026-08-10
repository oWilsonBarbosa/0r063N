import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

const root = path.resolve(import.meta.dirname);
const sourceDir = path.resolve(root, '..', '..', 'data', 'orogen_regions_full');
const outputDir = path.resolve(root, '..', '..', 'data', 'orogen_regions_full_v2');
const intermediateDir = path.join(root, 'intermediate');
const platePayload = JSON.parse(await fsp.readFile(path.join(intermediateDir, 'plate_speed_by_plate.json'), 'utf8'));
const tempBuffer = await fsp.readFile(path.join(intermediateDir, 'temp_continentality.f32'));
const tempArrayBuffer = tempBuffer.buffer.slice(tempBuffer.byteOffset, tempBuffer.byteOffset + tempBuffer.byteLength);
const tempContinentality = new Float32Array(tempArrayBuffer);
const isSurfaceCoast = await fsp.readFile(path.join(intermediateDir, 'is_surface_coast.u8'));

function formatFloat(value, digits = 6) {
  const v = Object.is(value, -0) ? 0 : value;
  return v.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

function parseMicro(text) {
  let s = text;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  const [whole, frac = ''] = s.split('.');
  return sign * (Number(whole || '0') * 1_000_000 + Number((frac + '000000').slice(0, 6)));
}

function makeLineIterator(filePath) {
  return readline.createInterface({
    input: fs.createReadStream(filePath).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })[Symbol.asyncIterator]();
}

const sourceFiles = fs.readdirSync(sourceDir)
  .filter((f) => /orogen_regions_full_part_\d+\.csv\.gz$/.test(f))
  .sort((a, b) => Number(a.match(/part_(\d+)/)[1]) - Number(b.match(/part_(\d+)/)[1]));

let rows = 0;
let land = 0;
let coast = 0;
const plateSpeeds = new Map();
const tempDistinct = new Set();

for (const sourceFile of sourceFiles) {
  const part = Number(sourceFile.match(/part_(\d+)/)[1]);
  const correctedFile = `orogen_regions_full_v2_part_${String(part).padStart(2, '0')}.csv.gz`;
  const sourceIt = makeLineIterator(path.join(sourceDir, sourceFile));
  const correctedIt = makeLineIterator(path.join(outputDir, correctedFile));

  const sourceHead = (await sourceIt.next()).value.split(',');
  const correctedHead = (await correctedIt.next()).value.split(',');
  if (sourceHead.length !== 56 || correctedHead.length !== 58) throw new Error(`${part}: bad header width`);
  const srcIdx = Object.fromEntries(sourceHead.map((name, i) => [name, i]));
  const outIdx = Object.fromEntries(correctedHead.map((name, i) => [name, i]));
  if (correctedHead[srcIdx.tempContality] !== 'tempContinentality') throw new Error(`${part}: rename missing`);

  while (true) {
    const [s, o] = await Promise.all([sourceIt.next(), correctedIt.next()]);
    if (s.done || o.done) {
      if (s.done !== o.done) throw new Error(`${part}: row count mismatch between source and output`);
      break;
    }
    const sf = s.value.split(',');
    const of = o.value.split(',');
    if (of.length !== 58) throw new Error(`${part}: output row has ${of.length} fields`);
    const id = Number(sf[srcIdx.id]);
    if (id !== rows || Number(of[outIdx.id]) !== id) throw new Error(`${part}: id mismatch at ${rows}`);

    for (let i = 0; i < 56; i++) {
      if (i === srcIdx.plateSpeed || i === srcIdx.tempContality) continue;
      if (sf[i] !== of[i]) throw new Error(`${part}: legacy field ${sourceHead[i]} changed at id ${id}`);
    }

    const expectedSpeed = formatFloat(Math.fround(platePayload.speedByPlate[sf[srcIdx.plate]]));
    if (of[outIdx.plateSpeed] !== expectedSpeed || Number(expectedSpeed) <= 0) {
      throw new Error(`${part}: invalid plateSpeed at id ${id}`);
    }
    plateSpeeds.set(sf[srcIdx.plate], expectedSpeed);

    const expectedTemp = formatFloat(tempContinentality[id]);
    if (of[outIdx.tempContinentality] !== expectedTemp) throw new Error(`${part}: invalid tempContinentality at id ${id}`);
    tempDistinct.add(expectedTemp);

    const expectedCoast = isSurfaceCoast[id] ? '1' : '0';
    if (of[outIdx.isSurfaceCoast] !== expectedCoast) throw new Error(`${part}: invalid isSurfaceCoast at id ${id}`);
    if (expectedCoast === '1') coast++;
    if (sf[srcIdx.isLand] === '1') land++;

    const elev = parseMicro(of[outIdx.elev]);
    const prePost = parseMicro(of[outIdx.prePost]);
    const delta = parseMicro(of[outIdx.postProcessDelta]);
    if (elev !== prePost + delta) throw new Error(`${part}: postProcessDelta identity fails at id ${id}`);
    rows++;
  }
  console.log(`[validate] ${correctedFile}: OK`);
}

const result = {
  status: 'passed',
  rows,
  fields: 58,
  land,
  surfaceCoast: coast,
  distinctPlates: plateSpeeds.size,
  distinctPlateSpeeds: new Set(plateSpeeds.values()).size,
  distinctTempContinentalityTextValues: tempDistinct.size,
  legacyColumnsUnchangedExcept: ['plateSpeed', 'tempContality -> tempContinentality'],
  addedColumns: ['isSurfaceCoast', 'postProcessDelta'],
};
if (rows !== 2_560_001 || land !== 534_840 || coast !== 40_772 || plateSpeeds.size !== 80) {
  throw new Error(`Final validation counters failed: ${JSON.stringify(result)}`);
}
const outPath = path.join(outputDir, 'validation_v2.json');
await fsp.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outPath, ...result }, null, 2));
