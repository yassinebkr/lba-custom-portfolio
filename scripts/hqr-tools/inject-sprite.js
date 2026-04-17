/**
 * Inject edited PNGs back into SPRITES.HQR.
 *
 * Usage:
 *   node inject-sprite.js                   # inject ALL PNGs present in modded_assets/sprites/
 *   node inject-sprite.js 11                # inject only entry 11
 *   node inject-sprite.js --strict          # fail on any off-palette pixel
 *
 * Reads from modded_assets/sprites/ (PNGs + _metadata.json).
 * Writes to output/SPRITES.HQR (ready for build-bundle.js).
 *
 * PNG → LBA sprite conversion:
 *   - Alpha < 128 → palette index 0 (transparent).
 *   - Otherwise → exact palette match if available, else nearest (Euclidean).
 *     --strict aborts on the first off-palette pixel; useful for CI.
 *
 * Codec lives in lib/sprite-codec.js.
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const codec = require('./lib/sprite-codec');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const MOD  = path.join(ROOT, 'modded_assets', 'sprites');
const OUT  = path.join(ROOT, 'output');

function pngToIndexed(pngPath, exactLookup, nearest, strict) {
    const data  = fs.readFileSync(pngPath);
    const png   = PNG.sync.read(data);
    const { width, height } = png;
    const pixels = new Uint8Array(width * height);
    let offPalette = 0;

    for (let i = 0; i < width * height; i++) {
        const r = png.data[i * 4 + 0];
        const g = png.data[i * 4 + 1];
        const b = png.data[i * 4 + 2];
        const a = png.data[i * 4 + 3];
        if (a < 128) {
            pixels[i] = codec.TRANSPARENT_IDX;
            continue;
        }
        const exact = exactLookup(r, g, b);
        if (exact >= 0) {
            pixels[i] = exact;
        } else {
            offPalette++;
            if (strict) {
                throw new Error(
                    `${path.basename(pngPath)}: off-palette color ` +
                    `rgb(${r},${g},${b}) at pixel ${i} (x=${i % width}, y=${Math.floor(i / width)})`);
            }
            pixels[i] = nearest(r, g, b);
        }
    }
    return { width, height, pixels, offPalette };
}

const args       = process.argv.slice(2);
const strict     = args.includes('--strict');
const idxArg     = args.find(a => /^\d/.test(a));
const filter     = idxArg ? new Set(idxArg.split(',').map(Number)) : null;

const metaPath = path.join(MOD, '_metadata.json');
if (!fs.existsSync(metaPath)) {
    console.error('ERROR: Run extract-sprites.js first to create _metadata.json');
    process.exit(1);
}

const meta     = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const palette  = codec.loadPalette(BASE);
const nearest  = codec.buildPaletteLUT(palette);
const exact    = codec.buildExactPaletteLUT(palette);

const sprBuf = fs.readFileSync(path.join(BASE, 'SPRITES.HQR'));
const sprAB  = sprBuf.buffer.slice(sprBuf.byteOffset, sprBuf.byteOffset + sprBuf.byteLength);
const sprHQR = HQR.fromArrayBuffer(sprAB);

let injected = 0;
let totalOffPalette = 0;

for (const entry of meta.entries) {
    if (entry.empty || !entry.filename) continue;
    if (filter && !filter.has(entry.index)) continue;

    const pngPath = path.join(MOD, entry.filename);
    if (!fs.existsSync(pngPath)) continue;

    const { width, height, pixels, offPalette } =
        pngToIndexed(pngPath, exact, nearest, strict);

    const offsetX = entry.offsetX || 0;
    const offsetY = entry.offsetY || 0;

    const spriteBuf = codec.encodeSprite(width, height, offsetX, offsetY, pixels);
    const ab = spriteBuf.buffer.slice(spriteBuf.byteOffset, spriteBuf.byteOffset + spriteBuf.byteLength);
    sprHQR.entries[entry.index] = new HQREntry(ab, CompressionType.NONE);

    injected++;
    totalOffPalette += offPalette;
    const warn = offPalette > 0 ? `  [WARN] ${offPalette} off-palette px snapped` : '';
    console.log(`  [${entry.index}] ${entry.description} (${width}×${height}) → injected${warn}`);
}

if (injected === 0) {
    console.log('No modified sprites found. Edit PNGs in modded_assets/sprites/ first.');
    process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const outPath = path.join(OUT, 'SPRITES.HQR');
const packed  = sprHQR.toArrayBuffer();
fs.writeFileSync(outPath, Buffer.from(packed));

console.log(`\n[DONE] Injected ${injected} sprites → ${outPath}`);
if (totalOffPalette > 0) {
    console.log(`       ${totalOffPalette} off-palette pixels were snapped. Re-run with --strict to fail on any.`);
}
console.log(`       Run: node build-bundle.js  to rebuild the web bundle`);
