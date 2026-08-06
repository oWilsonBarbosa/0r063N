// Earth calibration for the precipitation index -> millimetre scale.
//
// The v2 export's `pS`/`pW` are dimensionless: each is the raw seasonal
// precipitation field divided by its own 95th percentile.  Converting them to
// millimetres needs a scale, and the regional-report pipeline's `precipAnnualMm`
// uses an uncalibrated 1000.  This script validates the alternative used by
// docs/culture/: the generator's own CLIMATE.KOPPEN_PRECIP_SCALE_MM (838.5683),
// which its Koppen classifier feeds into real-millimetre Koppen thresholds and
// which tuning/climate/optimize.mjs fitted against observed Koppen-Geiger data.
//
// Method: run the generator's climate chain (wind -> ocean -> precipitation ->
// temperature -> Koppen) on assets/earth.png, exactly as
// tuning/climate/lib/earth-context.mjs does, then compare the resulting land
// precipitation field against observed Earth values.  Ground truth for the
// Koppen scoring is not needed and is not loaded.
//
// PREREQUISITES (this does not run from a bare checkout of this repository):
//   - a full World Orogen generator checkout, including tuning/ and assets/
//     earth.png; third_party/planet_heightmap_generation here is a partial
//     snapshot and lacks js/climate-config.js
//   - npm i delaunator@5.0.1 pngjs
//   - set GENERATOR_ROOT to the generator checkout
//
// Usage:  GENERATOR_ROOT=/path/to/planet_heightmap_generation \
//           node tools/province-vectors/earth-calibration.mjs [N]
//
// Result at N=160,001: land mean 720 mm/yr under K=838.5683 against Earth's
// observed ~715 mm/yr; solving K directly from that land mean gives 832.9.
// The zonal and per-class breakdowns it prints are the source of the
// reliability bands in docs/culture/ section 2.2.

import path from 'node:path';
import { PNG } from 'pngjs';
import Delaunator from 'delaunator';

import fs from 'node:fs';

const GEN = process.env.GENERATOR_ROOT
    ?? (() => { throw new Error('set GENERATOR_ROOT to a full generator checkout'); })();
const { makeRng }            = await import(`${GEN}/js/rng.js`);
const { setDelaunator, buildSphere } = await import(`${GEN}/js/sphere-mesh.js`);
const { applyDetailNoise, applySoilCreep } = await import(`${GEN}/js/terrain-post.js`);
const { DETAIL_NOISE_DAMPEN_STRENGTH } = await import(`${GEN}/js/terrain-config.js`);
const { computeWind }        = await import(`${GEN}/js/wind.js`);
const { computeOceanCurrents } = await import(`${GEN}/js/ocean.js`);
const { computePrecipitation } = await import(`${GEN}/js/precipitation.js`);
const { computeTemperature }   = await import(`${GEN}/js/temperature.js`);
const { classifyKoppen, KOPPEN_CLASSES } = await import(`${GEN}/js/koppen.js`);
const SimplexNoise = (await import(`${GEN}/js/simplex-noise.js`)).default
                  ?? (await import(`${GEN}/js/simplex-noise.js`)).SimplexNoise;
setDelaunator(Delaunator);

const N = Number(process.argv[2] ?? 40000), seed = 1234, jitter = 0.75;

function sampleBilinear(px_, imgW, imgH, px, py) {
    py = Math.max(0, Math.min(py, imgH - 1));
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const x1 = (x0 + 1) % imgW, y1 = Math.min(y0 + 1, imgH - 1);
    const fx = px - x0, fy = py - y0;
    const w = (xx, yy) => px_[yy * imgW + ((xx % imgW) + imgW) % imgW];
    return w(x0,y0)*(1-fx)*(1-fy) + px_[y0*imgW+x1]*fx*(1-fy)
         + w(x0,y1)*(1-fx)*fy     + px_[y1*imgW+x1]*fx*fy;
}
const grayToElev = v => (v < 1 ? -0.5 : Math.sqrt((v - 1) / 254));

const png = PNG.sync.read(fs.readFileSync(path.join(GEN, 'assets/earth.png')));
const gray = new Uint8Array(png.width * png.height);
for (let i = 0; i < gray.length; i++)
    gray[i] = Math.round(0.299*png.data[i*4] + 0.587*png.data[i*4+1] + 0.114*png.data[i*4+2]);

const rng = makeRng(seed);
const { mesh, r_xyz } = buildSphere(N, jitter, rng);
const n = mesh.numRegions;

const r_elevation = new Float32Array(n);
for (let r = 0; r < n; r++) {
    const x = r_xyz[3*r], y = r_xyz[3*r+1], z = r_xyz[3*r+2];
    const lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(x, z);
    r_elevation[r] = grayToElev(sampleBilinear(gray, png.width, png.height,
        (lon/Math.PI + 1) * 0.5 * png.width, (0.5 - lat/Math.PI) * png.height));
}
const r_isOcean = new Uint8Array(n);
for (let r = 0; r < n; r++) if (r_elevation[r] <= 0) r_isOcean[r] = 1;
const dampen = { dampenField: null, dampenStrength: DETAIL_NOISE_DAMPEN_STRENGTH, amplitudeField: null };
applyDetailNoise(mesh, r_xyz, r_elevation, r_isOcean, seed, dampen);
applyDetailNoise(mesh, r_xyz, r_elevation, r_isOcean, seed,
    { amplitudeKm: 0.05, frequencyMult: 2.0, warpAmpMult: 2.0, bipolar: true,
      biasExponent: 0.4, seedOffset: 13579, ...dampen });
applySoilCreep(mesh, r_elevation, r_isOcean, 3, 0.1125);

// synthetic plates: flood fill on land/ocean parity (verbatim from earth-context)
const r_plate = new Int32Array(n).fill(-1);
const plateIsOcean = new Set(), plateVec = {}, plateSeeds = new Set();
const { adjOffset, adjList } = mesh;
for (let r = 0; r < n; r++) {
    if (r_plate[r] >= 0) continue;
    const isOcean = r_elevation[r] <= 0;
    r_plate[r] = r; plateSeeds.add(r); plateVec[r] = [0,0,0];
    if (isOcean) plateIsOcean.add(r);
    const q = [r]; let h = 0;
    while (h < q.length) { const cur = q[h++];
        for (let ni = adjOffset[cur]; ni < adjOffset[cur+1]; ni++) { const nb = adjList[ni];
            if (r_plate[nb] >= 0) continue;
            if ((r_elevation[nb] <= 0) === isOcean) { r_plate[nb] = r; q.push(nb); } } }
}

const noise = new SimplexNoise(seed);
const windResult  = computeWind(mesh, r_xyz, r_elevation, plateIsOcean, r_plate, noise);
const oceanResult = computeOceanCurrents(mesh, r_xyz, r_elevation, windResult);
const precip      = computePrecipitation(mesh, r_xyz, r_elevation, windResult, oceanResult, 0, 0.3);
const temp        = computeTemperature(mesh, r_xyz, r_elevation, windResult, oceanResult, precip, 0);
const r_koppen    = classifyKoppen(mesh, r_elevation, temp, precip);


const KOP=['Ocean','Af','Am','Aw','BWh','BWk','BSh','BSk','Cfa','Cfb','Cfc','Csa','Csb','Csc','Cwa','Cwb','Cwc','Dfa','Dfb','Dfc','Dfd','Dsa','Dsb','Dsc','Dsd','Dwa','Dwb','Dwc','Dwd','ET','EF'];
const rows=[];
for (let r = 0; r < n; r++) rows.push({
    lat: Math.asin(Math.max(-1, Math.min(1, r_xyz[3*r+1]))) * 180/Math.PI,
    land: r_elevation[r] > 0 ? 1 : 0,
    pS: precip.r_precip_summer[r], pW: precip.r_precip_winter[r],
    k: r_koppen[r],
});
const land=rows.filter(r=>r.land===1);
const idxSum = r=>Math.max(0,r.pS)+Math.max(0,r.pW);      // annual index (0..2)
const meanIdxLand = land.reduce((s,r)=>s+idxSum(r),0)/land.length;
const meanIdxAll  = rows.reduce((s,r)=>s+idxSum(r),0)/rows.length;

console.log(`cells ${rows.length}  land ${land.length} (${(100*land.length/rows.length).toFixed(1)}%)`);
console.log(`mean annual index: land ${meanIdxLand.toFixed(4)}  global ${meanIdxAll.toFixed(4)}`);

const K_GEN = 838.5683;                     // CLIMATE.KOPPEN_PRECIP_SCALE_MM
const K_RPT = 1000;                         // 0r063N regional-report convention
const EARTH_LAND_MM = 715;                  // observed global land mean, incl. Antarctica
const EARTH_GLOBAL_MM = 990;                // observed global (land+ocean) mean

console.log(`\n-- implied land-mean annual precipitation --`);
for (const [name,K] of [['generator KOPPEN_PRECIP_SCALE_MM',K_GEN],['0r063N report convention',K_RPT]])
  console.log(`  K=${String(K).padStart(9)} (${name.padEnd(34)}) -> ${(meanIdxLand*K).toFixed(0)} mm/yr`);
console.log(`  observed Earth land mean                                        -> ${EARTH_LAND_MM} mm/yr`);
console.log(`\n-- K solved to match observed Earth --`);
console.log(`  from land mean   : K = ${(EARTH_LAND_MM/meanIdxLand).toFixed(1)} mm per unit index per half-year`);
console.log(`  from global mean : K = ${(EARTH_GLOBAL_MM/meanIdxAll).toFixed(1)}`);

// censoring
const cap = rows.filter(r=>r.pS>=0.999||r.pW>=0.999).length;
const capLand = land.filter(r=>r.pS>=0.999||r.pW>=0.999).length;
console.log(`\n-- censoring in the Earth run --`);
console.log(`  all cells at cap : ${cap} (${(100*cap/rows.length).toFixed(2)}%)`);
console.log(`  land cells at cap: ${capLand} (${(100*capLand/land.length).toFixed(2)}%)`);

// latitudinal profile over land, K = generator constant
console.log(`\n-- zonal land-mean annual mm (K=${K_GEN}) vs observed Earth --`);
const OBS={'0-10':2000,'10-20':1200,'20-30':350,'30-40':550,'40-50':650,'50-60':550,'60-70':400,'70-90':200};
for (const [band,lo,hi] of [['0-10',0,10],['10-20',10,20],['20-30',20,30],['30-40',30,40],['40-50',40,50],['50-60',50,60],['60-70',60,70],['70-90',70,90]]){
  const a=land.filter(r=>Math.abs(r.lat)>=lo&&Math.abs(r.lat)<hi);
  if(!a.length){console.log(`  ${band.padEnd(6)} (no land)`);continue;}
  const mm=a.reduce((s,r)=>s+idxSum(r),0)/a.length*K_GEN;
  console.log(`  ${band.padEnd(6)} sim ${mm.toFixed(0).padStart(5)} mm   obs ~${String(OBS[band]).padStart(4)} mm   ratio ${(mm/OBS[band]).toFixed(2)}`);
}

// per-Koppen-class mean, sim
console.log(`\n-- simulated land mean mm by Köppen class (K=${K_GEN}) --`);
const byK={};
for(const r of land){ (byK[KOP[r.k]] ??= []).push(idxSum(r)*K_GEN); }
const REF={Af:2200,Am:1800,Aw:1100,BWh:100,BWk:150,BSh:400,BSk:350,Cfa:1200,Cfb:900,Csa:500,Dfa:700,Dfb:650,Dfc:450,ET:250,EF:100};
for(const k of ['Af','Am','Aw','BWh','BWk','BSh','BSk','Cfa','Cfb','Csa','Dfa','Dfb','Dfc','ET','EF']){
  const a=byK[k]; if(!a||a.length<20){console.log(`  ${k.padEnd(4)} n<20`);continue;}
  const m=a.reduce((x,y)=>x+y,0)/a.length;
  console.log(`  ${k.padEnd(4)} n=${String(a.length).padStart(5)}  sim ${m.toFixed(0).padStart(5)} mm   typical Earth ~${String(REF[k]).padStart(4)} mm`);
}

