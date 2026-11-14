# R05.7 — Audio volume, voice validation and black-screen-on-death probe

Date: 2026-11-14. This is an evidence and acceptance record for the owner-local **js-dos 8.5.4** DOSBox Worker. It is not a claim that Game Over has been repaired.

## New owner-observed results

The owner loaded `r05-v8-english-voices.jsdos` on the main `/` runtime and reported **audible English dialogue**.

The js-dos report shows:
- `emu-ready` after 1,109 ms, `bnd-play` after 2,281 ms;
- `ci-ready` after 2,959 ms, `phase: backend ready`;
- `getRunningProgram() = RELENT`, `errors: []` and `warnings: []`;
- 41,456,047 compressed ZIP bytes;
- `soundFrequency() = 0`; this single reading cannot establish silence because the user **heard** effects and voices.

The earlier isolated 16-bit `W_SB16.DLL` test was also **owner-validated** for clear SFX and correct left/right spatialization. The currently tested voice bundle is a separate trial; **simultaneous VOX + 16-bit stereo must be checked** before a combined configuration can be accepted.

The owner also reported **black screen on death in js-dos 8.5.4**, and **no CD music**. In legacy 6.22, a nonterminal death with clovers had returned to the checkpoint, but a terminal Game Over remained unverified. Do not merge these two scenarios or automatically label the v8 black screen a Game Over defect.

## New host volume control

The main player now displays an accessible output-volume slider anchored on the right (default **30%**, range 0–100%). The slider calls the documented `DosProps.setVolume(gain)` API immediately. It controls all emulator output, including original SFX and spoken English VOX, without mutating game files or the in-game mixer. The secondary `/v8-local.html` page uses the same control. It is intentionally independent of the LBA.CFG volume values.

Reference: https://js-dos.com/player-api.html

## Black screen: bounded experiment, no binary patch

Original community source:
- [SOURCES/PERSO.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/PERSO.C), around line 1019, has two branches when Twinsen's death animation ends.
  - If `NbFourLeafClover > 0`, the engine decrements lives, restores `LastValidPerso`, sets HP to 50 and jumps back to `startloop` (checkpoint respawn).
  - Otherwise it calls `GameOver()` and exits the active game loop.
- [SOURCES/GAMEMENU.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GAMEMENU.C), around line 3054, implements GameOver using the `RESS_GAME_OVER` 3D asset, a `TimerRef`-driven ~10 s rotation, `SAMPLES.HQR` sample 37 and a follow-up screen transition.
- [scripts/hqr-tools/create-savegame.js](../scripts/hqr-tools/create-savegame.js) writes *two* clover leaves and 50 HP by default into generated DOS save slots, including S003. This makes a fresh load suitable for testing a **first, nonterminal** death; the in-memory clover count may change after repeated play.

New player diagnostic button **Inspect screen**, next to Stop emulator and Copy diagnostics, calls `ci.screenshot()` and `ci.getRunningProgram()`. It records only dimensions, approximate fraction of dark pixels, current program and elapsed milliseconds — **never copies or uploads pixels or proprietary assets**. The result is included in `window.r05V8DiagnosticReport()`.

Owner-local manual procedure:

1. Import a fresh **combined 16-bit + English VOX** bundle (command below), load Museum S003, note clovers on HUD and observe the scene.
2. Press **Inspect screen** before death as a baseline. Copy the report.
3. Lose **only the first life**. Wait ~15 s; if the screen stays black, use Inspect screen again, copy report; press ESC once, inspect after the input. Record whether menu/control returns.
4. Separately, after enough lives are lost, test the **terminal Game Over** case (no remaining clovers), repeat screenshots/ESC and elapsed time. The original engine's timed 3D animation means a temporary blank transition alone is not a permanent hang.
5. Compare a voice-free 16-bit bundle if only the combined bundle fails; this distinguishes VOX memory/resource interaction from the backend's independent death path.

Build the combined private bundle **without editing the original GOG installation**:

~~~bash
cd ~/Documents/lba-custom-portfolio
VOX="/mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows/VOX"
python3 scripts/runtime/prepare-jsdos8-bundle.py \
  --input output/r05-probes/r05-sb16-8.jsdos \
  --wave-driver W_SB16.DLL \
  --voices-dir "$VOX" \
  --out output/r05-probes/r05-v8-english-voices-16bit.jsdos
~~~

It is crucial to test **both** cases. If the initial death with two clovers returns to the checkpoint but the terminal Game Over stays black, inspect the 3D game-over rendering path and TimerRef before changing assets or timers. If both cases go black, investigate the general scene-restart/graphics path. The `ci-ready` event only confirms the worker started and **does not** prove it remains responsive when a death occurs.

## R05 gate status and next stages

| Gate | Evidence | Status |
| --- | --- | --- |
| Original DOS executable boot and S003 save | Owner gameplay | Passed |
| Sound effects and 16-bit stereo panning (v8) | Owner ear test | Passed |
| English VOX dialogue (v8, separate bundle) | Owner heard speech and report confirmed RELENT | Passed |
| **Combined 16-bit stereo + all VOX** | Archive generator available | Not yet owner-tested |
| Right-side adjustable output volume | Implemented and CI-tested; in-game loudness control pending owner confirmation | Engineering implemented |
| CD-DA soundtrack | GOG tracks available, private CUE/PCM probes built; no audible CD test | Not passed |
| Adeline logo MIDI jingle | `MidiDriver: NoMidi` in game config | Not passed |
| Nonterminal death in v8 | Black-screen report without identified life count | Failing/ambiguous |
| Terminal Game Over in v8 | No isolated user run / frame comparison | Open |
| R06 private original sprite fidelity | Previous codec and visual previews exist, not yet runtime verified | Open |
| R07 original interactive workshop, R08 visual QA, R09 public release | Later roadmap | Not passed |

No game content is published. No changes to `RELENT.EXE` or binary patches. Do not merge to `main` on the basis of packaging or synthetic browser CI.
