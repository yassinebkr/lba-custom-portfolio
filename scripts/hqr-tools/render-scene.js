/**
 * Render a scene as one big isometric PNG with a pixel→brick placement map.
 *
 * This is the reference template you paint over. Every pixel knows which brick
 * and which grid cell (gx, gy, gz) it belongs to, so inject-scene-image.js can
 * invert your painted PNG back into per-brick stamps.
 *
 * Usage:
 *   node render-scene.js 43          # scene 43 (museum)
 *   node render-scene.js --portfolio # all 6 portfolio rooms
 *
 * Outputs per scene:
 *   output/scenes/scene-N-template.png     the flat iso render
 *   output/scenes/scene-N-placements.json  every brick stamp (in paint order)
 *   output/scenes/scene-N-pixelmap.bin     Int32 per pixel → placement index
 *
 * Projection (LBA1 dimetric, 2:1):
 *   sx = (gx - gz) * 24
 *   sy = (gx + gz) * 12 - gy * 15
 */

const { HQR } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const MOD  = path.join(ROOT, 'modded_assets', 'bricks');
const OUT  = path.join(ROOT, 'output', 'scenes');

const GRID_X = 64, GRID_Z = 64, COL_Y = 25;
const CELL_HALF_W = 24;
const CELL_DEPTH  = 12;
const CELL_HEIGHT = 15;

const PORTFOLIO_SCENES = [43, 5, 42, 54, 60, 17];

function loadHQR(name) {
    const buf = fs.readFileSync(path.join(BASE, name));
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return HQR.fromArrayBuffer(ab);
}

function project(gx, gy, gz) {
    return {
        sx: (gx - gz) * CELL_HALF_W,
        sy: (gx + gz) * CELL_DEPTH - gy * CELL_HEIGHT,
    };
}

const gridHQR = loadHQR('LBA_GRI.HQR');
const bllHQR  = loadHQR('LBA_BLL.HQR');
const brickMeta = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'modded_assets', 'bricks', '_metadata.json'), 'utf8'));
const bm = {};
for (const e of brickMeta.entries) bm[e.index] = e;

const brickCache = new Map();
function loadBrickPng(idx) {
    if (brickCache.has(idx)) return brickCache.get(idx);
    const fname = String(idx).padStart(4, '0') + '.png';
    const p = path.join(MOD, fname);
    if (!fs.existsSync(p)) { brickCache.set(idx, null); return null; }
    const png = PNG.sync.read(fs.readFileSync(p));
    brickCache.set(idx, png);
    return png;
}

function parseLayouts(grid, bll, bllV) {
    const layouts = new Map();
    for (let i = 1; i < 256; i++) {
        const byte = grid[grid.length - 32 + (i >> 3)];
        const mask = 1 << (7 - (i & 7));
        if (!(byte & mask)) continue;
        const tableOff = (i - 1) * 4;
        if (tableOff + 4 > bll.length) continue;
        const layoutOff = bllV.getUint32(tableOff, true);
        if (layoutOff + 5 > bll.length) continue;
        const sx = bll[layoutOff], sy = bll[layoutOff + 1], sz = bll[layoutOff + 2];
        const n = sx * sy * sz;
        if (!n || n > 10000) continue;
        const bricks = [];
        let p = layoutOff + 5;
        for (let lz = 0; lz < sz; lz++) {
            for (let ly = 0; ly < sy; ly++) {
                for (let lx = 0; lx < sx; lx++) {
                    if (p + 2 > bll.length) break;
                    const b = bllV.getUint16(p, true);
                    if (b) bricks.push({ lx, ly, lz, idx: b - 1 });
                    p += 4;
                }
            }
        }
        layouts.set(i, { sx, sy, sz, bricks });
    }
    return layouts;
}

function collectPlacements(grid, gridV, layouts) {
    const placements = [];
    for (let z = 0; z < GRID_Z; z++) {
        for (let x = 0; x < GRID_X; x++) {
            const colOff = gridV.getUint16(2 * (x + z * 64), true);
            let p = colOff;
            if (p >= grid.length - 32) continue;
            const blockCount = grid[p++];
            let y = 0;
            const stamp = (g) => {
                if (!g || y >= COL_Y) return;
                const L = layouts.get(g);
                if (!L) return;
                for (const b of L.bricks) {
                    placements.push({
                        gx: x + b.lx, gy: y + b.ly, gz: z + b.lz,
                        brickIdx: b.idx,
                    });
                }
            };
            for (let blk = 0; blk < blockCount; blk++) {
                if (p >= grid.length) break;
                const flag = grid[p++];
                const cnt  = (flag & 0x3F) + 1;
                if (!(flag & 0xC0)) {
                    y += cnt;
                } else if (flag & 0x40) {
                    for (let k = 0; k < cnt; k++) {
                        if (p + 2 > grid.length) break;
                        const g = gridV.getUint16(p, true); p += 2;
                        stamp(g); y++;
                    }
                } else {
                    if (p + 2 > grid.length) break;
                    const g = gridV.getUint16(p, true); p += 2;
                    for (let k = 0; k < cnt; k++) { stamp(g); y++; }
                }
            }
        }
    }
    return placements;
}

function renderScene(sceneIdx) {
    const gridEntry = gridHQR.entries[sceneIdx];
    const bllEntry  = bllHQR.entries[sceneIdx];
    if (!gridEntry || !bllEntry) { console.log(`scene ${sceneIdx}: no data`); return; }

    const grid = new Uint8Array(gridEntry.content);
    const bll  = new Uint8Array(bllEntry.content);
    const gridV = new DataView(grid.buffer, grid.byteOffset, grid.byteLength);
    const bllV  = new DataView(bll.buffer, bll.byteOffset, bll.byteLength);

    const layouts = parseLayouts(grid, bll, bllV);
    const placements = collectPlacements(grid, gridV, layouts);
    console.log(`scene ${sceneIdx}: ${placements.length} placements, ${layouts.size} layouts`);

    // Painter's order: back-to-front by depth (gx+gz), then bottom-to-top by gy.
    placements.sort((a, b) => {
        const pa = a.gx + a.gz, pb = b.gx + b.gz;
        if (pa !== pb) return pa - pb;
        return a.gy - b.gy;
    });

    // Bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of placements) {
        const m = bm[p.brickIdx];
        if (!m) continue;
        const { sx, sy } = project(p.gx, p.gy, p.gz);
        const px = sx + (m.offsetX || 0);
        const py = sy + (m.offsetY || 0);
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px + m.width  > maxX) maxX = px + m.width;
        if (py + m.height > maxY) maxY = py + m.height;
    }
    if (!isFinite(minX)) { console.log(`  no renderable placements`); return; }

    const PAD = 16;
    const canvasW = Math.ceil(maxX - minX) + PAD * 2;
    const canvasH = Math.ceil(maxY - minY) + PAD * 2;
    const originX = -minX + PAD;
    const originY = -minY + PAD;
    console.log(`  canvas: ${canvasW}x${canvasH}`);

    const pngOut = new PNG({ width: canvasW, height: canvasH });
    pngOut.data.fill(0);
    const pixelMap = new Int32Array(canvasW * canvasH).fill(-1);

    for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        const m = bm[p.brickIdx];
        if (!m) continue;
        const brickPng = loadBrickPng(p.brickIdx);
        if (!brickPng) continue;
        const { sx, sy } = project(p.gx, p.gy, p.gz);
        const baseX = Math.round(sx + (m.offsetX || 0) + originX);
        const baseY = Math.round(sy + (m.offsetY || 0) + originY);
        const bw = brickPng.width;
        const bh = brickPng.height;
        for (let dy = 0; dy < bh; dy++) {
            const yy = baseY + dy;
            if (yy < 0 || yy >= canvasH) continue;
            for (let dx = 0; dx < bw; dx++) {
                const xx = baseX + dx;
                if (xx < 0 || xx >= canvasW) continue;
                const srcIdx = (dy * bw + dx) * 4;
                if (brickPng.data[srcIdx + 3] < 128) continue;
                const dstIdx = (yy * canvasW + xx) * 4;
                pngOut.data[dstIdx]     = brickPng.data[srcIdx];
                pngOut.data[dstIdx + 1] = brickPng.data[srcIdx + 1];
                pngOut.data[dstIdx + 2] = brickPng.data[srcIdx + 2];
                pngOut.data[dstIdx + 3] = 255;
                pixelMap[yy * canvasW + xx] = i;
            }
        }
    }

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `scene-${sceneIdx}-template.png`), PNG.sync.write(pngOut));
    fs.writeFileSync(path.join(OUT, `scene-${sceneIdx}-placements.json`),
        JSON.stringify({
            sceneIdx, canvasW, canvasH, padding: PAD,
            originX, originY,
            projection: { CELL_HALF_W, CELL_DEPTH, CELL_HEIGHT },
            placements: placements.map(p => ({
                gx: p.gx, gy: p.gy, gz: p.gz, brickIdx: p.brickIdx,
                width: bm[p.brickIdx]?.width,
                height: bm[p.brickIdx]?.height,
                offsetX: bm[p.brickIdx]?.offsetX || 0,
                offsetY: bm[p.brickIdx]?.offsetY || 0,
                bucket: bm[p.brickIdx]?.bucket,
            })),
        }, null, 2));
    fs.writeFileSync(path.join(OUT, `scene-${sceneIdx}-pixelmap.bin`),
        Buffer.from(pixelMap.buffer));

    console.log(`  [OK] scene-${sceneIdx}-template.png (${canvasW}x${canvasH})`);
}

const args = process.argv.slice(2);
if (args.includes('--portfolio')) {
    for (const s of PORTFOLIO_SCENES) renderScene(s);
} else {
    const s = args.find(a => /^\d+$/.test(a));
    renderScene(s ? parseInt(s, 10) : 43);
}
