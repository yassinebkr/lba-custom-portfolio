/**
 * Paint-over a scene template and push the result back into LBA_BRK.HQR.
 *
 * Flow:
 *   1. render-scene.js emitted scene-N-template.png + pixelmap.bin + placements.json.
 *   2. You paint over template.png in Photoshop/Procreate/Nano-Banana (same dims).
 *   3. This tool inverts the render:
 *        for each pixel (x,y) in your painted PNG:
 *          placement p = pixelmap[x,y]
 *          (dx, dy)    = (x, y) - screenPosOf(p)
 *          samples[p.brickIdx][dy][dx].push(rgba)
 *      Then for each brick used in the scene, pick the mode pixel per (dy, dx)
 *      across all instances → palette-snap → encode → overwrite brick slot.
 *   4. Write output/LBA_BRK.HQR.
 *
 * Why mode-of-instances and not per-placement uniqueness:
 *   LBA1 caps scene layouts at 256. Giving every grid cell its own brick would
 *   blow past that. We re-use the same brick indices the scene already uses;
 *   if you painted the 1246 floor cells consistently, the mode recovers your
 *   design; if you painted them all differently, the floor averages (tiling
 *   is unavoidable without layout explosion). The tool prints a "paint
 *   consistency" score per brick so you know which ones averaged cleanly.
 *
 * Usage:
 *   node inject-scene-image.js 43 path/to/painted.png
 *   node inject-scene-image.js 43 path/to/painted.png --strict
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const codec = require('./lib/sprite-codec');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const OUT  = path.join(ROOT, 'output');
const SCN  = path.join(OUT, 'scenes');

function encodeBrick(width, height, offsetX, offsetY, pixels) {
    const chunks = [];
    const header = Buffer.alloc(4);
    header[0] = width  & 0xFF;
    header[1] = height & 0xFF;
    header[2] = offsetX & 0xFF;
    header[3] = offsetY & 0xFF;
    chunks.push(header);
    for (let row = 0; row < height; row++) {
        chunks.push(codec.encodeRow(pixels.subarray(row * width, (row + 1) * width)));
    }
    return Buffer.concat(chunks);
}

const args = process.argv.slice(2);
const sceneArg = args.find(a => /^\d+$/.test(a));
const pngArg   = args.find(a => a.toLowerCase().endsWith('.png'));
const strict   = args.includes('--strict');
if (!sceneArg || !pngArg) {
    console.error('usage: node inject-scene-image.js <sceneIdx> <painted.png> [--strict]');
    process.exit(1);
}
const sceneIdx = parseInt(sceneArg, 10);

console.log(`[scene ${sceneIdx}] loading render artifacts...`);
const placements = JSON.parse(fs.readFileSync(
    path.join(SCN, `scene-${sceneIdx}-placements.json`), 'utf8'));
const pixelMapBuf = fs.readFileSync(path.join(SCN, `scene-${sceneIdx}-pixelmap.bin`));
const pixelMap = new Int32Array(pixelMapBuf.buffer, pixelMapBuf.byteOffset,
                                pixelMapBuf.byteLength / 4);

const { canvasW, canvasH, originX, originY, projection } = placements;
const { CELL_HALF_W, CELL_DEPTH, CELL_HEIGHT } = projection;

console.log(`[scene ${sceneIdx}] loading painted image...`);
const inPng = PNG.sync.read(fs.readFileSync(pngArg));
if (inPng.width !== canvasW || inPng.height !== canvasH) {
    console.error(`painted PNG is ${inPng.width}×${inPng.height} but template is ${canvasW}×${canvasH}.`);
    console.error(`Either (a) paint over the template at its native size, or (b) re-render the template at your size.`);
    process.exit(1);
}

console.log(`[scene ${sceneIdx}] loading palette...`);
const palette = codec.loadPalette(BASE);
const nearest = codec.buildPaletteLUT(palette);
const exact   = codec.buildExactPaletteLUT(palette);

// samples[brickIdx] = { width, height, offsetX, offsetY, counts: Array<Map<paletteIdx, count>> }
const samples = new Map();
function bucketFor(brickIdx, width, height, offsetX, offsetY) {
    let s = samples.get(brickIdx);
    if (!s) {
        s = {
            width, height, offsetX, offsetY,
            counts: new Array(width * height),
            placements: 0,
        };
        for (let i = 0; i < width * height; i++) s.counts[i] = new Map();
        samples.set(brickIdx, s);
    }
    return s;
}

function project(gx, gy, gz) {
    return {
        sx: (gx - gz) * CELL_HALF_W,
        sy: (gx + gz) * CELL_DEPTH - gy * CELL_HEIGHT,
    };
}

// Count placements per brick to give a paint-consistency denominator.
for (const p of placements.placements) {
    const s = bucketFor(p.brickIdx, p.width, p.height, p.offsetX, p.offsetY);
    s.placements++;
}

// Walk painted pixels, bucket by (brickIdx, dx, dy).
console.log(`[scene ${sceneIdx}] sampling ${canvasW * canvasH} pixels...`);
let sampled = 0, offPalette = 0, transparent = 0;
for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < canvasW; x++) {
        const pIdx = pixelMap[y * canvasW + x];
        if (pIdx < 0) continue;
        const p = placements.placements[pIdx];
        const { sx, sy } = project(p.gx, p.gy, p.gz);
        const baseX = Math.round(sx + p.offsetX + originX);
        const baseY = Math.round(sy + p.offsetY + originY);
        const dx = x - baseX, dy = y - baseY;
        if (dx < 0 || dy < 0 || dx >= p.width || dy >= p.height) continue;

        const pngOff = (y * canvasW + x) * 4;
        const r = inPng.data[pngOff], g = inPng.data[pngOff + 1],
              b = inPng.data[pngOff + 2], a = inPng.data[pngOff + 3];
        let palIdx;
        if (a < 128) { palIdx = codec.TRANSPARENT_IDX; transparent++; }
        else {
            const ex = exact(r, g, b);
            if (ex >= 0) palIdx = ex;
            else {
                offPalette++;
                if (strict) {
                    console.error(`off-palette rgb(${r},${g},${b}) at (${x},${y}) in --strict mode`);
                    process.exit(1);
                }
                palIdx = nearest(r, g, b);
            }
        }

        const s = samples.get(p.brickIdx);
        const cell = s.counts[dy * p.width + dx];
        cell.set(palIdx, (cell.get(palIdx) || 0) + 1);
        sampled++;
    }
}
console.log(`  sampled=${sampled}  offPalette=${offPalette}  transparent=${transparent}`);

// Load base BRK.
console.log(`[scene ${sceneIdx}] loading base LBA_BRK.HQR...`);
const brkBuf = fs.readFileSync(path.join(BASE, 'LBA_BRK.HQR'));
const brkAB  = brkBuf.buffer.slice(brkBuf.byteOffset, brkBuf.byteOffset + brkBuf.byteLength);
const brkHQR = HQR.fromArrayBuffer(brkAB);

// Also overlay any previously-injected bricks already in output/LBA_BRK.HQR so
// we don't stomp prior single-brick edits.
const priorOut = path.join(OUT, 'LBA_BRK.HQR');
if (fs.existsSync(priorOut)) {
    const prior = fs.readFileSync(priorOut);
    const priorAB = prior.buffer.slice(prior.byteOffset, prior.byteOffset + prior.byteLength);
    const priorHQR = HQR.fromArrayBuffer(priorAB);
    for (let i = 0; i < priorHQR.entries.length; i++) {
        if (priorHQR.entries[i]) brkHQR.entries[i] = priorHQR.entries[i];
    }
    console.log(`  overlayed prior output/LBA_BRK.HQR`);
}

// Build replacement bricks.
console.log(`[scene ${sceneIdx}] resolving ${samples.size} bricks...`);
let replaced = 0, kept = 0, missed = 0;
const consistency = [];

for (const [brickIdx, s] of samples) {
    const total = s.width * s.height;
    const pixels = new Uint8Array(total);

    // Decode original so we can keep pixels that are never visible in any
    // placement (always occluded) — otherwise we'd stamp transparency into
    // them and corrupt the brick if it ever gets revealed elsewhere.
    let origPixels = null;
    const orig = brkHQR.entries[brickIdx];
    if (orig) {
        try {
            const decoded = codec.decodeBrick(new Uint8Array(orig.content));
            if (decoded && decoded.width === s.width && decoded.height === s.height) {
                origPixels = decoded.pixels;
            }
        } catch {}
    }

    let touchedCells = 0;
    let concentratedHits = 0, totalHits = 0;
    for (let i = 0; i < total; i++) {
        const m = s.counts[i];
        if (m.size === 0) {
            pixels[i] = origPixels ? origPixels[i] : codec.TRANSPARENT_IDX;
            continue;
        }
        touchedCells++;
        let best = -1, bestCount = -1, sum = 0;
        for (const [pal, count] of m) {
            sum += count;
            if (count > bestCount) { bestCount = count; best = pal; }
        }
        pixels[i] = best;
        concentratedHits += bestCount;
        totalHits += sum;
    }
    if (!touchedCells) { missed++; continue; }
    const conc = totalHits ? (concentratedHits / totalHits) : 0;
    consistency.push({ brickIdx, placements: s.placements, consistency: conc, touched: touchedCells, total });

    // Compare to original brick — if identical, skip.
    const origEntry = brkHQR.entries[brickIdx];
    if (origEntry) {
        const origBytes = new Uint8Array(origEntry.content);
        if (origBytes.length >= 4) {
            const ow = origBytes[0], oh = origBytes[1];
            if (ow === s.width && oh === s.height) {
                // Decode original to compare pixel-wise.
                try {
                    const decoded = codec.decodeBrick(origBytes);
                    let same = decoded.pixels.length === pixels.length;
                    if (same) {
                        for (let i = 0; i < pixels.length; i++) {
                            if (decoded.pixels[i] !== pixels[i]) { same = false; break; }
                        }
                    }
                    if (same) { kept++; continue; }
                } catch {}
            }
        }
    }

    const brickBuf = encodeBrick(s.width, s.height, s.offsetX, s.offsetY, pixels);
    const ab = brickBuf.buffer.slice(brickBuf.byteOffset, brickBuf.byteOffset + brickBuf.byteLength);
    brkHQR.entries[brickIdx] = new HQREntry(ab, CompressionType.NONE);
    replaced++;
}

console.log(`  replaced=${replaced}  unchanged=${kept}  untouched=${missed}`);

// Report lowest-consistency bricks (the ones that averaged messily).
consistency.sort((a, b) => a.consistency - b.consistency);
const messy = consistency.filter(c => c.consistency < 0.75).slice(0, 10);
if (messy.length) {
    console.log(`\n  [WARN] ${messy.length} bricks with <75% paint consistency (you painted them inconsistently across instances):`);
    for (const m of messy) {
        console.log(`    brick ${String(m.brickIdx).padStart(4, '0')}  ${(m.consistency * 100).toFixed(0)}%  (${m.placements} placements)`);
    }
    console.log(`  → These appear tiled across many grid cells. The mode pixel wins, so small-minority details are dropped.`);
}

fs.mkdirSync(OUT, { recursive: true });
const outPath = path.join(OUT, 'LBA_BRK.HQR');
fs.writeFileSync(outPath, Buffer.from(brkHQR.toArrayBuffer()));
console.log(`\n[DONE] scene ${sceneIdx} → ${outPath}`);
console.log(`       run: bash scripts/build-web-bundle.sh  to rebuild the web bundle`);
