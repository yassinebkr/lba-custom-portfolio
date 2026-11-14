# R05.8 — Discriminate checkpoint respawn from terminal Game Over

Status: diagnostic implementation, **not** a fix of death or Game Over.
Source of truth: original DOS engine code and owner-local game execution;
synthetic CI can only confirm probe construction and browser instrumentation.
Keep all commercial game archives under the Git-ignored `output/` directory.

## Original game control flow

The original community LBA1 DOS source has two distinct paths at
`SOURCES/PERSO.C`, around lines 1015–1070:

1. When the protagonist's death animation ends and
   `NbFourLeafClover > 0`, decrement one clover, restore
   `LastValidPerso`, set health to 50 and jump back to `startloop`.
   The expected behavior is a checkpoint respawn **within the same
   game session**, not terminal Game Over.
2. When there is no remaining clover, call `GameOver()`, then return
   from the active game loop.

`SOURCES/GAMEMENU.C::GameOver()` (around 3054–3120) loads
`RESS.HQR` model index 21, runs a timer-based 3D animation, plays
`SAMPLES.HQR` sample 37, then resets the scene renderer.
It may legitimately pass through a dark transition. A permanently
black, unresponsive screen is **not** an acceptable outcome.

Sources:
- https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/PERSO.C
- https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GAMEMENU.C
- https://github.com/yassinebkr/lba-custom-portfolio/blob/fix/r05-1-runtime-probes/scripts/hqr-tools/create-savegame.js

The current guarded four-patch `RELENT.EXE` modifies CD probing and
skips two introductory FLA playbacks. It does **not** patch the death,
GameOver model, timer, or checkpoint logic. Therefore there is no
basis for claiming a known byte-level game-over bug or for introducing
a new executable patch yet.

## Preparation: identical 16-bit stereo and VOX context

Build the same combined private audio bundle for both branches of the
experiment:

~~~bash
cd ~/Documents/lba-custom-portfolio
VOX="/mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows/VOX"
python3 scripts/runtime/prepare-jsdos8-bundle.py \
  --input output/r05-probes/r05-sb16-8.jsdos \
  --wave-driver W_SB16.DLL \
  --voices-dir "$VOX" \
  --out output/r05-probes/r05-v8-english-voices-16bit.jsdos
~~~

With the same bundle, **Museum S003 contains two four-leaf clovers**.
This is a controlled *first death with remaining lives* check.
Now generate a terminal comparison archive by changing **exactly one
byte** of S003.LBA, the clover count, from 2 to 0.

~~~bash
python3 scripts/runtime/prepare-death-probe.py \
  --input output/r05-probes/r05-v8-english-voices-16bit.jsdos \
  --clovers 0 \
  --out output/r05-probes/r05-v8-death-no-clovers.jsdos
~~~

The script requires the expected version of the DOS save:
header 03, printable short save title, terminator, exactly 0x1CA
body bytes, clover value exactly 2 at body offset `0x1C7`.
It fails closed if that signature differs, does not touch any
executable or HQR, and rechecks the complete archive after writing.
The reference `r05-v8-english-voices-16bit.jsdos` is never overwritten.

Before manually testing, verify the two Game Over resources exist in
the owner game distribution. This checks HQR bounds, not decoding:

~~~bash
python3 scripts/runtime/inspect_gameover_resources.py \
  --base /mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows
~~~

## Browser diagnostic procedure (single local site)

After pulling branch updates and reloading `http://127.0.0.1:8765/`
with Ctrl+Shift+R, use only the main js-dos 8.5.4 importer.
Its output volume is adjustable on the right.

For each test:

1. Import a fresh private bundle; use **Continue Saved Game → Museum
   S003**. Verify the expected clover count in game.
2. Before death, click **Inspect screen**, then **Copy diagnostics**.
   The browser takes two private screenshots about 750 ms apart.
   The resulting JSON stores only dark-pixel ratio, changed-pixel ratio,
   frame dimensions, DOS program name and bounded warnings — no pixels.
3. Cause Twinsen's death **once**. Wait ~15 seconds. Click Inspect screen
   and Copy diagnostics again. Press ESC once, wait, and capture again.
4. Repeat from a fresh session with the second bundle.

Keep each test in a separate browser emulator session. Do not use save
states, edit the public site or mount GOG content through the HTTP server.

Expected table:

| Source archive | Clover count on fresh S003 load | Expected branch |
| --- | ---: | --- |
| r05-v8-english-voices-16bit.jsdos | 2 | Checkpoint respawn |
| r05-v8-death-no-clovers.jsdos | 0 | Terminal GameOver animation |

**Interpretation:**
- Checkpoint works, terminal GameOver remains black: focus on
  `RESS_GAME_OVER` model, sample 37, render/screen transition and timer.
- Both remain black: suspect shared post-death loop/graphics or runtime
  state rather than a terminal-only GameOver issue.
- Only the VOX-enabled version fails: compare a voice-free 16-bit
  baseline to test resource pressure or audio/voice cleanup effects.
- Frame darkness alone is *not* a CPU-stall diagnosis. Unchanged
  frames and `getRunningProgram() = RELENT` mean that the executable
  was still reported as the guest program, **not** that its internal
  game loop was progressing.
- If both branches work, log the evidence and mark death handling
  as owner-validated, rather than adding unneeded fixes.

Frame and guest-status operations each have a bounded 5-second host
timeout. A timeout generates an explicit diagnostic warning rather than
leaving an unresponsive Inspect button indefinitely.

## Explicit stop rule

No new RELENT.EXE patches, emulator switching, or gameplay rewrites
without (1) identifying which branch fails, (2) checking resource
presence, and (3) recording the output frame/guest-state evidence.

The exact remaining R05 audio subgates are CDDA, Adeline MIDI and a
combined 16-bit + VOX run. R06 DOS sprite fidelity begins only when
the runtime viability gates are clear.
