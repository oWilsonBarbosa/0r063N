// Climate-band and terrain classification tables.
// Frozen copy of KOPPEN_CLASSES from World Orogen js/koppen.js (index = the
// `koppen` CSV column). Terrain vocabulary follows Table 18 of the
// World Builder's Guidebook chapter; the Koppen->terrain mapping is the one
// interpretive piece of the pipeline, kept here as a single visible table.

export const KOPPEN_CLASSES = [
    { code: 'Ocean', name: 'Ocean' },
    { code: 'Af', name: 'Tropical rainforest' },
    { code: 'Am', name: 'Tropical monsoon' },
    { code: 'Aw', name: 'Tropical savanna' },
    { code: 'BWh', name: 'Hot desert' },
    { code: 'BWk', name: 'Cold desert' },
    { code: 'BSh', name: 'Hot steppe' },
    { code: 'BSk', name: 'Cold steppe' },
    { code: 'Cfa', name: 'Humid subtropical' },
    { code: 'Cfb', name: 'Oceanic' },
    { code: 'Cfc', name: 'Subpolar oceanic' },
    { code: 'Csa', name: 'Hot-summer Mediterranean' },
    { code: 'Csb', name: 'Warm-summer Mediterranean' },
    { code: 'Csc', name: 'Cold-summer Mediterranean' },
    { code: 'Cwa', name: 'Humid subtropical (monsoon)' },
    { code: 'Cwb', name: 'Subtropical highland' },
    { code: 'Cwc', name: 'Cold subtropical highland' },
    { code: 'Dfa', name: 'Hot-summer continental' },
    { code: 'Dfb', name: 'Warm-summer continental' },
    { code: 'Dfc', name: 'Subarctic' },
    { code: 'Dfd', name: 'Extremely cold subarctic' },
    { code: 'Dsa', name: 'Hot-summer continental (dry summer)' },
    { code: 'Dsb', name: 'Warm-summer continental (dry summer)' },
    { code: 'Dsc', name: 'Subarctic (dry summer)' },
    { code: 'Dsd', name: 'Extremely cold subarctic (dry summer)' },
    { code: 'Dwa', name: 'Hot-summer continental (monsoon)' },
    { code: 'Dwb', name: 'Warm-summer continental (monsoon)' },
    { code: 'Dwc', name: 'Subarctic (monsoon)' },
    { code: 'Dwd', name: 'Extremely cold subarctic (monsoon)' },
    { code: 'ET', name: 'Tundra' },
    { code: 'EF', name: 'Ice cap' },
];

// The book's five latitudinal climate bands.
export const BANDS = ['Tropical', 'Sub-tropical', 'Temperate', 'Sub-arctic', 'Arctic'];
export const BAND_OCEAN = 255;

const BAND_OF_KOPPEN = new Uint8Array(32);
{
    const T = 0, ST = 1, TE = 2, SA = 3, AR = 4;
    const m = {
        1: T, 2: T, 3: T,
        4: ST, 6: ST, 8: ST, 11: ST, 14: ST,
        5: TE, 7: TE, 9: TE, 10: TE, 12: TE, 13: TE, 15: TE, 16: TE, 17: TE, 21: TE, 25: TE,
        18: SA, 19: SA, 20: SA, 22: SA, 23: SA, 24: SA, 26: SA, 27: SA, 28: SA,
        29: AR, 30: AR,
    };
    for (const [k, v] of Object.entries(m)) BAND_OF_KOPPEN[+k] = v;
}

export function climateBand(koppen) {
    return koppen === 0 ? BAND_OCEAN : BAND_OF_KOPPEN[koppen];
}

// Terrain classes (Table 18 vocabulary) with map colors.
export const TERRAIN_CLASSES = [
    { key: 'barren', name: 'Barren', color: [120, 110, 100] },
    { key: 'desertSandy', name: 'Desert, sandy', color: [237, 213, 130] },
    { key: 'desertRocky', name: 'Desert, rocky', color: [205, 160, 100] },
    { key: 'scrub', name: 'Scrub / brushland', color: [189, 183, 107] },
    { key: 'grassland', name: 'Grassland / savanna', color: [196, 212, 110] },
    { key: 'prairie', name: 'Prairie', color: [222, 222, 130] },
    { key: 'steppe', name: 'Steppe', color: [218, 195, 130] },
    { key: 'forestLight', name: 'Forest, light', color: [120, 170, 110] },
    { key: 'forestMedium', name: 'Forest, medium', color: [70, 140, 70] },
    { key: 'forestHeavy', name: 'Forest, heavy', color: [30, 105, 45] },
    { key: 'jungleMedium', name: 'Jungle, medium', color: [40, 130, 60] },
    { key: 'jungleHeavy', name: 'Jungle, heavy', color: [10, 90, 35] },
    { key: 'marshSwamp', name: 'Marsh / swamp', color: [95, 140, 120] },
    { key: 'moor', name: 'Moor', color: [140, 130, 150] },
    { key: 'tundra', name: 'Tundra', color: [180, 180, 165] },
    { key: 'glacier', name: 'Glacier', color: [235, 240, 248] },
];
export const TERRAIN_OCEAN = 255;
const T_IDX = Object.fromEntries(TERRAIN_CLASSES.map((t, i) => [t.key, i]));

export function tempC(tNorm) {
    return -45 + Math.max(0, Math.min(1, tNorm)) * 90;
}

export function precipAnnualMm(pS, pW) {
    return (Math.max(0, pS) + Math.max(0, pW)) * 1000;
}

// Deterministic terrain class for one land cell.
export function classifyTerrain(koppen, elevKm, pannMm, isCoastal) {
    if (koppen === 30) return T_IDX.glacier;                       // EF
    if (elevKm > 3.0) return T_IDX.barren;                         // above treeline
    if (koppen === 29 && elevKm > 2.0) return T_IDX.barren;        // alpine ET
    if (koppen === 29) return T_IDX.tundra;

    // low-lying wet coastal flats -> wetlands
    if (elevKm < 0.05 && isCoastal && pannMm > 800 && koppen >= 1 && koppen <= 16) {
        return T_IDX.marshSwamp;
    }

    switch (koppen) {
        case 1: return T_IDX.jungleHeavy;                                       // Af
        case 2: return T_IDX.jungleMedium;                                      // Am
        case 3: return pannMm >= 900 ? T_IDX.forestLight : T_IDX.grassland;     // Aw
        case 4: return elevKm > 1.0 ? T_IDX.desertRocky : T_IDX.desertSandy;    // BWh
        case 5: return T_IDX.desertRocky;                                       // BWk
        case 6: return T_IDX.scrub;                                             // BSh
        case 7: return T_IDX.steppe;                                            // BSk
        case 8: case 14:                                                        // Cfa, Cwa
            return pannMm >= 1200 ? T_IDX.forestHeavy : T_IDX.forestMedium;
        case 9: return T_IDX.forestMedium;                                      // Cfb
        case 10: return pannMm >= 800 ? T_IDX.moor : T_IDX.forestLight;         // Cfc
        case 11: case 13: return T_IDX.scrub;                                   // Csa, Csc
        case 12: return pannMm >= 700 ? T_IDX.forestLight : T_IDX.scrub;        // Csb
        case 15: case 16: return T_IDX.grassland;                               // Cwb, Cwc (highland)
        case 17: case 21: case 25:                                              // Dfa, Dsa, Dwa
            return pannMm >= 600 ? T_IDX.forestMedium : T_IDX.prairie;
        case 18: case 22: case 26:                                              // Dfb, Dsb, Dwb
            return pannMm >= 500 ? T_IDX.forestMedium : T_IDX.prairie;
        case 19: case 20: case 23: case 24: case 27: case 28:                   // subarctic D
            return pannMm < 350 ? T_IDX.grassland : T_IDX.forestLight;
        default: return T_IDX.barren;
    }
}

// Per-cell classification of the whole dataset.
export function classifyAll(data) {
    const n = data.n;
    const terrain = new Uint8Array(n).fill(TERRAIN_OCEAN);
    const band = new Uint8Array(n).fill(BAND_OCEAN);
    for (let i = 0; i < n; i++) {
        if (!data.isLand[i]) continue;
        const k = data.koppen[i];
        band[i] = climateBand(k);
        const pann = precipAnnualMm(data.pS[i], data.pW[i]);
        terrain[i] = classifyTerrain(k, data.elev_km[i], pann, data.isCoastal[i]);
    }
    return { terrain, band };
}
