# R05.6 — Diagnosing VOX archive extraction in js-dos 8.5.4

Research date: 2026-11-14. **No copyrighted game audio, VOX banks, or
owner GOG bundles are checked in, served, or published.**

## Evidence reported by the owner

The voice bundle occupies **39.5 MiB compressed** and **44.8 MiB
unpacked**. It contains 12 VOX banks, totaling **32.1 MiB unpacked**,
and its largest bank is **10,101 KiB**.

This is well below the current 512 MiB ZIP import limit. The size
alone is insufficient to diagnose a permanent stall or out-of-memory
condition.

The js-dos 8 bundle extraction code copies the compressed ZIP into
WebAssembly memory and expands ZIP entries into emulated filesystem
storage. Multiple simultaneous copies can materially exceed the
nominal 44.8 MiB uncompressed size. This is a plausible source of
resource pressure, not evidence that available memory was exhausted.

Upstream source:
- https://github.com/caiiiycuk/emulators/blob/8.xx/src/libzip/libzip.ts
- https://github.com/caiiiycuk/emulators/blob/8.xx/native/libzip/jsdos-libzip.c
- https://github.com/caiiiycuk/js-dos/blob/8.xx/src/host/bundle-storage.ts

The literal UI string "Extracting local game files…" comes from the
legacy 6.22 importer; a loading label alone cannot establish which
backend the owner was running. On this experimental branch, the
primary local `/` portfolio route now starts js-dos 8.5.4, while
`/v6-local.html` preserves the old 6.22 reference.

## Controlled one-bank experiments

Hold these variables fixed:
- js-dos 8.5.4 DOSBox Worker backend;
- original **W_SB16.DLL 16-bit stereo**, already validated for clarity
  and correct left/right direction;
- identical patched RELENT.EXE, scene assets, HQR files and S003 save;
- identical data-only LBA.ISO and startup commands.

Change **only the amount and identity of added voice data**.
The two optional converter profiles select one bank by its *original
uncompressed file size*. The JSON output includes the chosen filename
and byte count.

~~~bash
cd ~/Documents/lba-custom-portfolio
VOX="/mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows/VOX"

# Smallest original English VOX bank: minimum extraction control
python3 scripts/runtime/prepare-jsdos8-bundle.py \
  --input output/r05-probes/r05-sb16-8.jsdos \
  --wave-driver W_SB16.DLL \
  --voices-dir "$VOX" --voice-profile smallest \
  --out output/r05-probes/r05-v8-vox-smallest.jsdos

# Largest English VOX bank: per-file size control
python3 scripts/runtime/prepare-jsdos8-bundle.py \
  --input output/r05-probes/r05-sb16-8.jsdos \
  --wave-driver W_SB16.DLL \
  --voices-dir "$VOX" --voice-profile largest \
  --out output/r05-probes/r05-v8-vox-largest.jsdos
~~~

Import one archive at a time through
`http://127.0.0.1:8765/`, using Stop emulator and a fresh page
reload between tests if needed. The already approved voice-free
`r05-v8-sb16-16bit.jsdos` is the baseline. Keep the existing full
voice archive as the third comparison case.

The main v8 player now records elapsed times for its startup phases,
and reports a *warning* if the backend has not reached ready state
after 30 seconds. The warning is **not** proof of memory exhaustion.

For diagnostics click **Copy diagnostics**, or use:

~~~javascript
JSON.stringify(window.r05V8DiagnosticReport(), null, 2)
~~~

| Observation | What it suggests | Next decision |
| --- | --- | --- |
| Smallest and largest load, full archive stalls | Cumulative memory/runtime cost or another VOX entry | Investigate total overhead or isolate a remaining bank |
| Smallest loads, largest stalls | Largest VOX entry is a candidate blocker | Inspect that entry's CRC/extraction |
| Both one-bank archives stall, voice-free baseline boots | Voice path/configuration/backend interaction, not just total size | Check bundle startup and native logs |
| All archives boot but speech remains silent | Extraction is not the playback blocker | Inspect correct language/bank and dialogue triggers |

A one-bank bundle does **not** prove that every original dialogue
line can play. Its immediate acceptance criterion is boot and
extraction, not complete spoken audio.

Do not infer that these archive tests establish voice playback, and
do not merge to main until owner-observed guest behavior is validated.
