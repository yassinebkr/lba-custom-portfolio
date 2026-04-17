const fs = require('fs');
const path = require('path');
const buf = fs.readFileSync(path.resolve(__dirname, '../../base_game/RELENT.EXE'));

function search(name, va) {
    const lo = va & 0xff;
    const b1 = (va >> 8) & 0xff;
    const b2 = (va >> 16) & 0xff;
    const b3 = (va >> 24) & 0xff;
    const pat = Buffer.from([lo, b1, b2, b3]);
    const hits = [];
    let idx = 0;
    while ((idx = buf.indexOf(pat, idx)) !== -1) {
        if (idx >= 0x0f000 && idx < 0x32a2b) hits.push(idx);
        idx++;
    }
    console.log(name + ' VA=0x' + va.toString(16) + ' pat=' +
        Array.from(pat).map(b => b.toString(16).padStart(2, '0')).join(' ') +
        ' execHits=' + hits.length);
    hits.slice(0, 10).forEach(off => {
        const s = Math.max(0, off - 8), e = Math.min(buf.length, off + 12);
        const bytes = Array.from(buf.slice(s, e)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('  file=0x' + off.toString(16) + ' ctx: ' + bytes);
    });
}

search('No CD',          0x40177);
search('Type INSTALL',   0x4017e);
search('LBA/FLA',        0x40169);
search('CD_LBA',         0x4015c);
search('D:samples.hqr',  0x40220);
search('CDVolume',       0x40064);
search('CDmidi_sb.hqr',  0x4011e);
search('samples.hqr',    0x40520);
search('pre-no-CD-0x40174', 0x40174);
search('pre-no-CD-0x40160', 0x40160);
search('samples.hqr alt', 0x40521);
