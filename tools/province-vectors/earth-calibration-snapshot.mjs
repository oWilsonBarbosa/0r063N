// Earth calibration against the generator snapshot that PRODUCED THIS EXPORT.
//
// orogen_meta_full_v2.json pins generatorSnapshotObject f9bb081 (2026-04-15).
// The generator has changed substantially since — js/elevation.js was largely
// rewritten and js/climate-config.js did not yet exist — so its present-day
// climate constants are not transferable backwards. This script therefore runs
// *that snapshot's* climate chain, not the current one, and solves for the
// index->millimetre scale that reproduces Earth's observed global land mean.
//
// Result at N=160,001, which is the source of PRECIP_SCALE_MM in
// tools/precip-scale.mjs:
//
//   K=1000 (the snapshot's own hardcoded koppen.js value) -> 879 mm/yr  (+23 %)
//   K=838.5683 (the current generator's fitted constant)  -> 737 mm/yr  (+3.1 %)
//   K=813.7 (fitted here)                                 -> 715 mm/yr
//
// Mirrors that version's heightmap-import path with all sculpting sliders at
// zero: sampleHeightmap -> applySoilCreep(3, 0.1125). Detail noise was added
// to the import path later and is correctly absent here.
//
// PREREQUISITES:
//   git worktree add /tmp/gen-f9bb081 f9bb081     # in a generator checkout
//   npm i delaunator@5.0.1 pngjs
//
// Usage:  GENERATOR_ROOT=/tmp/gen-f9bb081 \
//           node tools/province-vectors/earth-calibration-snapshot.mjs 160000

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import Delaunator from 'delaunator';

const GEN = process.env.GENERATOR_ROOT;
const { makeRng } = await import(`${GEN}/js/rng.js`);
const { setDelaunator, buildSphere } = await import(`${GEN}/js/sphere-mesh.js`);
const { applySoilCreep } = await import(`${GEN}/js/terrain-post.js`);
const { computeWind } = await import(`${GEN}/js/wind.js`);
const { computeOceanCurrents } = await import(`${GEN}/js/ocean.js`);
const { computePrecipitation } = await import(`${GEN}/js/precipitation.js`);
const { computeTemperature } = await import(`${GEN}/js/temperature.js`);
const { classifyKoppen, KOPPEN_CLASSES } = await import(`${GEN}/js/koppen.js`);
const SN = await import(`${GEN}/js/simplex-noise.js`);
const SimplexNoise = SN.default ?? SN.SimplexNoise;
setDelaunator(Delaunator);

const N = Number(process.argv[2] ?? 160000), seed = 1234, jitter = 0.75;
function bil(p,w,h,px,py){py=Math.max(0,Math.min(py,h-1));const x0=Math.floor(px),y0=Math.floor(py);
 const x1=(x0+1)%w,y1=Math.min(y0+1,h-1),fx=px-x0,fy=py-y0;const g=(xx,yy)=>p[yy*w+((xx%w)+w)%w];
 return g(x0,y0)*(1-fx)*(1-fy)+p[y0*w+x1]*fx*(1-fy)+g(x0,y1)*(1-fx)*fy+p[y1*w+x1]*fx*fy;}
const g2e = v => (v < 1 ? -0.5 : Math.sqrt((v - 1) / 254));

const png = PNG.sync.read(fs.readFileSync(path.join(GEN,'assets/earth.png')));
const gray = new Uint8Array(png.width*png.height);
for(let i=0;i<gray.length;i++) gray[i]=Math.round(0.299*png.data[i*4]+0.587*png.data[i*4+1]+0.114*png.data[i*4+2]);

const { mesh, r_xyz } = buildSphere(N, jitter, makeRng(seed));
const n = mesh.numRegions;
const r_elevation = new Float32Array(n);
for(let r=0;r<n;r++){const x=r_xyz[3*r],y=r_xyz[3*r+1],z=r_xyz[3*r+2];
 const lat=Math.asin(Math.max(-1,Math.min(1,y))),lon=Math.atan2(x,z);
 r_elevation[r]=g2e(bil(gray,png.width,png.height,(lon/Math.PI+1)*0.5*png.width,(0.5-lat/Math.PI)*png.height));}
const r_isOcean = new Uint8Array(n);
for(let r=0;r<n;r++) if(r_elevation[r]<=0) r_isOcean[r]=1;
applySoilCreep(mesh, r_elevation, r_isOcean, 3, 0.1125);

const r_plate=new Int32Array(n).fill(-1); const plateIsOcean=new Set(), plateVec={};
const {adjOffset,adjList}=mesh;
for(let r=0;r<n;r++){ if(r_plate[r]>=0) continue; const isO=r_elevation[r]<=0;
 r_plate[r]=r; plateVec[r]=[0,0,0]; if(isO) plateIsOcean.add(r);
 const q=[r]; let h=0;
 while(h<q.length){const c=q[h++];
  for(let i=adjOffset[c];i<adjOffset[c+1];i++){const nb=adjList[i];
   if(r_plate[nb]>=0) continue; if((r_elevation[nb]<=0)===isO){r_plate[nb]=r;q.push(nb);}}}}

const noise=new SimplexNoise(seed);
const wind=computeWind(mesh,r_xyz,r_elevation,plateIsOcean,r_plate,noise);
const ocean=computeOceanCurrents(mesh,r_xyz,r_elevation,wind);
const precip=computePrecipitation(mesh,r_xyz,r_elevation,wind,ocean,0,0.3);
const temp=computeTemperature(mesh,r_xyz,r_elevation,wind,ocean,precip,0);
const kop=classifyKoppen(mesh,r_elevation,temp,precip);

let landN=0, idxLand=0, capped=0;
const byK={};
for(let r=0;r<n;r++){
  if(r_elevation[r]<=0) continue;
  landN++;
  const i=Math.max(0,precip.r_precip_summer[r])+Math.max(0,precip.r_precip_winter[r]);
  idxLand+=i;
  if(precip.r_precip_summer[r]>=0.999||precip.r_precip_winter[r]>=0.999) capped++;
  (byK[KOPPEN_CLASSES[kop[r]].code] ??= []).push(i);
}
const meanIdx=idxLand/landN;
console.log(`GENERATOR: ${GEN}`);
console.log(`land cells ${landN} of ${n}   mean annual index ${meanIdx.toFixed(4)}`);
console.log(`censored land cells: ${capped} (${(100*capped/landN).toFixed(2)}%)`);
console.log(`\nland mean under K=1000       -> ${(meanIdx*1000).toFixed(0)} mm/yr`);
console.log(`land mean under K=838.5683   -> ${(meanIdx*838.5683).toFixed(0)} mm/yr`);
console.log(`observed Earth land mean     -> 715 mm/yr`);
console.log(`\n==> K that matches observed Earth: ${(715/meanIdx).toFixed(1)}`);
const REF={Af:2200,Am:1800,Aw:1100,BWh:100,BSh:400,BSk:350,Cfa:1200,Cfb:900,Csa:500,Dfa:700,Dfb:650,Dfc:450,ET:250,EF:100};
console.log(`\nper-class land mean (K=1000) vs typical Earth:`);
for(const k of Object.keys(REF)){const a=byK[k]; if(!a||a.length<20) continue;
  const m=a.reduce((x,y)=>x+y,0)/a.length*1000;
  console.log(`  ${k.padEnd(4)} n=${String(a.length).padStart(5)}  sim ${m.toFixed(0).padStart(5)} mm  earth ~${String(REF[k]).padStart(4)}  ratio ${(m/REF[k]).toFixed(2)}`);}
