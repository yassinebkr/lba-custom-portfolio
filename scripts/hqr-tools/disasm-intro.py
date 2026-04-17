#!/usr/bin/env python3
"""
Find code referencing the "DRAGON3" and "INTROD" strings in RELENT.EXE
and dump the surrounding disassembly. These strings are at obj2 offsets
0x3c (INTROD) and 0x264/0x4e4 (DRAGON3). In LE files with 32-bit pushes,
the compiler emits `push 0x3c` etc. with small immediates that can collide
with many unrelated integers — so we also scan for PUSH small-imm followed
by a CALL, which is the calling convention for the FLA player.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '_pylib'))
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

EXE = os.path.join(os.path.dirname(__file__), '..', '..', 'base_game', 'RELENT.EXE')
data = open(EXE, 'rb').read()
EXEC_FILE = 0x0f000
EXEC_VA   = 0x10000
EXEC_SIZE = 0x23a2b
code = data[EXEC_FILE:EXEC_FILE + EXEC_SIZE]

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

# Obj2 offsets of interest (small immediates that the compiler pushes):
STRINGS = {
    0x3c:  'INTROD',
    0x264: 'DRAGON3 (first)',
    0x4e4: 'DRAGON3 (second)',
    0x2aa: 'Scene.Hqr introuvable',
    0x578: 'ADELINE',
}

interesting = set(STRINGS.keys())
hits = []

for ins in md.disasm(code, EXEC_VA):
    for op in ins.operands:
        val = None
        if op.type == 2:  # IMM
            val = op.imm & 0xffffffff
        elif op.type == 3:  # MEM
            val = op.mem.disp & 0xffffffff
        if val in interesting:
            hits.append((ins, val, STRINGS[val]))
            break

for ins, val, name in hits:
    print(f"0x{ins.address:06x}  {ins.mnemonic:6s} {ins.op_str:40s}  -> {name}")

print()
print('=== Disasm around each DRAGON3/INTROD push (30 bytes back, 60 forward) ===')
for ins, val, name in hits:
    if 'DRAGON3' in name or 'INTROD' in name:
        print(f"\n--- {name} push at 0x{ins.address:x} ---")
        start = ins.address - 30
        end   = ins.address + 60
        off = start - EXEC_VA
        for i in md.disasm(code[off:end - EXEC_VA], start):
            marker = '  >' if i.address == ins.address else '   '
            bytes_hex = ' '.join(f'{b:02x}' for b in i.bytes)
            print(f"{marker} 0x{i.address:05x}  {bytes_hex:20s}  {i.mnemonic:6s} {i.op_str}")
