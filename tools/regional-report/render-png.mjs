// Zero-dependency PNG writing (truecolor RGB, filter 0) and tiny drawing
// helpers, including a 5x7 bitmap font for labels.

import zlib from 'node:zlib';

// ---- PNG encoder -----------------------------------------------------------

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, payload) {
    const out = Buffer.alloc(12 + payload.length);
    out.writeUInt32BE(payload.length, 0);
    out.write(type, 4, 'ascii');
    payload.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + payload.length)), 8 + payload.length);
    return out;
}

export function encodePNG(width, height, rgb /* Uint8Array length 3*w*h */) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 2;   // color type: truecolor
    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y++) {
        const src = y * width * 3;
        const dst = y * (width * 3 + 1);
        raw[dst] = 0; // filter: none
        raw.set(rgb.subarray(src, src + width * 3), dst + 1);
    }
    const idat = zlib.deflateSync(raw, { level: 6 });
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ---- Canvas helpers ---------------------------------------------------------

export function makeCanvas(width, height, fill = [255, 255, 255]) {
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0; i < width * height; i++) rgb.set(fill, i * 3);
    return { width, height, rgb };
}

export function setPx(cv, x, y, color) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
    cv.rgb.set(color, (y * cv.width + x) * 3);
}

export function fillRect(cv, x0, y0, w, h, color) {
    const x1 = Math.floor(x0 + w), y1 = Math.floor(y0 + h);
    for (let y = Math.floor(y0); y < y1; y++) {
        for (let x = Math.floor(x0); x < x1; x++) setPx(cv, x, y, color);
    }
}

// ---- 5x7 font ---------------------------------------------------------------
// Each glyph: 7 rows x 5 cols, encoded as 7 row-bytes (low 5 bits).

const FONT = {
    '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
    '2': [14, 17, 1, 2, 4, 8, 31], '3': [30, 1, 1, 14, 1, 1, 30],
    '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
    '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
    '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
    'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30],
    'C': [14, 17, 16, 16, 16, 17, 14], 'D': [30, 17, 17, 17, 17, 17, 30],
    'E': [31, 16, 16, 30, 16, 16, 31], 'F': [31, 16, 16, 30, 16, 16, 16],
    'G': [14, 17, 16, 23, 17, 17, 15], 'H': [17, 17, 17, 31, 17, 17, 17],
    'I': [14, 4, 4, 4, 4, 4, 14], 'J': [7, 2, 2, 2, 2, 18, 12],
    'K': [17, 18, 20, 24, 20, 18, 17], 'L': [16, 16, 16, 16, 16, 16, 31],
    'M': [17, 27, 21, 21, 17, 17, 17], 'N': [17, 25, 21, 19, 17, 17, 17],
    'O': [14, 17, 17, 17, 17, 17, 14], 'P': [30, 17, 17, 30, 16, 16, 16],
    'Q': [14, 17, 17, 17, 21, 18, 13], 'R': [30, 17, 17, 30, 20, 18, 17],
    'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4],
    'U': [17, 17, 17, 17, 17, 17, 14], 'V': [17, 17, 17, 17, 17, 10, 4],
    'W': [17, 17, 17, 21, 21, 27, 17], 'X': [17, 17, 10, 4, 10, 17, 17],
    'Y': [17, 17, 10, 4, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
    ' ': [0, 0, 0, 0, 0, 0, 0], '-': [0, 0, 0, 14, 0, 0, 0],
    '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
    '/': [1, 1, 2, 4, 8, 16, 16], '%': [25, 26, 2, 4, 8, 11, 19],
    '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
    ':': [0, 12, 12, 0, 12, 12, 0],
};

export function drawText(cv, x, y, text, color, scale = 1) {
    let cx = x;
    for (const chRaw of String(text).toUpperCase()) {
        const glyph = FONT[chRaw] || FONT[' '];
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 5; c++) {
                if ((glyph[r] >> (4 - c)) & 1) {
                    fillRect(cv, cx + c * scale, y + r * scale, scale, scale, color);
                }
            }
        }
        cx += 6 * scale;
    }
    return cx;
}

export function textWidth(text, scale = 1) {
    return String(text).length * 6 * scale;
}
