/**
 * Inject edited PNGs back into SPRITES.HQR.
 *
 * Usage:
 *   node inject-sprite.js                   # inject ALL modified PNGs
 *   node inject-sprite.js 11                # inject only entry 11
 *
 * Reads from modded_assets/sprites/ (PNGs + _metadata.json).
 * Writes to output/SPRITES.HQR (ready for build-bundle.js).
 *
 * The script:
 *   1. Opens base_game/SPRITES.HQR as the template
 *   2. For each PNG that differs from the extracted original, re-encodes
 *      the pixels into LBA1 sprite format (palette-matched + RLE)
 *   3. Replaces that entry in the HQR
 *   4. Writes the full HQR to output/SPRITES.HQR
 *
 * PNG → LBA sprite conversion:
 *   - Maps each pixel RGB → nearest palette color (Euclidean distance)
 *   - Transparent pixels (alpha < 128) become palette index 0
 *   - Encodes rows using the same RLE scheme the engine expects
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '../..');
const BASE  = path.join(ROOT, 'base_game');
const MOD   = path.join(ROOT, 'modded_assets', 'sprites');
const OUT   = path.join(ROOT, 'output');

// ── Load palette ────────────────────────────────────────────
function loadPalette() {
    const buf = fs.readFileSync(path.join(BASE, 'RESS.HQR'));
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const hqr = HQR.fromArrayBuffer(ab);
    const pal = Buffer.from(hqr.entries[0].content);
    const rgb = new Uint8Array(256 * 3);
    for (let i = 0; i < 256 * 3; i++) {
        rgb[i] = Math.min(255, (pal[i] & 0x3F) * 4);
    }
    return rgb;
}

// ── Nearest-palette color match ─────────────────────────────
function buildPaletteLUT(palette) {
    // For fast lookup, pre-build a map from RGB332 → palette index
    // But for accuracy, just do Euclidean on demand with caching
    const cache = new Map();
    return function nearest(r, g, b) {
        const key = (r << 16) | (g << 8) | b;
        if (cache.has(key)) return cache.get(key);
        let best = 1, bestDist = Infinity; // start at 1 — index 0 is transparent
        for (let i = 1; i < 256; i++) {
            const dr = palette[i*3+0] - r;
            const dg = palette[i*3+1] - g;
            const db = palette[i*3+2] - b;
            const d  = dr*dr + dg*dg + db*db;
            if (d < bestDist) { bestDist = d; best = i; }
            if (d === 0) break;
        }
        cache.set(key, best);
        return best;
    };
}

// ── Read PNG → indexed pixel buffer ─────────────────────────
function pngToIndexed(pngPath, nearest) {
    const data = fs.readFileSync(pngPath);
    const png  = PNG.sync.read(data);
    const { width, height } = png;
    const pixels = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
        const r = png.data[i*4+0];
        const g = png.data[i*4+1];
        const b = png.data[i*4+2];
        const a = png.data[i*4+3];
        pixels[i] = (a < 128) ? 0 : nearest(r, g, b);
    }

    return { width, height, pixels };
}

// ── Encode indexed pixels → LBA1 sprite RLE format ──────────
function encodeSprite(width, height, offsetX, offsetY, pixels) {
    const chunks = [];

    // Frame offset table: 1 frame → single uint32 pointing to byte 4
    const offBuf = Buffer.alloc(4);
    offBuf.writeUInt32LE(4, 0);
    chunks.push(offBuf);

    // Frame header
    const header = Buffer.alloc(4);
    header[0] = width & 0xFF;
    header[1] = height & 0xFF;
    header[2] = offsetX & 0xFF;
    header[3] = offsetY & 0xFF;
    chunks.push(header);

    // Encode each row
    for (let row = 0; row < height; row++) {
        const rowPixels = pixels.subarray(row * width, (row + 1) * width);
        const segments = encodeRow(rowPixels);
        chunks.push(segments);
    }

    return Buffer.concat(chunks);
}

function encodeRow(rowPixels) {
    const width = rowPixels.length;
    const parts = []; // each part: { type: 'skip'|'rle'|'literal', data }
    let x = 0;

    while (x < width) {
        // Count transparent run
        if (rowPixels[x] === 0) {
            let run = 0;
            while (x + run < width && rowPixels[x + run] === 0 && run < 64) run++;
            parts.push({ type: 'skip', len: run });
            x += run;
            continue;
        }

        // Count same-color run
        let rleLen = 1;
        while (x + rleLen < width && rowPixels[x + rleLen] === rowPixels[x]
               && rowPixels[x + rleLen] !== 0 && rleLen < 64) rleLen++;

        if (rleLen >= 3) {
            parts.push({ type: 'rle', len: rleLen, color: rowPixels[x] });
            x += rleLen;
        } else {
            // Literal run: collect non-zero pixels until we hit a skip or RLE opportunity
            let litLen = 0;
            while (x + litLen < width && litLen < 64) {
                if (rowPixels[x + litLen] === 0) break;
                // Check if an RLE run of 3+ starts here
                if (litLen > 0 && x + litLen + 2 < width
                    && rowPixels[x+litLen] === rowPixels[x+litLen+1]
                    && rowPixels[x+litLen] === rowPixels[x+litLen+2]) break;
                litLen++;
            }
            if (litLen === 0) litLen = 1;
            parts.push({ type: 'literal', len: litLen, data: rowPixels.slice(x, x + litLen) });
            x += litLen;
        }
    }

    // Serialize: segment count byte, then segments
    const out = [parts.length & 0xFF];
    for (const part of parts) {
        const iteration = part.len - 1;
        if (part.type === 'skip') {
            out.push(iteration & 0x3F); // high bits 00
        } else if (part.type === 'rle') {
            out.push(0x80 | (iteration & 0x3F)); // high bits 10
            out.push(part.color);
        } else {
            out.push(0xC0 | (iteration & 0x3F)); // high bits 11
            for (let i = 0; i < part.len; i++) out.push(part.data[i]);
        }
    }

    return Buffer.from(out);
}

// ── Main ────────────────────────────────────────────────────
const metaPath = path.join(MOD, '_metadata.json');
if (!fs.existsSync(metaPath)) {
    console.error('ERROR: Run extract-sprites.js first to create _metadata.json');
    process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const palette = loadPalette();
const nearest = buildPaletteLUT(palette);

// Load base SPRITES.HQR as template
const sprBuf = fs.readFileSync(path.join(BASE, 'SPRITES.HQR'));
const sprAB  = sprBuf.buffer.slice(sprBuf.byteOffset, sprBuf.byteOffset + sprBuf.byteLength);
const sprHQR = HQR.fromArrayBuffer(sprAB);

let filter = null;
if (process.argv[2]) {
    filter = new Set(process.argv[2].split(',').map(Number));
}

let injected = 0;

for (const entry of meta.entries) {
    if (entry.empty || !entry.filename) continue;
    if (filter && !filter.has(entry.index)) continue;

    const pngPath = path.join(MOD, entry.filename);
    if (!fs.existsSync(pngPath)) continue;

    const { width, height, pixels } = pngToIndexed(pngPath, nearest);
    const offsetX = entry.offsetX || 0;
    const offsetY = entry.offsetY || 0;

    const spriteBuf = encodeSprite(width, height, offsetX, offsetY, pixels);
    const ab = spriteBuf.buffer.slice(spriteBuf.byteOffset, spriteBuf.byteOffset + spriteBuf.byteLength);
    sprHQR.entries[entry.index] = new HQREntry(ab, CompressionType.NONE);

    injected++;
    console.log(`  [${entry.index}] ${entry.description} (${width}×${height}) → injected`);
}

if (injected === 0) {
    console.log('No modified sprites found. Edit PNGs in modded_assets/sprites/ first.');
    process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const outPath = path.join(OUT, 'SPRITES.HQR');
const packed = sprHQR.toArrayBuffer();
fs.writeFileSync(outPath, Buffer.from(packed));

console.log(`\n[DONE] Injected ${injected} sprites → ${outPath}`);
console.log(`       Run: node build-bundle.js  to rebuild the web bundle`);
