// Map images: per-region gnomonic terrain maps, the global overview, legend.

import { makeCanvas, encodePNG, setPx, fillRect, drawText, textWidth } from './render-png.mjs';
import { gnomonicInverse, fromLatLon } from './icosahedron.mjs';
import { TERRAIN_CLASSES, TERRAIN_OCEAN } from './classify.mjs';

const GRAY_BLEND = 0.78;          // out-of-region desaturation
const GNOMONIC_HALF = 0.86;       // tangent-plane half-extent (face circumradius ~0.764)

const OCEAN_SHALLOW = [137, 175, 209];
const OCEAN_MID = [93, 135, 178];
const OCEAN_DEEP = [58, 96, 142];
const COAST = [40, 40, 40];
const LAKE = [96, 150, 198];
const SALT_LAKE = [148, 178, 198];
const RIVER = [52, 106, 168];

function oceanColor(elevKm) {
    if (elevKm > -2) return OCEAN_SHALLOW;
    if (elevKm > -5) return OCEAN_MID;
    return OCEAN_DEEP;
}

function terrainColor(t) {
    return TERRAIN_CLASSES[t].color;
}

function shade(color, f) {
    return [color[0] * f | 0, color[1] * f | 0, color[2] * f | 0];
}

function toGray(color) {
    const g = 0.3 * color[0] + 0.59 * color[1] + 0.11 * color[2];
    const mix = (c) => Math.round(c * (1 - GRAY_BLEND) + (g * 0.35 + 160) * GRAY_BLEND);
    return [mix(color[0]), mix(color[1]), mix(color[2])];
}

function rasterPixel(grid, lat, lon) {
    const { W, H, resDeg } = grid;
    let px = Math.floor((lon + 180) / resDeg);
    if (px >= W) px -= W; if (px < 0) px += W;
    let py = Math.floor((90 - lat) / resDeg);
    if (py < 0) py = 0; if (py >= H) py = H - 1;
    return py * W + px;
}

function basePixelColor(p, grid, data, pxf, hydro) {
    const c = grid.cellGrid[p];
    if (pxf.landPx[p]) {
        if (hydro && hydro.lakeId[p] !== -1 && hydro.lakeVisible[hydro.lakeId[p]]) {
            return hydro.saltyLake[hydro.lakeId[p]] ? SALT_LAKE : LAKE;
        }
        if (hydro && hydro.riverPx[p]) return RIVER;
        let col = terrainColor(pxf.terrainPx[p]);
        if (pxf.mountainPx[p]) col = shade(col, 0.8);
        return col;
    }
    return oceanColor(data.elev_km[c]);
}

export function renderRegionMap(regionId, ctx, size = 1100) {
    const { grid, data, px: pxf, faces, hydro } = ctx;
    const face = faces[regionId];
    const titleH = 34;
    const cv = makeCanvas(size, size + titleH, [248, 248, 246]);

    const inRegion = new Uint8Array(size * size);
    const isLandMap = new Uint8Array(size * size);

    for (let my = 0; my < size; my++) {
        const Y = -((my + 0.5) / size * 2 - 1) * GNOMONIC_HALF;
        for (let mx = 0; mx < size; mx++) {
            const X = ((mx + 0.5) / size * 2 - 1) * GNOMONIC_HALF;
            const [lat, lon] = gnomonicInverse(face, X, Y);
            const p = rasterPixel(grid, lat, lon);
            const inside = pxf.regionPx[p] === regionId;
            let col = basePixelColor(p, grid, data, pxf, hydro);
            if (!inside) col = toGray(col);
            inRegion[my * size + mx] = inside ? 1 : 0;
            isLandMap[my * size + mx] = pxf.landPx[p];
            setPx(cv, mx, my + titleH, col);
        }
    }

    // coastline + region boundary strokes (map-space edge detection)
    for (let my = 0; my < size; my++) {
        for (let mx = 0; mx < size; mx++) {
            const i = my * size + mx;
            const right = mx + 1 < size ? i + 1 : i;
            const down = my + 1 < size ? i + size : i;
            if (inRegion[i]) {
                if (isLandMap[i] !== isLandMap[right] || isLandMap[i] !== isLandMap[down]) {
                    setPx(cv, mx, my + titleH, COAST);
                }
            }
            if (inRegion[i] !== inRegion[right] || inRegion[i] !== inRegion[down]) {
                setPx(cv, mx, my + titleH, [90, 90, 90]);
            }
        }
    }

    // quadrant cross through the face center
    const mid = Math.floor(size / 2);
    for (let t = 0; t < size; t += 3) {
        if (inRegion[t * size + mid]) setPx(cv, mid, t + titleH, [70, 70, 70]);
        if (inRegion[mid * size + t]) setPx(cv, t, mid + titleH, [70, 70, 70]);
    }

    fillRect(cv, 0, 0, size, titleH, [38, 50, 66]);
    drawText(cv, 12, 7, `REGION ${String(regionId + 1).padStart(2, '0')}`, [240, 240, 240], 3);
    const sub = `CENTER ${face.lat.toFixed(1)} ${face.lon.toFixed(1)}`;
    drawText(cv, size - textWidth(sub, 2) - 12, 10, sub, [170, 190, 210], 2);
    return encodePNG(cv.width, cv.height, cv.rgb);
}

export function renderOverview(ctx) {
    const { grid, data, px: pxf, faces, hydro } = ctx;
    const { W, H } = grid;
    const cv = makeCanvas(W, H);
    for (let p = 0; p < W * H; p++) {
        cv.rgb.set(basePixelColor(p, grid, data, pxf, hydro), p * 3);
    }
    // coastline
    for (let py = 0; py < H - 1; py++) {
        for (let mx = 0; mx < W; mx++) {
            const p = py * W + mx;
            const right = mx + 1 < W ? p + 1 : py * W;
            const down = p + W;
            if (pxf.landPx[p] !== pxf.landPx[right] || pxf.landPx[p] !== pxf.landPx[down]) {
                cv.rgb.set(COAST, p * 3);
            }
        }
    }
    // icosahedral edges: sample each face's corner-to-corner great circles
    for (const f of faces) {
        for (let e = 0; e < 3; e++) {
            const a = f.corners[e], b = f.corners[(e + 1) % 3];
            const omega = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
            const steps = 3000;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const k1 = Math.sin((1 - t) * omega) / Math.sin(omega);
                const k2 = Math.sin(t * omega) / Math.sin(omega);
                const v = [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
                const lat = Math.asin(v[1] / Math.hypot(v[0], v[1], v[2])) * 180 / Math.PI;
                const lon = Math.atan2(v[0], v[2]) * 180 / Math.PI;
                const p = rasterPixel(grid, lat, lon);
                cv.rgb.set([20, 20, 20], p * 3);
            }
        }
        // region number at face center (white text with dark plate)
        const label = String(f.region + 1).padStart(2, '0');
        const p = rasterPixel(grid, f.lat, f.lon);
        const py = (p / W) | 0, mx = p - py * W;
        fillRect(cv, mx - 16, py - 12, 32 + 6, 27, [38, 50, 66]);
        drawText(cv, mx - 11, py - 8, label, [255, 255, 255], 3);
    }
    return encodePNG(cv.width, cv.height, cv.rgb);
}

export function renderLegend() {
    const rows = [
        ...TERRAIN_CLASSES.map(t => ({ color: t.color, label: t.name })),
        { color: OCEAN_SHALLOW, label: 'Ocean (shelf, above -2 km)' },
        { color: OCEAN_MID, label: 'Ocean (-2 to -5 km)' },
        { color: OCEAN_DEEP, label: 'Ocean (below -5 km)' },
        { color: SALT_LAKE, label: 'Lake (endorheic / closed-basin)' },
        { color: RIVER, label: 'River' },
    ];
    const rowH = 22, w = 430;
    const cv = makeCanvas(w, rows.length * rowH + 16, [250, 250, 248]);
    rows.forEach((r, i) => {
        const y = 8 + i * rowH;
        fillRect(cv, 10, y, 28, rowH - 6, r.color);
        drawText(cv, 48, y + 3, r.label, [40, 40, 40], 1.5);
    });
    return encodePNG(cv.width, cv.height, cv.rgb);
}
