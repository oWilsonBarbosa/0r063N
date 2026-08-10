/* =====================================================================
 * OROGEN FULL EXTRACTOR  v2  —  paste into the DevTools console at
 * https://www.orogen.studio/#<planet-code>  AFTER the planet has finished
 * generating (and after you have pressed "Compute Climate", see below).
 *
 * Extracts the maximum information the running app holds:
 *   - every per-region field  (all 56 original CSV columns' worth, PLUS
 *     ~40 debug layers that were never in that export, PLUS derived
 *     lat/lon, physical km, cell area, real coastline, the local
 *     east/north tangent basis, and UNCENSORED wind/current magnitudes)
 *   - per-plate table, Koppen class table, ITCZ curves, dual-mesh
 *     geometry, terrain metrics, generation params, climate constants
 *   - a metadata JSON that is a real data dictionary, written BEFORE the
 *     bulk export so a crash still leaves a description behind
 *
 * WHY THIS WORKS: orogen.studio is served verbatim from the GitHub repo
 * (Pages workflow uploads path:'.', no bundler), so index.html loads raw
 * ES modules. Module identity is keyed by resolved URL, so importing
 * '/js/state.js' returns the SAME live singleton the app is using.
 *
 * IMPORTANT — CLIMATE: for meshes above AUTO_CLIMATE_THRESHOLD (300000
 * regions, js/main.js:83) the app SKIPS climate at generation time. This
 * planet has ~2.56M regions, so you MUST trigger "Compute Climate" in the
 * UI and let it finish. The script now GATES on this up front instead of
 * discovering it after ten minutes of work.
 *
 * IMPORTANT — OUTPUT FOLDER: the folder picker is now the very FIRST thing
 * that runs, because showDirectoryPicker() needs transient user activation
 * and Chrome expires that 5 seconds after the console paste. If the picker
 * is skipped you get ~16 separate downloads and Chrome blocks all but the
 * first unless you click "Allow" on the multi-download prompt.
 *
 * Everything is feature-detected: the deployed build may be older or newer
 * than any given source snapshot, so nothing is hard-coded. Missing fields
 * are skipped and REPORTED, never fatal. Nothing throws on a missing field.
 *
 * READ-ONLY: this only reads data already in your browser tab. The one
 * place upstream code would have written back into live state
 * (computeTerrainMetrics mutates ctx.plateIsOcean, js/terrain-metrics.js:
 * 802-805) is defended against explicitly — see section 5c.
 * ===================================================================== */

(async () => {
'use strict';

// ---------------------------------------------------------------------
// CONFIG — edit these before pasting if you want different behaviour.
// ---------------------------------------------------------------------
const CFG = {
  ROWS_PER_PART: 200000,   // matches the 13-part convention of the original export.
                           // Safe at this width now: the writer STREAMS, so no
                           // whole-part string is ever built (V8 caps strings at
                           // 536,870,888 chars and the old join() approach held
                           // three ~156 MB copies of each part simultaneously).
  START_PART: 0,           // resume knob: set to N to restart after a failed part.
                           // The script prints the value to use if a part fails.
  GZIP: true,              // compress each region part with CompressionStream.
                           // Sidecars and the manifest are ALWAYS uncompressed so
                           // that a file named .json really is readable JSON.
  INCLUDE_ADJACENCY: false,// region neighbour lists — TRUE is ~15M entries, very large
  INCLUDE_CELL_AREA: true, // per-region spherical Voronoi cell area (needs _adjTriList)
  INCLUDE_DUAL_MESH: true, // triangle centres + elevations + the Delaunay index, as
                           // three binary sidecars (~200 MB raw, far less gzipped).
                           // This is the complete polygonal geometry of the planet;
                           // without it the region table cannot be re-polygonised.
  INCLUDE_TANGENT_BASIS: true, // 6 columns reproducing js/wind.js:578-589 exactly.
                           // These are what turn the stored E/N wind and current
                           // components back into real 3-D vectors. Closed form,
                           // zero extra allocation, ~1 s.

  // --- OPT-IN RECOMPUTES -------------------------------------------------
  // All three default OFF. Each one runs generator code on the MAIN THREAD,
  // which freezes the tab for tens of seconds and allocates hundreds of MB.
  // They are the only way to reach the listed fields, so they are kept as
  // flags rather than dropped. Each verifies itself against live data and
  // discards its result if the reproduction does not match.
  RERUN_WIND: false,       // ~30-60 s, ~200 MB. Recovers r_coastDistLand,
                           // r_westness, r_plateContinentality — three fields
                           // computeWind returns (js/wind.js:877-891) that
                           // buildClimateFields (js/planet-worker.js:171-193)
                           // never forwards, so they exist NOWHERE in state.
  RERUN_TEMP: false,       // requires RERUN_WIND. Recovers tempContinentality,
                           // which the on-demand climate path omits from
                           // climateDebugLayers (js/planet-worker.js:767-780)
                           // even though handleGenerate includes it (:372).
  RECOMPUTE_TERRAIN_METRICS: false, // ~20-60 s (several full sorts over 2.56M
                           // cells). window.__terrainMetrics is written ONLY on
                           // the first `done` message (js/generate.js:243) and is
                           // never refreshed by reapplyDone or editDone, so the
                           // stored copy can describe a planet that no longer
                           // exists. The stored copy is always emitted either way.

  PREC: {                  // decimal places per field family (size vs precision)
    coord: 6,              // lat/lon degrees  (~0.1 m at equator)
    xyz: 7,                // unit sphere
    elev: 6,               // dimensionless elevation
    km: 4,                 // physical km
    norm: 5,               // 0..1 normalised fields
    phys: 3,               // physical units (C, mm)
    raw: 'sig9'            // uncensored vector components/magnitudes.
                           // MUST NOT be a fixed decimal count: ocean current
                           // components run around 1e-3 and below (js/ocean.js:378
                           // logs p95Sq in exponential notation), so 6 fixed
                           // decimals would keep ONE significant digit and would
                           // print 0 below 5e-7 — destroying exactly the dynamic
                           // range this export exists to preserve. 'sig9' is the
                           // shortest form that round-trips a Float32 exactly.
  }
};

const log  = (...a) => console.log('%c[orogen]', 'color:#4f9bff;font-weight:bold', ...a);
const warn = (...a) => console.warn('%c[orogen]', 'color:#e8a33b;font-weight:bold', ...a);

// ---------------------------------------------------------------------
// 0a. YIELD PRIMITIVE
//     setTimeout is the wrong tool here: Chrome throttles it to >=1 s in a
//     hidden tab and to once per 60 s under intensive throttling after five
//     minutes hidden, which can stall a 10-minute export for hours.
//     MessageChannel tasks are exempt from both that and the 4 ms nested
//     timer clamp; scheduler.yield() is the modern primitive when present.
// ---------------------------------------------------------------------
const _mc = (typeof MessageChannel === 'function') ? new MessageChannel() : null;
let _yieldRes = null;
if (_mc) _mc.port1.onmessage = () => { const f = _yieldRes; _yieldRes = null; if (f) f(); };
const yieldNow =
  (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function')
    ? () => scheduler.yield()
    : _mc
      ? () => new Promise(res => { _yieldRes = res; _mc.port2.postMessage(0); })
      : () => new Promise(res => setTimeout(res, 0));

// ---------------------------------------------------------------------
// 0b. OUTPUT FOLDER — FIRST, BEFORE ANY WORK.
//
//     showDirectoryPicker() requires transient user activation and Chrome
//     expires that 5 seconds after the gesture. The previous version asked
//     only after five dynamic imports, a 15M-iteration coastline sweep and
//     a 15M-atan2 cell-area loop, by which point activation was always
//     gone; the SecurityError was swallowed and mislabelled "declined",
//     silently selecting the 16-blocked-downloads path. Nothing above this
//     line does any work.
//
//     Note that even a SUCCESSFUL picker shows a permission prompt for
//     mode:'readwrite', which is another reason to front-load it.
// ---------------------------------------------------------------------
let dirHandle = null;
if (typeof window.showDirectoryPicker === 'function') {
  const pick = () => window.showDirectoryPicker({ mode: 'readwrite', id: 'orogen', startIn: 'downloads' });
  const active = (navigator.userActivation && typeof navigator.userActivation.isActive === 'boolean')
    ? navigator.userActivation.isActive : null;
  try {
    if (active === false) throw new DOMException('no transient activation', 'SecurityError');
    dirHandle = await pick();
  } catch (e) {
    const nm = e && e.name;
    if (nm === 'AbortError') {
      warn('folder picker cancelled by you — falling back to individual downloads');
    } else {
      // SecurityError (no activation) or anything else: offer a real button,
      // which guarantees activation regardless of what DevTools granted.
      log(`folder picker unavailable from the console paste (${nm}) — click the button to choose one`);
      try {
        const btn = document.createElement('button');
        btn.textContent = 'Choose orogen export folder';
        btn.style.cssText = 'position:fixed;z-index:2147483647;top:16px;left:16px;' +
          'padding:14px 22px;font:600 15px system-ui;background:#4f9bff;color:#fff;' +
          'border:0;border-radius:8px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4)';
        const cancel = document.createElement('button');
        cancel.textContent = 'Skip (use downloads)';
        cancel.style.cssText = btn.style.cssText.replace('left:16px', 'left:290px').replace('#4f9bff', '#666');
        document.body.appendChild(btn); document.body.appendChild(cancel);
        dirHandle = await new Promise(res => {
          btn.onclick    = async () => { try { res(await pick()); } catch { res(null); } };
          cancel.onclick = () => res(null);
        });
        btn.remove(); cancel.remove();
      } catch (e2) { warn('button fallback failed:', e2 && e2.message); }
    }
  }
} else {
  warn('File System Access API not available in this browser (Chrome/Edge strongly ' +
       'recommended for an export this size) — falling back to individual downloads');
}

if (dirHandle) {
  log('streaming output to the chosen folder');
} else {
  const ok = confirm(
    'No output folder was granted.\n\n' +
    'This run will emit ~16 separate downloads. Chrome asks for the ' +
    '"Download multiple files" permission on the SECOND file and silently ' +
    'discards every later file until you click Allow — and you must keep this ' +
    'tab in the foreground for the whole ~10 minute run.\n\n' +
    'Cancel is the recommended answer: re-run and accept the folder picker.\n\n' +
    'Continue with downloads anyway?');
  if (!ok) throw new Error('aborted by user — re-run and accept the folder picker');
  warn('proceeding with the download fallback at user request');
}

if (document.visibilityState !== 'visible') {
  warn('this tab is not in the foreground — bring it forward before continuing; ' +
       'Chrome throttles background timers and may discard a tab this large');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) warn('tab hidden — keep it foregrounded; timers throttle and ' +
                            'Chrome may discard a ~1.5 GB tab under memory pressure');
});

// ---------------------------------------------------------------------
// 1. LOAD THE LIVE MODULES
//    Primary: direct path import (works on the unbundled Pages deploy).
//    Fallback: discover the real module URLs from the resource timeline,
//    in case the site is ever rebuilt with hashed/bundled assets.
// ---------------------------------------------------------------------
async function loadModules() {
  const tryImport = async (spec) => { try { return await import(spec); } catch { return null; } };

  let stateMod = await tryImport('/js/state.js');

  if (!stateMod) {
    warn('direct import of /js/state.js failed — trying resource-timeline discovery');
    const urls = performance.getEntriesByType('resource')
      .map(e => e.name)
      .filter(u => /\.m?js(\?|$)/.test(u) && u.startsWith(location.origin));
    for (const u of urls) {
      if (!/state/i.test(u)) continue;
      const m = await tryImport(u);
      if (m && m.state && 'curData' in m.state) { stateMod = m; break; }
    }
  }
  if (!stateMod || !stateMod.state) {
    throw new Error('Could not reach the app state module. Is this really orogen.studio, ' +
                    'and is the build unbundled? Check the Network tab for /js/state.js');
  }

  // Optional helper modules — each is nice-to-have, none is fatal.
  const [colorMap, koppen, planetCode, climateCfg] = await Promise.all([
    tryImport('/js/color-map.js'),
    tryImport('/js/koppen.js'),
    tryImport('/js/planet-code.js'),
    tryImport('/js/climate-config.js')   // absent on older builds
  ]);

  return { state: stateMod.state, colorMap, koppen, planetCode, climateCfg };
}

const M = await loadModules();
const d = M.state.curData;

if (!d) throw new Error('state.curData is null — generate a planet first, then re-run.');
log('live state acquired; curData keys:', Object.keys(d).length);

const mesh = d.mesh;
const N = (mesh && (mesh.numRegions ?? mesh.numRegions_)) || d.r_elevation.length;
log(`regions: ${N.toLocaleString()}`);

const DL = d.debugLayers || {};
if (!Object.keys(DL).length) warn('debugLayers is empty — most extra layers will be missing.');

// ---------------------------------------------------------------------
// 1b. CLIMATE PRE-FLIGHT GATE
//     state.climateComputed (js/state.js:30) is the app's own authoritative
//     flag; it is set true at js/generate.js:664 on climateDone and at :506
//     on editDone. Checking it here — rather than silently emitting 24 blank
//     columns and mentioning it at the very end — is the difference between
//     a 30-second fix and a wasted 10-minute run.
// ---------------------------------------------------------------------
const climateReady = !!(M.state.climateComputed &&
                        d.r_temperature_summer && d.r_precip_summer && d.r_wind_east_summer);
if (!climateReady) {
  const msg =
    'CLIMATE IS NOT COMPUTED.\n\n' +
    'This planet has ' + N.toLocaleString() + ' regions, above the 300,000 auto-climate ' +
    'threshold (AUTO_CLIMATE_THRESHOLD, js/main.js:83), so the app skipped climate at ' +
    'generation time and js/generate.js:467-480 nulled the climate debug layers.\n\n' +
    'About 24 of ~90 columns will be MISSING: temperature, precipitation, wind, ocean ' +
    'currents, Koppen, pressure, rain shadow, continentality.\n\n' +
    'Cancel, press "Compute Climate" in the UI, wait for it to finish, then re-run this ' +
    'script.\n\nPress OK only if you deliberately want a terrain-only export.';
  if (!confirm(msg)) throw new Error('aborted — run "Compute Climate" first, then re-run.');
  warn('proceeding WITHOUT climate at user request');
} else {
  log('climate is computed — full column set available');
}

// ---------------------------------------------------------------------
// 2. UNIT CONVERSIONS  (read from the live modules, never hard-coded)
// ---------------------------------------------------------------------
const elevToHeightKm = M.colorMap?.elevToHeightKm ?? null;
if (!elevToHeightKm) warn('elevToHeightKm unavailable — elev_km column will be blank.');

// Temperature: the app normalises to a FIXED -45..+45 C window and CLAMPS
// to [0,1] (js/temperature.js:789-790, 997), and koppen.js reads it back as
// T_C = -45 + t*90. The clamp means +-45 C are saturation artifacts, not
// measurements — see the tS_sat / tW_sat columns below.
const tempC = (t) => -45 + t * 90;

// Precipitation: mm per half-year = value * KOPPEN_PRECIP_SCALE_MM
// (js/koppen.js:110-111). Older builds have no climate-config.js.
const PRECIP_MM = M.climateCfg?.CLIMATE?.KOPPEN_PRECIP_SCALE_MM
               ?? M.climateCfg?.CLIMATE_DEFAULTS?.KOPPEN_PRECIP_SCALE_MM
               ?? 1000;
log('precip scale (mm per unit):', PRECIP_MM);

const KOPPEN_CLASSES = M.koppen?.KOPPEN_CLASSES ?? null;

const R_EARTH = 6371.0;   // km — the radius the codebase itself assumes
                          // (js/terrain-metrics.js:19-20, js/temperature.js:797)

// ---------------------------------------------------------------------
// 3. DERIVED PER-REGION DATA THE APP DOES NOT STORE
// ---------------------------------------------------------------------
const xyz  = d.r_xyz;                      // flat [x0,y0,z0, x1,y1,z1, ...]
const elev = d.r_elevation;

// -- true surface coastline -------------------------------------------
// NOTE: curData.coastline_r is a TECTONIC boundary class (js/elevation.js:
// 227-236 adds to it on plate-boundary conditions), NOT a land/ocean
// adjacency coastline. The real coastline is computed here from the mesh
// adjacency the app already precomputes (js/sphere-mesh.js:128-145).
let isSurfaceCoast = null;
let nCoast = 0;
if (mesh?.adjOffset && mesh?.adjList) {
  isSurfaceCoast = new Uint8Array(N);
  const off = mesh.adjOffset, adj = mesh.adjList;
  for (let r = 0; r < N; r++) {
    const land = elev[r] > 0;
    let edge = 0;
    for (let k = off[r]; k < off[r + 1]; k++) {
      if ((elev[adj[k]] > 0) !== land) { edge = 1; break; }
    }
    isSurfaceCoast[r] = edge;
    if (edge) nCoast++;
    if ((r & 262143) === 0) await yieldNow();   // ~15M inner iterations; keep the tab alive
  }
  log(`computed true surface coastline: ${nCoast.toLocaleString()} cells`);
} else {
  warn('mesh adjacency unavailable — isSurfaceCoast skipped.');
}

// -- per-region spherical cell area ------------------------------------
// Uses the incident-triangle ring (the Voronoi cell vertices) if present.
// Fully scalarised: the previous version allocated ~61M throwaway 3-element
// arrays here (two per triangle), ~2.9 GB of pure GC churn.
// generateTriangleCenters (js/sphere-mesh.js:206-218) returns the arithmetic
// CENTROID of three unit vertices, which is not itself unit length, and the
// Van Oosterom-Strackee formula assumes unit vectors — so we normalise. The
// error was negligible (~3e-6 relative at this resolution) but normalising
// costs three multiplies and removes the question entirely.
let cellArea = null;
let solidAngleTotal = null;
if (CFG.INCLUDE_CELL_AREA && mesh?._adjTriList && mesh?.adjOffset && d.t_xyz) {
  try {
    cellArea = new Float32Array(N);
    const off = mesh.adjOffset, tri = mesh._adjTriList, T = d.t_xyz;
    for (let r = 0; r < N; r++) {
      const a = off[r], b = off[r + 1];
      if (b <= a) { cellArea[r] = 0; continue; }
      const cx = xyz[3*r], cy = xyz[3*r+1], cz = xyz[3*r+2];
      let area = 0;
      let i0 = tri[a] * 3;
      let px = T[i0], py = T[i0+1], pz = T[i0+2];
      let pm = Math.hypot(px, py, pz) || 1; px /= pm; py /= pm; pz /= pm;
      for (let k = a; k < b; k++) {
        const nk = (k + 1 === b) ? a : k + 1;
        const i1 = tri[nk] * 3;
        let qx = T[i1], qy = T[i1+1], qz = T[i1+2];
        const qm = Math.hypot(qx, qy, qz) || 1; qx /= qm; qy /= qm; qz /= qm;
        // spherical excess of triangle (c,p,q) via Van Oosterom-Strackee
        const kx = py*qz - pz*qy, ky = pz*qx - px*qz, kz = px*qy - py*qx;
        const num = Math.abs(cx*kx + cy*ky + cz*kz);
        const dcp = cx*px + cy*py + cz*pz;
        const dcq = cx*qx + cy*qy + cz*qz;
        const dpq = px*qx + py*qy + pz*qz;
        area += 2 * Math.atan2(num, 1 + dcp + dcq + dpq);
        px = qx; py = qy; pz = qz;          // reuse; no re-read, no re-normalise
      }
      cellArea[r] = area * R_EARTH * R_EARTH;   // km^2
      if ((r & 65535) === 0) await yieldNow();
    }
    // Sanity check the whole field: the solid angles must sum to 4*pi.
    let solid = 0;
    for (let r = 0; r < N; r++) solid += cellArea[r] / (R_EARTH * R_EARTH);
    solidAngleTotal = solid;
    log(`cell-area check: total solid angle ${solid.toFixed(6)} sr (expect ${(4*Math.PI).toFixed(6)})`);
    if (Math.abs(solid - 4 * Math.PI) > 1e-3) {
      warn('cell areas do NOT sum to 4*pi — treat cellArea_km2 as suspect');
    }
    log('computed per-region cell areas (km^2, Earth radius 6371)');
  } catch (e) { warn('cell-area computation failed, skipping:', e.message); cellArea = null; }
}

// -- local east/north tangent basis ------------------------------------
// Reproduces js/wind.js:578-589 exactly (east_y is identically 0 there).
// This is what lets a consumer rebuild 3-D wind and current vectors from
// the stored E/N components. Memoised per region so the six getters that
// read it cost one evaluation per row and allocate nothing.
let _bR = -1, _beX = 0, _beZ = 0, _bnX = 0, _bnY = 0, _bnZ = 0;
function basisAt(r) {
  if (r === _bR) return;
  _bR = r;
  const x = xyz[3*r], y = xyz[3*r+1], z = xyz[3*r+2];
  let ex = z, ez = -x;
  let el = Math.sqrt(ex*ex + ez*ez);
  if (el < 1e-10) { ex = 1; ez = 0; el = 1; }   // pole fallback, as upstream
  ex /= el; ez /= el;
  // North = P x East, with east_y = 0
  let nx = y*ez, ny = z*ex - x*ez, nz = -y*ex;
  const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
  _beX = ex; _beZ = ez; _bnX = nx/nl; _bnY = ny/nl; _bnZ = nz/nl;
}

// -- synthetic pole vertex ---------------------------------------------
// js/sphere-mesh.js:178-184 appends one artificial vertex at exactly (0,0,1)
// to close the Fibonacci mesh and returns numRegions = N+1. Under the app's
// own Y-up convention (lat = asin(y), lon = atan2(x,z), js/wind.js:571-572)
// that vertex reports lat 0.000000 / lon 0.000000 — it looks like a perfectly
// ordinary equatorial cell sitting at the origin of the coordinate system,
// which is exactly where a consumer is least likely to suspect an artifact.
// Its Voronoi cell, valence, cell area and coastline flag are all meaningless.
const POLE_R = N - 1;
const isSyntheticPole = !!xyz &&
  Math.abs(xyz[3*POLE_R]) < 1e-6 && Math.abs(xyz[3*POLE_R+1]) < 1e-6 &&
  xyz[3*POLE_R+2] > 0.999;
if (isSyntheticPole) log(`synthetic pole vertex detected at region ${POLE_R} — will be flagged`);
else warn(`expected the synthetic pole vertex at region ${POLE_R} but its geometry is not (0,0,1) — not flagging`);

// ---------------------------------------------------------------------
// 4. OPT-IN RECOMPUTES  (all default OFF; see CFG for why)
// ---------------------------------------------------------------------

// 4a. computeWind re-run -> r_coastDistLand, r_westness, r_plateContinentality.
//     Verified read-only with respect to all six arguments: plateIsOcean is
//     only ever read via .has() (js/wind.js:771-795) and every output array is
//     freshly allocated. SimplexNoise is stateless after construction
//     (js/simplex-noise.js:6-15), so new SimplexNoise(seed) reproduces the
//     worker's instance (js/planet-worker.js:262) bit for bit.
let WR = null;
if (CFG.RERUN_WIND) {
  if (!(d.mesh && d.r_xyz && d.r_elevation && d.r_plate && d.plateIsOcean && d.seed != null)) {
    warn('RERUN_WIND requested but the required inputs are not all present — skipping');
  } else {
    try {
      const [windMod, sxMod] = await Promise.all([
        import('/js/wind.js').catch(() => null),
        import('/js/simplex-noise.js').catch(() => null)
      ]);
      if (windMod?.computeWind && sxMod?.SimplexNoise) {
        warn('re-running computeWind on the MAIN thread — the tab will freeze for ' +
             '30-60 s and allocate ~200 MB. This is expected.');
        await yieldNow(); await new Promise(res => setTimeout(res, 50));
        WR = windMod.computeWind(d.mesh, d.r_xyz, d.r_elevation,
                                 d.plateIsOcean, d.r_plate, new sxMod.SimplexNoise(d.seed));
        // MUST-PASS verification: prove the re-run reproduces this exact planet.
        let ok = true, checked = 0;
        if (DL.windSpeedSummer && WR.r_wind_speed_summer) {
          for (let r = 0; r < N; r += 997) { checked++;
            if (Math.abs(WR.r_wind_speed_summer[r] - DL.windSpeedSummer[r]) > 1e-4) { ok = false; break; } }
        }
        if (ok && DL.continentality && WR.r_continentality) {
          for (let r = 0; r < N; r += 997) { checked++;
            if (Math.abs(WR.r_continentality[r] - DL.continentality[r]) > 1e-4) { ok = false; break; } }
        }
        if (!checked) { warn('no live layer available to verify the computeWind re-run — discarding'); WR = null; }
        else if (!ok) { warn('computeWind re-run does NOT match live debugLayers — discarding'); WR = null; }
        else log('computeWind re-run verified against live windSpeedSummer + continentality');
      } else warn('wind.js / simplex-noise.js unavailable — RERUN_WIND skipped');
    } catch (e) { warn('computeWind re-run failed:', e && e.message); WR = null; }
  }
}

// 4b. computeTemperature re-run -> tempContinentality.
//     computeTemperature reads oceanResult ONLY for r_ocean_warmth_summer
//     (js/temperature.js:807) and r_ocean_warmth_/r_ocean_speed_<season>
//     (:822-823), and precipResult ONLY for r_precip_<season> (:824) — every
//     one of which is already sitting in curData. So shim objects suffice and
//     neither ocean nor precipitation needs recomputing. It does need a real
//     windResult (it destructures the tangent basis and the ITCZ splines),
//     which is why this rides on 4a.
let TR = null;
if (CFG.RERUN_TEMP) {
  if (!WR) warn('RERUN_TEMP requires a verified RERUN_WIND result — skipping');
  else if (!(d.r_ocean_warmth_summer && d.r_precip_summer)) warn('RERUN_TEMP needs ocean warmth + precip in state — skipping');
  else {
    try {
      const tmod = await import('/js/temperature.js').catch(() => null);
      if (tmod?.computeTemperature) {
        const oceanShim = {
          r_ocean_warmth_summer: d.r_ocean_warmth_summer,
          r_ocean_warmth_winter: d.r_ocean_warmth_winter,
          r_ocean_speed_summer:  d.r_ocean_speed_summer,
          r_ocean_speed_winter:  d.r_ocean_speed_winter
        };
        const precipShim = { r_precip_summer: d.r_precip_summer, r_precip_winter: d.r_precip_winter };
        await yieldNow(); await new Promise(res => setTimeout(res, 50));
        TR = tmod.computeTemperature(d.mesh, d.r_xyz, d.r_elevation,
                                     WR, oceanShim, precipShim, 0 /* temperatureOffset, patched below */);
        let ok = !!(TR && TR.r_temperature_summer && d.r_temperature_summer);
        if (ok) for (let r = 0; r < N; r += 997) {
          if (Math.abs(TR.r_temperature_summer[r] - d.r_temperature_summer[r]) > 1e-3) { ok = false; break; }
        }
        if (!ok) {
          warn('computeTemperature re-run does not reproduce live tS — most likely a non-zero ' +
               'temperatureOffset in the planet code; tempContinentality itself is offset-independent, ' +
               'but the reproduction could not be PROVEN, so it is discarded.');
          TR = null;
        } else log('recovered tempContinentality (verified against live r_temperature_summer)');
      }
    } catch (e) { warn('computeTemperature re-run failed:', e && e.message); TR = null; }
  }
}

// 4c. terrainMetrics.
//     CRITICAL: computeTerrainMetrics OPENS by writing back onto the object
//     you hand it — js/terrain-metrics.js:802-805 replaces ctx.plateIsOcean
//     with an Array when it is a Set. Passing state.curData directly would
//     leave curData.plateIsOcean as an Array, after which every
//     plateIsOcean.has(...) in the running app throws (js/wind.js:771, the
//     plate-colour and edit-mode paths, and this script's own columns).
//     So we build a FRESH context object and copy the Set, then assert that
//     the live state survived intact.
const tmStale = window.__terrainMetrics ?? d.terrainMetrics ?? null;
let tmFresh = null;
if (CFG.RECOMPUTE_TERRAIN_METRICS) {
  try {
    const tm = await import('/js/terrain-metrics.js').catch(() => null);
    if (tm?.computeTerrainMetrics) {
      const ctx = {
        mesh: d.mesh,
        r_xyz: d.r_xyz,
        r_elevation: d.r_elevation,
        r_plate: d.r_plate,
        plateIsOcean: d.plateIsOcean instanceof Set ? Array.from(d.plateIsOcean) : d.plateIsOcean,
        r_stress: d.r_stress,
        debugLayers: { ...DL },          // shallow copy, so nothing can be attached to the live object
        prePostElev: d.prePostElev
      };
      warn('recomputing terrainMetrics — several full sorts over 2.56M cells, expect 20-60 s of freeze');
      await yieldNow(); await new Promise(res => setTimeout(res, 50));
      tmFresh = tm.computeTerrainMetrics(ctx);
      log('terrainMetrics recomputed against the CURRENT elevation');
    } else warn('terrain-metrics.js unavailable — recompute skipped');
  } catch (e) { warn('terrainMetrics recompute failed:', e && e.message); tmFresh = { _error: String(e && e.message) }; }
  if (d.plateIsOcean && !(d.plateIsOcean instanceof Set)) {
    throw new Error('live curData.plateIsOcean was mutated into a non-Set — aborting to avoid ' +
                    'leaving the app broken. Reload the page.');
  }
}

// ---------------------------------------------------------------------
// 5. BUILD THE COLUMN SPEC  — every column is feature-detected.
//    {name, get(r), prec, meta}   prec=null means emit as integer/raw.
//    `meta` becomes the data dictionary in orogen_meta.json: a bare list of
//    column names cannot be round-tripped into anything usable.
// ---------------------------------------------------------------------
const cols = [];
const missing = [];
const add   = (name, get, prec = null, cmeta = {}) => cols.push({ name, get, prec, meta: cmeta });
const addIf = (cond, name, get, prec = null, cmeta = {}) =>
  cond ? add(name, get, prec, cmeta) : missing.push(name);

// identity + geometry
add('id',  r => r, null, { source: 'row index', dtype: 'int', units: 'region id', semantics: 'mesh region index 0..numRegions-1' });
add('lat', r => Math.asin(Math.max(-1, Math.min(1, xyz[3*r+1]))) * 180 / Math.PI, CFG.PREC.coord,
    { source: 'derived from curData.r_xyz', dtype: 'float', units: 'degrees', semantics: 'asin(y)*180/PI — Y-up convention, js/wind.js:571' });
add('lon', r => Math.atan2(xyz[3*r], xyz[3*r+2]) * 180 / Math.PI, CFG.PREC.coord,
    { source: 'derived from curData.r_xyz', dtype: 'float', units: 'degrees', semantics: 'atan2(x,z)*180/PI — Y-up convention, js/wind.js:572' });
add('x', r => xyz[3*r],   CFG.PREC.xyz, { source: 'curData.r_xyz', dtype: 'Float32', units: 'unit sphere' });
add('y', r => xyz[3*r+1], CFG.PREC.xyz, { source: 'curData.r_xyz', dtype: 'Float32', units: 'unit sphere' });
add('z', r => xyz[3*r+2], CFG.PREC.xyz, { source: 'curData.r_xyz', dtype: 'Float32', units: 'unit sphere' });

addIf(isSyntheticPole, 'isSyntheticPole', r => (r === POLE_R ? 1 : 0), null,
    { source: 'derived', dtype: 'uint8', units: 'flag',
      semantics: 'The artificial vertex appended by buildSphere (js/sphere-mesh.js:178-184) at ' +
                 '(0,0,1) to close the Fibonacci mesh. It reads as lat 0 / lon 0. Its Voronoi cell, ' +
                 'neighbour ring, cellArea_km2 and isSurfaceCoast are mesh artefacts, not terrain. ' +
                 'Filter this out before any spatial analysis.' });

// elevation family
add('elev', r => elev[r], CFG.PREC.elev,
    { source: 'curData.r_elevation', dtype: 'Float32', units: 'dimensionless elevation', semantics: 'final elevation; >0 is land' });
addIf(!!elevToHeightKm, 'elev_km', r => elevToHeightKm(elev[r]), CFG.PREC.km,
    { source: 'js/color-map.js elevToHeightKm(elev)', dtype: 'float', units: 'km',
      semantics: 'canonical generator curve: ocean elev*10; land 6*t^4*(5-4t) (js/color-map.js:7-12)' });
addIf(!!d.prePostElev, 'prePost', r => d.prePostElev[r], CFG.PREC.elev,
    { source: 'curData.prePostElev', dtype: 'Float32', units: 'elevation',
      semantics: 'elevation snapshot taken BEFORE the whole post-processing block (warp, smoothing, detail noise, erosion, soil creep)' });
addIf(!!d.prePostElev, 'postProcessDelta', r => elev[r] - d.prePostElev[r], CFG.PREC.elev,
    { source: 'derived', dtype: 'float', units: 'elevation delta',
      semantics: 'elev - prePost: the FULL post-processing delta INCLUDING terrain warp. Contrast ' +
                 'with the erosionDelta debug layer, whose baseline is snapshotted AFTER the warp ' +
                 '(js/planet-worker.js:78-88), so erosionDelta EXCLUDES warp.' });
addIf(!!cellArea, 'cellArea_km2', r => cellArea[r], 2,
    { source: 'derived from mesh._adjTriList + curData.t_xyz', dtype: 'float', units: 'km^2',
      semantics: 'spherical Voronoi cell area (Van Oosterom-Strackee over the incident-triangle ring), ' +
                 'scaled by R = 6371 km — the radius the codebase itself assumes (js/terrain-metrics.js:19). ' +
                 'Rescale if your planet is not Earth-sized.' });

// masks
add('isLand', r => elev[r] > 0 ? 1 : 0, null, { source: 'derived', dtype: 'uint8', units: 'flag', semantics: 'r_elevation > 0' });
addIf(!!d.mountain_r,  'isMountain',     r => d.mountain_r.has(r) ? 1 : 0, null,
    { source: 'curData.mountain_r (Set)', dtype: 'uint8', units: 'flag', semantics: 'tectonic mountain class (js/elevation.js:230-235)' });
addIf(!!d.coastline_r, 'isTectCoastal',  r => d.coastline_r.has(r) ? 1 : 0, null,
    { source: 'curData.coastline_r (Set)', dtype: 'uint8', units: 'flag',
      semantics: 'TECTONIC boundary class (js/elevation.js:227-236) — this is the old CSV `isCoastal`. ' +
                 'It is NOT a land/ocean coastline; use isSurfaceCoast for that.' });
addIf(!!isSurfaceCoast,'isSurfaceCoast', r => isSurfaceCoast[r], null,
    { source: 'derived from mesh.adjOffset/adjList', dtype: 'uint8', units: 'flag',
      semantics: 'TRUE coastline: this cell has at least one neighbour on the other side of sea level' });
addIf(!!d.ocean_r,     'isOceanRegion',  r => d.ocean_r.has(r) ? 1 : 0, null,
    { source: 'curData.ocean_r (Set)', dtype: 'uint8', units: 'flag', semantics: 'tectonic ocean-boundary class' });

// plates
addIf(!!d.r_plate, 'plate', r => d.r_plate[r], null,
    { source: 'curData.r_plate', dtype: 'Int32', units: 'plate id',
      semantics: 'COARSE-MESH SEED REGION ID, not a dense 0..P-1 index. Join against orogen_plates.csv.' });
addIf(!!d.r_plate && !!d.plateIsOcean, 'isOcPlate', r => d.plateIsOcean.has(d.r_plate[r]) ? 1 : 0, null,
    { source: 'curData.plateIsOcean (Set)', dtype: 'uint8', units: 'flag', semantics: 'current oceanic/continental flag of this cell\'s plate' });
addIf(!!d.r_plate && !!d.originalPlateIsOcean, 'origIsOcPlate', r => d.originalPlateIsOcean.has(d.r_plate[r]) ? 1 : 0, null,
    { source: 'curData.originalPlateIsOcean (Set)', dtype: 'uint8', units: 'flag', semantics: 'flag as first generated, before any user plate toggle' });
addIf(!!d.r_stress, 'stress', r => d.r_stress[r], CFG.PREC.norm,
    { source: 'curData.r_stress', dtype: 'Float32', units: 'dimensionless', semantics: 'plate-boundary stress magnitude' });

// tangent basis (Tier A: free, closed form, reproduces js/wind.js:578-589)
if (CFG.INCLUDE_TANGENT_BASIS) {
  const B = { source: 'derived (exactly js/wind.js:578-589)', dtype: 'float', units: 'unit vector component' };
  add('eastX',  r => { basisAt(r); return _beX; }, CFG.PREC.xyz, { ...B, semantics: 'local east unit vector, x' });
  add('eastY',  r => 0,                            CFG.PREC.xyz, { ...B, semantics: 'local east unit vector, y — identically 0 under the Y-up convention' });
  add('eastZ',  r => { basisAt(r); return _beZ; }, CFG.PREC.xyz, { ...B, semantics: 'local east unit vector, z' });
  add('northX', r => { basisAt(r); return _bnX; }, CFG.PREC.xyz, { ...B, semantics: 'local north unit vector, x' });
  add('northY', r => { basisAt(r); return _bnY; }, CFG.PREC.xyz, { ...B, semantics: 'local north unit vector, y' });
  add('northZ', r => { basisAt(r); return _bnZ; }, CFG.PREC.xyz, { ...B, semantics: 'local north unit vector, z' });
}

// ---- every debug layer, under its REAL key name ----------------------
// Includes layers never present in the original 56-column export, e.g.
// cratonWeight, basinWeight, mantleFlow, continentalDrag, sizeVelocity,
// velChange, skeleton, noiseAmp, foldBeltWeight, lip, uniformNoise,
// dynamicTopo.
// NOTE: the layer once called `foldRidge` was renamed `phasorRidge`
// upstream (js/elevation.js:2535); we emit whatever key actually exists.
//
// Three refinements over the naive Object.keys() loop:
//   (a) superPlates is pulled out and emitted as an INTEGER column named
//       `superPlate`, because it is a nominal group id widened to Float32
//       (js/elevation.js:2602-2604), not a continuous field;
//   (b) the four aliased climate layers are suppressed — postMessage's
//       structured clone preserves object identity, so debugLayers.tempSummer
//       IS curData.r_temperature_summer (js/planet-worker.js:369-371, 776-778).
//       Emitting both duplicates ~80 MB of CSV for zero information. The check
//       is by object IDENTITY, so if a future build stops aliasing them, both
//       columns come back automatically;
//   (c) anything rejected is RECORDED in `missing` instead of vanishing.
const DL_DOC = {
  base:            { u: 'elevation',       d: 'raw distance-field elevation before any per-domain modifier' },
  tectonic:        { u: 'elevation delta', d: 'delta added by the tectonic-uplift block' },
  noise:           { u: 'elevation delta', d: 'delta added by the noise block' },
  interior:        { u: 'elevation delta', d: 'continental-interior bias and plateau boost; LAND ONLY, 0 on ocean' },
  coastal:         { u: 'elevation delta', d: 'coastal-plain suppression + coastal detail + island-arc uplift; mixed sign' },
  ocean:           { u: 'elevation',       d: 'ocean-floor shelf/slope/abyss profile; OCEAN ONLY' },
  hotspot:         { u: 'elevation delta', d: 'hotspot / plume uplift field' },
  lip:             { u: 'elevation delta', d: 'large igneous province contribution' },
  margins:         { u: 'class code',      d: 'CATEGORICAL, ocean only: 0.2 passive margin, 0.8 active margin, 1.0 mid-ocean ridge, -0.5 fracture zone (js/elevation.js:1174-1177)' },
  backArc:         { u: 'elevation delta', d: 'back-arc basin contribution' },
  phasorRidge:     { u: 'elevation delta', d: 'directional fold-belt ridge. THIS IS THE OLD CSV `foldRidge`, renamed and reimplemented upstream.' },
  orogenicPower:   { u: '[-0.5, +0.5]',    d: 'shaped low-frequency noise STORED AS raw-0.5, so its range is centred on zero (js/elevation.js:929)' },
  tecActivity:     { u: '[0,1]',           d: 'max(normalised stress, cubed proximity to mountain seeds)' },
  uniformNoise:    { u: 'dimensionless',   d: 'uniform noise field used by the elevation assignment' },
  dynamicTopo:     { u: 'elevation delta', d: 'mantle dynamic-topography contribution' },
  basin:           { u: '[0,1]',           d: 'shield <-> basin personality field; LAND ONLY' },
  noiseAmp:        { u: 'dimensionless',   d: 'per-region noise amplitude used by terrain classification' },
  foldBeltWeight:  { u: '[0,1]',           d: 'fold-belt terrain-type weight' },
  cratonWeight:    { u: '[0,1]',           d: 'craton terrain-type weight' },
  basinWeight:     { u: '[0,1]',           d: 'basin terrain-type weight' },
  skeleton:        { u: 'elevation',       d: 'r_elevation snapshot immediately after buildSkeleton (js/elevation.js:2559) — pure tectonic form, pre-noise and pre-erosion' },
  erosionDelta:    { u: 'elevation delta', d: 'final minus the post-WARP snapshot (js/planet-worker.js:88,154-157). EXCLUDES terrain warp; use postProcessDelta for warp + everything.' },
  continentalDrag: { u: 'dimensionless',   d: 'plate-physics diagnostic, expanded from the coarse mesh' },
  sizeVelocity:    { u: 'dimensionless',   d: 'plate-physics diagnostic, expanded from the coarse mesh' },
  plateSpeed:      { u: 'dimensionless',   d: 'plate-physics diagnostic, expanded from the coarse mesh' },
  velChange:       { u: 'dimensionless',   d: 'plate-physics diagnostic, expanded from the coarse mesh' },
  mantleFlow:      { u: 'dimensionless',   d: 'plate-physics diagnostic, expanded from the coarse mesh' },
  pressureSummer:  { u: 'hPa deviation',   d: 'sea-level pressure DEVIATION from 1013 hPa (js/wind.js:850-853)' },
  pressureWinter:  { u: 'hPa deviation',   d: 'sea-level pressure DEVIATION from 1013 hPa (js/wind.js:850-853)' },
  windSpeedSummer: { u: '[0,1]',           d: 'p95-normalised AND CLAMPED (js/wind.js:842-846). Use windS_Speed_raw for the true magnitude.' },
  windSpeedWinter: { u: '[0,1]',           d: 'p95-normalised AND CLAMPED (js/wind.js:842-846). Use windW_Speed_raw for the true magnitude.' },
  continentality:  { u: '[0,1]',           d: 'smoothstep of BFS distance-from-ocean, elevation mask' },
  rainShadowSummer:{ u: 'dimensionless',   d: 'orographic rain-shadow factor, NH summer' },
  rainShadowWinter:{ u: 'dimensionless',   d: 'orographic rain-shadow factor, NH winter' },
  tempContinentality:{ u: '[0,1] or -1',   d: 'zone-based temperature continentality; -1 on OCEAN cells (js/temperature.js:146-150)' },
  koppen:          { u: 'class id',        d: 'CATEGORICAL index into KOPPEN_CLASSES; 0 = Ocean. See orogen_koppen_classes.csv.' }
};

const CLIMATE_ALIAS_PAIRS = [
  ['precipSummer', 'r_precip_summer',      'pS'],
  ['precipWinter', 'r_precip_winter',      'pW'],
  ['tempSummer',   'r_temperature_summer', 'tS'],
  ['tempWinter',   'r_temperature_winter', 'tW']
];
const aliased = {};
for (const [dlKey, cdKey, shortName] of CLIMATE_ALIAS_PAIRS) {
  if (DL[dlKey] && d[cdKey] && DL[dlKey] === d[cdKey]) aliased[dlKey] = shortName;
}

const dlRejected = [];
const dlKeys = Object.keys(DL).filter(k => {
  if (k === 'superPlates') return false;         // handled explicitly below
  if (k in aliased) return false;                // emitted once, under the short name
  const a = DL[k];
  if (a == null) { dlRejected.push(k + ' (null)'); return false; }
  if (typeof a.length !== 'number') { dlRejected.push(k + ' (not array-like)'); return false; }
  if (a.length !== N) { dlRejected.push(`${k} (len ${a.length} != ${N})`); return false; }
  return true;
}).sort();

for (const k of dlKeys) {
  const arr = DL[k];
  const isInt = ArrayBuffer.isView(arr) &&
                !(arr instanceof Float32Array) && !(arr instanceof Float64Array);
  add(k, r => arr[r], isInt ? null : CFG.PREC.norm, {
    source: 'curData.debugLayers.' + k,
    dtype: arr.constructor ? arr.constructor.name : 'array',
    units: DL_DOC[k]?.u ?? 'dimensionless',
    semantics: DL_DOC[k]?.d ?? 'generator debug layer (see js/elevation.js / js/planet-worker.js)'
  });
}
log(`debug layers captured (${dlKeys.length}):`, dlKeys.join(', ') || '(none)');
if (Object.keys(aliased).length) {
  log('skipped duplicate debug layers (identical array OBJECT to a climate column):',
      Object.entries(aliased).map(([k, v]) => `${k} -> ${v}`).join(', '));
}
if (dlRejected.length) {
  warn('debug layers rejected:', dlRejected.join(', '));
  missing.push(...dlRejected);
  // nulls here are EXPECTED and benign when climate was skipped: js/generate.js:
  // 467-480 writes koppen/tempSummer/tempWinter/precipSummer/precipWinter = null.
}

// superPlates, explicitly: an Int32 group id widened to Float32
// (js/elevation.js:2602-2604), and only built when the plate count P >= 8
// (js/planet-worker.js:273-277). Emitting it through the generic loop made it
// look continuous, and made its absence indistinguishable from a dropped column.
let superPlateCount = 0;
if (DL.superPlates && DL.superPlates.length === N) {
  const SP = DL.superPlates;
  add('superPlate', r => SP[r] | 0, null, {
    source: 'curData.debugLayers.superPlates',
    dtype: 'Int32 (stored as Float32Array)',
    units: 'group id',
    semantics: 'CATEGORICAL super-plate group id 0..numSuperPlates-1; nominal, not ordered. ' +
               'Renumbered from scratch by any plate-edit rebuild (js/planet-worker.js:598-601).'
  });
  for (let r = 0; r < N; r += 97) if (SP[r] > superPlateCount) superPlateCount = SP[r];
  superPlateCount = (superPlateCount | 0) + 1;
} else {
  missing.push('superPlates (absent — buildSuperPlates runs only when the plate count P >= 8, js/planet-worker.js:273-277)');
}

// Which debug layers a fully-populated build would carry, so the user can see
// what this session is MISSING rather than only what it has.
const EXPECTED_DL = ['base','tectonic','noise','interior','coastal','ocean','hotspot','lip',
  'tecActivity','margins','backArc','phasorRidge','orogenicPower','uniformNoise','dynamicTopo',
  'basin','noiseAmp','foldBeltWeight','cratonWeight','basinWeight','skeleton','superPlates',
  'erosionDelta','continentalDrag','sizeVelocity','plateSpeed','velChange','mantleFlow',
  'pressureSummer','pressureWinter','windSpeedSummer','windSpeedWinter','continentality',
  'precipSummer','precipWinter','rainShadowSummer','rainShadowWinter',
  'tempSummer','tempWinter','tempContinentality','koppen'];
const dlAbsent = EXPECTED_DL.filter(k => !(k in DL) || DL[k] == null);
if (dlAbsent.length) warn('debug layers absent on this build/session:', dlAbsent.join(', '));

// Plate-physics layers are attached only in handleGenerate (js/planet-worker.js:
// 328-332) and are NOT re-attached by handleEditRecompute, whose editDone
// handler replaces curData.debugLayers wholesale. Their joint absence alongside
// a present `base` layer is a reliable signature of a post-plate-edit export.
const PHYS_DL = ['continentalDrag','sizeVelocity','plateSpeed','velChange','mantleFlow'];
const plateEditDetected = !!DL.base && PHYS_DL.every(k => !DL[k]);
if (plateEditDetected) {
  warn('plate-physics debug layers are gone — this planet was rebuilt via a plate edit. ' +
       PHYS_DL.join(', ') + ' are NOT recoverable without regenerating from the planet code, ' +
       'and superPlate ids have been renumbered.');
}

// koppen label alongside the numeric class
if (DL.koppen && KOPPEN_CLASSES) {
  add('koppen_code', r => KOPPEN_CLASSES[DL.koppen[r]]?.code ?? '', null,
      { source: 'js/koppen.js KOPPEN_CLASSES[debugLayers.koppen[r]].code', dtype: 'string',
        units: 'Koppen code', semantics: 'e.g. Af, BWh, Cfb; "Ocean" for class 0. Full table in orogen_koppen_classes.csv.' });
} else if (DL.koppen && !KOPPEN_CLASSES) {
  missing.push('koppen_code (koppen.js unavailable)');
}

// ---- climate: normalised values + physical conversions ---------------
addIf(!!d.r_temperature_summer, 'tS', r => d.r_temperature_summer[r], CFG.PREC.norm,
    { source: 'curData.r_temperature_summer', dtype: 'Float32', units: '[0,1]',
      semantics: 'normalised NH-summer temperature; CLAMPED to [0,1] at js/temperature.js:997' });
addIf(!!d.r_temperature_winter, 'tW', r => d.r_temperature_winter[r], CFG.PREC.norm,
    { source: 'curData.r_temperature_winter', dtype: 'Float32', units: '[0,1]',
      semantics: 'normalised NH-winter temperature; CLAMPED to [0,1] at js/temperature.js:997' });
addIf(!!d.r_temperature_summer, 'tempC_S', r => tempC(d.r_temperature_summer[r]), CFG.PREC.phys,
    { source: 'derived', dtype: 'float', units: 'degrees C',
      semantics: '-45 + t*90. Because t is clamped, +-45 C are SATURATED, not measured — see tS_sat.' });
addIf(!!d.r_temperature_winter, 'tempC_W', r => tempC(d.r_temperature_winter[r]), CFG.PREC.phys,
    { source: 'derived', dtype: 'float', units: 'degrees C',
      semantics: '-45 + t*90. Because t is clamped, +-45 C are SATURATED, not measured — see tW_sat.' });
// Temperature IS censored: js/temperature.js:997 hard-clamps to [0,1] with
// T_MIN=-45, T_MAX=+45 (:789-790). On a planet with ice caps a large contiguous
// polar area reports exactly -45.000 C, and that is a floor artifact, not a
// temperature. Precipitation had a censoring flag; temperature deserves one too.
addIf(!!d.r_temperature_summer, 'tS_sat', r => { const t = d.r_temperature_summer[r]; return t <= 0 ? -1 : (t >= 1 ? 1 : 0); }, null,
    { source: 'derived', dtype: 'int8', units: 'flag', semantics: '-1 = floored at -45 C, +1 = ceilinged at +45 C, 0 = in range' });
addIf(!!d.r_temperature_winter, 'tW_sat', r => { const t = d.r_temperature_winter[r]; return t <= 0 ? -1 : (t >= 1 ? 1 : 0); }, null,
    { source: 'derived', dtype: 'int8', units: 'flag', semantics: '-1 = floored at -45 C, +1 = ceilinged at +45 C, 0 = in range' });

// ---- precipitation ---------------------------------------------------
// The previous version tested `value >= 0.999` for censoring. That is wrong in
// BOTH directions on this build, because the p95 clamp is not the last step:
//
//   A. js/precipitation.js:721-724   blended = min(1, blended / p95)      <- the censoring
//   B. js/precipitation.js:731-739   continental interior cap, down to
//                                    1 - PRECIP_CONT_CAP_MAX_REDUCTION (0.884)
//   C. js/precipitation.js:745-763   ps = max(0, m + (ps-m)*c) with
//                                    m = (ps+pw)/2 and c = PRECIP_SEASON_CONTRAST
//                                    = 1.7754 (js/climate-config.js:115)
//
// Step C means FINAL VALUES ROUTINELY EXCEED 1.0: summer 0.90 / winter 0.10
// gives m = 0.50 and ps' = 0.50 + 0.40*1.7754 = 1.21, which the old test flagged
// as "censored" although it never touched the ceiling. Step B means a genuinely
// clamped cell can be capped down to 0.116 and never flagged at all.
//
// Step C is exactly invertible, because the seasonal mean is its own fixed
// point: ps' + pw' = 2m, so m survives the transform untouched. We recover the
// pre-contrast ("p95 units") value and test THAT. The one place invertibility
// breaks is the max(0, ...) floor — if either season was driven to exactly 0 the
// mean is no longer preserved, so those cells are marked precip_invertible = 0
// and their censor flags are left empty rather than guessed.
let PRECIP_C = M.climateCfg?.CLIMATE?.PRECIP_SEASON_CONTRAST
            ?? M.climateCfg?.CLIMATE_DEFAULTS?.PRECIP_SEASON_CONTRAST
            ?? null;
let PRECIP_C_KNOWN = true;
let precipMaxSeen = null;
if (d.r_precip_summer && d.r_precip_winter) {
  let mx = 0;
  for (let r = 0; r < N; r++) {
    const a = d.r_precip_summer[r], b = d.r_precip_winter[r];
    if (a > mx) mx = a;
    if (b > mx) mx = b;
  }
  precipMaxSeen = mx;
  if (PRECIP_C == null) {
    // climate-config.js unreadable (older build). A max above 1 proves step C
    // ran, but not by how much, so say so instead of inventing a constant.
    if (mx > 1 + 1e-5) {
      warn('precipitation exceeds 1.0 (max ' + mx.toFixed(4) + ') so the seasonal-contrast step ' +
           'ran, but PRECIP_SEASON_CONTRAST is unreadable — pS/pW cannot be inverted and the ' +
           'censor flags are reported as not-invertible.');
      PRECIP_C = 1; PRECIP_C_KNOWN = false;
    } else { PRECIP_C = 1; }
  }
  log('precip seasonal contrast:', PRECIP_C_KNOWN ? PRECIP_C : 'UNKNOWN',
      '| max precip value seen:', mx.toFixed(4));
}
const _invC = 1 / (PRECIP_C || 1);
const preS = r => { const a = d.r_precip_summer[r], b = d.r_precip_winter[r]; const m = (a + b) / 2; return m + (a - m) * _invC; };
const preW = r => { const a = d.r_precip_summer[r], b = d.r_precip_winter[r]; const m = (a + b) / 2; return m + (b - m) * _invC; };
const precipInvertible = r => (PRECIP_C_KNOWN && d.r_precip_summer[r] !== 0 && d.r_precip_winter[r] !== 0) ? 1 : 0;
const havePrecip = !!(d.r_precip_summer && d.r_precip_winter);

addIf(havePrecip, 'pS', r => d.r_precip_summer[r], CFG.PREC.norm,
    { source: 'curData.r_precip_summer', dtype: 'Float32', units: 'p95 units, post-contrast',
      semantics: 'p95-clamped, then interior-capped, then contrast-stretched. CAN EXCEED 1.0.' });
addIf(havePrecip, 'pW', r => d.r_precip_winter[r], CFG.PREC.norm,
    { source: 'curData.r_precip_winter', dtype: 'Float32', units: 'p95 units, post-contrast',
      semantics: 'p95-clamped, then interior-capped, then contrast-stretched. CAN EXCEED 1.0.' });
addIf(havePrecip, 'precipMM_S', r => d.r_precip_summer[r] * PRECIP_MM, CFG.PREC.phys,
    { source: 'derived', dtype: 'float', units: 'mm per half-year',
      semantics: 'pS * KOPPEN_PRECIP_SCALE_MM. This is EXACTLY what the Koppen classifier saw ' +
                 '(js/koppen.js:110-111 multiplies the same post-contrast value).' });
addIf(havePrecip, 'precipMM_W', r => d.r_precip_winter[r] * PRECIP_MM, CFG.PREC.phys,
    { source: 'derived', dtype: 'float', units: 'mm per half-year',
      semantics: 'pW * KOPPEN_PRECIP_SCALE_MM — exactly what the Koppen classifier saw.' });
addIf(havePrecip, 'pS_p95units', r => preS(r), CFG.PREC.norm,
    { source: 'derived (inverse of js/precipitation.js:745-763)', dtype: 'float', units: 'p95 units, pre-contrast',
      semantics: 'summer precip with the seasonal-contrast stretch removed; this is the scientifically comparable field' });
addIf(havePrecip, 'pW_p95units', r => preW(r), CFG.PREC.norm,
    { source: 'derived (inverse of js/precipitation.js:745-763)', dtype: 'float', units: 'p95 units, pre-contrast',
      semantics: 'winter precip with the seasonal-contrast stretch removed' });
addIf(havePrecip, 'pS_censored', r => precipInvertible(r) ? (preS(r) >= 1 - 1e-5 ? 1 : 0) : '', null,
    { source: 'derived', dtype: 'uint8 or empty', units: 'flag',
      semantics: 'pre-contrast summer value sits at the p95 ceiling. SOUND but not COMPLETE: the ' +
                 'continental interior cap (js/precipitation.js:731-739) can pull a clamped cell ' +
                 'below the ceiling and hide it. Empty where precip_invertible = 0.' });
addIf(havePrecip, 'pW_censored', r => precipInvertible(r) ? (preW(r) >= 1 - 1e-5 ? 1 : 0) : '', null,
    { source: 'derived', dtype: 'uint8 or empty', units: 'flag',
      semantics: 'as pS_censored, for winter' });
addIf(havePrecip, 'precip_invertible', r => precipInvertible(r), null,
    { source: 'derived', dtype: 'uint8', units: 'flag',
      semantics: '0 when the max(0,..) floor in js/precipitation.js:759-761 destroyed mean-preservation ' +
                 'for this cell (either season exactly 0), or when PRECIP_SEASON_CONTRAST was unreadable' });

// ---- wind & ocean currents: RAW, UNCENSORED --------------------------
// The E/N components are stored PRE-normalisation, and the app's displayed
// speed is min(1, hypot(E,N)/p95) (js/wind.js:842-846; js/ocean.js:365-377).
// So hypot(E,N) is the exact uncensored magnitude — this recovers information
// the original CSV export permanently lost. Emitted at sig-9 so the recovery
// is not thrown away by fixed-decimal formatting (see CFG.PREC.raw).
const vec = (E, Nn, name, prec, what) => {
  if (!E || !Nn) { missing.push(name + 'E/' + name + 'N/' + name + 'Speed_raw'); return; }
  add(name + 'E', r => E[r], prec,
      { source: 'curData', dtype: 'Float32', units: 'raw model units', semantics: what + ', eastward component (pre-normalisation)' });
  add(name + 'N', r => Nn[r], prec,
      { source: 'curData', dtype: 'Float32', units: 'raw model units', semantics: what + ', northward component (pre-normalisation)' });
  add(name + 'Speed_raw', r => Math.hypot(E[r], Nn[r]), CFG.PREC.raw,
      { source: 'derived', dtype: 'float', units: 'raw model units',
        semantics: what + ', TRUE uncensored magnitude hypot(E,N). The app only ever displays min(1, hypot/p95).' });
};
vec(d.r_wind_east_summer, d.r_wind_north_summer, 'windS_', CFG.PREC.raw, 'NH-summer wind');
vec(d.r_wind_east_winter, d.r_wind_north_winter, 'windW_', CFG.PREC.raw, 'NH-winter wind');
vec(d.r_ocean_current_east_summer, d.r_ocean_current_north_summer, 'ocS_', CFG.PREC.raw, 'NH-summer ocean current');
vec(d.r_ocean_current_east_winter, d.r_ocean_current_north_winter, 'ocW_', CFG.PREC.raw, 'NH-winter ocean current');

// normalised speeds as the app shows them (kept for comparability)
addIf(!!d.r_ocean_speed_summer, 'ocSpeedS_norm', r => d.r_ocean_speed_summer[r], CFG.PREC.norm,
    { source: 'curData.r_ocean_speed_summer', dtype: 'Float32', units: '[0,1]',
      semantics: 'min(1, hypot/p95) as displayed (js/ocean.js:373-376). Multiply by meta.p95.oceanSummer to recover raw units.' });
addIf(!!d.r_ocean_speed_winter, 'ocSpeedW_norm', r => d.r_ocean_speed_winter[r], CFG.PREC.norm,
    { source: 'curData.r_ocean_speed_winter', dtype: 'Float32', units: '[0,1]',
      semantics: 'min(1, hypot/p95) as displayed. Multiply by meta.p95.oceanWinter to recover raw units.' });
addIf(!!d.r_ocean_warmth_summer, 'owS', r => d.r_ocean_warmth_summer[r], CFG.PREC.norm,
    { source: 'curData.r_ocean_warmth_summer', dtype: 'Float32', units: '[0,1]', semantics: 'advected ocean warmth, NH summer' });
addIf(!!d.r_ocean_warmth_winter, 'owW', r => d.r_ocean_warmth_winter[r], CFG.PREC.norm,
    { source: 'curData.r_ocean_warmth_winter', dtype: 'Float32', units: '[0,1]', semantics: 'advected ocean warmth, NH winter' });

// ---- fields that exist NOWHERE in stored state (opt-in re-runs) ------
addIf(!!WR, 'coastDistLand', r => WR.r_coastDistLand[r], null,
    { source: 'computeWind re-run (js/wind.js:884)', dtype: 'Int32/Float32', units: 'BFS hops',
      semantics: 'distance from land to the nearest ocean, in mesh hops. buildClimateFields ' +
                 '(js/planet-worker.js:171-193) never forwards this, so it exists nowhere in state.' });
addIf(!!WR, 'westness', r => WR.r_westness[r], CFG.PREC.norm,
    { source: 'computeWind re-run (js/wind.js:885)', dtype: 'Float32', units: '[0,1]',
      semantics: 'west-coast vs east-coast field. This is what decides Mediterranean vs ' +
                 'humid-subtropical in Koppen (js/precipitation.js:764 passes it through for exactly that).' });
addIf(!!WR, 'plateContinentality', r => WR.r_plateContinentality[r], CFG.PREC.norm,
    { source: 'computeWind re-run (js/wind.js:886)', dtype: 'Float32', units: '[0,1]',
      semantics: 'continentality measured on the TECTONIC PLATE mask rather than the elevation mask — ' +
                 'distinct from the `continentality` debug layer.' });
addIf(!!TR, 'tempContinentality', r => TR.r_tempContinentality[r], CFG.PREC.norm,
    { source: 'computeTemperature re-run (js/temperature.js:1009)', dtype: 'Float32', units: '[0,1] or -1',
      semantics: 'zone-based temperature continentality; -1 on ocean. The on-demand climate path omits ' +
                 'it from climateDebugLayers (js/planet-worker.js:767-780) although handleGenerate includes it (:372).' });
if (!WR && CFG.RERUN_WIND) missing.push('coastDistLand/westness/plateContinentality (re-run attempted and discarded)');
if (!WR && !CFG.RERUN_WIND) missing.push('coastDistLand/westness/plateContinentality (CFG.RERUN_WIND is off)');
if (!TR && !DL.tempContinentality) missing.push('tempContinentality (omitted by the on-demand climate path; set CFG.RERUN_WIND + CFG.RERUN_TEMP to recover)');

log(`columns: ${cols.length}`);
if (missing.length) warn(`absent (skipped): ${missing.join(', ')}`);

// ---------------------------------------------------------------------
// 6. FORMATTING
//    The old fmt did String(+v.toFixed(p)) — toFixed allocates a string, the
//    unary plus parses it back to a double, and String() allocates a second
//    string. At 2.56M rows x ~90 columns that is ~460M short-lived string
//    allocations and minutes of pure CPU. Math.round(v*10^p)/10^p produces the
//    identical shortest-round-trip decimal for every value in this dataset and
//    allocates once. (Exact .5 ties round differently — Math.round is
//    half-up-toward-+Inf, toFixed is half-away-from-zero — which cannot matter
//    for float model output.)
// ---------------------------------------------------------------------
const NC   = cols.length;
const GET  = cols.map(c => c.get);
const PRC  = cols.map(c => c.prec);
const MUL  = cols.map(c => (typeof c.prec === 'number') ? Math.pow(10, c.prec) : 0);
const SIG  = cols.map(c => (c.prec === 'sig9' ? 9 : c.prec === 'sig7' ? 7 : 0));

function fmtSig(v, s) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  return (a >= 1e-4 && a < 1e7) ? String(+v.toPrecision(s)) : v.toExponential(s - 1);
}
function cell(c, r) {
  const v = GET[c](r);
  if (typeof v === 'string') return v;
  if (v == null || !Number.isFinite(v)) return '';
  const s = SIG[c];
  if (s) return fmtSig(v, s);
  const m = MUL[c];
  if (m === 0) return String(v);
  const x = v * m;
  return Math.abs(x) < 9e15 ? String(Math.round(x) / m) : String(+v.toFixed(PRC[c]));
}
// standalone formatter for the sidecars, so they keep the same null discipline
function fmt(v, p) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  if (p === null || p === undefined) return String(v);
  if (p === 'sig9') return fmtSig(v, 9);
  if (p === 'sig7') return fmtSig(v, 7);
  const m = Math.pow(10, p), x = v * m;
  return Math.abs(x) < 9e15 ? String(Math.round(x) / m) : String(+v.toFixed(p));
}

// ---------------------------------------------------------------------
// 7. OUTPUT LAYER
//    Preferred: File System Access API -> a real streaming pipe to a file.
//    Fallback : bounded Blob accumulation -> one Blob -> gzip -> download.
//
//    Neither path ever builds a whole-part string. The old code held three
//    simultaneous ~156 MB copies of every part (the lines[] array, the joined
//    string, and the Blob copy) on top of an already ~1.3 GB heap, and none of
//    it could be collected until after the write, because V8 pins every local
//    that is live across an await in the async function's register array.
// ---------------------------------------------------------------------
const gzipOK   = CFG.GZIP && typeof CompressionStream === 'function';
const streamOK = typeof TextEncoderStream === 'function' && typeof TransformStream === 'function';
const ext = (base) => base + (gzipOK ? '.gz' : '');
if (CFG.GZIP && !gzipOK) warn('CompressionStream unavailable — writing uncompressed (much larger)');
if (dirHandle && !streamOK) log('TextEncoderStream unavailable — using the buffered writer');

// download pacing / accounting for the fallback path
let _dlCount = 0;
const _liveUrls = [];
async function download(name, blob) {
  if (_dlCount === 1) {
    warn('Chrome is about to ask for the "Download multiple files" permission. You MUST click ' +
         'Allow — otherwise every remaining file is SILENTLY discarded and this script cannot ' +
         'tell (an anchor click gives no completion signal). Keep this tab in the foreground.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  _dlCount++;
  // Bounded LRU revoke: the old 60 s timer kept up to 13 blobs alive at once
  // (~325 MB gzipped, ~1.5 GB with GZIP off) for no reason.
  _liveUrls.push(url);
  while (_liveUrls.length > 2) URL.revokeObjectURL(_liveUrls.shift());
  // Pace with a delay that survives tab throttling; setTimeout does not.
  const t = performance.now();
  while (performance.now() - t < 1200) await yieldNow();
  if (document.visibilityState !== 'visible') {
    warn('tab is hidden — downloads and timers are throttled; bring this tab forward');
  }
}

// A sink is { write(str) -> Promise, close() -> Promise<{name, bytes}> }.
function makeSink(baseName, compress) {
  const useGz = compress && gzipOK;
  const name  = baseName + (useGz ? '.gz' : '');

  // ---- Path A: true streaming straight into the chosen folder ----
  if (dirHandle && streamOK) {
    const enc = new TextEncoderStream();
    let bytes = 0;
    const counter = new TransformStream({
      transform(chunk, ctl) { bytes += chunk.byteLength; ctl.enqueue(chunk); }
    });
    let src = enc.readable;
    if (useGz) src = src.pipeThrough(new CompressionStream('gzip'));
    src = src.pipeThrough(counter);
    const w = enc.writable.getWriter();
    let pipeErr = null;
    const done = (async () => {
      const fh = await dirHandle.getFileHandle(name, { create: true });
      const fs = await fh.createWritable();     // FileSystemWritableFileStream IS a WritableStream
      await src.pipeTo(fs);                     // streams, honours backpressure, closes fs
    })().catch(e => { pipeErr = e; });
    return {
      write: (s) => w.write(s),
      close: async () => {
        try { await w.close(); } catch (e) { if (!pipeErr) pipeErr = e; }
        await done;
        if (pipeErr) throw pipeErr;
        log('wrote', name, `(${(bytes / 1048576).toFixed(1)} MB)`);
        return { name, bytes };
      }
    };
  }

  // ---- Path B: bounded buffering -> Blob (off-heap) -> gzip -> write/download ----
  const blobs = [];
  let buf = '';
  const FLUSH = 4 * 1024 * 1024;   // ~4 MB of JS string live at any moment
  return {
    write: async (s) => {
      buf += s;
      if (buf.length >= FLUSH) { blobs.push(new Blob([buf])); buf = ''; }
    },
    close: async () => {
      if (buf) { blobs.push(new Blob([buf])); buf = ''; }
      let blob = new Blob(blobs, { type: useGz ? 'application/gzip' : 'text/csv' });
      blobs.length = 0;
      if (useGz) blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
      if (dirHandle) {
        const fh = await dirHandle.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        await download(name, blob);
      }
      const bytes = blob.size;
      log('wrote', name, `(${(bytes / 1048576).toFixed(1)} MB)`);
      return { name, bytes };
    }
  };
}

// Small files (manifest, plates, ITCZ, Koppen table). ALWAYS UNCOMPRESSED:
// the old writeFile gzipped everything whenever CompressionStream existed, so
// a file named orogen_meta.json actually contained gzip bytes and would not
// open. Names and contents now agree.
async function writeSmall(name, text) {
  const sink = makeSink(name, false);
  await sink.write(text);
  return sink.close();
}

async function writeBinary(name, arrayBuffer) {
  const useGz = gzipOK;
  const outName = name + (useGz ? '.gz' : '');
  let blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  if (useGz) blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  if (dirHandle) {
    const fh = await dirHandle.getFileHandle(outName, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  } else {
    await download(outName, blob);
  }
  log('wrote', outName, `(${(blob.size / 1048576).toFixed(1)} MB)`);
  return { name: outName, bytes: blob.size };
}

// ---------------------------------------------------------------------
// 8. PRE-FLIGHT MANIFEST
//    Written BEFORE the ten minutes of bulk work, so that even a total
//    failure leaves behind a file describing what the parts were meant to
//    contain. It is rewritten at the end with the results.
// ---------------------------------------------------------------------
const planetCode = (location.hash || '').replace(/^#/, '') ||
                   document.getElementById('seedCode')?.value || null;
let genParams = null;
try { genParams = planetCode && M.planetCode?.decodePlanetCode
                  ? M.planetCode.decodePlanetCode(planetCode) : null; } catch {}

const header = cols.map(c => c.name).join(',');
const nParts = Math.ceil(N / CFG.ROWS_PER_PART);

// Informational only — no whole-part string is built any more, so V8's
// 536,870,888-char String::kMaxLength is not reachable by this writer.
{
  const estBytesPerRow = NC * 9;
  const estPartChars = CFG.ROWS_PER_PART * estBytesPerRow;
  log(`estimated uncompressed part size: ${(estPartChars / 1048576).toFixed(0)} MB ` +
      `over ${nParts} parts (${NC} columns); the writer streams, so no ~${(536870888/1048576)|0} MB ` +
      `string limit applies`);
}

const meta = {
  planetCode,
  url: location.href,
  extractedAt: new Date().toISOString(),
  status: 'in-progress',
  numRegions: N,
  seed: d.seed ?? null,
  nMag: d.nMag ?? null,
  generationParams: genParams,
  climateComputed: climateReady,
  rowsPerPart: CFG.ROWS_PER_PART,
  gzip: gzipOK,
  columns: cols.map(c => c.name),
  fields: cols.map(c => ({
    name: c.name,
    dtype: c.meta?.dtype ?? 'float',
    units: c.meta?.units ?? null,
    source: c.meta?.source ?? 'derived by extractor',
    semantics: c.meta?.semantics ?? null,
    precision: (c.prec === null || c.prec === undefined) ? 'exact' : c.prec
  })),
  debugLayersCaptured: dlKeys,
  debugLayersAbsent: dlAbsent,
  debugLayersRejected: dlRejected,
  aliasedLayers: aliased,           // dl key -> the short column that stands in for it
  superPlateCount: superPlateCount || null,
  plateEditDetected,
  syntheticPoleRegion: isSyntheticPole ? POLE_R : null,
  fieldsMissing: missing,
  parts: [],
  failedParts: [],
  cellAreaSolidAngleSr: solidAngleTotal,
  precipSeasonContrast: PRECIP_C_KNOWN ? PRECIP_C : null,
  precipMaxValueSeen: precipMaxSeen,
  conversions: {
    lat: 'asin(y) * 180/PI   (Y-up, js/wind.js:571)',
    lon: 'atan2(x, z) * 180/PI   (Y-up, js/wind.js:572)',
    elev_km: 'js/color-map.js elevToHeightKm(elev)  [canonical generator curve]',
    temp_C: '-45 + t*90. js/temperature.js:997 CLAMPS t to [0,1] with T_MIN=-45/T_MAX=+45 ' +
            '(:789-790), so +-45 C are SATURATED, not measured — see tS_sat / tW_sat ' +
            '(-1 = floored, +1 = ceilinged, 0 = in range).',
    precip_mm: `p * ${PRECIP_MM} (KOPPEN_PRECIP_SCALE_MM). precipMM_S/W reproduce exactly what ` +
               `the Koppen classifier saw (js/koppen.js:110-111 uses the same post-contrast value).`,
    cellArea_km2: 'spherical Voronoi cell area x R^2 with R = 6371 km — the radius the codebase ' +
                  'itself assumes (js/terrain-metrics.js:19). Rescale for a non-Earth-sized planet.',
    wind3D: 'windS_3D = windS_E*[eastX,eastY,eastZ] + windS_N*[northX,northY,northZ]; ' +
            'same for windW_, ocS_, ocW_. The basis reproduces js/wind.js:578-589 exactly.',
    windSpeed_raw: 'hypot(E, N) — uncensored. The app displays min(1, hypot/p95) (js/wind.js:842-846).',
    oceanSpeed_raw: 'hypot(E, N) — uncensored. The app displays min(1, hypot/p95) (js/ocean.js:365-377).'
  },
  notes: [
    'isTectCoastal is the generator TECTONIC class (the old CSV `isCoastal`, js/elevation.js:227-236), ' +
    'not a coastline. isSurfaceCoast is the TRUE land/ocean adjacency coastline, computed here.',
    'Plate ids are COARSE-mesh seed region ids, not a dense 0..P-1 range.',
    'pS/pW are p95-clamped (js/precipitation.js:721-724), then interior-capped (:731-739), then ' +
    'contrast-stretched by PRECIP_SEASON_CONTRAST=' + (PRECIP_C_KNOWN ? PRECIP_C : 'unknown') +
    ' (:745-763) — so they CAN EXCEED 1.0. pS_p95units/pW_p95units are the exact pre-contrast ' +
    'values (the stretch preserves the seasonal mean, so it inverts exactly). pS_censored/pW_censored ' +
    'flag cells whose PRE-CONTRAST value hit the p95 ceiling: sound, but not complete, because the ' +
    'continental interior cap can pull a clamped cell back below the ceiling. Cells with ' +
    'precip_invertible = 0 are not recoverable (the max(0,..) floor at :759-761 broke mean-preservation).',
    'The layer once exported as `foldRidge` was renamed `phasorRidge` upstream and is emitted under ' +
    'that name. `superPlates` is emitted as the integer column `superPlate`.',
    'tempSummer/tempWinter/precipSummer/precipWinter in debugLayers are the SAME ARRAY OBJECTS as ' +
    'r_temperature_summer/winter and r_precip_summer/winter (js/planet-worker.js:369-371, 776-778); ' +
    'they are emitted once each, under the short names tS/tW/pS/pW. See aliasedLayers.',
    'tempContinentality is omitted by the on-demand climate path (js/planet-worker.js:767-780) and ' +
    'therefore only exists on planets small enough for climate at generation time ' +
    '(AUTO_CLIMATE_THRESHOLD = 300000, js/main.js:83). Set CFG.RERUN_WIND + CFG.RERUN_TEMP to recover it.',
    'coastDistLand, westness and plateContinentality are returned by computeWind (js/wind.js:884-886) ' +
    'but never forwarded by buildClimateFields (js/planet-worker.js:171-193), so they exist in NO ' +
    'stored field. Set CFG.RERUN_WIND to recover them.',
    isSyntheticPole
      ? `Region ${POLE_R} is the synthetic vertex appended by buildSphere (js/sphere-mesh.js:178-184) ` +
        'at (0,0,1) to close the Fibonacci mesh. Under lat=asin(y)/lon=atan2(x,z) it reports lat 0, ' +
        'lon 0. Its Voronoi cell, neighbour ring, cellArea_km2 and isSurfaceCoast are mesh artefacts, ' +
        'not terrain. Filter isSyntheticPole = 1 before any spatial analysis.'
      : 'The synthetic pole vertex could not be identified by geometry on this build; no flag column was emitted.',
    plateEditDetected
      ? 'plateEditDetected = true: the five plate-physics layers were destroyed by a plate-edit rebuild ' +
        '(editDone replaces curData.debugLayers wholesale) and superPlate ids were renumbered by ' +
        'buildSuperPlates. Regenerate the planet from its code and export BEFORE editing to capture them.'
      : 'No plate edit detected; the plate-physics debug layers are the originals.',
    'ITCZ curves are a 360-bin RESAMPLING at bin centres over [-pi, pi) (js/wind.js:863-875) of a ' +
    'spline fitted at only NUM_LON = 72 longitudes (js/wind.js:235) — 360 is not the native resolution.'
  ],
  terrainMetricsAtGeneration: tmStale,
  terrainMetricsFresh: tmFresh,
  terrainMetrics: (tmFresh && !tmFresh._error) ? tmFresh : tmStale,
  terrainMetricsNote:
    'window.__terrainMetrics is written ONLY on the initial `done` message (js/generate.js:243) and is ' +
    'never refreshed by reapplyDone or editDone, so terrainMetricsAtGeneration describes the planet AS ' +
    'FIRST GENERATED and can be stale after any Reapply or plate edit. terrainMetricsFresh is non-null ' +
    'only when CFG.RECOMPUTE_TERRAIN_METRICS was on; it is recomputed against the CURRENT r_elevation ' +
    'using a COPY of plateIsOcean, because computeTerrainMetrics writes back onto the context object it ' +
    'is given (js/terrain-metrics.js:802-805) and passing curData directly would corrupt the live app. ' +
    'Keys beginning with _ are dropped by computeTerrainMetrics itself and are not recoverable.'
};

// climate parameter block + exactly-solvable normalisation constants
{
  const CLIM = M.climateCfg?.CLIMATE ?? null;
  const CLIM_DEF = M.climateCfg?.CLIMATE_DEFAULTS ?? null;
  meta.climateParams = CLIM ? { ...CLIM } : null;
  meta.climateParamsModified = (CLIM && CLIM_DEF)
    ? Object.keys(CLIM).filter(k => CLIM[k] !== CLIM_DEF[k])
    : null;   // non-empty => climate was tuned away from defaults in this session
  meta.climateParamsNote =
    'js/climate-config.js:153 exports CLIMATE = {...CLIMATE_DEFAULTS} — a live, mutable object every ' +
    'climate module reads at call time. Without it the exported climate columns cannot be reproduced ' +
    'or fully interpreted (PRECIP_MODEL_BLEND, PRECIP_CONT_CAP_*, PRECIP_SEASON_CONTRAST, ' +
    'TEMP_SWING_SCALE, KOPPEN_SHOULDER_FRAC, the WIND_ITCZ_* family all shape these numbers).';

  // p95 = hypot(E,N) / normalisedSpeed, solvable exactly on any cell whose
  // normalised value is strictly inside (0,1). This constant is what makes the
  // raw and displayed columns mutually convertible.
  function solveP95(E, Nn, normArr) {
    if (!E || !Nn || !normArr) return null;
    const vals = [];
    for (let r = 0; r < N && vals.length < 4000; r += 641) {
      const n = normArr[r];
      if (n > 1e-3 && n < 0.999) vals.push(Math.hypot(E[r], Nn[r]) / n);
    }
    if (!vals.length) return null;
    vals.sort((a, b) => a - b);
    const med = vals[vals.length >> 1];
    return { p95: med, samples: vals.length, spread: (vals[vals.length - 1] - vals[0]) / (med || 1) };
  }
  meta.p95 = {
    windSummer:  solveP95(d.r_wind_east_summer, d.r_wind_north_summer, DL.windSpeedSummer),
    windWinter:  solveP95(d.r_wind_east_winter, d.r_wind_north_winter, DL.windSpeedWinter),
    oceanSummer: solveP95(d.r_ocean_current_east_summer, d.r_ocean_current_north_summer, d.r_ocean_speed_summer),
    oceanWinter: solveP95(d.r_ocean_current_east_winter, d.r_ocean_current_north_winter, d.r_ocean_speed_winter),
    precip: null,
    _note: 'p95 = hypot(E,N)/normalisedSpeed, solved on uncensored cells; `spread` should be ~1e-3 if ' +
           'the solve is sound. Multiply any *Speed_norm column by p95 to recover raw units. `precip` ' +
           'is null because the pre-normalisation precipitation array is overwritten IN PLACE ' +
           '(js/precipitation.js:721-724) and its p95 is not solvable from stored state.'
  };
}

try {
  await writeSmall('orogen_meta.json', JSON.stringify(meta, null, 1));
  log('pre-flight manifest written — a crash from here on still leaves a description behind');
} catch (e) { warn('could not write the pre-flight manifest:', e && e.message); }

// ---------------------------------------------------------------------
// 9. STREAM THE REGION TABLE IN PARTS
//    Each part is contained: one failure no longer discards the sidecars,
//    the manifest and every later part.
// ---------------------------------------------------------------------
const partInfo = [];
const failed = [];
const t0 = performance.now();
const row = new Array(NC);        // ONE array for the entire export. The old code
                                  // allocated a fresh Array(NC) per row: 2.56M
                                  // JSArray+FixedArray pairs, ~1.9 GB of churn for
                                  // a buffer that never escapes past join().
let lastYield = performance.now();

for (let part = (CFG.START_PART | 0); part < nParts; part++) {
  const lo = part * CFG.ROWS_PER_PART;
  const hi = Math.min(N, lo + CFG.ROWS_PER_PART);
  const baseName = `orogen_regions_part_${String(part).padStart(2, '0')}.csv`;
  try {
    const sink = makeSink(baseName, true);
    await sink.write(header + '\n');            // every part carries the header
    let buf = '';
    for (let r = lo; r < hi; r++) {
      for (let c = 0; c < NC; c++) row[c] = cell(c, r);
      buf += row.join(',') + '\n';
      if ((r & 1023) === 1023) {
        await sink.write(buf); buf = '';        // ~800 KB per flush; backpressure applies
        if (performance.now() - lastYield > 12) { await yieldNow(); lastYield = performance.now(); }
      }
    }
    if (buf) { await sink.write(buf); buf = ''; }
    const res = await sink.close();
    partInfo.push({ part, file: res.name, bytes: res.bytes, rows: hi - lo, firstId: lo, lastId: hi - 1 });
    log(`part ${part + 1}/${nParts} done (${((performance.now() - t0) / 1000).toFixed(1)}s elapsed)`);
  } catch (e) {
    warn(`part ${part} FAILED: ${e && e.name}: ${e && e.message} — continuing with the next part`);
    failed.push({ part, firstId: lo, lastId: hi - 1, error: `${e && e.name}: ${e && e.message}` });
    window.__orogenResumeFrom = part;
  }
}
if (failed.length) {
  warn(`RE-RUN with CFG.START_PART = ${failed[0].part} to recover the failed parts:`, failed);
}

// ---------------------------------------------------------------------
// 10. SIDECAR TABLES  (each independently contained)
// ---------------------------------------------------------------------
const sidecars = [];
const sidecarErrors = [];
async function sidecar(label, fn) {
  try { const r = await fn(); if (r) sidecars.push(r); }
  catch (e) { warn(`sidecar ${label} failed: ${e && e.message}`); sidecarErrors.push({ label, error: String(e && e.message) }); }
}

// per-plate table — plate ids are COARSE-mesh seed region ids, not 0..P-1.
// plateDensityLand / plateDensityOcean are the counterfactual densities
// (js/generate.js:209-211): plateDensity[pid] is only whichever of the two
// matches the plate's CURRENT ocean/land flag, and toggling a plate swaps it
// (js/main.js:883-892). They are per-plate constants available nowhere else
// once the tab closes.
await sidecar('plates', async () => {
  if (!d.plateSeeds) { missing.push('orogen_plates.csv (no plateSeeds)'); return null; }
  const rows = ['plate,pole_x,pole_y,pole_z,omega,isOcean,origIsOcean,density,densityLand,densityOcean'];
  for (const s of d.plateSeeds) {
    const pv = d.plateVec?.[s];
    const pole = pv?.pole ?? ['', '', ''];
    rows.push([s,
               fmt(pole[0], 9), fmt(pole[1], 9), fmt(pole[2], 9),
               fmt(pv?.omega, 9),
               d.plateIsOcean?.has(s) ? 1 : 0,
               d.originalPlateIsOcean?.has(s) ? 1 : 0,
               fmt(d.plateDensity?.[s], 6),
               fmt(d.plateDensityLand?.[s], 6),
               fmt(d.plateDensityOcean?.[s], 6)].join(','));
  }
  return writeSmall('orogen_plates.csv', rows.join('\n') + '\n');
});

// Koppen class table — makes the koppen / koppen_code columns self-contained
// (js/koppen.js:22 is a 31-entry array of {code, name, color[r,g,b]}, index 0 = Ocean).
await sidecar('koppen classes', async () => {
  if (!KOPPEN_CLASSES) { missing.push('orogen_koppen_classes.csv (koppen.js unavailable)'); return null; }
  const kr = ['class_id,code,name,color_r,color_g,color_b'];
  KOPPEN_CLASSES.forEach((k, i) =>
    kr.push([i, k.code ?? '', JSON.stringify(k.name ?? ''),
             fmt(k.color?.[0], 4), fmt(k.color?.[1], 4), fmt(k.color?.[2], 4)].join(',')));
  return writeSmall('orogen_koppen_classes.csv', kr.join('\n') + '\n');
});

// ITCZ curves — 360 bins, RADIANS in source, emitted as degrees too.
// Routed through fmt so an absent lat array yields an empty field rather than
// the literal text "NaN" (undefined * 180/PI === NaN, and join() prints it).
await sidecar('itcz', async () => {
  if (!d.itczLons) { missing.push('orogen_itcz.csv (no itczLons)'); return null; }
  const rows = ['bin,lon_rad,lon_deg,lat_summer_rad,lat_summer_deg,lat_winter_rad,lat_winter_deg'];
  const deg = v => (typeof v === 'number' && Number.isFinite(v)) ? v * 180 / Math.PI : null;
  for (let i = 0; i < d.itczLons.length; i++) {
    const lo = d.itczLons[i], ls = d.itczLatsSummer?.[i], lw = d.itczLatsWinter?.[i];
    rows.push([i, fmt(lo, 6), fmt(deg(lo), 6), fmt(ls, 6), fmt(deg(ls), 6), fmt(lw, 6), fmt(deg(lw), 6)].join(','));
  }
  return writeSmall('orogen_itcz.csv', rows.join('\n') + '\n');
});

// dual mesh — the complete polygonal geometry of the planet. Binary keeps it
// to ~16 bytes/triangle instead of a huge CSV. Without it, a consumer holding
// only the region table cannot rebuild cell polygons or run any topological
// analysis. Set CFG.INCLUDE_DUAL_MESH = false to skip (~200 MB raw).
await sidecar('dual mesh', async () => {
  if (!CFG.INCLUDE_DUAL_MESH) { missing.push('dual mesh sidecars (CFG.INCLUDE_DUAL_MESH is off)'); return null; }
  if (!(mesh?.triangles && d.t_xyz)) { missing.push('dual mesh sidecars (mesh.triangles / t_xyz unavailable)'); return null; }
  const T = (d.t_xyz.length / 3) | 0;
  const f = new Float32Array(4 * T);
  for (let t = 0; t < T; t++) {
    f[4*t]   = d.t_xyz[3*t];
    f[4*t+1] = d.t_xyz[3*t+1];
    f[4*t+2] = d.t_xyz[3*t+2];
    f[4*t+3] = d.t_elevation ? d.t_elevation[t] : NaN;
    if ((t & 262143) === 0) await yieldNow();
  }
  const a = await writeBinary('orogen_triangles_xyz_elev.f32', f.buffer);
  const triCopy = mesh.triangles.slice();
  const b = await writeBinary('orogen_mesh_triangles.' + (triCopy.constructor?.name ?? 'bin'), triCopy.buffer);
  let c = null;
  if (mesh.halfedges) {
    const heCopy = mesh.halfedges.slice();
    c = await writeBinary('orogen_mesh_halfedges.' + (heCopy.constructor?.name ?? 'bin'), heCopy.buffer);
  }
  meta.dualMesh = {
    numTriangles: T,
    numRegions: N,
    files: [a, b, c].filter(Boolean).map(x => x.name),
    trianglesDtype: mesh.triangles.constructor?.name ?? 'unknown',
    halfedgesDtype: mesh.halfedges?.constructor?.name ?? null,
    'orogen_triangles_xyz_elev.f32':
      'Float32 [x,y,z,elev] * numTriangles, little-endian. xyz is the UNNORMALISED arithmetic ' +
      'centroid of the three corner unit vectors (js/sphere-mesh.js:206-218) — normalise before ' +
      'using it as a direction. elev is curData.t_elevation, the mean of the three corner region ' +
      'elevations (NaN if t_elevation was unavailable).',
    'orogen_mesh_triangles': 'three region ids per triangle, row-major (the Delaunay index)',
    'orogen_mesh_halfedges': 'opposite-side index per side, -1 where unpaired'
  };
  return null;   // the individual writeBinary results are already recorded above
});

// optional region adjacency (large!)
await sidecar('adjacency', async () => {
  if (!CFG.INCLUDE_ADJACENCY) return null;
  if (!(mesh?.adjOffset && mesh?.adjList)) { missing.push('orogen_adjacency.csv (no mesh adjacency)'); return null; }
  const sink = makeSink('orogen_adjacency.csv', true);
  await sink.write('id,neighbours\n');
  let buf = '';
  for (let r = 0; r < N; r++) {
    const nb = [];
    for (let k = mesh.adjOffset[r]; k < mesh.adjOffset[r + 1]; k++) nb.push(mesh.adjList[k]);
    buf += `${r},"${nb.join(' ')}"\n`;
    if ((r & 1023) === 1023) {
      await sink.write(buf); buf = '';
      if (performance.now() - lastYield > 12) { await yieldNow(); lastYield = performance.now(); }
    }
  }
  if (buf) await sink.write(buf);
  return sink.close();
});

// ---------------------------------------------------------------------
// 11. FINAL MANIFEST  (overwrites the pre-flight copy, same filename)
// ---------------------------------------------------------------------
meta.parts = partInfo;
meta.failedParts = failed;
meta.sidecars = sidecars;
meta.sidecarErrors = sidecarErrors;
meta.fieldsMissing = missing;
meta.status = (failed.length || sidecarErrors.length) ? 'partial' : 'complete';
meta.elapsedSeconds = +((performance.now() - t0) / 1000).toFixed(1);
meta.resumeHint = failed.length ? `re-run with CFG.START_PART = ${failed[0].part}` : null;
try {
  await writeSmall('orogen_meta.json', JSON.stringify(meta, null, 1));
} catch (e) {
  warn('FINAL manifest write failed:', e && e.message, '— the pre-flight copy is still on disk.');
}

// ---------------------------------------------------------------------
// 12. SUMMARY — captured vs missing
// ---------------------------------------------------------------------
console.groupCollapsed(
  `%c[orogen] EXTRACTION ${meta.status.toUpperCase()}`,
  `color:${meta.status === 'complete' ? '#3bbf6a' : '#e8a33b'};font-weight:bold`);
log(`regions        : ${N.toLocaleString()}`);
log(`columns        : ${cols.length}`);
log(`region parts   : ${partInfo.length}/${nParts} written` +
    (CFG.START_PART ? ` (started at part ${CFG.START_PART})` : ''));
log(`sidecars       : ${sidecars.map(s => s.name).join(', ') || '(none)'}`);
log(`output         : ${dirHandle ? 'folder (File System Access)' : `${_dlCount} browser downloads`}`);
log(`climate        : ${climateReady ? 'captured' : 'MISSING — press "Compute Climate" and re-run'}`);
log(`debug layers   : ${dlKeys.length} captured` +
    (Object.keys(aliased).length ? `, ${Object.keys(aliased).length} de-duplicated` : '') +
    (dlAbsent.length ? `, ${dlAbsent.length} absent` : ''));
if (dlAbsent.length)      log(`  absent       : ${dlAbsent.join(', ')}`);
if (dlRejected.length)    log(`  rejected     : ${dlRejected.join(', ')}`);
log(`uncensored     : wind + ocean E/N and hypot(E,N) at 9 significant digits`);
log(`recomputes     : wind=${WR ? 'captured' : (CFG.RERUN_WIND ? 'attempted, discarded' : 'off')}` +
    `, temp=${TR ? 'captured' : (CFG.RERUN_TEMP ? 'attempted, discarded' : 'off')}` +
    `, terrainMetrics=${tmFresh && !tmFresh._error ? 'fresh' : (CFG.RECOMPUTE_TERRAIN_METRICS ? 'failed' : 'stale copy only')}`);
if (missing.length)       log(`missing        : ${missing.join(', ')}`);
if (failed.length)        warn(`FAILED PARTS   : ${failed.map(f => f.part).join(', ')} — re-run with CFG.START_PART = ${failed[0].part}`);
if (sidecarErrors.length) warn(`FAILED SIDECARS: ${sidecarErrors.map(s => s.label).join(', ')}`);
log(`elapsed        : ${meta.elapsedSeconds}s`);
console.groupEnd();

// release any download URLs still pinned by the LRU
for (const u of _liveUrls) { try { URL.revokeObjectURL(u); } catch {} }
_liveUrls.length = 0;

return meta;
})().catch(e => console.error('%c[orogen] FATAL', 'color:#e33;font-weight:bold', e));