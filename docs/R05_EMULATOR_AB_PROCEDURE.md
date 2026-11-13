# R05 — DOSBox configuration, js-dos 8.5.4 A/B and CD-DA gates

Scope: owner-local Debian tests only. No original LBA1 files, MIDI assets,
GOG MP3s, or generated .jsdos bundles may be committed, deployed, or uploaded.
The maintained public route remains the 6.22 importer; all 8.5.4 tests are
isolated under /web_deploy/v8-local.html.

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

Open **http://127.0.0.1:8765/?r05debug=1**, import the
owner-local `output/r05-probes/r05-sb16-8.jsdos`, then open developer tools.

The launcher now passes:

    -conf .jsdos/dosbox.conf -c "imgmount d LBA.ISO -t iso" -c RELENT.EXE

**Expected:** the DOSBox initialization log explicitly names the extracted
`.jsdos/dosbox.conf`, *not only*
`/home/web_user/.dosbox/dosbox-jsdos.conf`.
The browser-only diagnostics may display the argv string, but this is
not a substitute for a DOSBox log proving that the file was read.

Control without explicit config: open
**http://127.0.0.1:8765/?r05debug=1&r05config=legacy** and import exactly
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

Open **http://127.0.0.1:8765/v8-local.html**. Import the new
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
**http://127.0.0.1:8765/?r05debug=1&r05cdda=1** to explicitly mount
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

## Gate 2b: the owner's MP3 tracks, ONLY after a successful CD-DA tone

The GOG installation has all nine original tracks at
`/mnt/fast-ssd/Games/Heroic/tlba-classic/Common/Music/Track_02.mp3`
through `Track_10.mp3`. Keep this experiment private:

    python3 scripts/runtime/make-cdda-probe.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --mode owner-mp3 \
      --gog-root /mnt/fast-ssd/Games/Heroic/tlba-classic \
      --out output/r05-probes/r05-cdda-owner.jsdos

Use the same 6.22 CUE test URL and import this new archive.
MP3 in a DOSBox CUE requires a decoder in the chosen WASM build.
The historical DOSBox fork guards compressed audio in
src/dos/cdrom_image.cpp with C_SDL_SOUND; **we have not confirmed**
that either released WASM binary includes this decoder. A PCM-tone
success followed by MP3 failure would narrow the defect to the
compressed-audio decoder path.

To compare v8 CD music, convert the owner MP3 CUE bundle with
prepare-jsdos8-bundle.py and `--cd-image LBA.CUE`, then import that
private resulting bundle on the v8 route.

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
| MP3 played after tone passed | Owner check | N/A | Owner check |

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
