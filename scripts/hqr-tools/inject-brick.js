/**
 * Inject edited PNGs back into LBA_BRK.HQR.
 *
 * Usage:
 *   node inject-brick.js                  # inject every modified PNG in modded_assets/bricks/
 *   node inject-brick.js 1234             # inject only brick 1234
 *   node inject-brick.js 1234,1235,1236   # inject a few
 *   node inject-brick.js --strict         # fail on any off-palette pixel
 *
 * Reads from modded_assets/bricks/ (PNGs + _metadata.json).
 * Writes to output/LBA_BRK.HQR (ready for build-bundle.js).
 *
 * Brick encoding = sprite-frame encoding without the u32 offset table.
 * Header: width(u8) height(u8) offsetX(i8) offsetY(i8), then row-RLE.
 * Codec: lib/sprite-codec.js (encodeRow + decodeBrick).
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const codec = require('./lib/sprite-codec');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const MOD  = path.join(ROOT, 'modded_assets', 'bricks');
const OUT  = path.join(ROOT, 'output');

function encodeBrick(width, height, offsetX, offsetY, pixels) {
    if (width > 255 || height > 255) {
        throw new Error(`brick ${width}×${height} exceeds u8 header limit`);
    }
    if (pixels.length !== width * height) {
        throw new Error(`pixel buffer ${pixels.length} doesn't match ${width}×${height}`);
    }
    const chunks = [];
    const header = Buffer.alloc(4);
    header[0] = width  & 0xFF;
    header[1] = height & 0xFF;
    header[2] = offsetX & 0xFF;
    header[3] = offsetY & 0xFF;
    chunks.push(header);
    for (let row = 0; row < height; row++) {
        const rowPixels = pixels.subarray(row * width, (row + 1) * width);
        chunks.push(codec.encodeRow(rowPixels));
    }
    return Buffer.concat(chunks);
}

function pngToIndexed(pngPath, exactLookup, nearest, strict) {
    const data = fs.readFileSync(pngPath);
    const png  = PNG.sync.read(data);
    const { width, height } = png;
    const pixels = new Uint8Array(width * height);
    let offPalette = 0;

    for (let i = 0; i < width * height; i++) {
        const r = png.data[i * 4 + 0];
        const g = png.data[i * 4 + 1];
        const b = png.data[i * 4 + 2];
        const a = png.data[i * 4 + 3];
        if (a < 128) { pixels[i] = codec.TRANSPARENT_IDX; continue; }
        const exact = exactLookup(r, g, b);
        if (exact >= 0) {
            pixels[i] = exact;
        } else {
            offPalette++;
            if (strict) {
                throw new Error(
                    `${path.basename(pngPath)}: off-palette color rgb(${r},${g},${b}) ` +
                    `at pixel ${i} (x=${i % width}, y=${Math.floor(i / width)})`);
            }
            pixels[i] = nearest(r, g, b);
        }
    }
    return { width, height, pixels, offPalette };
}

const args   = process.argv.slice(2);
const strict = args.includes('--strict');
const idxArg = args.find(a => /^\d/.test(a));
const filter = idxArg ? new Set(idxArg.split(',').map(Number)) : null;

const metaPath = path.join(MOD, '_metadata.json');
if (!fs.existsSync(metaPath)) {
    console.error('ERROR: Run extract-bricks.js first to create _metadata.json');
    process.exit(1);
}

const meta    = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const palette = codec.loadPalette(BASE);
const nearest = codec.buildPaletteLUT(palette);
const exact   = codec.buildExactPaletteLUT(palette);

const brkBuf = fs.readFileSync(path.join(BASE, 'LBA_BRK.HQR'));
const brkAB  = brkBuf.buffer.slice(brkBuf.byteOffset, brkBuf.byteOffset + brkBuf.byteLength);
const brkHQR = HQR.fromArrayBuffer(brkAB);

const baseMTime = fs.statSync(path.join(BASE, 'LBA_BRK.HQR')).mtimeMs;

let injected = 0;
let totalOffPalette = 0;

for (const entry of meta.entries) {
    if (entry.empty || !entry.filename) continue;
    if (filter && !filter.has(entry.index)) continue;

    const pngPath = path.join(MOD, entry.filename);
    if (!fs.existsSync(pngPath)) continue;

    if (!filter) {
        // Auto-filter: only inject PNGs modified AFTER the base HQR (i.e. the user
        // actually changed them). Otherwise `node inject-brick.js` with no args would
        // re-encode all 8715 bricks and take minutes.
        const pngMTime = fs.statSync(pngPath).mtimeMs;
        if (pngMTime <= baseMTime) continue;
    }

    const { width, height, pixels, offPalette } =
        pngToIndexed(pngPath, exact, nearest, strict);

    if (width !== entry.width || height !== entry.height) {
        console.log(`  [${entry.index}] SIZE MISMATCH ${width}×${height} vs original ${entry.width}×${entry.height} — scene grids expect exact dimensions`);
    }

    const offsetX = entry.offsetX || 0;
    const offsetY = entry.offsetY || 0;

    const brickBuf = encodeBrick(width, height, offsetX, offsetY, pixels);
    const ab = brickBuf.buffer.slice(brickBuf.byteOffset, brickBuf.byteOffset + brickBuf.byteLength);
    brkHQR.entries[entry.index] = new HQREntry(ab, CompressionType.NONE);

    injected++;
    totalOffPalette += offPalette;
    const warn = offPalette > 0 ? `  [WARN] ${offPalette} off-palette px snapped` : '';
    console.log(`  [${entry.index}] ${width}×${height} (${entry.bucket}) → injected${warn}`);
}

if (injected === 0) {
    console.log('No modified bricks found. Edit a PNG in modded_assets/bricks/ first (or pass an index).');
    process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const outPath = path.join(OUT, 'LBA_BRK.HQR');
const packed  = brkHQR.toArrayBuffer();
fs.writeFileSync(outPath, Buffer.from(packed));

console.log(`\n[DONE] Injected ${injected} bricks → ${outPath}`);
if (totalOffPalette > 0) {
    console.log(`       ${totalOffPalette} off-palette pixels were snapped. Re-run with --strict to fail on any.`);
}
console.log(`       Run: bash scripts/build-web-bundle.sh  to rebuild the web bundle`);
