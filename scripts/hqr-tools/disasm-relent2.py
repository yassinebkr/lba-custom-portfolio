#!/usr/bin/env python3
"""
Hunt for CD-check code by looking at instructions that reference small
displacements in the 0x100..0x300 range — these are likely string offsets
relative to a data-segment base register. Watcom DOS4GW loads the data
object base into a register (commonly EBX or a read-only thunk) and then
accesses strings via [reg + disp32].
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '_pylib'))
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from capstone.x86 import X86_OP_IMM, X86_OP_MEM

EXE = os.path.join(os.path.dirname(__file__), '..', '..', 'base_game', 'RELENT.EXE')
data = open(EXE, 'rb').read()
EXEC_FILE = 0x0f000
EXEC_VA   = 0x10000
EXEC_SIZE = 0x23a2b
code = data[EXEC_FILE:EXEC_FILE + EXEC_SIZE]

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

# Suspect string offsets (within data obj 2, base 0x40000):
STRINGS = {
    0x100: '\\nOK.\\n',
    0x15b: 'dCD_LBA',
    0x15c: 'CD_LBA',
    0x163: 'rD:',
    0x164: 'D:',
    0x167: 'c\\LBA\\FLA\\',
    0x168: '\\LBA\\FLA\\',
    0x172: 'idNo CD',
    0x174: 'No CD',
    0x177: 'No CD (+3)',
    0x17a: 'meType INSTALL',
    0x17c: 'Type INSTALL',
    0x220: 'D:samples.hqr',
    0x222: 'samples.hqr',
    0x520: 'samples.hqr (tail)',
    0x064: 'CDVolume',
    0x11e: 'CDmidi_sb.hqr',
}

interesting_disps = set(STRINGS.keys())

hits = []
for ins in md.disasm(code, EXEC_VA):
    for op in ins.operands:
        val = None
        if op.type == X86_OP_IMM:
            val = op.imm & 0xffffffff
        elif op.type == X86_OP_MEM:
            val = op.mem.disp & 0xffffffff
        if val in interesting_disps:
            hits.append((ins, val, STRINGS[val]))
            break

# Bucket by the string hit to see distribution
from collections import defaultdict
by_str = defaultdict(list)
for ins, val, name in hits:
    by_str[name].append(ins)

for name, inss in sorted(by_str.items(), key=lambda x: x[0]):
    print(f"=== {name} ({len(inss)} hits) ===")
    for ins in inss[:20]:
        print(f"  0x{ins.address:x}: {ins.mnemonic:6s} {ins.op_str}")
    if len(inss) > 20:
        print(f"  ... {len(inss)-20} more")
