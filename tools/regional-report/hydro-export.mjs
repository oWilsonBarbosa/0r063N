// Machine-readable hydrography export: the major-river network and the
// endorheic (closed-basin) lakes as lat/lon point sets on the 0.125° grid.
//
// This is the single source of truth for derived hydrography across the repo —
// the same network drawn on the regional maps and the atlas drainage plate, and
// validated in reports/regional/HYDROLOGY_VALIDATION.md. Other tools (e.g. the
// Python per-continent maps in tools/tectonics-pipeline) read this file rather
// than recomputing flow routing, so every map agrees.

export function hydrographyExport(grid, hydro, meta) {
    const { W, H, resDeg } = grid;
    const { riverPx, discharge, lakeId, lakeVisible } = hydro;
    const r3 = (x) => Math.round(x * 1000) / 1000;   // ~100 m, plenty for overlays

    const rivers = [];
    const lakes = [];
    for (let p = 0; p < W * H; p++) {
        const inRiver = riverPx[p] === 1;
        const inLake = lakeId[p] !== -1 && lakeVisible[lakeId[p]] === 1;
        if (!inRiver && !inLake) continue;
        const ix = p % W, iy = (p / W) | 0;
        const lon = r3(-180 + (ix + 0.5) * resDeg);
        const lat = r3(90 - (iy + 0.5) * resDeg);
        if (inRiver) rivers.push([lat, lon, Math.round(discharge[p])]);
        if (inLake) lakes.push([lat, lon]);
    }

    return {
        planetCode: meta.planetCode,
        resDeg,
        note: 'Derived hydrography from tools/regional-report (Node). ' +
            'rivers.points = major-river network pixels [lat, lon, dischargeKm3] ' +
            `(>= ${hydro.thresholds.MAJOR_RIVER_KM3} km3/yr, threading through filled exorheic basins); ` +
            'lakes.points = endorheic (closed-basin) lake pixels [lat, lon]. ' +
            'See reports/regional/HYDROLOGY_VALIDATION.md.',
        thresholds: hydro.thresholds,
        rivers: { count: rivers.length, points: rivers },
        lakes: { count: lakes.length, points: lakes },
    };
}
