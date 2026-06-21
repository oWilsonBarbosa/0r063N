// Atlas plate renderers: global maps built from the raster grid.
// Each function returns a PNG buffer.

import { makeCanvas, encodePNG, setPx, fillRect, drawText, textWidth } from './render-png.mjs';
import { tempC, precipAnnualMm, miamiNpp, KOPPEN_CLASSES } from './classify.mjs';

// Köppen colors (frozen from World Orogen js/koppen.js, scaled to 0-255)
export const KOPPEN_COLORS = [
    [74, 111, 165], [0, 0, 255], [0, 120, 255], [70, 170, 250],
    [255, 0, 0], [255, 150, 150], [245, 165, 0], [255, 219, 99],
    [199, 255, 79], [99, 255, 79], [51, 199, 0], [255, 255, 0],
    [199, 199, 0], [150, 150, 0], [150, 255, 150], [99, 199, 99],
    [51, 150, 51], [0, 255, 255], [56, 199, 255], [0, 125, 125],
    [0, 69, 94], [230, 128, 255], [179, 89, 217], [128, 51, 166],
    [89, 26, 115], [171, 176, 255], [110, 120, 199], [74, 79, 199],
    [51, 0, 135], [179, 179, 179], [105, 105, 105],
];

// ---- color helpers ----------------------------------------------------------

export function ramp(stops, t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
            const [t0, ...c0] = stops[i - 1];
            const [t1, ...c1] = stops[i];
            const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
            return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * f));
        }
    }
    return stops[stops.length - 1].slice(1);
}

function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h * 12) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
}

const HYPSO_LAND = [
    [0.00, 90, 140, 90], [0.10, 130, 170, 100], [0.25, 190, 200, 120],
    [0.42, 210, 180, 120], [0.60, 170, 130, 95], [0.78, 145, 125, 115],
    [0.90, 210, 210, 210], [1.00, 255, 255, 255],
];
const HYPSO_OCEAN = [
    [0.00, 160, 198, 222], [0.25, 110, 155, 195], [0.55, 70, 110, 160], [1.00, 28, 48, 92],
];
const TEMP_RAMP = [
    [0.00, 70, 40, 140], [0.20, 60, 100, 200], [0.40, 140, 200, 230],
    [0.50, 245, 245, 235], [0.62, 250, 215, 120], [0.80, 230, 110, 50], [1.00, 150, 20, 30],
];
const PRECIP_RAMP = [
    [0.00, 150, 105, 60], [0.25, 210, 190, 130], [0.45, 160, 200, 120],
    [0.70, 60, 150, 90], [0.88, 50, 110, 170], [1.00, 30, 50, 140],
];
const NPP_RAMP = [
    [0.00, 225, 215, 190], [0.25, 200, 200, 140], [0.50, 140, 185, 100],
    [0.75, 60, 140, 70], [1.00, 10, 80, 40],
];
const DELTA_RAMP = [   // erosion (carved) red ... deposition blue
    [0.00, 150, 25, 25], [0.35, 235, 150, 110], [0.50, 245, 245, 240],
    [0.65, 130, 170, 220], [1.00, 30, 60, 150],
];

export function hypsoColor(elevKm) {
    return elevKm >= 0
        ? ramp(HYPSO_LAND, elevKm / 5)
        : ramp(HYPSO_OCEAN, -elevKm / 9.3);
}

// ---- plate scaffolding ------------------------------------------------------

const TITLE_BG = [38, 50, 66];
const TITLE_H = 44;

// Render a raster-indexed color function into a canvas band at 1/`step` scale.
function rasterBand(cv, yOff, grid, step, colorFn) {
    const { W, H } = grid;
    const w = Math.floor(W / step), h = Math.floor(H / step);
    for (let my = 0; my < h; my++) {
        for (let mx = 0; mx < w; mx++) {
            cv.rgb.set(colorFn((my * step) * W + (mx * step)), ((my + yOff) * cv.width + mx) * 3);
        }
    }
    return h;
}

function newPlate(width, bodyH, title, subtitle) {
    const cv = makeCanvas(width, bodyH + TITLE_H, [248, 248, 246]);
    fillRect(cv, 0, 0, width, TITLE_H, TITLE_BG);
    drawText(cv, 14, 8, title, [240, 240, 240], 2);
    if (subtitle) drawText(cv, 14, 28, subtitle, [165, 185, 205], 1);
    return cv;
}

function colorBar(cv, x, y, w, h, stops, labels) {
    for (let i = 0; i < w; i++) {
        const col = ramp(stops, i / (w - 1));
        fillRect(cv, x + i, y, 1, h, col);
    }
    labels.forEach(({ t, label }) => {
        drawText(cv, x + Math.round(t * w) - textWidth(label, 1) / 2, y + h + 4, label, [50, 50, 50], 1);
    });
}

function drawArrow(cv, x0, y0, dx, dy, color) {
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const steps = Math.ceil(len);
    for (let s = 0; s <= steps; s++) {
        setPx(cv, x0 + dx * s / steps, y0 + dy * s / steps, color);
    }
    // head
    const ux = dx / len, uy = dy / len;
    for (let s = 1; s <= 3; s++) {
        setPx(cv, x0 + dx - ux * s - uy * s * 0.7, y0 + dy - uy * s + ux * s * 0.7, color);
        setPx(cv, x0 + dx - ux * s + uy * s * 0.7, y0 + dy - uy * s - ux * s * 0.7, color);
    }
}

function coastOverlay(cv, yOff, grid, step, landAt, color = [40, 40, 40]) {
    const { W, H } = grid;
    const w = Math.floor(W / step), h = Math.floor(H / step);
    for (let my = 0; my < h - 1; my++) {
        for (let mx = 0; mx < w; mx++) {
            const p = (my * step) * W + mx * step;
            const pr = (my * step) * W + ((mx + 1) % w) * step;
            const pd = ((my + 1) * step) * W + mx * step;
            if (landAt(p) !== landAt(pr) || landAt(p) !== landAt(pd)) {
                setPx(cv, mx, my + yOff, color);
            }
        }
    }
}

// hillshade factor per raster pixel (NW light), ~0.75..1.2
function buildShade(grid, elevAt) {
    const { W, H } = grid;
    const shade = new Float32Array(W * H).fill(1);
    for (let py = 1; py < H - 1; py++) {
        for (let px = 0; px < W; px++) {
            const p = py * W + px;
            const l = py * W + (px === 0 ? W - 1 : px - 1);
            const u = (py - 1) * W + px;
            const g = (elevAt(p) - elevAt(l)) + (elevAt(p) - elevAt(u));
            shade[p] = Math.max(0.72, Math.min(1.22, 1 - g * 1.6));
        }
    }
    return shade;
}

const shaded = (col, s) => [Math.min(255, col[0] * s) | 0, Math.min(255, col[1] * s) | 0, Math.min(255, col[2] * s) | 0];

// ---- Plate 01: shaded relief -----------------------------------------------

export function plateRelief(ctx) {
    const { grid, data } = ctx;
    const elevAt = p => data.elev_km[grid.cellGrid[p]];
    const shade = buildShade(grid, elevAt);
    const cv = newPlate(grid.W, grid.H + 80, 'PLATE 1 - SHADED RELIEF AND BATHYMETRY',
        'HYPSOMETRIC TINTS, NW ILLUMINATION. ELEVATIONS -9.3 TO 8.5 KM');
    // quantize elevation and shade so the PNG compresses well
    const qe = e => Math.round(e * 25) / 25;
    const qs = s => Math.round(s * 24) / 24;
    rasterBand(cv, TITLE_H, grid, 1, p => shaded(hypsoColor(qe(elevAt(p))), qs(shade[p])));
    coastOverlay(cv, TITLE_H, grid, 1, p => ctx.px.landPx[p]);
    colorBar(cv, 60, TITLE_H + grid.H + 18, 500, 16, HYPSO_LAND,
        [{ t: 0, label: '0' }, { t: 0.5, label: '2.5' }, { t: 1, label: '5+ KM' }]);
    colorBar(cv, 660, TITLE_H + grid.H + 18, 500, 16, HYPSO_OCEAN,
        [{ t: 0, label: '0' }, { t: 0.5, label: '-4.6' }, { t: 1, label: '-9.3 KM' }]);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 04: erosion (3 panels) -------------------------------------------

export function plateErosion(ctx) {
    const { grid, data } = ctx;
    const step = 2;
    const w = grid.W / step, h = grid.H / step;
    const preKm = p => {
        const v = data.prePost[grid.cellGrid[p]];
        return v > 0 ? v * 6 : v * 10;
    };
    const curKm = p => data.elev_km[grid.cellGrid[p]];
    const cv = newPlate(w, (h + 26) * 3 + 60, 'PLATE 4 - THE WORK OF EROSION',
        'PRE-EROSION SURFACE, PRESENT SURFACE, AND NET ELEVATION CHANGE');
    let y = TITLE_H;
    drawText(cv, 10, y + 6, 'A. PRE-EROSION SURFACE (RAW TECTONIC UPLIFT)', [40, 40, 40], 1.5);
    y += 26;
    rasterBand(cv, y, grid, step, p => hypsoColor(preKm(p)));
    y += h;
    drawText(cv, 10, y + 6, 'B. PRESENT SURFACE (AFTER GLACIAL, FLUVIAL AND THERMAL EROSION)', [40, 40, 40], 1.5);
    y += 26;
    rasterBand(cv, y, grid, step, p => hypsoColor(curKm(p)));
    coastOverlay(cv, y, grid, step, p => ctx.px.landPx[p]);
    y += h;
    drawText(cv, 10, y + 6, 'C. NET CHANGE ON LAND: RED = CARVED AWAY, BLUE = DEPOSITED', [40, 40, 40], 1.5);
    y += 26;
    rasterBand(cv, y, grid, step, p => {
        if (!ctx.px.landPx[p]) return [216, 224, 232];
        const d = curKm(p) - preKm(p); // km, negative = eroded
        return ramp(DELTA_RAMP, 0.5 + d / 3);
    });
    coastOverlay(cv, y, grid, step, p => ctx.px.landPx[p], [90, 90, 90]);
    y += h;
    colorBar(cv, 60, y + 14, 420, 14, DELTA_RAMP,
        [{ t: 0, label: '-1.5 KM' }, { t: 0.5, label: '0' }, { t: 1, label: '+1.5 KM' }]);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 05: tectonic plates ----------------------------------------------

export function plateTectonics(ctx) {
    const { grid, data, px } = ctx;
    const { W, H, cellGrid } = grid;
    // remap arbitrary plate ids to sequential indices
    const ids = new Map();
    const plateOf = p => {
        const raw = data.plate[cellGrid[p]];
        if (!ids.has(raw)) ids.set(raw, ids.size);
        return ids.get(raw);
    };
    const cv = newPlate(W, H + 90, 'PLATE 5 - TECTONIC PLATES AND BOUNDARIES',
        'PLATE MOSAIC. RED = CONVERGENT, BLUE = DIVERGENT RIDGE, GOLD = TRANSFORM. DOTS = HOTSPOTS');
    rasterBand(cv, TITLE_H, grid, 1, p => {
        const base = hslToRgb((plateOf(p) * 0.61803) % 1, 0.45, px.landPx[p] ? 0.72 : 0.55);
        return base;
    });
    coastOverlay(cv, TITLE_H, grid, 1, p => px.landPx[p], [105, 105, 105]);
    // boundaries colored by type
    for (let py = 0; py < H - 1; py++) {
        for (let pxx = 0; pxx < W; pxx++) {
            const p = py * W + pxx;
            const pr = py * W + ((pxx + 1) % W);
            const pd = (py + 1) * W + pxx;
            for (const q of [pr, pd]) {
                if (data.plate[cellGrid[p]] === data.plate[cellGrid[q]]) continue;
                const ridge = (data.foldRidge[cellGrid[p]] + data.foldRidge[cellGrid[q]]) / 2;
                const stress = (data.stress[cellGrid[p]] + data.stress[cellGrid[q]]) / 2;
                const col = ridge > 0.04 ? [40, 70, 200] : stress > 0.25 ? [200, 30, 30] : [215, 170, 40];
                setPx(cv, pxx, py + TITLE_H, col);
                break;
            }
        }
    }
    // hotspots: local maxima above threshold
    for (let py = 2; py < H - 2; py += 2) {
        for (let pxx = 2; pxx < W - 2; pxx += 2) {
            const p = py * W + pxx;
            const v = data.hotspot[cellGrid[p]];
            if (v < 0.17) continue;
            let isMax = true;
            for (let dy = -2; dy <= 2 && isMax; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    if (data.hotspot[cellGrid[(py + dy) * W + pxx + dx]] > v) { isMax = false; break; }
                }
            }
            if (isMax) {
                fillRect(cv, pxx - 2, py + TITLE_H - 2, 5, 5, [120, 20, 90]);
                fillRect(cv, pxx - 1, py + TITLE_H - 1, 3, 3, [255, 120, 200]);
            }
        }
    }
    drawText(cv, 60, TITLE_H + H + 16, 'EACH COLOR IS ONE PLATE. LIGHTER = CONTINENTAL CRUST, DARKER = OCEANIC.', [50, 50, 50], 1.5);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 06: tectonic activity --------------------------------------------

export function plateActivity(ctx) {
    const { grid, data, px } = ctx;
    const cv = newPlate(grid.W, grid.H + 80, 'PLATE 6 - OROGENY AND TECTONIC ACTIVITY',
        'OROGENIC POWER ON LAND (ORANGE), MID-OCEAN RIDGES (CYAN), BACK-ARC BASINS (MAGENTA)');
    rasterBand(cv, TITLE_H, grid, 1, p => {
        const c = grid.cellGrid[p];
        const baseCol = px.landPx[p] ? [225, 222, 212] : [188, 198, 210];
        const act = Math.min(1, data.tecAct[c]);
        let col = [baseCol[0] - act * 60, baseCol[1] - act * 60, baseCol[2] - act * 45];
        const oro = Math.min(1, data.orogPow[c] / 0.4);
        if (px.landPx[p] && oro > 0.08) col = ramp([[0, col[0], col[1], col[2]], [1, 200, 70, 20]], oro);
        const ridge = Math.min(1, data.foldRidge[c] / 0.4);
        if (!px.landPx[p] && ridge > 0.08) col = ramp([[0, col[0], col[1], col[2]], [1, 0, 170, 190]], ridge);
        const ba = Math.min(1, data.backArc[c] / 0.4);
        if (!px.landPx[p] && ba > 0.08) col = ramp([[0, col[0], col[1], col[2]], [1, 180, 40, 160]], ba);
        return col.map(v => Math.max(0, Math.min(255, v | 0)));
    });
    coastOverlay(cv, TITLE_H, grid, 1, p => px.landPx[p]);
    drawText(cv, 60, TITLE_H + grid.H + 16, 'DARKENING = OVERALL TECTONIC ACTIVITY (EARTHQUAKE BELTS).', [50, 50, 50], 1.5);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 07: Köppen --------------------------------------------------------

export function plateKoppen(ctx) {
    const { grid, data, px } = ctx;
    const legendRows = Math.ceil((KOPPEN_CLASSES.length - 1) / 4);
    const legendH = legendRows * 20 + 30;
    const cv = newPlate(grid.W, grid.H + legendH, 'PLATE 7 - KOPPEN CLIMATE CLASSIFICATION',
        'AS COMPUTED BY THE ORIGINAL SIMULATION (PER-CELL KOPPEN CLASS FROM THE EXPORT)');
    rasterBand(cv, TITLE_H, grid, 1, p => {
        const k = data.koppen[grid.cellGrid[p]];
        return k === 0 ? [205, 215, 226] : KOPPEN_COLORS[k];
    });
    coastOverlay(cv, TITLE_H, grid, 1, p => px.landPx[p], [70, 70, 70]);
    let y = TITLE_H + grid.H + 12;
    for (let k = 1; k < KOPPEN_CLASSES.length; k++) {
        const col = (k - 1) % 4, row = ((k - 1) / 4) | 0;
        const x = 40 + col * 700;
        fillRect(cv, x, y + row * 20, 26, 14, KOPPEN_COLORS[k]);
        drawText(cv, x + 34, y + row * 20 + 2, `${KOPPEN_CLASSES[k].code} ${KOPPEN_CLASSES[k].name}`, [40, 40, 40], 1.5);
    }
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 08/09: temperature & precipitation (2-3 panels) ------------------

function seasonPanels(ctx, title, subtitle, panels, bar) {
    const { grid } = ctx;
    const step = 2;
    const w = grid.W / step, h = grid.H / step;
    const cv = newPlate(w, (h + 26) * panels.length + 64, title, subtitle);
    let y = TITLE_H;
    for (const panel of panels) {
        drawText(cv, 10, y + 6, panel.caption, [40, 40, 40], 1.5);
        y += 26;
        rasterBand(cv, y, grid, step, panel.colorFn);
        coastOverlay(cv, y, grid, step, p => ctx.px.landPx[p], [70, 70, 70]);
        y += h;
    }
    colorBar(cv, 60, y + 14, 460, 14, bar.stops, bar.labels);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

export function plateTemperature(ctx) {
    const { grid, data } = ctx;
    const tCol = field => p => ramp(TEMP_RAMP, (tempC(data[field][grid.cellGrid[p]]) + 40) / 80);
    return seasonPanels(ctx, 'PLATE 8 - SURFACE TEMPERATURE',
        'SEASONAL MEANS. SEASONS USE THE NORTHERN-HEMISPHERE CONVENTION', [
        { caption: 'A. JUNE-AUGUST HALF-YEAR', colorFn: tCol('tS') },
        { caption: 'B. DECEMBER-FEBRUARY HALF-YEAR', colorFn: tCol('tW') },
    ], {
        stops: TEMP_RAMP,
        labels: [{ t: 0, label: '-40 C' }, { t: 0.5, label: '0' }, { t: 1, label: '+40 C' }],
    });
}

export function platePrecipitation(ctx) {
    const { grid, data } = ctx;
    const half = field => p => {
        const mm = Math.max(0, data[field][grid.cellGrid[p]]) * 1000;
        return ramp(PRECIP_RAMP, mm / 1500);
    };
    const annual = p => {
        const c = grid.cellGrid[p];
        return ramp(PRECIP_RAMP, precipAnnualMm(data.pS[c], data.pW[c]) / 3000);
    };
    return seasonPanels(ctx, 'PLATE 9 - PRECIPITATION',
        'HALF-YEAR TOTALS AND ANNUAL TOTAL', [
        { caption: 'A. JUNE-AUGUST HALF-YEAR (0-1500 MM)', colorFn: half('pS') },
        { caption: 'B. DECEMBER-FEBRUARY HALF-YEAR (0-1500 MM)', colorFn: half('pW') },
        { caption: 'C. ANNUAL TOTAL (0-3000 MM)', colorFn: annual },
    ], {
        stops: PRECIP_RAMP,
        labels: [{ t: 0, label: '0' }, { t: 0.5, label: '1500' }, { t: 1, label: '3000 MM' }],
    });
}

// ---- Plate 10: pressure & winds ----------------------------------------------

export function plateWinds(ctx) {
    const { grid, data, px } = ctx;
    const { W, H, cellGrid } = grid;
    const step = 2;
    const w = W / step, h = H / step;
    // pressure percentile normalization
    const norm = (field) => {
        let lo = Infinity, hi = -Infinity;
        for (let p = 0; p < W * H; p += 7) {
            const v = data[field][cellGrid[p]];
            if (v < lo) lo = v; if (v > hi) hi = v;
        }
        return v => (v - lo) / (hi - lo + 1e-9);
    };
    const PRESS_RAMP = [[0, 80, 110, 180], [0.5, 240, 240, 235], [1, 200, 90, 60]];
    const cv = newPlate(w, (h + 26) * 2 + 64, 'PLATE 10 - SEA-LEVEL PRESSURE AND WINDS',
        'PRESSURE FIELD (BLUE LOW, RED HIGH) WITH WIND VECTORS');
    let y = TITLE_H;
    const seasons = [
        { caption: 'A. JUNE-AUGUST', press: 'prS', wE: 'windES', wN: 'windNS' },
        { caption: 'B. DECEMBER-FEBRUARY', press: 'prW', wE: 'windEW', wN: 'windNW' },
    ];
    for (const s of seasons) {
        const nf = norm(s.press);
        drawText(cv, 10, y + 6, s.caption, [40, 40, 40], 1.5);
        y += 26;
        rasterBand(cv, y, grid, step, p => ramp(PRESS_RAMP, nf(data[s.press][cellGrid[p]])));
        coastOverlay(cv, y, grid, step, p => px.landPx[p], [90, 90, 90]);
        // wind arrows on a ~4.5 deg grid
        const cell = 18;
        for (let gy = cell; gy < h - 2; gy += cell) {
            for (let gx = Math.floor(cell / 2); gx < w; gx += cell) {
                let e = 0, n = 0, cnt = 0;
                for (let dy = -3; dy <= 3; dy += 2) {
                    for (let dx = -3; dx <= 3; dx += 2) {
                        const c = cellGrid[((gy + dy) * step) * W + ((gx + dx + w) % w) * step];
                        e += data[s.wE][c]; n += data[s.wN][c]; cnt++;
                    }
                }
                e /= cnt; n /= cnt;
                const mag = Math.hypot(e, n);
                const sc = Math.min(13, 3 + mag * 0.10);
                drawArrow(cv, gx, y + gy, e / (mag + 1e-9) * sc, -n / (mag + 1e-9) * sc, [25, 25, 25]);
            }
        }
        y += h;
    }
    colorBar(cv, 60, y + 14, 460, 14, PRESS_RAMP,
        [{ t: 0, label: 'LOW' }, { t: 1, label: 'HIGH' }]);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 11: ocean currents -------------------------------------------------

export function plateCurrents(ctx) {
    const { grid, data, px } = ctx;
    const { W, H, cellGrid } = grid;
    const step = 2;
    const w = W / step, h = H / step;
    const cv = newPlate(w, (h + 26) * 2 + 40, 'PLATE 11 - OCEAN SURFACE CURRENTS',
        'RED = WARM POLEWARD FLOW, BLUE = COLD EQUATORWARD FLOW');
    let y = TITLE_H;
    const seasons = [
        { caption: 'A. JUNE-AUGUST', E: 'ocEastS', N: 'ocNorthS', S: 'ocSpeedS', O: 'owS' },
        { caption: 'B. DECEMBER-FEBRUARY', E: 'ocEastW', N: 'ocNorthW', S: 'ocSpeedW', O: 'owW' },
    ];
    for (const s of seasons) {
        drawText(cv, 10, y + 6, s.caption, [40, 40, 40], 1.5);
        y += 26;
        rasterBand(cv, y, grid, step, p => {
            if (px.landPx[p]) return [228, 224, 212];
            const d = data.elev_km[cellGrid[p]];
            return d > -2 ? [205, 222, 235] : d > -5 ? [185, 205, 224] : [165, 188, 212];
        });
        coastOverlay(cv, y, grid, step, p => px.landPx[p], [120, 120, 120]);
        const cell = 18;
        for (let gy = cell; gy < h - 2; gy += cell) {
            for (let gx = Math.floor(cell / 2); gx < w; gx += cell) {
                const p0 = (gy * step) * W + gx * step;
                if (px.landPx[p0]) continue;
                // window means: the warm/cold signal lives on narrow boundary
                // currents, so sample a neighborhood rather than one cell
                let e = 0, n = 0, spd = 0, warm = 0, cnt = 0;
                for (let dy = -4; dy <= 4; dy += 2) {
                    for (let dx = -4; dx <= 4; dx += 2) {
                        const p = ((gy + dy) * step) * W + ((gx + dx + w) % w) * step;
                        if (px.landPx[p]) continue;
                        const c = cellGrid[p];
                        e += data[s.E][c]; n += data[s.N][c];
                        spd += data[s.S][c]; warm += data[s.O][c];
                        cnt++;
                    }
                }
                if (cnt === 0) continue;
                e /= cnt; n /= cnt; spd /= cnt; warm /= cnt;
                const mag = Math.hypot(e, n);
                if (mag < 0.08 || spd < 0.06) continue;
                const col = warm > 0.015 ? [195, 35, 35] : warm < -0.015 ? [35, 60, 185] : [70, 70, 70];
                const sc = 3 + Math.min(11, spd * 12);
                drawArrow(cv, gx, y + gy, e / mag * sc, -n / mag * sc, col);
            }
        }
        y += h;
    }
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 12: drainage basins -------------------------------------------------

export function plateBasins(ctx) {
    const { grid, data, px, hydro } = ctx;
    const { W, H } = grid;
    const N = W * H;

    // terminal pixel of every land pixel (stop at endorheic salt lakes)
    const terminal = new Int32Array(N).fill(-1);
    const order = hydro.popOrder;
    for (let i = 0; i < N; i++) {
        const p = order[i];
        if (!px.landPx[p]) { terminal[p] = p; continue; }
        if (hydro.lakeId[p] !== -1 && hydro.saltyLake[hydro.lakeId[p]]) { terminal[p] = -2 - hydro.lakeId[p]; continue; }
        const r = hydro.receiver[p];
        terminal[p] = r >= 0 ? terminal[r] : p;
    }
    // basin color per major river: keyed by the ocean pixel its mouth drains to
    const mouthColor = new Map();
    hydro.rivers.forEach((rv, i) => {
        const r = hydro.receiver[rv.mouthPx];
        if (r >= 0) mouthColor.set(terminal[r] >= 0 ? terminal[r] : r, i);
    });
    // NOTE: terminal of an ocean pixel is itself; mouths map to that pixel
    const cv = newPlate(W, H + 70, 'PLATE 12 - DRAINAGE BASINS AND RIVER SYSTEMS',
        'EACH COLOR IS THE WATERSHED OF ONE MAJOR RIVER. DARK GRAY = ENDORHEIC (CLOSED) BASINS');
    rasterBand(cv, TITLE_H, grid, 1, p => {
        if (!px.landPx[p]) return [215, 224, 233];
        if (hydro.lakeId[p] !== -1 && hydro.lakeVisible[hydro.lakeId[p]]) {
            return hydro.saltyLake[hydro.lakeId[p]] ? [148, 178, 198] : [80, 140, 198];
        }
        if (hydro.riverPx[p]) return [35, 80, 150];
        const t = terminal[p];
        if (t <= -2) return [110, 105, 115];                        // endorheic
        const m = mouthColor.get(t);
        if (m !== undefined) return hslToRgb((m * 0.61803) % 1, 0.4, 0.78);
        return [232, 228, 218];                                     // minor coastal drainage
    });
    coastOverlay(cv, TITLE_H, grid, 1, p => px.landPx[p]);
    drawText(cv, 60, TITLE_H + H + 14, `${hydro.rivers.length} MAJOR RIVER BASINS COLORED. PALE = SMALL COASTAL CATCHMENTS.`, [50, 50, 50], 1.5);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

// ---- Plate 13: net primary productivity ---------------------------------------

export function plateNpp(ctx) {
    const { grid, data, px } = ctx;
    const cv = newPlate(grid.W, grid.H + 80, 'PLATE 13 - VEGETATION PRODUCTIVITY (MIAMI NPP MODEL)',
        'NET PRIMARY PRODUCTIVITY FROM ANNUAL TEMPERATURE AND PRECIPITATION (ICE CAPS = 0)');
    rasterBand(cv, TITLE_H, grid, 1, p => {
        if (!px.landPx[p]) return [210, 220, 230];
        const c = grid.cellGrid[p];
        return ramp(NPP_RAMP, miamiNpp(data.koppen[c], data.tS[c], data.tW[c], data.pS[c], data.pW[c]) / 3000);
    });
    coastOverlay(cv, TITLE_H, grid, 1, p => px.landPx[p]);
    colorBar(cv, 60, TITLE_H + grid.H + 18, 460, 16, NPP_RAMP,
        [{ t: 0, label: '0' }, { t: 0.5, label: '1500' }, { t: 1, label: '3000 G/M2/YR' }]);
    return encodePNG(cv.width, cv.height, cv.rgb);
}
