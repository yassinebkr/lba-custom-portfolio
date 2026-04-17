#!/usr/bin/env python3
"""
Disassemble RELENT.EXE's EXEC section around the suspected CD-check cluster
and hunt for references to "No CD" and friends. Goal: find the instruction
that pushes/loads the "No CD" string VA and the conditional jump that leads
there, so we can patch it to skip the check.

LE layout (verified):
  OBJ 1 EXEC  vsize=0x23a2b  base=0x10000  file=0xf000
  OBJ 2 DATA  vsize=0x1f508  base=0x40000  file=0x33000
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '_pylib'))
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

EXE  = os.path.join(os.path.dirname(__file__), '..', '..', 'base_game', 'RELENT.EXE')
data = open(EXE, 'rb').read()

EXEC_FILE = 0x0f000
EXEC_VA   = 0x10000
EXEC_SIZE = 0x23a2b

DATA_FILE = 0x33000
DATA_VA   = 0x40000
DATA_SIZE = 0x1f508

code = data[EXEC_FILE:EXEC_FILE + EXEC_SIZE]
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

# Interesting VAs (data section):
#   file 0x33172 "idNo CD\0"         -> VA 0x40172
#   file 0x33177 "No CD\0" mid       -> VA 0x40177
#   file 0x3317a "meType INSTALL\0"  -> VA 0x4017a
#   file 0x33167 "c\LBA\FLA\\\0"     -> VA 0x40167
#   file 0x3315b "dCD_LBA\0"         -> VA 0x4015b
#   file 0x33163 "rD:\0"             -> VA 0x40163
#   file 0x33220 "D:samples.hqr"     -> VA 0x40220
#   file 0x33100 "\nOK.\n"           -> VA 0x40100
INTEREST = {
    0x40172: 'idNo CD',
    0x40177: 'No CD (+3)',
    0x4017a: 'meType INSTALL',
    0x40167: 'c\\LBA\\FLA\\',
    0x4015b: 'dCD_LBA',
    0x40163: 'rD:',
    0x40100: '\\nOK.\\n',
    0x40220: 'D:samples.hqr',
}

def refers_to(ins, va_set):
    """Return list of (operand_index, va, label) if the instruction
    references any interesting data VAs — either as immediate or as
    memory displacement."""
    hits = []
    for i, op in enumerate(ins.operands):
        val = None
        if op.type == 2:  # IMM
            val = op.imm & 0xffffffff
        elif op.type == 3:  # MEM
            val = op.mem.disp & 0xffffffff
        if val is not None and val in va_set:
            hits.append((i, val, va_set[val]))
    return hits

# Walk the EXEC section linearly (Watcom-generated LE is mostly linear-ish
# code; we'll get some garbage decodes at data boundaries but that's fine).
all_refs = []
for ins in md.disasm(code, EXEC_VA):
    hits = refers_to(ins, INTEREST)
    if hits:
        all_refs.append((ins, hits))

print('=== Refs to CD/No-CD strings ===')
for ins, hits in all_refs:
    for (i, va, label) in hits:
        print(f"  0x{ins.address:x}: {ins.mnemonic:6s} {ins.op_str:40s}  -> 0x{va:x} [{label}]")

# Also search for direct refs to 0x4017X range (where 'No CD' lives) more
# broadly — the string block could be referenced at any byte within 0x40170..0x40180.
BROAD = {}
for va in range(0x40150, 0x40200):
    BROAD[va] = f'near_strings_0x{va:x}'
print('\n=== Broad refs to 0x40150..0x40200 ===')
broad_hits = []
for ins in md.disasm(code, EXEC_VA):
    hits = refers_to(ins, BROAD)
    if hits:
        broad_hits.append((ins, hits))
for ins, hits in broad_hits[:50]:
    for (i, va, label) in hits:
        print(f"  0x{ins.address:x}: {ins.mnemonic:6s} {ins.op_str:40s}  -> 0x{va:x}")
print(f"  ({len(broad_hits)} total)")

# And the \\nOK.\\n string area (0x40100..0x40110)
OK_RANGE = {va: 'OK' for va in range(0x40100, 0x40120)}
print('\n=== Refs to \\nOK.\\n area (0x40100..0x40120) ===')
for ins in md.disasm(code, EXEC_VA):
    hits = refers_to(ins, OK_RANGE)
    if hits:
        for (i, va, label) in hits:
            print(f"  0x{ins.address:x}: {ins.mnemonic:6s} {ins.op_str:40s}  -> 0x{va:x}")
