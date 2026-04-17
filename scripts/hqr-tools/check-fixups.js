/**
 * Dump every LE fixup record whose source location falls inside
 * the CD-check code window [0x10a5f .. 0x10a90] (file offsets).
 *
 * Goal: figure out whether the LE loader will overwrite bytes inside
 * patch-relent.js's patch at load time, silently corrupting the patch.
 */

const fs = require('fs');
const path = require('path');

const EXE = path.resolve(__dirname, '../../base_game/RELENT.EXE');
const buf = fs.readFileSync(EXE);

const lfanew = buf.readUInt32LE(0x3C);
const h = lfanew;

const pageSize     = buf.readUInt32LE(h + 0x28);
const objTableOff  = buf.readUInt32LE(h + 0x40);
const numObjects   = buf.readUInt32LE(h + 0x44);
const fixPageOff   = buf.readUInt32LE(h + 0x68);
const fixRecOff    = buf.readUInt32LE(h + 0x6c);
const dataPagesOff = buf.readUInt32LE(h + 0x80);

const objects = [];
for (let i = 0; i < numObjects; i++) {
    const o = h + objTableOff + i * 24;
    objects.push({
        vsize:    buf.readUInt32LE(o),
        base:     buf.readUInt32LE(o + 4),
        flags:    buf.readUInt32LE(o + 8),
        numPages: buf.readUInt32LE(o + 16),
        fileOff:  dataPagesOff + (buf.readUInt32LE(o + 12) - 1) * pageSize,
    });
}

const totalPages = objects.reduce((s, o) => s + o.numPages, 0);
const pageFixOffsets = [];
for (let i = 0; i <= totalPages; i++) {
    pageFixOffsets.push(buf.readUInt32LE(h + fixPageOff + i * 4));
}

function pageToObject(pageIdx1) {
    let cum = 0;
    for (const obj of objects) {
        if (pageIdx1 <= cum + obj.numPages) {
            return { obj, pageInObj: pageIdx1 - cum };
        }
        cum += obj.numPages;
    }
    return null;
}

const WINDOWS = [
    [0x10a5f, 0x10a90, 'patch1 CD check'],
    [0x0f83f, 0x0f84c, 'INTROD FLA call'],
    [0x10e71, 0x10e7e, 'DRAGON3 FLA call'],
];
const WINDOW_LO = Math.min(...WINDOWS.map(w => w[0]));
const WINDOW_HI = Math.max(...WINDOWS.map(w => w[1]));

const hits = [];

for (let p = 1; p <= totalPages; p++) {
    const pi = pageToObject(p);
    if (!pi || !(pi.obj.flags & 4)) continue;
    const pageFileStart = pi.obj.fileOff + (pi.pageInObj - 1) * pageSize;
    if (pageFileStart + pageSize < WINDOW_LO) continue;
    if (pageFileStart > WINDOW_HI) continue;

    const start = h + fixRecOff + pageFixOffsets[p - 1];
    const end   = h + fixRecOff + pageFixOffsets[p];
    let pos = start;
    while (pos < end) {
        const recStart = pos;
        const src = buf[pos];
        const tgt = buf[pos + 1];
        pos += 2;
        const srcType  = src & 0x0f;
        const srcList  = (src & 0x20) !== 0;
        const tgtType  = tgt & 0x03;
        const tgtObj16 = (tgt & 0x40) !== 0;
        const addOn    = (tgt & 0x04) !== 0;

        const srcOff = buf.readInt16LE(pos);
        pos += 2;

        if (srcList) {
            const n = buf[pos];
            pos += 1 + n * 2;
        }

        if (tgtType === 0) {
            const objNum = tgtObj16 ? buf.readUInt16LE(pos) : buf[pos];
            pos += tgtObj16 ? 2 : 1;
            let targetOff;
            if      (srcType === 0x07) { targetOff = buf.readUInt32LE(pos); pos += 4; }
            else if (srcType === 0x05 || srcType === 0x02) { targetOff = buf.readUInt16LE(pos); pos += 2; }
            else if (srcType === 0x06 || srcType === 0x08) { targetOff = buf.readUInt32LE(pos); pos += 4; }
            else if (srcType === 0x00) { targetOff = buf[pos]; pos += 1; }
            else break;
            if (addOn) pos += 4;

            const srcFileOff = pageFileStart + srcOff;
            if (srcFileOff >= WINDOW_LO && srcFileOff < WINDOW_HI) {
                hits.push({
                    recStart: recStart - h,
                    srcFileOff,
                    srcType,
                    targetObj: objNum,
                    targetOff,
                });
            }
        } else if (tgtType === 1) {
            pos += tgtObj16 ? 2 : 1;
            if (srcType === 0x07) pos += 4;
            else pos += 2;
        } else if (tgtType === 2) {
            pos += tgtObj16 ? 2 : 1;
            pos += 2;
        } else if (tgtType === 3) {
            pos += 2;
        } else {
            break;
        }
    }
}

WINDOWS.forEach(([lo, hi, name]) => {
    const winHits = hits.filter(h => h.srcFileOff >= lo && h.srcFileOff < hi);
    console.log(`\n[${name}]  [0x${lo.toString(16)} .. 0x${hi.toString(16)})  hits=${winHits.length}`);
    winHits.forEach(h => {
        const srcBytes = Array.from(buf.slice(h.srcFileOff, h.srcFileOff + 4))
            .map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  src file=0x${h.srcFileOff.toString(16)}  srcType=0x${h.srcType.toString(16)}  ` +
                    `target=obj${h.targetObj}+0x${h.targetOff.toString(16)}  bytes=${srcBytes}`);
    });
});
