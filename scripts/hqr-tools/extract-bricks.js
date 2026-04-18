/**
 * Extract LBA1 bricks from LBA_BRK.HQR as RGBA PNGs.
 *
 * Bricks are the 2D isometric tiles that make up world geometry — floors,
 * walls, pillars, stairs. Each scene's 3D room is a grid of brick refs
 * (LBA_GRI.HQR) that reference entries in LBA_BRK.HQR.
 *
 * Usage:
 *   node extract-bricks.js              # extract all 8715 bricks
 *   node extract-bricks.js 0,1,100      # only a few
 *
 * Output: modded_assets/bricks/
 *   0000.png, 0001.png, …               — RGBA PNGs
 *   _metadata.json                      — entry dims + category bucket
 *
 * Codec: decodeBrick in lib/sprite-codec.js.
 */

const { HQR } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const codec = require('./lib/sprite-codec');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const OUT  = path.join(ROOT, 'modded_assets', 'bricks');

function brickToRGBA(brick, palette) {
    const { width, height, pixels } = brick;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const idx = pixels[i];
        if (idx === codec.TRANSPARENT_IDX) {
            rgba[i * 4 + 3] = 0;
        } else {
            rgba[i * 4 + 0] = palette[idx * 3 + 0];
            rgba[i * 4 + 1] = palette[idx * 3 + 1];
            rgba[i * 4 + 2] = palette[idx * 3 + 2];
            rgba[i * 4 + 3] = 255;
        }
    }
    return rgba;
}

function writePNG(filepath, width, height, rgba) {
    const png = new PNG({ width, height });
    rgba.copy(png.data);
    fs.writeFileSync(filepath, PNG.sync.write(png));
}

function bucketOf(w, h) {
    if (w === 48 && h === 26) return 'floor';      // full iso floor tile
    if (w === 24 && h === 23) return 'half-tile';  // quarter
    if (w === 48 && h === 38) return 'wall';       // full wall segment
    if (w === 46 && h === 38) return 'wall';
    if (h >= 30)              return 'tall';       // pillars, columns
    if (h <= 12)              return 'thin';       // caps, edges
    return 'other';
}

const palette = codec.loadPalette(BASE);

const brkBuf = fs.readFileSync(path.join(BASE, 'LBA_BRK.HQR'));
const brkAB  = brkBuf.buffer.slice(brkBuf.byteOffset, brkBuf.byteOffset + brkBuf.byteLength);
const brkHQR = HQR.fromArrayBuffer(brkAB);

fs.mkdirSync(OUT, { recursive: true });

let filter = null;
if (process.argv[2]) {
    filter = new Set(process.argv[2].split(',').map(Number));
}

const metaEntries = [];
let extracted = 0;
const bucketCounts = {};

for (let i = 0; i < brkHQR.entries.length; i++) {
    const entry = brkHQR.entries[i];
    if (!entry || !entry.content || entry.content.byteLength < 4) {
        metaEntries.push({ index: i, filename: null, empty: true });
        continue;
    }

    const data  = new Uint8Array(entry.content);
    const brick = codec.decodeBrick(data);

    if (!brick) {
        metaEntries.push({ index: i, filename: null, empty: true });
        continue;
    }

    const filename = String(i).padStart(4, '0') + '.png';
    const bucket   = bucketOf(brick.width, brick.height);
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;

    metaEntries.push({
        index:    i,
        filename,
        width:    brick.width,
        height:   brick.height,
        offsetX:  brick.offsetX,
        offsetY:  brick.offsetY,
        bucket,
        empty:    false,
    });

    if (filter && !filter.has(i)) continue;

    const rgba = brickToRGBA(brick, palette);
    writePNG(path.join(OUT, filename), brick.width, brick.height, rgba);
    extracted++;
    if (extracted % 500 === 0) {
        process.stdout.write(`  ${extracted} bricks extracted...\r`);
    }
}

fs.writeFileSync(path.join(OUT, '_metadata.json'), JSON.stringify({
    source:       'LBA_BRK.HQR',
    generatedAt:  new Date().toISOString(),
    version:      Date.now(),
    totalEntries: brkHQR.entries.length,
    buckets:      bucketCounts,
    entries:      metaEntries,
}, null, 2));

console.log(`\n[DONE] Extracted ${extracted} bricks to ${OUT}`);
console.log(`       Buckets:`, bucketCounts);
