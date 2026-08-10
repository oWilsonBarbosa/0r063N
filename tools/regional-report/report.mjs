// Markdown report templates (per-region report + index README).

import { BANDS, TERRAIN_CLASSES } from './classify.mjs';

const fmtInt = (x) => Math.round(x).toLocaleString('en-US');
const fmtKm2 = (x) => `${fmtInt(x)} km²`;
const fmtPct = (x, d = 1) => `${(100 * x).toFixed(d)} %`;
const fmtDeg = (lat, lon) =>
    `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

function dominantBand(r) {
    if (r.landFrac < 0.005) return '—';
    let best = -1, bestA = 0;
    for (let b = 0; b < BANDS.length; b++) {
        if (r.bandArea[b] > bestA) { bestA = r.bandArea[b]; best = b; }
    }
    return best >= 0 && bestA > 0 ? BANDS[best] : '—';
}

function dominantTerrain(r) {
    if (r.landFrac < 0.005) return '—';
    let best = -1, bestA = 0;
    for (let t = 0; t < TERRAIN_CLASSES.length; t++) {
        if (r.terrainArea[t] > bestA) { bestA = r.terrainArea[t]; best = t; }
    }
    return best >= 0 && bestA > 0 ? TERRAIN_CLASSES[best].name : '—';
}

export function regionEpithet(r) {
    if (r.landFrac < 0.005) return 'Open ocean';
    const band = dominantBand(r).toLowerCase();
    const h = r.hydrography.label.toLowerCase();
    return `${band.charAt(0).toUpperCase()}${band.slice(1)} ${h}`;
}

export function regionReport(r) {
    const nn = String(r.regionId + 1).padStart(2, '0');
    const L = [];
    L.push(`# Region ${nn} — ${regionEpithet(r)}`);
    L.push('');
    L.push(`Triangular face centered at ${fmtDeg(r.face.lat, r.face.lon)} · area ${fmtKm2(r.areaTotal)} (1/20 of the planet).`);
    L.push('');
    L.push(`![Region ${nn} terrain map](../maps/region_${nn}.png)`);
    L.push('');
    L.push(`*All percentages are area-weighted. Terrain colors are keyed in the [legend](../maps/legend.png).*`);
    L.push('');

    // At a glance
    L.push('## At a Glance');
    L.push('');
    L.push('| | |');
    L.push('|---|---|');
    L.push(`| Hydrography | **${r.hydrography.label}** |`);
    L.push(`| Land share | ${fmtPct(r.landFrac)} (${fmtKm2(r.areaLand)}) |`);
    L.push(`| Dominant climate band | ${dominantBand(r)} |`);
    L.push(`| Dominant terrain | ${dominantTerrain(r)} |`);
    L.push(`| Mountain systems | ${r.mountainSystems.length} |`);
    if (r.meanTsummerC !== null) {
        L.push(`| Mean land temperature | ${r.meanTsummerC.toFixed(1)} °C (Jun half-year) / ${r.meanTwinterC.toFixed(1)} °C (Dec half-year) |`);
        L.push(`| Mean annual precipitation | ${fmtInt(r.meanPannMm)} mm |`);
    }
    L.push('');

    // Hydrography
    L.push('## Hydrography');
    L.push('');
    L.push(`Classified as **${r.hydrography.label}** (Table 15 vocabulary), based on:`);
    L.push('');
    L.push(`- Land covers ${fmtPct(r.landFrac)} of the region.`);
    if (r.hydrography.largestKm2 > 0) {
        const largest = r.landComps[0];
        const part = largest.touchesOutside
            ? 'part of a larger landmass continuing into a neighboring region'
            : 'fully contained in this region';
        L.push(`- Largest land body: ${fmtKm2(largest.areaKm2)} (${part}).`);
    }
    L.push(`- ${r.islands.length} island(s) ≥ 600 km² fully inside the region; ${r.majorMasses.length} landmass(es) of continental scale or continuing beyond the region's edges.`);
    if (r.enclosedWaterArea > 0) {
        L.push(`- ${fmtKm2(r.enclosedWaterArea)} of enclosed (landlocked) water.`);
    }
    L.push('');

    // Landforms
    L.push('## Landforms');
    L.push('');
    if (r.mountainSystems.length === 0) {
        L.push('No mountain system of significant extent (≥ 5,000 km²) rises in this region.');
    } else {
        L.push('| System | Quadrant | Length × width | Trend | Peak | Mean elev. |');
        L.push('|---|---|---|---|---|---|');
        r.mountainSystems.slice(0, 8).forEach((m, i) => {
            L.push(`| ${i + 1} (${fmtKm2(m.areaKm2)}) | ${m.quadrant} | ${fmtInt(m.lengthKm)} × ${fmtInt(m.widthKm)} km | ${m.trend} | ${m.peakKm.toFixed(1)} km at ${fmtDeg(m.peakLat, m.peakLon)} | ${m.meanElevKm.toFixed(1)} km |`);
        });
        if (r.mountainSystems.length > 8) {
            L.push('');
            L.push(`…plus ${r.mountainSystems.length - 8} lesser system(s).`);
        }
    }
    L.push('');
    const reliefTotal = r.reliefArea.reduce((a, b) => a + b, 0);
    if (reliefTotal > 0) {
        L.push('Relief of the land area:');
        L.push('');
        L.push('| Lowlands (< 0.3 km) | Hills (0.3–0.8 km) | Highlands (0.8–2 km) | Mountains (> 2 km) |');
        L.push('|---|---|---|---|');
        L.push('| ' + [...r.reliefArea].map(a => fmtPct(a / reliefTotal)).join(' | ') + ' |');
        L.push('');
    }

    // Climate
    L.push('## Climate');
    L.push('');
    if (r.areaLand <= 0) {
        L.push('No land — open ocean under the regional wind belts described below.');
    } else {
        L.push('Climate-band composition of the land area (the book\'s five latitudinal bands, assigned from the simulated Köppen class of each cell):');
        L.push('');
        L.push('| ' + BANDS.join(' | ') + ' |');
        L.push('|' + BANDS.map(() => '---').join('|') + '|');
        L.push('| ' + [...r.bandArea].map(a => r.areaLand > 0 ? fmtPct(a / r.areaLand) : '0 %').join(' | ') + ' |');
        L.push('');
        L.push('Leading Köppen classes on land:');
        L.push('');
        L.push('| Class | Type | Share of land |');
        L.push('|---|---|---|');
        for (const k of r.koppenTop) {
            L.push(`| ${k.code} | ${k.name} | ${fmtPct(k.frac)} |`);
        }
    }
    L.push('');

    // Winds
    L.push('## Prevailing Winds & Moisture');
    L.push('');
    L.push('Wind direction is the direction the wind blows **from** (area-weighted mean over each quadrant); strength is relative to the planet-wide mean. "Variable" marks quadrants where the seasonal vectors largely cancel (monsoonal or convergence zones). Seasons follow the northern-hemisphere convention: "Jun" is the June–August half-year — southern-hemisphere summer is the Dec column.');
    L.push('');
    L.push('| Quadrant | Jun wind | Dec wind | Land precip. | Regime | Rain shadow |');
    L.push('|---|---|---|---|---|---|');
    for (const Q of r.quadrants) {
        const wind = s => s ? `from ${s.from}, ${s.strength}${s.variable ? ', variable' : ''}` : '—';
        const precip = Q.pannMm !== null ? `${fmtInt(Q.pannMm)} mm (${Q.seasonality})` : 'no land';
        const rs = Q.rainShadowFrac > 0.1 ? fmtPct(Q.rainShadowFrac, 0) + ' of land' : '—';
        L.push(`| ${Q.name} | ${wind(Q.summer)} | ${wind(Q.winter)} | ${precip} | ${Q.humidity ?? '—'} | ${rs} |`);
    }
    L.push('');
    const shadowed = r.quadrants.filter(Q => Q.rainShadowFrac > 0.15);
    if (shadowed.length && r.mountainSystems.length) {
        const m = r.mountainSystems[0];
        L.push(`A pronounced rain shadow affects the ${shadowed.map(Q => Q.name).join(' and ')} quadrant(s), leeward of the ${m.quadrant} mountain system.`);
        L.push('');
    }

    // Terrain
    L.push('## Predominant Terrain');
    L.push('');
    if (r.areaLand <= 0) {
        L.push('No land terrain.');
    } else {
        L.push('Terrain classes (Table 18 vocabulary) derived per cell from Köppen class, elevation and annual precipitation:');
        L.push('');
        L.push('| Terrain | Share of land |');
        L.push('|---|---|');
        const order = [...TERRAIN_CLASSES.keys()]
            .filter(t => r.terrainArea[t] > 0)
            .sort((a, b) => r.terrainArea[b] - r.terrainArea[a]);
        for (const t of order) {
            const share = r.terrainArea[t] / r.areaLand;
            if (share < 0.002) continue;
            L.push(`| ${TERRAIN_CLASSES[t].name} | ${fmtPct(share)} |`);
        }
        L.push('');
        if (r.expanses.length) {
            L.push('Notable expanses (largest contiguous areas):');
            L.push('');
            for (const e of r.expanses) {
                L.push(`- A ${e.group} of ${fmtKm2(e.areaKm2)} in the ${e.quadrant} quadrant.`);
            }
            L.push('');
        }
    }

    // Water bodies
    L.push('## Water Bodies');
    L.push('');
    if (r.regionWaters.length) {
        L.push('Enclosed below-sea-level seas (basins with no ocean outlet, almost certainly saline):');
        L.push('');
        L.push('| Body | Kind | Area | Max. depth | Quadrant |');
        L.push('|---|---|---|---|---|');
        r.regionWaters.slice(0, 8).forEach((wb, i) => {
            L.push(`| ${i + 1} | ${wb.kind} | ${fmtKm2(wb.areaKm2)} | ${wb.maxDepthKm.toFixed(1)} km | ${wb.quadrant} |`);
        });
        if (r.regionWaters.length > 8) {
            L.push('');
            L.push(`…plus ${r.regionWaters.length - 8} smaller enclosed water bodies.`);
        }
        L.push('');
    }
    if (r.lakes.length) {
        L.push('Closed-basin (endorheic) lakes — terminal depressions where evaporation balances inflow, holding standing (saline) water with no ocean outlet:');
        L.push('');
        L.push('| Lake | Area | Surface elev. | Max. depth | Quadrant |');
        L.push('|---|---|---|---|---|');
        r.lakes.slice(0, 10).forEach((lk, i) => {
            L.push(`| ${i + 1} | ${fmtKm2(lk.areaKm2)} | ${fmtInt(lk.surfaceKm * 1000)} m | ${fmtInt(lk.maxDepthKm * 1000)} m | ${lk.quadrant} |`);
        });
        if (r.lakes.length > 10) {
            L.push('');
            L.push(`…plus ${r.lakes.length - 10} smaller endorheic lakes.`);
        }
        L.push('');
    }
    if (!r.regionWaters.length && !r.lakes.length) {
        L.push('No enclosed seas or closed-basin lakes detected in this region.');
        L.push('');
    }

    // Rivers
    L.push('## Rivers');
    L.push('');
    if (r.rivers.length) {
        L.push(`${r.rivers.length} major river system(s) reach the sea (or a terminal lake) in this region — the book expects 4d6 for a typical region. Discharge is annual flow at the mouth; for scale, the Rhine carries ≈ 70 km³/yr and the Mississippi ≈ 580 km³/yr.`);
        L.push('');
        L.push('| River | Discharge | Main-stem length | Source | Mouth | Empties into |');
        L.push('|---|---|---|---|---|---|');
        r.rivers.slice(0, 10).forEach((rv, i) => {
            L.push(`| ${i + 1} | ${fmtInt(rv.dischargeKm3)} km³/yr | ${fmtInt(rv.lengthKm)} km | ${rv.srcQuadrant} quadrant | ${rv.mouthQuadrant}, ${fmtDeg(rv.mouthLat, rv.mouthLon)} | ${rv.terminus} |`);
        });
        if (r.rivers.length > 10) {
            L.push('');
            L.push(`…plus ${r.rivers.length - 10} lesser major rivers.`);
        }
        L.push('');
    } else if (r.areaLand > 0) {
        L.push('No major river reaches the sea within this region — the land here is too arid, too fragmented, or drains into neighboring regions.');
        L.push('');
    } else {
        L.push('No land, no rivers.');
        L.push('');
    }
    L.push('> **Method note.** Rivers and lakes are not part of the Orogen export; they are derived by this tool with standard terrain hydrology: priority-flood depression filling over the elevation raster, steepest-descent flow routing, and runoff from annual precipitation minus temperature-driven evapotranspiration (Ol\'dekop curve). Only **closed-basin (endorheic) lakes** are reported as standing water: at the 0.125° grid, exorheic filled depressions are an over-detection artifact (unresolved river incision makes through-flowing valleys look ponded), whereas endorheic closure is resolution-robust — rivers are drawn straight through filled exorheic basins. The full consistency and plausibility checks are in [`HYDROLOGY_VALIDATION.md`](../HYDROLOGY_VALIDATION.md). Below-sea-level enclosed seas come directly from the export\'s elevation field.');
    L.push('');
    return L.join('\n');
}

export function indexReadme(meta, results, partitionNote) {
    const L = [];
    L.push('# Regional Geography Reports');
    L.push('');
    L.push(`Chapter-style physical-geography write-ups (after Chapter 3, *Continents and Geography*, of the AD&D World Builder's Guidebook) for the exported World Orogen planet — derived from the simulation data itself rather than dice rolls.`);
    L.push('');
    L.push('| | |');
    L.push('|---|---|');
    L.push(`| Planet code | [\`${meta.planetCode}\`](${meta.url}) |`);
    L.push(`| Seed | ${meta.seed} |`);
    L.push(`| Cells | ${meta.numRegions.toLocaleString('en-US')} |`);
    L.push(`| Land fraction | ${meta.landFractionPct} % |`);
    L.push(`| Extracted | ${meta.extractedAt} |`);
    L.push('');
    L.push('![Overview](maps/overview.png)');
    L.push('');
    L.push('Terrain/ocean colors: [legend](maps/legend.png).');
    L.push('');
    L.push('**See also the [Physical Atlas](atlas/README.md)** — 13 global plates (relief, erosion, tectonics, climate, ocean currents, drainage basins, vegetation) plus a planetary records gazetteer.');
    L.push('');
    L.push('The derived hydrography (rivers, lakes, drainage) is machine-checked for mass balance, routing and Earth-plausibility in [`HYDROLOGY_VALIDATION.md`](HYDROLOGY_VALIDATION.md).');
    L.push('');
    L.push('## The 20 regions');
    L.push('');
    L.push(partitionNote);
    L.push('');
    L.push('| Region | Character | Hydrography | Land | Dominant band | Dominant terrain | Mtn. systems | Major rivers | Lakes |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of results) {
        const nn = String(r.regionId + 1).padStart(2, '0');
        L.push(`| [${nn}](regions/region_${nn}.md) | ${regionEpithet(r)} | ${r.hydrography.label} | ${fmtPct(r.landFrac)} | ${dominantBand(r)} | ${dominantTerrain(r)} | ${r.mountainSystems.length} | ${r.rivers.length} | ${r.lakes.length} |`);
    }
    L.push('');
    L.push('## How this was generated');
    L.push('');
    L.push('Generated by `tools/regional-report` (zero-dependency Node.js). Pipeline: stream the 13 gzipped CSV parts into typed arrays → assign each cell to an icosahedral face → rasterize to a 0.125° equirectangular grid (area-weighted) → classify climate bands and Table-18 terrain from Köppen class, elevation and precipitation → derive hydrology (priority-flood depression filling, precipitation-driven flow accumulation, rivers, and closed-basin endorheic lakes — exorheic filled-depression lakes are suppressed as a coarse-DEM artifact, see [HYDROLOGY_VALIDATION.md](HYDROLOGY_VALIDATION.md)) → per-region connected-component analysis for landmasses, mountain systems and enclosed waters → render maps and write these reports.');
    L.push('');
    L.push('Regenerate with:');
    L.push('');
    L.push('```bash');
    L.push('node tools/regional-report/main.mjs');
    L.push('```');
    L.push('');
    return L.join('\n');
}
