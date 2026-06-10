// Simple chart rendering (elevation profiles, hypsometric curve) on the
// zero-dependency PNG canvas.

import { makeCanvas, encodePNG, setPx, fillRect, drawText, textWidth } from './render-png.mjs';

const AXIS = [60, 60, 60];
const GRID_LINE = [210, 210, 210];
const LAND_FILL = [170, 140, 100];
const WATER_FILL = [120, 160, 200];
const SEA_LINE = [40, 80, 140];

// Filled elevation profile along a transect.
// samples: array of { t (0..1 along axis), elevKm }
export function profileChart({ width = 2400, height = 460, title, xTickLabels, samples, yMin = -10, yMax = 9 }) {
    const mL = 70, mR = 20, mT = 46, mB = 40;
    const cv = makeCanvas(width, height, [250, 250, 248]);
    const plotW = width - mL - mR, plotH = height - mT - mB;
    const xOf = t => mL + t * plotW;
    const yOf = e => mT + (yMax - e) / (yMax - yMin) * plotH;

    // horizontal gridlines every 2 km
    for (let e = Math.ceil(yMin / 2) * 2; e <= yMax; e += 2) {
        const y = Math.round(yOf(e));
        for (let x = mL; x < width - mR; x += 2) setPx(cv, x, y, GRID_LINE);
        drawText(cv, 8, y - 3, `${e >= 0 ? ' ' : ''}${e}`, AXIS, 1);
    }

    // profile fill
    const seaY = yOf(0);
    for (let i = 0; i < samples.length; i++) {
        const x0 = Math.round(xOf(samples[i].t));
        const x1 = i + 1 < samples.length ? Math.round(xOf(samples[i + 1].t)) : x0 + 1;
        const e = samples[i].elevKm;
        const yE = yOf(e);
        for (let x = x0; x < Math.max(x1, x0 + 1); x++) {
            if (e >= 0) {
                for (let y = Math.round(yE); y <= seaY; y++) setPx(cv, x, y, LAND_FILL);
            } else {
                for (let y = Math.round(seaY); y <= yOf(e); y++) setPx(cv, x, y, WATER_FILL);
            }
        }
    }
    // sea level line
    for (let x = mL; x < width - mR; x++) setPx(cv, x, Math.round(seaY), SEA_LINE);

    // axes
    for (let y = mT; y < height - mB; y++) setPx(cv, mL, y, AXIS);
    for (let x = mL; x < width - mR; x++) setPx(cv, x, height - mB, AXIS);
    if (xTickLabels) {
        xTickLabels.forEach(({ t, label }) => {
            const x = Math.round(xOf(t));
            for (let y = height - mB; y < height - mB + 5; y++) setPx(cv, x, y, AXIS);
            drawText(cv, x - textWidth(label, 1) / 2, height - mB + 8, label, AXIS, 1);
        });
    }
    drawText(cv, mL, 10, title, [30, 30, 30], 2);
    drawText(cv, 8, mT - 14, 'KM', AXIS, 1);
    return cv;
}

// Hypsometric curve (cumulative area vs elevation) + elevation histogram.
export function hypsometryChart({ width = 1400, height = 560, title, cumPoints, histBins }) {
    const mL = 80, mR = 30, mT = 50, mB = 46;
    const cv = makeCanvas(width, height, [250, 250, 248]);
    const plotW = width - mL - mR, plotH = height - mT - mB;
    const yMin = -10, yMax = 9;
    const yOf = e => mT + (yMax - e) / (yMax - yMin) * plotH;
    const xOf = f => mL + f * plotW;

    for (let e = -10; e <= 9; e += 2) {
        const y = Math.round(yOf(e));
        for (let x = mL; x < width - mR; x += 2) setPx(cv, x, y, GRID_LINE);
        drawText(cv, 14, y - 3, `${e >= 0 ? ' ' : ''}${e}`, AXIS, 1);
    }
    // histogram bars (share of area per elevation bin), drawn from the left
    const maxBin = Math.max(...histBins.map(b => b.frac));
    for (const b of histBins) {
        const y0 = Math.round(yOf(b.hi)), y1 = Math.round(yOf(b.lo));
        const w = Math.round(b.frac / maxBin * plotW * 0.45);
        const col = b.lo >= 0 ? [200, 175, 135] : [150, 180, 210];
        fillRect(cv, mL + 1, y0, w, Math.max(1, y1 - y0 - 1), col);
    }
    // cumulative curve: fraction of surface above elevation e
    let prev = null;
    for (const pt of cumPoints) {
        const x = Math.round(xOf(pt.frac)), y = Math.round(yOf(pt.elevKm));
        if (prev) {
            const steps = Math.max(Math.abs(x - prev[0]), Math.abs(y - prev[1]), 1);
            for (let s = 0; s <= steps; s++) {
                setPx(cv, Math.round(prev[0] + (x - prev[0]) * s / steps),
                    Math.round(prev[1] + (y - prev[1]) * s / steps), [170, 40, 40]);
                setPx(cv, Math.round(prev[0] + (x - prev[0]) * s / steps) + 1,
                    Math.round(prev[1] + (y - prev[1]) * s / steps), [170, 40, 40]);
            }
        }
        prev = [x, y];
    }
    const seaY = Math.round(yOf(0));
    for (let x = mL; x < width - mR; x++) setPx(cv, x, seaY, SEA_LINE);

    for (let y = mT; y < height - mB; y++) setPx(cv, mL, y, AXIS);
    for (let x = mL; x < width - mR; x++) setPx(cv, x, height - mB, AXIS);
    for (let f = 0; f <= 1.001; f += 0.25) {
        const x = Math.round(xOf(f));
        for (let y = height - mB; y < height - mB + 5; y++) setPx(cv, x, y, AXIS);
        drawText(cv, x - 10, height - mB + 8, `${Math.round(f * 100)}%`, AXIS, 1);
    }
    drawText(cv, mL, 10, title, [30, 30, 30], 2);
    drawText(cv, mL, 28, 'RED: SHARE OF SURFACE ABOVE ELEVATION. BARS: AREA PER 250 M BIN.', [110, 110, 110], 1);
    drawText(cv, 14, mT - 14, 'KM', AXIS, 1);
    return cv;
}

export { encodePNG };
