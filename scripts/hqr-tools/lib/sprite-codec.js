/**
 * LBA1 sprite codec — shared by extract-sprites.js, inject-sprite.js, and
 * test-sprites.js so they can't drift.
 *
 * Format reference: twin-e/src/grid.c `drawBrickSprite` (line 652).
 *
 *   offsetTable : uint32[N]   // one entry per frame
 *   frame       : {
 *     header : [width:u8, height:u8, offsetX:i8, offsetY:i8]
 *     rows   : for each row,
 *                segCount : u8
 *                segments : segCount × segment
 *     segment :
 *       temp = next byte, iteration = (temp & 0x3F) + 1
 *       (temp & 0xC0) == 0x00 → transparent skip, advance x by `iteration`
 *       (temp & 0xC0) == 0x80 → RLE  : next byte = color, repeat `iteration`×
 *       otherwise             → literal: read `iteration` palette indices
 *
 * Palette: RESS.HQR entry 0 is 768 bytes of 6-bit VGA (values 0..63). We
 * scale ×4 to get 8-bit RGB. Index 0 is always transparent.
 */

const { HQR } = require('@lbalab/hqr');
const fs      = require('fs');
const path    = require('path');

const PALETTE_SIZE    = 256;
const PALETTE_BYTES   = PALETTE_SIZE * 3;
const TRANSPARENT_IDX = 0;
const MAX_RUN         = 64; // (temp & 0x3F) + 1 maxes out at 64

function loadPalette(baseGameDir) {
    const ressPath = path.join(baseGameDir, 'RESS.HQR');
    const buf = fs.readFileSync(ressPath);
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const hqr = HQR.fromArrayBuffer(ab);
    const pal = Buffer.from(hqr.entries[0].content);
    const rgb = new Uint8Array(PALETTE_BYTES);
    for (let i = 0; i < PALETTE_BYTES; i++) {
        rgb[i] = Math.min(255, (pal[i] & 0x3F) * 4);
    }
    return rgb;
}

function decodeSpriteFrame(data, frameIndex = 0) {
    if (data.length < 8) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const frameOff = view.getUint32(frameIndex * 4, true);
    if (frameOff >= data.length - 4) return null;

    const ptr     = data.subarray(frameOff);
    const width   = ptr[0];
    const height  = ptr[1];
    const offsetX = (ptr[2] > 127) ? ptr[2] - 256 : ptr[2];
    const offsetY = (ptr[3] > 127) ? ptr[3] - 256 : ptr[3];

    if (width === 0 || height === 0 || width > 512 || height > 512) return null;

    const pixels = new Uint8Array(width * height);
    let p = 4;

    for (let row = 0; row < height; row++) {
        let x = 0;
        const numSegments = ptr[p++];
        for (let seg = 0; seg < numSegments; seg++) {
            const temp      = ptr[p++];
            const iteration = (temp & 0x3F) + 1;

            if ((temp & 0xC0) === 0x00) {
                x += iteration;
            } else if ((temp & 0xC0) === 0x80) {
                const color = ptr[p++];
                for (let i = 0; i < iteration && x < width; i++, x++) {
                    pixels[row * width + x] = color;
                }
            } else {
                for (let i = 0; i < iteration && x < width; i++, x++) {
                    pixels[row * width + x] = ptr[p++];
                }
            }
        }
    }

    return { width, height, offsetX, offsetY, pixels };
}

function encodeRow(rowPixels) {
    const width = rowPixels.length;
    const parts = [];
    let x = 0;

    while (x < width) {
        if (rowPixels[x] === TRANSPARENT_IDX) {
            let run = 0;
            while (x + run < width
                   && rowPixels[x + run] === TRANSPARENT_IDX
                   && run < MAX_RUN) run++;
            parts.push({ type: 'skip', len: run });
            x += run;
            continue;
        }

        let rleLen = 1;
        while (x + rleLen < width
               && rowPixels[x + rleLen] === rowPixels[x]
               && rowPixels[x + rleLen] !== TRANSPARENT_IDX
               && rleLen < MAX_RUN) rleLen++;

        if (rleLen >= 3) {
            parts.push({ type: 'rle', len: rleLen, color: rowPixels[x] });
            x += rleLen;
        } else {
            let litLen = 0;
            while (x + litLen < width && litLen < MAX_RUN) {
                if (rowPixels[x + litLen] === TRANSPARENT_IDX) break;
                if (litLen > 0
                    && x + litLen + 2 < width
                    && rowPixels[x + litLen]     === rowPixels[x + litLen + 1]
                    && rowPixels[x + litLen + 1] === rowPixels[x + litLen + 2]) break;
                litLen++;
            }
            if (litLen === 0) litLen = 1;
            parts.push({
                type: 'literal',
                len:  litLen,
                data: rowPixels.slice(x, x + litLen),
            });
            x += litLen;
        }
    }

    if (parts.length > 255) {
        throw new Error(`row encoded to ${parts.length} segments; max is 255`);
    }

    const out = [parts.length & 0xFF];
    for (const part of parts) {
        const iteration = (part.len - 1) & 0x3F;
        if (part.type === 'skip') {
            out.push(iteration);
        } else if (part.type === 'rle') {
            out.push(0x80 | iteration);
            out.push(part.color);
        } else {
            out.push(0xC0 | iteration);
            for (let i = 0; i < part.len; i++) out.push(part.data[i]);
        }
    }
    return Buffer.from(out);
}

function encodeSprite(width, height, offsetX, offsetY, pixels) {
    if (width > 255 || height > 255) {
        throw new Error(`sprite ${width}×${height} exceeds u8 header limit (255×255)`);
    }
    if (pixels.length !== width * height) {
        throw new Error(`pixel buffer ${pixels.length} doesn't match ${width}×${height}`);
    }

    const chunks = [];

    const offBuf = Buffer.alloc(4);
    offBuf.writeUInt32LE(4, 0);
    chunks.push(offBuf);

    const header = Buffer.alloc(4);
    header[0] = width  & 0xFF;
    header[1] = height & 0xFF;
    header[2] = offsetX & 0xFF;
    header[3] = offsetY & 0xFF;
    chunks.push(header);

    for (let row = 0; row < height; row++) {
        const rowPixels = pixels.subarray(row * width, (row + 1) * width);
        chunks.push(encodeRow(rowPixels));
    }

    return Buffer.concat(chunks);
}

function buildPaletteLUT(palette) {
    const cache = new Map();
    return function nearest(r, g, b) {
        const key = (r << 16) | (g << 8) | b;
        const cached = cache.get(key);
        if (cached !== undefined) return cached;
        let best = 1, bestDist = Infinity;
        for (let i = 1; i < PALETTE_SIZE; i++) {
            const dr = palette[i * 3 + 0] - r;
            const dg = palette[i * 3 + 1] - g;
            const db = palette[i * 3 + 2] - b;
            const d  = dr * dr + dg * dg + db * db;
            if (d < bestDist) { bestDist = d; best = i; if (d === 0) break; }
        }
        cache.set(key, best);
        return best;
    };
}

function buildExactPaletteLUT(palette) {
    const exact = new Map();
    for (let i = 0; i < PALETTE_SIZE; i++) {
        const key = (palette[i * 3] << 16) | (palette[i * 3 + 1] << 8) | palette[i * 3 + 2];
        if (!exact.has(key)) exact.set(key, i);
    }
    return function lookup(r, g, b) {
        const key = (r << 16) | (g << 8) | b;
        return exact.has(key) ? exact.get(key) : -1;
    };
}

module.exports = {
    PALETTE_SIZE,
    PALETTE_BYTES,
    TRANSPARENT_IDX,
    MAX_RUN,
    loadPalette,
    decodeSpriteFrame,
    encodeSprite,
    encodeRow,
    buildPaletteLUT,
    buildExactPaletteLUT,
};
