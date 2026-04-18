/**
 * Build scene → brick mapping by replaying twin-e's grid/BLL loader.
 *
 * Algorithm (from twin-e/src/grid.c `loadGridBricks`):
 *   For each scene N (0..119):
 *     grid = LBA_GRI.HQR[N]
 *     bll  = LBA_BLL.HQR[N]
 *     bllBits = last 32 bytes of grid (256-bit usage bitmap)
 *     for i in 1..255 where bllBits[i] is set:
 *       offset = bll[(i-1)*4 .. (i-1)*4+3] as u32
 *       layout = bll[offset..]
 *       sizeX, sizeY, sizeZ = layout[0..2]; data = layout[5..]
 *       for each of sizeX*sizeY*sizeZ cells (4 bytes each):
 *         brickIdx = u16 at start of cell
 *         if brickIdx != 0: brick (brickIdx-1) is used by scene N
 *
 * Output: metadata-ui/public/scene-bricks.json
 *   { scenes: { "N": { description, bricks: [...] } },
 *     brickToScenes: { "brickIdx": [sceneIds...] } }
 */

const { HQR } = require('@lbalab/hqr');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');

function loadHQR(name) {
    const buf = fs.readFileSync(path.join(BASE, name));
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return HQR.fromArrayBuffer(ab);
}

const gridHQR  = loadHQR('LBA_GRI.HQR');
const bllHQR   = loadHQR('LBA_BLL.HQR');
const sceneMeta = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'tools', 'metadata', 'LBA1', 'HQR', 'SCENE.HQR.json'), 'utf8'));

const NUM_SCENES = 120;

const scenes = {};
const brickToScenes = {};

function collectBricks(sceneIdx) {
    const gridEntry = gridHQR.entries[sceneIdx];
    const bllEntry  = bllHQR.entries[sceneIdx];
    if (!gridEntry || !bllEntry) return [];

    const grid = new Uint8Array(gridEntry.content);
    const bll  = new Uint8Array(bllEntry.content);
    if (grid.length < 32 || bll.length < 4) return [];

    const bllBitsOffset = grid.length - 32;
    const bllView  = new DataView(bll.buffer, bll.byteOffset, bll.byteLength);

    const used = new Set();

    for (let i = 1; i < 256; i++) {
        const byte = grid[bllBitsOffset + (i >> 3)];
        const mask = 1 << (7 - (i & 7));
        if (!(byte & mask)) continue;

        const tableOff = (i - 1) * 4;
        if (tableOff + 4 > bll.length) continue;
        const layoutOff = bllView.getUint32(tableOff, true);
        if (layoutOff + 5 > bll.length) continue;

        const sizeX = bll[layoutOff];
        const sizeY = bll[layoutOff + 1];
        const sizeZ = bll[layoutOff + 2];
        const cellCount = sizeX * sizeY * sizeZ;
        if (!cellCount || cellCount > 10000) continue;

        let ptr = layoutOff + 5;
        for (let j = 0; j < cellCount; j++) {
            if (ptr + 2 > bll.length) break;
            const brickIdx = bllView.getUint16(ptr, true);
            if (brickIdx) used.add(brickIdx - 1);
            ptr += 4;
        }
    }

    return [...used].sort((a, b) => a - b);
}

let withBricks = 0;
let totalRefs  = 0;

for (let sceneIdx = 0; sceneIdx < NUM_SCENES; sceneIdx++) {
    const bricks = collectBricks(sceneIdx);
    if (!bricks.length) continue;

    withBricks++;
    totalRefs += bricks.length;

    const desc = sceneMeta.entries[sceneIdx]?.description || `Scene ${sceneIdx}`;
    scenes[sceneIdx] = { description: desc, brickCount: bricks.length, bricks };

    for (const b of bricks) {
        (brickToScenes[b] = brickToScenes[b] || []).push(sceneIdx);
    }
}

const outPath = path.join(ROOT, 'metadata-ui', 'public', 'scene-bricks.json');
fs.writeFileSync(outPath, JSON.stringify({
    source:        'LBA_GRI.HQR + LBA_BLL.HQR',
    generatedAt:   new Date().toISOString(),
    scenesScanned: NUM_SCENES,
    scenesWithBricks: withBricks,
    totalRefs,
    scenes,
    brickToScenes,
}, null, 2));

console.log(`[DONE] ${withBricks}/${NUM_SCENES} scenes have bricks, ${totalRefs} total refs → ${outPath}`);
console.log(`       Unique bricks referenced: ${Object.keys(brickToScenes).length}`);
