/**
 * Locate references to the "No CD" / CD-check related strings in RELENT.EXE
 * EXEC section, then dump surrounding bytes for manual disassembly.
 *
 * LE layout (confirmed by analyze-relent.js):
 *   OBJ 1 (EXEC): file 0x0f000, VA 0x10000, size 0x23a2b
 *   OBJ 2 (DATA): file 0x33000, VA 0x40000, size 0x1f508
 *
 * String VAs (file - 0x33000 + 0x40000):
 *   "No CD"    file 0x33177 → VA 0x40177
 *   "\LBA\FLA\" file 0x33169 → VA 0x40169
 *   "CD_LBA"   file 0x3315c → VA 0x4015c
 *   "D:samples.hqr" file 0x33220 → VA 0x40220
 *   "CDVolume" file 0x33064 → VA 0x40064
 */

const fs = require('fs');
const path = require('path');

const EXE = path.resolve(__dirname, '../../base_game/RELENT.EXE');
const buf = fs.readFileSync(EXE);

const EXEC_FILE = 0x0f000;
const EXEC_VA   = 0x10000;
const EXEC_SIZE = 0x23a2b;

function findRefs(va, name) {
    const lo  = va        & 0xff;
    const b1  = (va >> 8) & 0xff;
    const b2  = (va >> 16)& 0xff;
    const b3  = (va >> 24)& 0xff;
    const needle = Buffer.from([lo, b1, b2, b3]);
    const results = [];
    const end = EXEC_FILE + EXEC_SIZE;
    let idx = EXEC_FILE;
    while (idx < end) {
        const found = buf.indexOf(needle, idx);
        if (found === -1 || found >= end) break;
        results.push(found);
        idx = found + 1;
    }
    console.log(`\nRefs to ${name} VA 0x${va.toString(16)} (bytes ${[lo,b1,b2,b3].map(b=>b.toString(16).padStart(2,'0')).join(' ')}):`);
    results.forEach(off => {
        const va_off = EXEC_VA + (off - EXEC_FILE);
        // print 16 bytes before and 16 bytes after the imm
        const start = Math.max(EXEC_FILE, off - 16);
        const ctxEnd = Math.min(end, off + 20);
        const bytes = Array.from(buf.slice(start, ctxEnd))
            .map(b => b.toString(16).padStart(2,'0')).join(' ');
        console.log(`  file=0x${off.toString(16)}  va=0x${va_off.toString(16)}`);
        console.log(`    ctx: ${bytes}`);
        // Mark the matched immediate position within the context
        const matchPos = off - start;
        const marker = ' '.repeat(matchPos * 3 + 9) + '^^^^^^^^^^^';
        console.log(marker);
    });
    return results;
}

findRefs(0x40177, '"No CD"');
findRefs(0x40169, '"\\LBA\\FLA\\"');
findRefs(0x4015c, '"CD_LBA"');
findRefs(0x40220, '"D:samples.hqr"');
findRefs(0x40177 - 2, '"No CD" offset-by-2'); // sometimes string is loaded at prefix
