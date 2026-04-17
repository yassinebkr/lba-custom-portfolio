/**
 * Parse the LE fixup table of RELENT.EXE to find instructions that load
 * "No CD" and related string addresses. LE files store addresses via
 * fixup records rather than inline immediates, so find-nocd-refs.js (which
 * searched for raw VA bytes) came up empty.
 *
 * LE header layout (relevant offsets, from LE-signature base h):
 *   h + 0x28: page size
 *   h + 0x40: object table offset
 *   h + 0x44: object count
 *   h + 0x48: object page-map table offset
 *   h + 0x68: fixup page table offset
 *   h + 0x6c: fixup record table offset
 *   h + 0x80: data pages file offset
 *
 * Fixup page table: (numPages + 1) dwords, each the byte offset into the
 * fixup record table where that page's fixup records begin.
 *
 * Fixup record format (for internal 32-bit offset targets, the common case):
 *   src (1 byte):
 *     low nibble = source type:
 *       0x02 = 16-bit selector
 *       0x05 = 16-bit offset
 *       0x06 = 16:16 pointer
 *       0x07 = 32-bit offset    <-- interesting
 *       0x08 = 48-bit pointer
 *     bit 0x10 = source list
 *     bit 0x20 = 32-bit target offset (else 16-bit)
 *     bit 0x40 = additive
 *   tgt (1 byte):
 *     low nibble = target type:
 *       0 = internal ref (same module)   <-- interesting
 *       1 = imported by ordinal
 *       2 = imported by name
 *       3 = internal entry table
 *     bit 0x10 = additive value
 *     bit 0x20 = target object/ordinal word (else byte)
 *     bit 0x40 = 32-bit target offset (else 16-bit)
 *   src_off (word): offset within source page
 *   (if source list: count byte then list of offsets — skip for now)
 *   target data:
 *     object_num: byte or word (per tgt 0x20)
 *     target_offset: word or dword (per tgt 0x40)
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
const pageMapOff   = buf.readUInt32LE(h + 0x48);
const fixPageOff   = buf.readUInt32LE(h + 0x68);
const fixRecOff    = buf.readUInt32LE(h + 0x6c);
const dataPagesOff = buf.readUInt32LE(h + 0x80);
const mpages       = buf.readUInt32LE(h + 0x10);

console.log('LE @ 0x' + h.toString(16));
console.log('  pageSize     = 0x' + pageSize.toString(16));
console.log('  num memory pages = ' + mpages);
console.log('  objTable @ 0x' + (h + objTableOff).toString(16) + ' (' + numObjects + ' objects)');
console.log('  fixPage  @ 0x' + (h + fixPageOff).toString(16));
console.log('  fixRec   @ 0x' + (h + fixRecOff).toString(16));
console.log('  dataPages @ 0x' + dataPagesOff.toString(16));

// ── Object table ──
const objects = [];
for (let i = 0; i < numObjects; i++) {
    const o = h + objTableOff + i * 24;
    objects.push({
        num:      i + 1,
        vsize:    buf.readUInt32LE(o),
        base:     buf.readUInt32LE(o + 4),
        flags:    buf.readUInt32LE(o + 8),
        pageMap:  buf.readUInt32LE(o + 12),
        numPages: buf.readUInt32LE(o + 16),
        fileOff:  dataPagesOff + (buf.readUInt32LE(o + 12) - 1) * pageSize,
    });
}
objects.forEach(o => {
    const kind = (o.flags & 4) ? 'EXEC' : 'DATA';
    console.log(`  obj ${o.num} ${kind} vsize=0x${o.vsize.toString(16)} base=0x${o.base.toString(16)} file=0x${o.fileOff.toString(16)} pages=${o.numPages}`);
});

// ── Fixup page table ──
// (numPages+1) dwords — each is an offset from fixRecOff to where that
// page's fixups start. Total pages = sum of all object page counts.
const totalPages = objects.reduce((s, o) => s + o.numPages, 0);
console.log('Total pages for fixup table: ' + totalPages);

const pageFixOffsets = [];
for (let i = 0; i <= totalPages; i++) {
    pageFixOffsets.push(buf.readUInt32LE(h + fixPageOff + i * 4));
}

// ── Walk fixups per page ──
// Map page index → object number. Pages are indexed 1..totalPages in the
// order objects appear in the object table.
function pageToObject(pageIdx1) {
    let cum = 0;
    for (const obj of objects) {
        if (pageIdx1 <= cum + obj.numPages) {
            return { obj, pageInObj: pageIdx1 - cum }; // 1-based
        }
        cum += obj.numPages;
    }
    return null;
}

// Targets we care about: internal refs into obj 2 (DATA) at these offsets
const dataObj = objects[1]; // second object
const TARGETS = {
    0x177: '"No CD"',
    0x175: 'anything with "id\\0No CD"',
    0x179: '"o CD" mid',
    0x169: '"\\LBA\\FLA\\"',
    0x15c: '"CD_LBA"',
    0x168: 'c\\LBA\\FLA',
    0x220: '"D:samples.hqr"',
    0x520: '"samples.hqr"',
    0x064: '"CDVolume"',
    0x11e: '"CDmidi_sb.hqr"',
};

const matches = [];

for (let p = 1; p <= totalPages; p++) {
    const start = h + fixRecOff + pageFixOffsets[p - 1];
    const end   = h + fixRecOff + pageFixOffsets[p];
    let pos = start;
    while (pos < end) {
        if (pos >= buf.length) break;
        const src = buf[pos];
        const tgt = buf[pos + 1];
        pos += 2;

        const srcType = src & 0x0f;
        const srcList = (src & 0x20) !== 0;
        const tgtType = tgt & 0x03;
        const tgtObj16 = (tgt & 0x40) !== 0;  // object number word vs byte
        const tgtOff32 = (tgt & 0x10) !== 0;  // 32-bit target offset vs 16-bit
        const addOn    = (tgt & 0x04) !== 0;  // additive

        // source offset (word, signed, relative to page start)
        const srcOff = buf.readInt16LE(pos);
        pos += 2;

        // srcList: one-byte count of additional source offsets, each word
        let extraSources = 0;
        if (srcList) {
            // Can't find reliable docs — skip for now, likely not common
            console.log('  (source list encountered at page ' + p + ')');
            extraSources = buf[pos];
            pos += 1 + extraSources * 2;
        }

        if (tgtType !== 0) {
            // Only handle internal refs. Still need to skip past record body.
            // Imported by ordinal/name have different bodies; we stop parsing
            // this record gracefully by bailing.
            // Imported by ordinal: module_num (byte/word) + import_ord (byte/word/dword)
            // Imported by name:    module_num (byte/word) + proc_name (word)
            if (tgtType === 1) {
                // imported by ordinal
                pos += tgtObj16 ? 2 : 1;          // module index
                // ordinal size: for 8-bit source or 16-bit selector: byte; else word/dword
                if (srcType === 0x07) pos += tgtOff32 ? 4 : 2;
                else                   pos += 2;
            } else if (tgtType === 2) {
                // imported by name
                pos += tgtObj16 ? 2 : 1;          // module index
                pos += 2;                          // proc name offset
            } else if (tgtType === 3) {
                // internal via entry table
                pos += 2;                          // ord
            } else {
                // unknown — bail
                break;
            }
            continue;
        }

        // Internal ref: object number (byte or word) + offset (byte/word/dword
        // depending on src type)
        const objNum = tgtObj16 ? buf.readUInt16LE(pos) : buf[pos];
        pos += tgtObj16 ? 2 : 1;

        let targetOff;
        // For 32-bit source offset (srcType 0x07), target offset matches srcType unless
        // tgt 0x10 overrides. Simplest: if srcType == 0x07, read dword.
        if (srcType === 0x00) {
            // byte fixup — unusual
            targetOff = buf[pos]; pos += 1;
        } else if (srcType === 0x05 || srcType === 0x02) {
            targetOff = buf.readUInt16LE(pos); pos += 2;
        } else if (srcType === 0x07) {
            targetOff = buf.readUInt32LE(pos); pos += 4;
        } else if (srcType === 0x06 || srcType === 0x08) {
            targetOff = buf.readUInt32LE(pos); pos += 4;
        } else {
            // unknown source — skip conservatively
            break;
        }

        if (addOn) pos += 4; // additive value dword

        // Is this a hit?
        if (objNum === 2 && TARGETS[targetOff]) {
            // Compute source file offset from page index + srcOff
            const pi = pageToObject(p);
            if (pi && pi.obj.flags & 4) {
                const srcFileOff = pi.obj.fileOff + (pi.pageInObj - 1) * pageSize + srcOff;
                matches.push({
                    obj: objNum,
                    targetOff,
                    targetName: TARGETS[targetOff],
                    srcFileOff,
                    srcVA: pi.obj.base + (pi.pageInObj - 1) * pageSize + srcOff,
                    page: p,
                    srcOffInPage: srcOff,
                });
            }
        }
    }
}

console.log('\n=== Matches ===');
matches.forEach(m => {
    const ctxStart = Math.max(0, m.srcFileOff - 16);
    const ctxEnd   = Math.min(buf.length, m.srcFileOff + 20);
    const bytes = Array.from(buf.slice(ctxStart, ctxEnd))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
    const markerPos = m.srcFileOff - ctxStart;
    console.log(`obj=${m.obj} +0x${m.targetOff.toString(16)} ${m.targetName}`);
    console.log(`  src file=0x${m.srcFileOff.toString(16)}  VA=0x${m.srcVA.toString(16)}`);
    console.log(`  ctx [16 before, 4 at src, 16 after]:`);
    console.log(`  ${bytes}`);
    console.log(`  ${' '.repeat(markerPos * 3)}^^^^^^^^^^^`);
});
console.log('\nTotal matches: ' + matches.length);
