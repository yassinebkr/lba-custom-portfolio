/**
 * Patch RELENT.EXE to skip the "No CD" check and both intro FLA
 * playbacks, letting the portfolio drop the visitor straight into the
 * game world.
 *
 * All patch sites verified fixup-free via check-fixups.js — the LE loader
 * won't rewrite any bytes inside these windows at load time.
 *
 * Patch 1 — "No CD" bypass (file 0x10a5f, 13 bytes):
 *   Original: push 0x15c; call 0x2a395 (find_cd_drive); add esp, 4
 *   Replaced: mov byte [0x2c32], 3; mov eax, 1; nop
 *   Forces CD drive index = 3 ('A'+3='D') which gets written into the
 *   "D:" prefix string at 0x11a85, and forces eax != 0 so the following
 *   `test eax, eax; je 0x11ace` doesn't branch to the error block.
 *
 * Patch 2 — "Type INSTALL" skip (file 0x10af1, 2 bytes):
 *   Original: 75 0f (jne 0x11b02)
 *   Replaced: EB 0f (jmp 0x11b02)
 *   Defensive: unconditionally skip the "Type INSTALL" error branch so
 *   the outcome is independent of whatever [0x10e7a] holds at runtime.
 *
 * Patch 3 — Skip INTROD.FLA playback (file 0xf83f, 13 bytes):
 *   Original: push 0x3c; call 0x25c50 (play_fla); add esp, 4
 *   Replaced: 13× nop
 *   INTROD.FLA is 15.9 MB — including it on the CD ISO would blow
 *   through the js-dos WASM heap budget, and portfolio visitors don't
 *   need to watch a ten-minute opening cinematic.
 *
 * Patch 4 — Skip DRAGON3.FLA playback (file 0x10e71, 13 bytes):
 *   Original: push 0x264; call 0x25c50 (play_fla); add esp, 4
 *   Replaced: 13× nop
 *   DRAGON3.FLA is the "Relentless / Twinsen's Adventure" title-card
 *   cinematic. Without this patch the game spins in invalid memory
 *   reads because DRAGON3.FLA isn't on our CD ISO.
 *
 * Writes the patched binary to output/RELENT.EXE so build-bundle.js
 * overlays it without touching base_game/.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC  = path.join(ROOT, 'base_game', 'RELENT.EXE');
const OUT  = path.join(ROOT, 'output', 'RELENT.EXE');

const buf = fs.readFileSync(SRC);
console.log('Loaded RELENT.EXE size=' + buf.length);

function assertBytes(fileOff, expected, label) {
    const actual = Array.from(buf.slice(fileOff, fileOff + expected.length));
    const match = actual.every((b, i) => b === expected[i]);
    if (!match) {
        const e = expected.map(b => b.toString(16).padStart(2, '0')).join(' ');
        const a = actual.map(b => b.toString(16).padStart(2, '0')).join(' ');
        throw new Error(`${label} at file 0x${fileOff.toString(16)}: expected ${e}, got ${a}`);
    }
    console.log(`[OK] ${label} at file 0x${fileOff.toString(16)} matches pre-patch`);
}

// Patch 1: push 0x15c; call 0x2a395; add esp, 4
const PATCH1_OFF = 0x10a5f;
const PATCH1_OLD = [0x68, 0x5c, 0x01, 0x00, 0x00,
                    0xe8, 0x2c, 0x89, 0x01, 0x00,
                    0x83, 0xc4, 0x04];
const PATCH1_NEW = [0xc6, 0x05, 0x32, 0x2c, 0x00, 0x00, 0x03,  // mov byte [0x2c32], 3
                    0xb8, 0x01, 0x00, 0x00, 0x00,              // mov eax, 1
                    0x90];                                       // nop

// Patch 2: jne +0x0f -> jmp +0x0f
const PATCH2_OFF = 0x10af1;
const PATCH2_OLD = [0x75, 0x0f];
const PATCH2_NEW = [0xeb, 0x0f];

// Patch 3: NOP out `push 0x3c; call 0x25c50; add esp, 4` at 0xf83f (13 bytes)
const PATCH3_OFF = 0x0f83f;
const PATCH3_OLD = [0x68, 0x3c, 0x00, 0x00, 0x00,
                    0xe8, 0x07, 0x54, 0x01, 0x00,
                    0x83, 0xc4, 0x04];
const PATCH3_NEW = new Array(13).fill(0x90);

// Patch 4: NOP out `push 0x264; call 0x25c50; add esp, 4` at 0x10e71 (13 bytes)
const PATCH4_OFF = 0x10e71;
const PATCH4_OLD = [0x68, 0x64, 0x02, 0x00, 0x00,
                    0xe8, 0xd5, 0x3d, 0x01, 0x00,
                    0x83, 0xc4, 0x04];
const PATCH4_NEW = new Array(13).fill(0x90);

assertBytes(PATCH1_OFF, PATCH1_OLD, 'patch 1 (CD check push/call)');
assertBytes(PATCH2_OFF, PATCH2_OLD, 'patch 2 (Type INSTALL jne)');
assertBytes(PATCH3_OFF, PATCH3_OLD, 'patch 3 (INTROD.FLA play)');
assertBytes(PATCH4_OFF, PATCH4_OLD, 'patch 4 (DRAGON3.FLA play)');

PATCH1_NEW.forEach((b, i) => { buf[PATCH1_OFF + i] = b; });
PATCH2_NEW.forEach((b, i) => { buf[PATCH2_OFF + i] = b; });
PATCH3_NEW.forEach((b, i) => { buf[PATCH3_OFF + i] = b; });
PATCH4_NEW.forEach((b, i) => { buf[PATCH4_OFF + i] = b; });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
console.log('\n[WRITE] ' + OUT + ' (' + buf.length + ' bytes)');

// Readback verification
const verify = fs.readFileSync(OUT);
const hex = a => a.map(b => b.toString(16).padStart(2, '0')).join(' ');
console.log('[VERIFY] patch 1 bytes: ' + hex(Array.from(verify.slice(PATCH1_OFF, PATCH1_OFF + PATCH1_NEW.length))));
console.log('[VERIFY] patch 2 bytes: ' + hex(Array.from(verify.slice(PATCH2_OFF, PATCH2_OFF + PATCH2_NEW.length))));
console.log('[VERIFY] patch 3 bytes: ' + hex(Array.from(verify.slice(PATCH3_OFF, PATCH3_OFF + PATCH3_NEW.length))));
console.log('[VERIFY] patch 4 bytes: ' + hex(Array.from(verify.slice(PATCH4_OFF, PATCH4_OFF + PATCH4_NEW.length))));
