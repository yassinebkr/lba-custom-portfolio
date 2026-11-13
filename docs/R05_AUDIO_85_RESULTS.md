# R05.5 — js-dos 8.5.4 validated PCM, reversed stereo, missing CD music and voice banks

Research and owner test status: 2026-11-13.

**User-tested evidence**

- js-dos 6.22, with explicit packaged DOSBox config: sound effects usable,
  music and dialogue voices still silent.
- js-dos 8.5.4 DOSBox Worker, using precisely the 8-bit W_SB16_8.DLL
  variant and the same game executable and save assets: effects sound
  substantially cleaner, and quality has been accepted in real gameplay.
- In that 8-bit js-dos 8.5.4 setup, moving toward the left of a sound
  source moves perceived audio toward the RIGHT headphone. The stereo
  scene is reversed. This is a reported in-game observation, not a
  microphone measurement.
- Music and dialogue remain silent in both engines; neither received
  working CDDA tracks or voice banks in the tested bundle.

**Architecture decision:** promote js-dos 8.5.4 DOSBox Worker to the
*audio-effect reference for private QA*, but do not merge or replace the
old v6.22 route until stereo, CD audio, voice banks, game saves and
regression tests have all passed. Do not describe full audio as fixed.

## 1. 8-bit stereo: historical driver behavior, not an automatic browser fix

Two original engine sources localize the inversion:

- Original [SOURCES/BALANCE.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/BALANCE.C)
  assigns sine-based gains to the expected left and right pointers.
- Original [SOURCES/AMBIANCE.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/AMBIANCE.C)
  passes the calculated values as `volleft`, `volright` to WavePlay().
- Original [LIB386/PLATFORM/DOS/LIB_SAMP/WAVE_A.ASM](https://github.com/LBALab/lba1-classic-community/blob/main/LIB386/PLATFORM/DOS/LIB_SAMP/WAVE_A.ASM),
  around the 8-bit STEREO branch at ~2046..2062, classifies the
  right-to-left gain ratio but labels the low-ratio case as RIGHT and
  the high-ratio case as LEFT. This is consistent with the owner
  listening test.
- For SAMPLE16BIT + STEREO at ~2033..2045, that same driver source
  stores the original `volleft` and `volright` independently.
  Original WAVE_DLL.MAK compiles W_SB16.DLL using SAMPLE16BIT and
  W_SB16_8.DLL without it.

**Single discriminating experiment:** keep js-dos 8.5.4, the exact same
C:/ game files, no game mixer and the Museum S003 scene; switch **only**
the configured wave driver from W_SB16_8.DLL to W_SB16.DLL, already
present in the owner bundle. No new external DLL, no executable patch.

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --wave-driver W_SB16.DLL \
      --out output/r05-probes/r05-v8-sb16-16bit.jsdos

Open http://127.0.0.1:8765/v8-local.html. Import the newly converted
archive; listen to identical left/right and front-center effects in
Museum. Expected **hypothesis**, not observed result: cleaner panning
because the 16-bit driver does not use the broken 8-bit classifier.
If sound becomes muffled or silent, revert to validated 8-bit output.
Do **not** apply a global WebAudio L/R swap; that would also reverse
future CDDA music and voice channels, which are not implicated.

DOSBox Staging has a per-device `MIXER SB REVERSE` feature, but the
selected js-dos 8 backend is not DOSBox Staging and its upstream DOSBox
fork's mixer code has no evidence of supporting that command. Do not
silently assume compatibility:
https://www.dosbox-staging.org/0.83/manual/sound/mixer/

## 2. Original voices: .VOX banks are absent from the current ZIP

The prior claim that voices depend on a missing `VOX.HQR` was wrong.

The original [SOURCES/MESSAGE.C](https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/MESSAGE.C)
defines `PATH_NAR_HD "VOX\\\\"` and loads per-language banks such as
`VOX/EN_SYS.VOX`, `VOX/EN_GAM.VOX`, and `VOX/EN_000.VOX`.
It first tries voices on the hard drive and falls back to
`D:/LBA/VOX/...` on the original CD if not found. The builder currently
copies only top-level EXE/HQR/DLL/CFG, excluding the VOX subdirectory.

**Important safety detail:** `FlagKeepVoice: OFF` does *not* disable
speaking by itself. In MESSAGE.C::ClearVoiceFile it lets the game delete
cached VOX bank files upon exit. To protect bundled files, the
opt-in v8 converter now sets `FlagKeepVoice: ON` when voices are
included. This only modifies the private copy of LBA.CFG in the ZIP.

Game config is `LanguageCD: English`; the converter deliberately
selects English EN_*.VOX banks only, avoiding needless packaging of
every other language.

Check the owner installation without changing it:

    VOX="/mnt/fast-ssd/Games/Heroic/tlba-classic/Speedrun/Windows/VOX"
    find "$VOX" -maxdepth 1 -type f -iname 'EN_*.VOX' -printf '%f  %k KiB\n'

Generate an isolated v8 private archive preserving 8-bit PCM with
authentic English DOS voice banks:

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --voices-dir "$VOX" \
      --out output/r05-probes/r05-v8-english-voices.jsdos

In the v8 player, load a saved scene, initiate an actual character
dialogue with text and check audible spoken lines. Menu sounds and
footsteps are not voice tests. A loaded file list in the ZIP is a
structural check, not proof of audible voice decoding.

## 3. Original CD music: owners have all nine MP3s, but the game got a data-only ISO

`SOURCES/AMBIANCE.C::PlayMusic` uses PlayCdTrack for indices 1..9
when CDEnable is true. The owner GOG installation has
`Common/Music/Track_02.mp3` through `Track_10.mp3`, but our default
bundle mounts `LBA.ISO` without CD audio tracks. The Adeline logo is
separate: `PlayMidiFile(31)`, muted by `MidiDriver: NoMidi`.

The preexisting `make-cdda-probe.py` now supports a coherent v8 test
path. First check actual CUE transport with synthetic PCM tones:

    python3 scripts/runtime/make-cdda-probe.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --mode tone \
      --out output/r05-probes/r05-cdda-tone.jsdos

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-cdda-tone.jsdos \
      --cd-image LBA.CUE \
      --out output/r05-probes/r05-v8-cdda-tone.jsdos

Import `r05-v8-cdda-tone.jsdos` in the v8 test page; verify the CUE
was mounted and an in-game CD music event actually triggers an audible
tone. Silence without a confirmed music event is inconclusive.

Only once the CD-DA transport is validated, generate the owner's
compressed-track version:

    python3 scripts/runtime/make-cdda-probe.py \
      --input output/r05-probes/r05-sb16-8.jsdos \
      --mode owner-mp3 \
      --gog-root /mnt/fast-ssd/Games/Heroic/tlba-classic \
      --out output/r05-probes/r05-cdda-owner.jsdos

    python3 scripts/runtime/prepare-jsdos8-bundle.py \
      --input output/r05-probes/r05-cdda-owner.jsdos \
      --cd-image LBA.CUE \
      --out output/r05-probes/r05-v8-cdda-owner.jsdos

MP3 decoding in the actual WebAssembly DOSBox binary remains an open
gate. A successful synthetic tone does not establish MP3 decoder
support. The reference DOSBox fork gates SDL_sound/CD audio compressed
decoding on `C_SDL_SOUND`. Do not assume it is compiled in:
https://github.com/js-dos/dosbox/blob/main/src/dos/cdrom_image.cpp

Audio CD volume is initialized to 0 in our LBA.CFG; original
SOURCES/PERSO.C and SOURCES/GAMEMENU.C read and update this value for
the original hardware mixer. Since our game selects NoMixer, zero
*does not itself prove* the emulated CDAUDIO channel is muted.
If a correctly mounted and actively playing CDDA track is still silent,
inspect the DOSBox mixer channel and gain separately, without
changing SB16 effects at the same time.

## Acceptance and stop rules

1. Restore correct L/R panning while preserving the already verified
   js-dos 8 PCM fidelity. This remains unverified.
2. Voice: English VOX banks physically present in the owner source;
   output validated; audible dialogue confirmed. This remains unverified.
3. CD: CUE track enumeration and synthetic tone actually audible;
   then GOG MP3 decoding and correct track numbering. Both unverified.
4. Museum S003, movement, checkpoint, no browser regressions.

Keep all original private game/voice/audio data in ignored `output/`.
No original assets or bundled binaries in `web_deploy/` or GitHub.
No merge until owner has performed the runtime tests.
