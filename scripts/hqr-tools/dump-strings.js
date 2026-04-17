/**
 * Full string dump of RELENT.EXE data section (all null-terminated ASCII
 * of length ≥ 4), to map the actual runtime string table.
 */
const fs = require('fs');
const buf = fs.readFileSync('base_game/RELENT.EXE');

const DATA_START = 0x33000;
const DATA_END   = 0x33000 + 0x1f508;

const strs = [];
let start = -1;
for (let i = DATA_START; i < DATA_END; i++) {
    const b = buf[i];
    if (b >= 0x20 && b < 0x7F) {
        if (start < 0) start = i;
    } else {
        if (start >= 0 && i - start >= 4) {
            strs.push({ off: start, str: buf.toString('ascii', start, i) });
        }
        start = -1;
    }
}

// Print all strings
strs.forEach(s => {
    const va = s.off - 0x33000 + 0x40000;
    console.log('0x' + s.off.toString(16).padStart(6,'0') + ' VA=0x' + va.toString(16) + '  ' + JSON.stringify(s.str));
});
console.log('\nTotal strings: ' + strs.length);
