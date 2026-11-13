# R05 — Reassessing js-dos before a runtime migration

Research date: 2026-11-13. This document supersedes the *recommendation to immediately prefer ScummVM* in the earlier [audio architecture report](R05_AUDIO_ARCHITECTURE_RESEARCH.md), but not its factual source analysis. Owner's preferred technical constraint: retain execution of the original DOS program on an actual emulated DOS machine where feasible. No code or private game assets are added in this research step.

## Verified owner-local media inventory

The GOG install **does** contain:
- Common/Midi/LBA1-32.mp3 (~160 KiB): a pre-rendered copy of the original Adeline logo MIDI cue, corresponding to index 31.
- Common/Music/Track_02.mp3 through Track_10.mp3 (total **38,800 KiB**, ~37.9 MiB).
- Speedrun/Windows/LBA.DAT (4 KiB).

This contradicts any prior implication that original music files are unavailable. These files are not in the minimal DOS bundle and must remain owner-private.

## A more fundamental finding: the 6.22 browser launcher ignores our bundled DOSBox configuration

Current [web_deploy/local-bundle.mjs](../web_deploy/local-bundle.mjs) calls:

    main(['-c', 'imgmount d LBA.ISO -t iso', '-c', 'RELENT.EXE']);

But [scripts/runtime/build-private-jsdos.py](../scripts/runtime/build-private-jsdos.py) writes the emulation parameters into \`.jsdos/dosbox.conf\` inside the archive. The JavaScript importer unpacks that file and invokes the 6.22 DOSBox runtime without \`-conf\`. The owner's console showed DOSBox loading \`/home/web_user/.dosbox/dosbox-jsdos.conf\` instead. **This is a source-backed contract error in our integration.** All previous audio variations changed LBA.CFG (the original game's driver settings), while the intended emulator-side SB16/OPL/mixer/rate settings were not demonstrably loaded.

Official sources:
- DOSBox manual: \`-conf <configfile>\` loads a specified configuration; without it DOSBox loads its default/user config. https://www.dosbox.com/DOSBoxManual.html
- js-dos 7 bundle guide explicitly distinguishes 6.22's *manual emulator configuration* from the automatic bundle config loaded by 7+: https://js-dos.com/v7/build/docs/jsdos-bundle/
- 6.22 API reference supports direct \`main([...])\` execution and options. https://js-dos.com/6.22/docs/api/generate.html?page=js-dos-options

Next focused correction (to be tested in a separate commit, **not yet applied**):

    main(['-conf', '/.jsdos/dosbox.conf',
          '-c', 'imgmount d LBA.ISO -t iso',
          '-c', 'RELENT.EXE']);

The exact extracted FS path must be checked; a log proving the intended file was loaded is required before sound A/B claims. Keep the old launch variant as a control and do not repackage GOG resources merely to test emulator config parsing.

**Important**: loading the emulator configuration alone will not restore the Adeline logo cue, because the *game-level* LBA.CFG still sets MidiDriver: NoMidi. It will not conjure CD-DA tracks from our data-only ISO.

## Modern js-dos: a DOS-first replacement for js-dos 6.22, not for RELENT.EXE

As of 2026-11-13, latest published js-dos release verified via GitHub is **v8.5.4**, dated 2026-11-12:
https://github.com/caiiiycuk/js-dos/releases/tag/v8.5.4

Version 8.5.0 announced improved Web audio buffering, audio pitch stability, underrun recovery and resampling alongside an updated DOSBox-X backend:
https://github.com/caiiiycuk/js-dos/releases/tag/v8.5.0

v8.4.0 previously added AudioWorklet, persistence improvements, and browser performance controls:
https://github.com/caiiiycuk/js-dos/releases/tag/v8.4.0

Current js-dos emulator API supports \`dosboxWorker\`, \`dosboxXWorker\`, \`dosboxXDebugWorker\`, file-system bundle inspection, \`audioWorklet\` backend option, and DOSBox-X debugger/MCP backend:
https://js-dos.com/emulators.html

These features are credible relevance signals for our current audio defect and native debugger/guest liveness problem, but they **do not prove** LBA1's Miles driver compatibility or CD audio output in v8. The existing patched RELENT.EXE and HQR file formats are preserved in a DOS emulator. Adapter changes are required: js-dos 8's bundle-driven startup must include the mount/start commands in \`.jsdos/dosbox.conf\` [autoexec], or use a backend API explicitly implementing the same sequence. A \`.jsdos/jsdos.json\` may be added; verify actual validation rules rather than assuming 6.22's manual launch command is reused unchanged. Keep v6.22 and v8 launchers on separate local test routes.

## Original CD music: use the real media path instead of inventing a JS jukebox

Original [SOURCES/AMBIANCE.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/AMBIANCE.C) dispatches most numbers 1..9 to PlayCdTrack when CDEnable is true. The existing executable patch explicitly forces the CD-detected branch; the tiny generated ISO is data-only and contains no Red Book tracks.

DOSBox's documented route is to mount a mixed-mode CUE with a data track (track 01) and audio tracks (02..10); CUE can reference ISO + separate MP3/OGG audio:
- https://www.dosbox.com/wiki/IMGMOUNT
- https://www.dosbox.com/wiki/Cuesheet
- https://www.dosbox.com/DOSBoxManual.html

**Critical build-specific caveat:** in the open-source DOSBox fork's \`src/dos/cdrom_image.cpp\`, compressed CUE audio is guarded by \`#if defined(C_SDL_SOUND)\`; \`configure.ac\` enables it only if SDL_sound headers/libs/seek support are found:
- https://github.com/js-dos/dosbox/blob/main/src/dos/cdrom_image.cpp
- https://github.com/js-dos/dosbox/blob/main/configure.ac

This source evidence is **not sufficient to claim the precompiled 6.22 or 8.5.4 WebAssembly artifact includes MP3 CDDA support**. Verify the specific WASM backend first with a tiny original, owner-created CUE/PCM tone or a private GOG track in a private bundle, then test the CD command semantics and mixer CDAUDIO channel. MP3 tracks add ~38 MiB compressed to the private game bundle before any MIDI/voice assets; this remains within our current 512 MiB local browser import limit, but decompression, peak memory and audio buffering must be measured.

The logo Adeline jingle is a separate issue. Original [SOURCES/GAMEMENU.C::AdelineLogo](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GAMEMENU.C) calls PlayMidiFile(31), but our current LBA.CFG uses NoMidi; supplying Track_02..Track_10 does not restore it. GOG's LBA1-32.mp3 is an available private fidelity reference; an HTML audio overlay would be pragmatic but **would not count as faithful guest MIDI hardware emulation**, and synchronization to game state requires reliable triggers. Prefer an original guest MIDI path if the chosen emulator supports it.

## Architecture comparison specific to this portfolio

| Question | js-dos 6.22, corrected | js-dos 8 / DOSBox-X | ScummVM TwinE |
| --- | --- | --- | --- |
| Runs exact guarded RELENT.EXE and DOS callbacks | Yes | Yes, compatibility to test | **No** — new game engine |
| Preserves DOS Save Snnn.LBA menu path | Yes, owner-tested | Likely if executable/files identical; must test | Not guaranteed |
| Directly honors existing RELENT.EXE binary patches | Yes | Yes | No |
| Can consume custom HQR files | Yes | Yes | Likely, with format/version caveats |
| PCM driver path | Historical Miles SB16, observed flawed | Historical driver with newer emulation/audio transport | Native software sample decoder/mixer |
| MIDI from original DOS driver | Failed on previous Miles SB FM test | Unknown; benchmark | Native MIDI/parser, no Miles hardware |
| Data-only ISO plays CD soundtrack | No | No | Separate extracted tracks supported |
| Mixed-mode CUE support | DOSBox feature; WASM build unknown | DOSBox feature; WASM build unknown | Uses extracted audio files directly |
| Browser packaging cost | Minimal existing changes | New frontend adapter and backend QA | Different runtime integration plus save/patch porting |
| Strongest use | Regression/control | **Best first upgrade candidate** | Independent audio oracle / fallback |

ScummVM sources:
- https://github.com/scummvm/scummvm/blob/master/engines/twine/audio/sound.cpp
- https://github.com/scummvm/scummvm/blob/master/engines/twine/audio/music.cpp
- https://github.com/scummvm/scummvm/blob/master/engines/twine/renderer/screens.cpp

## Falsifiable gates — avoid open-ended configuration permutations

**Gate 0 — 6.22 config contract:** explicitly load the bundled DOSBox config; verify the runtime log names it or check the effective device settings in DOSBox. Compare identical footsteps in Museum with the prior known partially audible sb16-8 bundle. If config is ignored or causes regressions, revert the isolated launcher change and record logs. No new DLL profiles.

**Gate 1 — js-dos 8.5.4 DOSBox worker:** separate local test page with the exact same private patched executable, HQR and S003 save, known-good wave driver, and mounted ISO. Validate boot, museum collision/movement, one checkpoint respawn, and SFX. Compare audible fidelity and errors against Gate 0. Do not replace the existing importer until this passes.

**Gate 2 — CD-DA capability:** only on the better DOS backend, test a correctly mounted private mixed-mode CUE using owner's own files. Confirm track numbering, start/stop, correct music and seeking. Unknown WASM SDL_sound support is the first blocker to check. Do not convert entire music collection to uncompressed PCM unless a tiny probe justifies the bandwidth and memory costs.

**Gate 3 — Adeline jingle:** evaluate MIDI hardware emulation with an isolated original Miles driver and documented I/O; independently compare to owner-local LBA1-32.mp3. A browser overlay is a different fidelity mode and must be labeled as such if used.

**Stop rule:** if correctly loaded 6.22 config and an isolated modern js-dos backend still fail PCM/MIDI with the original DLLs, stop before writing a custom emulator audio driver. Use ScummVM only as a comparator of expected fidelity, and resume R06 artwork integration with an explicit audio limitation.

**Recommendation:** retain DOS emulation as the primary private technical architecture; fix the proven 6.22 config contract; benchmark v8.5.4 in parallel. No proven reason yet to abandon RELENT.EXE/our existing DOS scene editing tools.
