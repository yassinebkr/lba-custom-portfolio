/**
 * Analyze RELENT.EXE (DOS4GW LE/LX) to find the "No CD" error path.
 *
 * Goal: locate the instruction that branches to the "No CD" message,
 * so we can patch it and skip the CD-ROM requirement entirely.
 *
 * Strategy:
 *  1. Dump all ASCII strings with file offsets
 *  2. Find "No CD" / "Type INSTALL" / "samples.hqr" / other CD-related literals
 *  3. Search for x86 instructions that load the address of those strings
 *  4. Walk backwards to find the conditional jump that leads there
 */

const fs = require('fs');
const path = require('path');

const EXE = path.resolve(__dirname, '../../base_game/RELENT.EXE');
const buf = fs.readFileSync(EXE);
console.log('RELENT.EXE size:', buf.length);

// ── LE/LX header ───────────────────────────────────────────────
// DOS stub ends at e_lfanew (0x3C), which points to PE/LE/LX header.
const lfanew = buf.readUInt32LE(0x3C);
const sig = buf.toString('ascii', lfanew, lfanew + 2);
console.log('Header @ 0x' + lfanew.toString(16) + ' signature:', sig);

// LE header layout (partial): https://faydoc.tripod.com/formats/exe-LE.htm
if (sig === 'LE' || sig === 'LX') {
    const h = lfanew;
    const eipObj      = buf.readUInt32LE(h + 0x18);  // Object # of EIP
    const eip         = buf.readUInt32LE(h + 0x1C);  // EIP offset in object
    const numObjects  = buf.readUInt32LE(h + 0x44);
    const objTableOff = buf.readUInt32LE(h + 0x40);
    const pageTableOff= buf.readUInt32LE(h + 0x48);
    const dataPagesOff= buf.readUInt32LE(h + 0x80);
    const pageSize    = buf.readUInt32LE(h + 0x28);
    console.log('  EIP obj:', eipObj, 'offset: 0x' + eip.toString(16));
    console.log('  #objects:', numObjects, 'objTable @ 0x' + (h + objTableOff).toString(16));
    console.log('  data pages @ 0x' + dataPagesOff.toString(16), 'page size:', pageSize);

    // Object table entries
    for (let i = 0; i < numObjects; i++) {
        const o = h + objTableOff + i * 24;
        const vsize    = buf.readUInt32LE(o);
        const baseAddr = buf.readUInt32LE(o + 4);
        const flags    = buf.readUInt32LE(o + 8);
        const pageMap  = buf.readUInt32LE(o + 12); // 1-based
        const numPages = buf.readUInt32LE(o + 16);
        const fileOff  = dataPagesOff + (pageMap - 1) * pageSize;
        const kind = (flags & 4) ? 'EXEC' : 'DATA';
        console.log(`  obj ${i+1}: ${kind} vsize=0x${vsize.toString(16)} base=0x${baseAddr.toString(16)} file=0x${fileOff.toString(16)} pages=${numPages} flags=0x${flags.toString(16)}`);
    }
}

// ── Find ASCII strings ─────────────────────────────────────────
function findStrings(needle) {
    const results = [];
    const re = Buffer.from(needle, 'ascii');
    let idx = 0;
    while ((idx = buf.indexOf(re, idx)) !== -1) {
        // grab some context
        let start = idx;
        while (start > 0 && buf[start - 1] >= 0x20 && buf[start - 1] < 0x7F) start--;
        let end = idx + re.length;
        while (end < buf.length && buf[end] >= 0x20 && buf[end] < 0x7F) end++;
        results.push({ offset: idx, context: buf.toString('ascii', start, end) });
        idx = end;
    }
    return results;
}

console.log('\n── Key strings ──');
['No CD', 'Type INSTALL', 'INSTALL', 'samples.hqr', 'CD_LBA', 'LBA\\FLA', 'LBA/FLA',
 'INTROD', 'CDROM', 'CDVolume', 'LanguageCD', 'FlagKeepVoice', 'FlagDisplayText']
    .forEach(s => {
        const hits = findStrings(s);
        if (hits.length) {
            console.log(`  "${s}":`);
            hits.forEach(h => console.log(`    0x${h.offset.toString(16).padStart(6,'0')}  "${h.context}"`));
        }
    });

// ── Scan for CFG option keys (Watcom strcmp patterns) ──────────
console.log('\n── All strings with "CD" substring ──');
const cdHits = findStrings('CD');
cdHits.slice(0, 30).forEach(h =>
    console.log(`  0x${h.offset.toString(16).padStart(6,'0')}  "${h.context}"`));
console.log('  (' + cdHits.length + ' total)');

console.log('\n── All strings with "Flag" substring ──');
const flagHits = findStrings('Flag');
flagHits.forEach(h =>
    console.log(`  0x${h.offset.toString(16).padStart(6,'0')}  "${h.context}"`));
