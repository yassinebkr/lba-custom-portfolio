/**
 * Extract LBA1 sprites from SPRITES.HQR as RGBA PNGs.
 *
 * Usage:
 *   node extract-sprites.js                   # extract all
 *   node extract-sprites.js 3                 # extract entry 3 only
 *   node extract-sprites.js 3,6,11            # extract a few
 *
 * Output goes to modded_assets/sprites/
 *   000_tank_bullet.png   — RGBA PNG (palette-expanded, transparency = index 0)
 *   _palette.png          — 16×16 swatch grid for reference
 *   _palette.bin          — raw 768-byte VGA palette (6-bit values)
 *   _metadata.json        — entry list for inject-sprite.js
 *
 * Codec lives in lib/sprite-codec.js. Edit that file — not this one — if
 * the sprite format ever changes.
 */

const { HQR } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const codec = require('./lib/sprite-codec');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const OUT  = path.join(ROOT, 'modded_assets', 'sprites');

function spriteToRGBA(sprite, palette) {
    const { width, height, pixels } = sprite;
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

function writePNG(filepath, width, height, rgbaData) {
    const png = new PNG({ width, height });
    rgbaData.copy(png.data);
    fs.writeFileSync(filepath, PNG.sync.write(png));
}

function writePalettePNG(filepath, palette) {
    const cellSize = 16, cols = 16, rows = 16;
    const w = cols * cellSize, h = rows * cellSize;
    const png = new PNG({ width: w, height: h });
    for (let idx = 0; idx < codec.PALETTE_SIZE; idx++) {
        const cx = (idx % cols) * cellSize;
        const cy = Math.floor(idx / cols) * cellSize;
        for (let dy = 0; dy < cellSize; dy++) {
            for (let dx = 0; dx < cellSize; dx++) {
                const off = ((cy + dy) * w + (cx + dx)) * 4;
                png.data[off + 0] = palette[idx * 3 + 0];
                png.data[off + 1] = palette[idx * 3 + 1];
                png.data[off + 2] = palette[idx * 3 + 2];
                png.data[off + 3] = idx === codec.TRANSPARENT_IDX ? 0 : 255;
            }
        }
    }
    fs.writeFileSync(filepath, PNG.sync.write(png));
}

const palette = codec.loadPalette(BASE);
const metadataPath = path.join(ROOT, 'tools', 'metadata', 'LBA1', 'HQR', 'SPRITES.HQR.json');
const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const sprBuf = fs.readFileSync(path.join(BASE, 'SPRITES.HQR'));
const sprAB  = sprBuf.buffer.slice(sprBuf.byteOffset, sprBuf.byteOffset + sprBuf.byteLength);
const sprHQR = HQR.fromArrayBuffer(sprAB);

fs.mkdirSync(OUT, { recursive: true });

let filter = null;
if (process.argv[2]) {
    filter = new Set(process.argv[2].split(',').map(Number));
}

const metaEntries = [];
let extracted = 0;

for (let i = 0; i < sprHQR.entries.length; i++) {
    const entry = sprHQR.entries[i];
    const desc  = meta.entries[i] ? meta.entries[i].description : `entry_${i}`;
    const slug  = String(i).padStart(3, '0') + '_' + desc.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

    if (!entry || !entry.content || entry.content.byteLength < 8) {
        metaEntries.push({ index: i, filename: null, description: desc, empty: true });
        continue;
    }

    const data   = Buffer.from(entry.content);
    const sprite = codec.decodeSpriteFrame(data, 0);

    if (!sprite) {
        metaEntries.push({ index: i, filename: null, description: desc, empty: true });
        continue;
    }

    const info = {
        index:       i,
        filename:    slug + '.png',
        description: desc,
        width:       sprite.width,
        height:      sprite.height,
        offsetX:     sprite.offsetX,
        offsetY:     sprite.offsetY,
        empty:       false,
    };
    metaEntries.push(info);

    if (filter && !filter.has(i)) continue;

    const rgba = spriteToRGBA(sprite, palette);
    writePNG(path.join(OUT, info.filename), sprite.width, sprite.height, rgba);
    extracted++;
    if (extracted % 50 === 0) process.stdout.write(`  ${extracted} sprites extracted...\r`);
}

writePalettePNG(path.join(OUT, '_palette.png'), palette);
fs.writeFileSync(path.join(OUT, '_palette.bin'), Buffer.from(palette));
fs.writeFileSync(path.join(OUT, '_metadata.json'), JSON.stringify({
    source:       'SPRITES.HQR',
    totalEntries: sprHQR.entries.length,
    entries:      metaEntries,
}, null, 2));

console.log(`\n[DONE] Extracted ${extracted} sprites to ${OUT}`);
console.log(`       Palette: _palette.png / _palette.bin`);
console.log(`       Metadata: _metadata.json`);
console.log(`\nEdit PNGs in GIMP, then run: node inject-sprite.js`);
