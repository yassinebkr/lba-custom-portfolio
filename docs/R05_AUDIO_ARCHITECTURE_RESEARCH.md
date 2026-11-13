# R05 Audio Root-Cause Research and Architecture Decision

**2026-11-13 update:** New code review identified that the 6.22 browser importer never explicitly passes the generated `.jsdos/dosbox.conf` to DOSBox, while the logs show default configuration. The owner also confirmed all nine GOG MP3 tracks and the logo jingle are available locally. The earlier preference for switching to ScummVM was therefore premature; consult [R05 DOS-first reassessment](R05_JSDOS_REASSESSMENT.md) before making a runtime decision. ScummVM remains a valid independent fidelity reference.

Research date: 2026-11-13. Scope: owner-local LBA1 DOS/js-dos 6.22 experiments, the historical open-source engine, and the modern ScummVM/TwinE implementation. This is a source investigation and decision record, **not** an audio fix or a proof of browser fidelity. No copyrighted game content is checked in.

## Owner-observed baseline

| Probe | In-game observation | Evidence quality |
| --- | --- | --- |
| r05-silent | Game works without sound | Manual browser test |
| r05-sb16 | Extremely faint/muffled sound | Manual browser test |
| r05-sb16-8 | Footsteps and slider samples improved, but museum SFX still muffled; music mostly absent | Manual browser test |
| r05-sb16-mixer and mixer-loud | Completely silent | Manual browser tests |
| r05-sb16-mono | Browser logged DOSBox illegal-memory reads/writes; **audible result not explicitly reported** | Browser log only |
| r05-sb16-8-fm | DOS console prints Miles Sound Blaster FM device followed by “Sound Hardware not found”, then returns to C: prompt | Screenshot; driver abort confirmed |
| DOS save S003 | Museum loads in DOS game | Manual browser test |
| Checkpoint respawn | Works after losing one life | Manual browser test |

The browser source-map 404 is developer tooling, not an audio failure. Illegal guest memory access warnings are concerning, but not causally linked to any specific audio defect by the available traces.

## Source-proven failure mechanisms

### A. Adeline logo is MIDI event 31, explicitly disabled by our config

Original source:
- [SOURCES/GAMEMENU.C, AdelineLogo()](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GAMEMENU.C), calls PlayMidiFile(31) before loading RESS_LOGO_PCR.
- [SOURCES/AMBIANCE.C, PlayMidiFile()](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/AMBIANCE.C), immediately returns when Midi_Driver_Enable is false.
- [SOURCES/PERSO.C, InitProgram()](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/PERSO.C), requests INIT_MIDI; source loads MIDI_SB.HQR when FM selected.
- [scripts/runtime/build-private-jsdos.py](../scripts/runtime/build-private-jsdos.py), GAME_CONFIG sets MidiDriver: NoMidi, and MIDI remains disabled in all non-FM reference probes.

The logo jingle is not an audio-CD track. Enabling a working MIDI backend is necessary for the original DOS logic to produce it. The separate ScummVM implementation also calls playMidiFile(31) in [engines/twine/renderer/screens.cpp](https://github.com/scummvm/scummvm/blob/master/engines/twine/renderer/screens.cpp).

The historical patcher [patch-relent.js](../scripts/hqr-tools/patch-relent.js) deliberately skips playback of INTROD.FLA and DRAGON3.FLA, which additionally prevents those movies and their sound from playing. These are separate from the AdelineLogo() MIDI call; do not conflate them.

### B. Gameplay CD music cannot play from the generated ISO

Original source [SOURCES/AMBIANCE.C, PlayMusic()](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/AMBIANCE.C): with CDEnable, most numbered tracks 1..9 are selected as PlayCdTrack() rather than MIDI. [SOURCES/PERSO.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/PERSO.C) sets CDEnable after its CD-ROM probe.

Our [guarded RELENT.EXE patch](../scripts/hqr-tools/patch-relent.js) forces the CD detection path to succeed, and the [owner-local builder](../scripts/runtime/build-private-jsdos.py) synthesizes a ~2.8 MB ISO9660 data-only LBA.ISO containing CD_LBA and SAMPLES.HQR. It has **zero Red Book CDDA audio tracks**.

This is a necessary missing resource, independent of FM driver fixes. No sbtype/IRQ/DMA/mixer permutation can manufacture absent CD tracks. DOSBox documentation confirms that audio-CD tracks require a track-capable medium such as CUE/BIN, whereas ISO9660 images are data-only:
- https://www.dosbox.com/DOSBoxManual.html
- https://www.dosbox-staging.org/0.83/manual/sound/sound-devices/cd-da/

An archive of the 1994 PC game lists nine commercial audio tracks (02 Opening through 10 Theme), consistent with the engine track-range code:
- https://dr.loudness-war.info/album/view/64415

### C. The AIL/32 hardware detection failed; this is not an archive import error

The owner-observed A32SBFM.DLL test printed its recognized Miles device name, then Sound Hardware not found and returned to the DOS prompt. In original [LIB386/PLATFORM/DOS/LIB_MIDI/MIDI.C](https://github.com/LBALab/lba1-classic-community/blob/main/LIB386/PLATFORM/DOS/LIB_MIDI/MIDI.C), InitMidi() calls AIL_detect_device; a false return disables initialization. Original [LIB386/LIB_SYS/ADELINE.C](https://github.com/LBALab/lba1-classic-community/blob/main/LIB386/LIB_SYS/ADELINE.C) exits when InitMidi fails.

This proves *what* failed in the engine's initialization sequence, **not** why the hardware probe failed. The alternate fixed-port AdLib probe is not an accepted audio solution until verified on the owner's system. No further random MIDI port and DMA guesses are justified.

### D. PCM effects are independent and still degraded

The historical [WAVE_DLL.MAK](https://github.com/LBALab/lba1-classic-community/blob/main/LIB386/PLATFORM/DOS/LIB_SAMP/WAVE_DLL.MAK) compiles W_SB16.DLL as 16-bit stereo and W_SB16_8.DLL as 8-bit stereo. Owner observed an audible difference, confirming output format matters. The exact location of frequency attenuation/distortion cannot be determined from ZIP extraction or generic DOSBox illegal-read logs.

DOSBox Staging documents substantial Sound Blaster filter and output-model differences; those observations do **not** demonstrate a js-dos-specific root cause:
- https://www.dosbox-staging.org/0.83/manual/sound/sound-devices/sound-blaster/
- https://github.com/dosbox-staging/dosbox-staging/issues/407

A historical js-dos issue reports missing sound/music in other games on 6.22.60, but was closed after a developer reported sound working for one test bundle; it is **not** proof of a general unfixed bug:
- https://github.com/caiiiycuk/js-dos/issues/138

### E. Original voice/cutscene completeness is intentionally disabled

The builder excludes VOX.HQR; INTROD.FLA and DRAGON3.FLA are bypassed to fit the minimal owner-local bundle. Therefore 'exact original audio experience' is not even a valid acceptance target for the *current inputs*. Restoring full presentation would require licensed source files, memory/performance analysis and distinct loading paths, beyond an audio driver fix.

## Existing alternatives, evaluated

| Runtime | Sound architecture | Browser evidence | Compatibility with current portfolio | Risk |
| --- | --- | --- | --- | --- |
| Original RELENT.EXE + js-dos 6.22 | Miles DOS MIDI; SB16 PCM; CDDA on genuine audio disc | User-confirmed gameplay/saves/respawn, faulty SFX | Matches existing guarded patches and Snnn.LBA saves | Multiple independent audio/media blockers; browser DOSBox complexity |
| Original DOS engine rebuilt from LBALab source | Historical audio code + DOS hardware | Source available; not yet rebuilt for our assets | May retain HQR semantics, but version/patch changes need revalidation | Still DOS hardware/driver and CDDA concerns |
| ScummVM TwinE native | Software sample decoding/mixer + MIDI parser + extracted CD tracks | Official twine:lba compatibility 'Good' | Reuses HQR-style input, **not** original executable patch sites or necessarily DOS save files | Must validate specific GOG variant, scene overlays, save migration |
| ScummVM TwinE Emscripten | Same higher-level sound system in WebAssembly | Official browser port exists; independent ScummWEB reports LBA startup | Could reuse private-import concept but needs a new integration adapter | Compilation, input/persistence, engine plugin loading, original game files still restricted |
| Independent original-art isometric browser runtime | Own licensed audio and scene logic | Existing asset pipeline, sprite demos | Best distribution fit if all assets are original/licensed | Reimplementing LBA-specific semantics is substantial |

References:
- https://www.scummvm.org/compatibility/DEV/twine%3Alba
- https://github.com/scummvm/scummvm/blob/master/engines/twine/audio/sound.cpp
- https://github.com/scummvm/scummvm/blob/master/engines/twine/audio/music.cpp
- https://github.com/scummvm/scummvm/blob/master/engines/twine/renderer/screens.cpp
- https://github.com/scummvm/scummvm/blob/master/dists/emscripten/README.md
- https://scummweb.tsilva.eu/compatibility

The modern Classic distribution of LBA1 listed in the public Steam depot includes Common/Midi/LBA1-32.mp3 for the Adeline jingle and Common/Music/Track_02.mp3 .. Track_10.mp3. ScummVM's music.cpp documents LBA1-32 for MIDI index 31, and supports extracted track_02 files. The owner's actual **GOG** filesystem layout is unverified: do not claim those files exist there until locally inventoried.
- https://steamdb.info/depot/1857700/
- https://github.com/scummvm/scummvm/blob/master/engines/twine/audio/music.cpp

Read-only owner inventory; do not upload the data:

    ROOT="/mnt/fast-ssd/Games/Heroic/tlba-classic"
    find "$ROOT" -type f \( -iname 'lba1-32.*' -o -iname 'track_*.mp3' -o -iname 'track_*.ogg' -o -iname '*.cue' -o -iname '*.gog' -o -iname '*.dat' \) -printf '%P\t%k KiB\n' | head -n 100

## Decision and strict next gates

1. **Freeze js-dos audio-driver permutations.** Preserve r05-sb16-8 as the known partially audible reference; do not enable MIDI/mixer by default. Archive test results.
2. For **private fidelity QA**, validate the owner's lawful LBA1 data in *native ScummVM twine* first. Evidence required: logo jingle audible, a Museum footstep/ambient effect clean, and the intended level loaded.
3. Only if native passes, attempt a **single minimal WebAssembly TwinE proof**, isolated from the existing js-dos importer. Evidence required: sound, keyboard, one scene, no private assets hosted or uploaded.
4. Re-test the real custom HQR overlay, collision and save semantics before replacing the DOS adapter. **Original DOS Snnn.LBA save compatibility must not be assumed.** If one of these gates fails substantially, keep js-dos for private testing, and invest in the already-existing original-art runtime rather than inventing a broad engine compatibility layer.
5. The stated *public portfolio* objective requires a directly playable site without users owning LBA1. Open-source engine code (GPL) does **not** license copyrighted graphics, dialogue, MIDI, recordings, game level assets or models. The hosted product must use independently authored or explicitly licensed assets, regardless of runtime selected.
6. Resume R06 original-art/scene QA independently of exact commercial sound restoration: the playable DOS/saves/checkpoint milestone is useful, but full soundtrack restoration is not a prerequisite for testing our original sprite pipeline.

**Stop rule:** without a reliable private ScummVM sound/scene comparison or redistributable final audio, do not spend further cycles patching Miles or shipping ad-hoc browser audio overlays. Track exact playback equivalence only as an optional fidelity experiment.
