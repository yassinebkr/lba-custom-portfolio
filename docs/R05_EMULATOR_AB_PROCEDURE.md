# R05 — DOSBox configuration, js-dos 8.5.4 A/B and CD-DA gates

Scope: owner-local Debian tests only. No original LBA1 files, MIDI assets,
GOG MP3s, or generated .jsdos bundles may be committed, deployed, or uploaded.
On this experimental branch, the *local* /web_deploy/ homepage launches
js-dos 8.5.4; /web_deploy/v6-local.html preserves the old 6.22 control.
The upstream js-dos 8 vendor files are installed locally and ignored by git.
Do not assume the experimental v8 homepage is publicly deployed yet.

## One-time branch update

Run in the original Linux checkout:

    cd ~/Documents/lba-custom-portfolio
    git fetch origin +refs/heads/fix/r05-1-runtime-probes:refs/remotes/origin/fix/r05-1-runtime-probes
    git switch fix/r05-1-runtime-probes
    git merge --ff-only origin/fix/r05-1-runtime-probes

Base game directory is the owner's already verified GOG DOS installation:

    BASE="/mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows"
    test -f output/r05-probes/r05-sb16-8.jsdos || python3 scripts/runtime/run-r05-probes.py --base "$BASE"

Serve local static files, leaving the server in a terminal:

    python3 -m http.server 8765 --directory web_deploy

## Gate 0: verify the 6.22 emulator-side config is actually loaded

Open **http://127.0.0.1:8765/v6-local.html?r05debug=1**, import the
owner-local `output/r05-probes/r05-sb16-8.jsdos`, then open developer tools.

The launcher now passes:

    -conf .jsdos/dosbox.conf -c "imgmount d LBA.ISO -t iso" -c RELENT.EXE

**Expected:** the DOSBox initialization log explicitly names the extracted
`.jsdos/dosbox.conf`, *not only*
`/home/web_user/.dosbox/dosbox-jsdos.conf`.
The browser-only diagnostics may display the argv string, but this is
not a substitute for a DOSBox log proving that the file was read.

Control without explicit config: open
**http://127.0.0.1:8765/v6-local.html?r05debug=1&r05config=legacy** and import exactly
the same owner file. This route reproduces the previous DOSBox invocation;
only the "-conf" part differs. Reload the page between trials. Compare
Museum S003 footsteps at a fixed OS/browser volume, listen for attenuation,
and check guest startup and errors. If both sound identical, do not claim
that loading the file repaired PCM; it only fixed config provenance.

## Gate 1: js-dos 8.5.4, same program, same saves and audio DLL

Install **pinned** open-source player and emulator files from published npm
packages; both versions are recorded. This writes into gitignored vendor
directory, not into the public runtime route:

    python3 scripts/runtime/install-jsdos8.py

Create a companion private archive from the **same** working 8-bit 6.22 ZIP:

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --out output/r05-probes/r05-v8-sb16-8.jsdos

The converter enforces identical bytes in every game file, including
RELENT.EXE, HQR archives and Museum S003. It updates only the emulated
DOSBox startup sequence in `.jsdos/dosbox.conf` by adding:

    [autoexec]
    mount c .
    c:
    imgmount d LBA.ISO -t iso
    RELENT.EXE

Open **http://127.0.0.1:8765/**. Import the new
`r05-v8-sb16-8.jsdos` file. The v8 player is pinned to js-dos 8.5.4
and emulators 8.5.3 and locked to the DOSBox Worker, **not DOSBox-X**.
It automatically starts after a one-second built-in countdown; initial
mouse capture, fullscreen, cloud UI and autosave are disabled.

Do not select the existing 6.22 bundle on the v8 page: without [autoexec]
the engine would not be asked to start RELENT.EXE.

Test: DOS menu boots; S003 Museum loads and Twinsen moves/collides;
same footstep is clearer/same/worse; one ordinary death still returns to
the last checkpoint. Use the **Stop emulation** control rather than
Ctrl+F9 or window management. Press **Copy diagnostic report** for
events and engine version (or call `window.r05V8DiagnosticReport()`).
None of these tests have been performed yet against the real GOG binary
in automated CI.

GitHub Actions includes a separate, real pinned js-dos 8 DOSBox worker
smoke test driven by a *synthetic* ZIP that runs a DOS directory listing.
It verifies browser asset loading and backend startup only.

## Gate 2a: genuine CD-DA transport with generated tones (not GOG audio)

This is a binary/CD emulation test, not full soundtrack integration.
Generate a mixed-mode CUE with:
- Track 01: untouched owner-local LBA.ISO data track (MODE1/2048)
- Tracks 02..10: nine generated, six-second 44.1 kHz 16-bit stereo
  CD-sector-aligned PCM audio files (2352 bytes per CD frame)

    python3 scripts/runtime/make-cdda-probe.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --mode tone \
      --out output/r05-probes/r05-cdda-tone.jsdos

On the 6.22 test page use
**http://127.0.0.1:8765/v6-local.html?r05debug=1&r05cdda=1** to explicitly mount
LBA.CUE, then import `r05-cdda-tone.jsdos`. Confirm the DOSBox console
says the CUE was accepted and both CD track listing and an *actual*
CD-music trigger in the game produce a short audible tone.

Caution: a successful ZIP build proves neither CUE parser support nor
CD-DA output. If no music event fires in the chosen scene, the absence
of a tone is inconclusive. A CUE parser error or an explicit CD audio
subsystem error is stronger evidence of an unsupported emulator backend.

To try the **same** synthetic CD test on the v8 page:

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-cdda-tone.jsdos \
      --out output/r05-probes/r05-v8-cdda-tone.jsdos \
      --cd-image LBA.CUE

## Gate 2b: raw owner CDDA preview, NOT an MP3 CUE

The owner GOG installation has all nine original MP3 tracks at
`Common/Music/Track_02.mp3` through `Track_10.mp3`. Source inspection
of the pinned emulators 8.5.3 DOSBox backend proves that its
`native/config/config.h` explicitly leaves `C_SDL_SOUND` undefined.
The old DOSBox CD image code relies on that macro to decode MP3/OGG CUE
audio. Therefore `r05-cdda-owner.jsdos` with direct MP3s is **not**
a supported test for our chosen v8 DOSBox Worker. The v8 private
converter rejects that input. Do not waste time repeating a silent MP3
CUE experiment.

After the raw synthetic CD tone gate actually passes, transcode **one**
30-second sample of the owner's Track_10.mp3 (triggered by the original main menu) with local FFmpeg to
44.1 kHz, signed 16-bit, stereo, raw sector-aligned CDDA:

    python3 scripts/runtime/make-cdda-pcm-preview.py \
      --input output/r05-probes/r05-cdda-tone.jsdos \
      --gog-root /mnt/fast-ssd/Games/Heroic/tlba-classic \
      --track 10 --seconds 30 \
      --out output/r05-probes/r05-cdda-pcm-preview.jsdos

Then prepare it for the v8 browser backend:

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-cdda-pcm-preview.jsdos \
      --cd-image LBA.CUE \
      --out output/r05-probes/r05-v8-cdda-pcm-preview.jsdos

The original game still issues CD-track commands against the emulated
drive. This experiment only substitutes compatible PCM track bytes for
the compressed track media, while leaving the other eight synthetic
tones and all original game files unchanged.

If one original preview plays, measure the full nine-track decoded size
and browser memory before generating the complete owner-local CD image.
Do not automatically promote that large private game bundle into the
public deployment.

The Adeline logo is **MIDI index 31**, not a CD-DA track. Its missing
jingle is separately explained by the existing `MidiDriver: NoMidi`.
A CUE success does not restore it. The actual GOG
`Common/Midi/LBA1-32.mp3` is a reference recording only; no
browser audio overlay is part of these tests.

## Decision gates

| Measurement | 6.22 corrected | 6.22 legacy | 8.5.4 DOSBox |
| --- | --- | --- | --- |
| Config file actually loaded | Owner check | Default | Built-in bundle |
| DOS menu + Museum S003 | Owner check | Previously confirmed | Owner check |
| Identical S003 footstep clarity | Owner check | Historical attenuated baseline | Owner check |
| Checkpoint respawn | Owner check | Previously confirmed | Owner check |
| CUE accepted, synthetic tone actually heard | Owner check | N/A | Owner check |
| One original raw PCM music preview played after tone passes | Optional | N/A | Owner check |

If v8 materially worsens startup, saved-game movement or performance, do
not migrate. If both versions fail CUE/PCM, do not blindly add MP3 tracks
to the public pipeline. If the corrected 6.22 config unexpectedly breaks
boot, the exact old behavior is retained with `?r05config=legacy`.

References:
- js-dos 6.22 manual config requirement: https://js-dos.com/pure-js.html
- js-dos v8 bundle format: https://js-dos.com/jsdos-bundle.html
- js-dos v8 UI API: https://js-dos.com/player-api.html
- js-dos latest verified 8.5.4 release: https://github.com/caiiiycuk/js-dos/releases/tag/v8.5.4
- DOSBox mixed-mode CUE implementation: https://github.com/js-dos/dosbox/blob/main/src/dos/cdrom_image.cpp

Recent owner evidence: js-dos 8.5.4 has clearly improved PCM SFX relative to v6.22; left/right balance is reversed under the 8-bit original driver. Neither version had VOX banks or real CDDA mounted at that point. See [R05.5 audio results and stereo/voice gates](R05_AUDIO_85_RESULTS.md).

## 2026-11-13 runtime promotion

Owner confirmed substantially improved js-dos 8 effects and successful stereo
orientation with original 16-bit W_SB16.DLL. Therefore / on this branch now
uses v8 while the 6.22 control moved to /v6-local.html. The old /v8-local.html
is retained only for existing bookmarks and secondary diagnostics. CI checks
v8 DOSBox Worker startup from the actual portfolio homepage and 6.22 from its
new legacy path. The large VOX import previously appeared stalled; this is
still an open bug and cannot be attributed to the wrong version simply from a
loading-label string. Do not publish third-party or GOG assets implicitly.
