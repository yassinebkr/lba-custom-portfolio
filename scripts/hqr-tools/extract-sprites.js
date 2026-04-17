/**
 * Extract LBA1 sprites from SPRITES.HQR as indexed-color PNGs.
 *
 * Usage:
 *   node extract-sprites.js                   # extract all
 *   node extract-sprites.js 3                  # extract entry 3 only
 *   node extract-sprites.js 3,6,11             # extract a few
 *
 * Output goes to modded_assets/sprites/
 *   000_tank_bullet.png    — RGBA PNG (palette-expanded, transparency = index 0)
 *   _palette.png           — 16×16 swatch grid for reference
 *   _palette.bin           — raw 768-byte VGA palette (6-bit values)
 *   _metadata.json         — entry list for repack-sprites.js
 *
 * LBA1 sprite format (from twin-e/grid.c drawBrickSprite):
 *   - Offset table: N × uint32 (one per frame). We only extract frame 0.
 *   - Frame header: [width:u8] [height:u8] [offsetX:i8] [offsetY:i8]
 *   - Row data: for each row, 1 segment-count byte, then segments:
 *       temp & 0xC0 == 0x00 → transparent run: skip (temp & 0x3F) + 1 pixels
 *       temp & 0xC0 == 0x80 → RLE fill: next byte is color, repeat (temp & 0x3F) + 1
 *       temp & 0xC0 == 0xC0 → literal: read (temp & 0x3F) + 1 color bytes
 */

const { HQR } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '../..');
const BASE  = path.join(ROOT, 'base_game');
const OUT   = path.join(ROOT, 'modded_assets', 'sprites');

// ── Load palette from RESS.HQR entry 0 ──────────────────────
function loadPalette() {
    const buf = fs.readFileSync(path.join(BASE, 'RESS.HQR'));
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const hqr = HQR.fromArrayBuffer(ab);
    const pal = Buffer.from(hqr.entries[0].content);

    // VGA 6-bit (0-63) → 8-bit (0-255): multiply by 4 then clamp
    const rgb = new Uint8Array(256 * 3);
    for (let i = 0; i < 256 * 3; i++) {
        rgb[i] = Math.min(255, (pal[i] & 0x3F) * 4);
    }
    return rgb;
}

// ── Decode one sprite frame into a pixel buffer ──────────────
function decodeSpriteFrame(data, frameIndex) {
    if (data.length < 8) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // Offset table: each frame is a uint32 offset
    const frameOff = view.getUint32(frameIndex * 4, true);
    if (frameOff >= data.length - 4) return null;

    const ptr = data.subarray(frameOff);
    const width   = ptr[0];
    const height  = ptr[1];
    const offsetX = (ptr[2] > 127) ? ptr[2] - 256 : ptr[2]; // signed
    const offsetY = (ptr[3] > 127) ? ptr[3] - 256 : ptr[3];

    if (width === 0 || height === 0 || width > 512 || height > 512) return null;

    // Palette-indexed pixel buffer (0 = transparent)
    const pixels = new Uint8Array(width * height);
    let p = 4; // offset into ptr

    for (let row = 0; row < height; row++) {
        let x = 0;
        const numSegments = ptr[p++];
        for (let seg = 0; seg < numSegments; seg++) {
            const temp = ptr[p++];
            const iteration = (temp & 0x3F) + 1;

            if ((temp & 0xC0) === 0x00) {
                // Transparent skip
                x += iteration;
            } else if ((temp & 0xC0) === 0x80) {
                // RLE: one color repeated
                const color = ptr[p++];
                for (let i = 0; i < iteration && x < width; i++, x++) {
                    pixels[row * width + x] = color;
                }
            } else {
                // Literal: read iteration color bytes
                for (let i = 0; i < iteration && x < width; i++, x++) {
                    pixels[row * width + x] = ptr[p++];
                }
            }
        }
    }

    return { width, height, offsetX, offsetY, pixels };
}

// ── Encode sprite frame into RGBA PNG ────────────────────────
function spriteToRGBA(sprite, palette) {
    const { width, height, pixels } = sprite;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const idx = pixels[i];
        if (idx === 0) {
            // transparent
            rgba[i*4+3] = 0;
        } else {
            rgba[i*4+0] = palette[idx*3+0];
            rgba[i*4+1] = palette[idx*3+1];
            rgba[i*4+2] = palette[idx*3+2];
            rgba[i*4+3] = 255;
        }
    }
    return rgba;
}

function writePNG(filepath, width, height, rgbaData) {
    const png = new PNG({ width, height });
    rgbaData.copy(png.data);
    const buf = PNG.sync.write(png);
    fs.writeFileSync(filepath, buf);
}

// ── Write palette swatch PNG ────────────────────────────────
function writePalettePNG(filepath, palette) {
    const cellSize = 16;
    const cols = 16, rows = 16;
    const w = cols * cellSize, h = rows * cellSize;
    const png = new PNG({ width: w, height: h });
    for (let idx = 0; idx < 256; idx++) {
        const cx = (idx % cols) * cellSize;
        const cy = Math.floor(idx / cols) * cellSize;
        for (let dy = 0; dy < cellSize; dy++) {
            for (let dx = 0; dx < cellSize; dx++) {
                const off = ((cy + dy) * w + (cx + dx)) * 4;
                png.data[off+0] = palette[idx*3+0];
                png.data[off+1] = palette[idx*3+1];
                png.data[off+2] = palette[idx*3+2];
                png.data[off+3] = idx === 0 ? 0 : 255;
            }
        }
    }
    fs.writeFileSync(filepath, PNG.sync.write(png));
}

// ── Main ────────────────────────────────────────────────────
const palette = loadPalette();
const metadataPath = path.join(ROOT, 'tools', 'metadata', 'LBA1', 'HQR', 'SPRITES.HQR.json');
const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const sprBuf = fs.readFileSync(path.join(BASE, 'SPRITES.HQR'));
const sprAB  = sprBuf.buffer.slice(sprBuf.byteOffset, sprBuf.byteOffset + sprBuf.byteLength);
const sprHQR = HQR.fromArrayBuffer(sprAB);

fs.mkdirSync(OUT, { recursive: true });

// Parse optional index filter
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

    const data = Buffer.from(entry.content);
    const sprite = decodeSpriteFrame(data, 0);

    if (!sprite) {
        metaEntries.push({ index: i, filename: null, description: desc, empty: true });
        continue;
    }

    const info = {
        index: i,
        filename: slug + '.png',
        description: desc,
        width: sprite.width,
        height: sprite.height,
        offsetX: sprite.offsetX,
        offsetY: sprite.offsetY,
        empty: false,
    };
    metaEntries.push(info);

    if (filter && !filter.has(i)) continue;

    const rgba = spriteToRGBA(sprite, palette);
    writePNG(path.join(OUT, info.filename), sprite.width, sprite.height, rgba);
    extracted++;
    if (extracted % 50 === 0) process.stdout.write(`  ${extracted} sprites extracted...\r`);
}

// Write palette reference
writePalettePNG(path.join(OUT, '_palette.png'), palette);
fs.writeFileSync(path.join(OUT, '_palette.bin'), Buffer.from(palette));

// Write metadata for repack
fs.writeFileSync(path.join(OUT, '_metadata.json'), JSON.stringify({
    source: 'SPRITES.HQR',
    totalEntries: sprHQR.entries.length,
    entries: metaEntries,
}, null, 2));

console.log(`\n[DONE] Extracted ${extracted} sprites to ${OUT}`);
console.log(`       Palette: _palette.png / _palette.bin`);
console.log(`       Metadata: _metadata.json`);
console.log(`\nEdit PNGs in GIMP, then run: node inject-sprite.js`);
