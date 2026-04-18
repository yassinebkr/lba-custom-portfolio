/**
 * Rank bricks by actual render-occurrences in a scene, not just presence.
 * Replays twin-e's createGridMap to count how many times each brick is placed
 * in the final 3D room — tells you which bricks are "the floor", "the wall",
 * "the pillar" vs incidental decoration.
 *
 * Usage:
 *   node analyze-scene-bricks.js 43           # one scene, top 20
 *   node analyze-scene-bricks.js 43 --top 50  # one scene, top 50
 *   node analyze-scene-bricks.js --portfolio  # all 6 portfolio rooms, top 10 each
 */

const { HQR } = require('@lbalab/hqr');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');

const PORTFOLIO_SCENES = [
    { id: 43, label: 'Museum (hub)' },
    { id: 5,  label: "Twinsen's house" },
    { id: 42, label: 'Proxim City (CinePi)' },
    { id: 54, label: "Inventor's house" },
    { id: 60, label: 'Rebel camp (GSAT)' },
    { id: 17, label: 'Ruins (OpenClaw)' },
];

function loadHQR(name) {
    const buf = fs.readFileSync(path.join(BASE, name));
    return HQR.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const gridHQR = loadHQR('LBA_GRI.HQR');
const bllHQR  = loadHQR('LBA_BLL.HQR');
const brickMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'modded_assets', 'bricks', '_metadata.json'), 'utf8'));
const bm = {};
for (const e of brickMeta.entries) bm[e.index] = e;

const GRID_X = 64, GRID_Z = 64, COL_Y = 25;

function analyze(sceneIdx) {
    const gridEntry = gridHQR.entries[sceneIdx];
    const bllEntry  = bllHQR.entries[sceneIdx];
    if (!gridEntry || !bllEntry) return null;

    const grid = new Uint8Array(gridEntry.content);
    const bll  = new Uint8Array(bllEntry.content);
    if (grid.length < 32) return null;

    const bllV  = new DataView(bll.buffer,  bll.byteOffset,  bll.byteLength);
    const gridV = new DataView(grid.buffer, grid.byteOffset, grid.byteLength);

    // Layout idx → list of brick indices (one per cell in the layout volume)
    const layoutBricks = new Map();
    for (let i = 1; i < 256; i++) {
        const tableOff = (i - 1) * 4;
        if (tableOff + 4 > bll.length) break;
        const layoutOff = bllV.getUint32(tableOff, true);
        if (layoutOff + 5 > bll.length) continue;
        const sx = bll[layoutOff], sy = bll[layoutOff + 1], sz = bll[layoutOff + 2];
        const n = sx * sy * sz;
        if (n <= 0 || n > 10000) continue;
        const bricks = [];
        let p = layoutOff + 5;
        for (let j = 0; j < n; j++) {
            const b = bllV.getUint16(p, true);
            if (b) bricks.push(b - 1);
            p += 4;
        }
        layoutBricks.set(i, bricks);
    }

    const occur = new Map();
    for (let z = 0; z < GRID_Z; z++) {
        const rowBase = z << 6;
        for (let x = 0; x < GRID_X; x++) {
            const colOff = gridV.getUint16(2 * (x + rowBase), true);
            let p = colOff;
            if (p >= grid.length - 32) continue;
            const blockCount = grid[p++];
            const column = new Array(COL_Y).fill(0);
            let y = 0;
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
                        if (y < COL_Y) column[y++] = g;
                    }
                } else {
                    if (p + 2 > grid.length) break;
                    const g = gridV.getUint16(p, true); p += 2;
                    for (let k = 0; k < cnt; k++) {
                        if (y < COL_Y) column[y++] = g;
                    }
                }
            }
            for (let yy = 0; yy < COL_Y; yy++) {
                const gIdx = column[yy];
                if (!gIdx) continue;
                const bricks = layoutBricks.get(gIdx);
                if (!bricks) continue;
                for (const b of bricks) occur.set(b, (occur.get(b) || 0) + 1);
            }
        }
    }

    const sorted = [...occur.entries()].sort((a, b) => b[1] - a[1]);
    const total  = [...occur.values()].reduce((a, b) => a + b, 0);
    return { total, unique: sorted.length, sorted };
}

function printTop(sceneIdx, label, top, leverage) {
    const result = analyze(sceneIdx);
    if (!result) { console.log(`Scene ${sceneIdx}: no grid data`); return; }
    console.log(`\n=== Scene ${sceneIdx} (${label}) ===`);
    console.log(`   ${result.total} brick occurrences across ${result.unique} unique bricks\n`);
    console.log('  rank  #brk   occur   % scene   dims       bucket');
    console.log('  ----  -----  ------  -------   --------   --------');
    let cumul = 0;
    for (let i = 0; i < Math.min(top, result.sorted.length); i++) {
        const [idx, count] = result.sorted[i];
        const m = bm[idx];
        const pct = ((count / result.total) * 100).toFixed(1);
        cumul += count;
        console.log(
            '  ' + String(i + 1).padStart(4) + '  ' +
            String(idx).padStart(4, '0').padEnd(5) + '  ' +
            String(count).padStart(6) + '  ' +
            (pct + '%').padStart(7) + '   ' +
            (m ? m.width + 'x' + m.height : '?').padEnd(8) + '   ' +
            (m ? m.bucket : '?'),
        );
    }
    if (leverage) {
        const leveragePct = ((cumul / result.total) * 100).toFixed(1);
        console.log(`\n  → Editing top ${top} bricks covers ${leveragePct}% of the scene's visual volume.`);
    }
}

const args = process.argv.slice(2);
const topFlag = args.indexOf('--top');
const top = topFlag >= 0 ? parseInt(args[topFlag + 1], 10) : 20;

if (args.includes('--portfolio')) {
    for (const s of PORTFOLIO_SCENES) printTop(s.id, s.label, 10, true);
} else {
    const sceneArg = args.find(a => /^\d+$/.test(a));
    const sceneIdx = sceneArg ? parseInt(sceneArg, 10) : 43;
    const label = PORTFOLIO_SCENES.find(s => s.id === sceneIdx)?.label || `Scene ${sceneIdx}`;
    printTop(sceneIdx, label, top, true);
}
