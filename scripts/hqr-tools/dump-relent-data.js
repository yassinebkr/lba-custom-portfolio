/**
 * Hexdump of RELENT.EXE data section near the "No CD" string, to disambiguate
 * which bytes are debug symbols vs live string literals, and to find the
 * actual C-string terminators.
 */
const fs = require('fs');
const buf = fs.readFileSync('base_game/RELENT.EXE');

function hexdump(start, len) {
    for (let off = 0; off < len; off += 16) {
        const addr = (start + off).toString(16).padStart(6, '0');
        let hex = '', ascii = '';
        for (let i = 0; i < 16; i++) {
            if (off + i >= len) break;
            const b = buf[start + off + i];
            hex += b.toString(16).padStart(2, '0') + ' ';
            ascii += (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.';
        }
        console.log(addr + '  ' + hex.padEnd(48) + ' |' + ascii + '|');
    }
}

// Virtual address of data section: file 0x33000 → VA 0x40000 (from LE obj table)
const fileToVa = off => off - 0x33000 + 0x40000;
const vaToFile = va  => va - 0x40000 + 0x33000;

console.log('── 0x33060 (CDVolume area) ──');
hexdump(0x33060, 0x40);
console.log('\n── 0x33100 (CDmidi / CD_LBA / LBA\\FLA / No CD) ──');
hexdump(0x33100, 0xA0);
console.log('\n── 0x33200 (samples.hqr area) ──');
hexdump(0x33200, 0x40);
console.log('\n── 0x33400 (LanguageCD / FlagKeepVoice area) ──');
hexdump(0x33400, 0x80);

// Now search EXECUTABLE section for 32-bit immediates that match the VA of
// "No CD" string. Watcom protected-mode uses mov reg, imm32 to load data ptrs.
// VA of "No CD" text itself depends on where it actually lives.

// Find literal "No CD\0"
const pattern = Buffer.from('No CD\0', 'ascii');
const noCdFile = buf.indexOf(pattern);
console.log('\n"No CD\\0" literal @ file 0x' + noCdFile.toString(16), 'VA 0x' + fileToVa(noCdFile).toString(16));

const typeInstPat = Buffer.from('Type INSTALL', 'ascii');
const typeInstFile = buf.indexOf(typeInstPat);
console.log('"Type INSTALL" literal @ file 0x' + typeInstFile.toString(16), 'VA 0x' + fileToVa(typeInstFile).toString(16));

const cdLbaPat = Buffer.from('CD_LBA', 'ascii');
const cdLbaFile = buf.indexOf(cdLbaPat);
console.log('"CD_LBA" literal @ file 0x' + cdLbaFile.toString(16), 'VA 0x' + fileToVa(cdLbaFile).toString(16));

const flaPathPat = Buffer.from('\\LBA\\FLA\\', 'ascii');
const flaPathFile = buf.indexOf(flaPathPat);
console.log('"\\LBA\\FLA\\" literal @ file 0x' + flaPathFile.toString(16), 'VA 0x' + fileToVa(flaPathFile).toString(16));

// Look for "c:\LBA\FLA\" format string pattern (CD check builds drive path)
const fmtPat = Buffer.from('%c:\\LBA\\', 'ascii');
const fmtFile = buf.indexOf(fmtPat);
console.log('"%c:\\LBA\\" fmt @ file 0x' + (fmtFile >= 0 ? fmtFile.toString(16) : 'none'));

// Search EXEC section (file 0xf000..0x33000) for mov reg, imm32 that match
// the target string VAs. Watcom: B8 xx xx xx xx = MOV EAX, imm32, etc.
function findImm32Refs(va) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(va, 0);
    const hits = [];
    let idx = 0xf000;
    while (idx < 0x33000) {
        const n = buf.indexOf(bytes, idx);
        if (n === -1 || n >= 0x33000) break;
        hits.push(n);
        idx = n + 1;
    }
    return hits;
}

if (noCdFile >= 0) {
    const va = fileToVa(noCdFile);
    console.log('\n── Refs to "No CD" VA 0x' + va.toString(16) + ' in .text ──');
    findImm32Refs(va).forEach(f => console.log('  file 0x' + f.toString(16)));
}
if (typeInstFile >= 0) {
    const va = fileToVa(typeInstFile);
    console.log('\n── Refs to "Type INSTALL" VA 0x' + va.toString(16) + ' in .text ──');
    findImm32Refs(va).forEach(f => console.log('  file 0x' + f.toString(16)));
}
if (flaPathFile >= 0) {
    const va = fileToVa(flaPathFile);
    console.log('\n── Refs to "\\LBA\\FLA\\" VA 0x' + va.toString(16) + ' in .text ──');
    findImm32Refs(va).forEach(f => console.log('  file 0x' + f.toString(16)));
    // Also try VA-1 (if string starts one byte earlier due to prefix)
    findImm32Refs(va - 1).forEach(f => console.log('  file 0x' + f.toString(16) + ' (VA-1)'));
}
if (cdLbaFile >= 0) {
    const va = fileToVa(cdLbaFile);
    console.log('\n── Refs to "CD_LBA" VA 0x' + va.toString(16) + ' in .text ──');
    findImm32Refs(va).forEach(f => console.log('  file 0x' + f.toString(16)));
}
