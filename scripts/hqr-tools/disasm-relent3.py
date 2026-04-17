#!/usr/bin/env python3
"""
Full disassembly of the CD-check region in RELENT.EXE.
Dumps instructions from VA 0x11a00 to 0x11e20 linearly so we can see the
full control flow around the CD check and "No CD" print call.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '_pylib'))
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

EXE = os.path.join(os.path.dirname(__file__), '..', '..', 'base_game', 'RELENT.EXE')
data = open(EXE, 'rb').read()
EXEC_FILE = 0x0f000
EXEC_VA   = 0x10000
code = data[EXEC_FILE:EXEC_FILE + 0x23a2b]

md = Cs(CS_ARCH_X86, CS_MODE_32)

START_VA = 0x11a00
END_VA   = 0x11e20

offset = START_VA - EXEC_VA
for ins in md.disasm(code[offset:END_VA - EXEC_VA], START_VA):
    if ins.address >= END_VA:
        break
    bytes_hex = ' '.join(f'{b:02x}' for b in ins.bytes)
    print(f"0x{ins.address:05x}  {bytes_hex:24s}  {ins.mnemonic:6s} {ins.op_str}")
