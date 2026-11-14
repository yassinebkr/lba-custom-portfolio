# R05 — Original DOS scene-entry and cinematic regression guard

**Decision:** keep the original DOS engine under js-dos 8.5.4 as the
owner-local runtime. Create original assets with existing asset authoring
and DOS/HQR adapters. Do not replace scene runtime with a second
JavaScript/Canvas implementation. The earlier experimental JavaScript
workshop preview has been withdrawn from this branch.

## Confirmed historical failures and byte-guarded workaround

Two original engine calls could leave the private data-only ISO unable
to complete startup:

| Executable site | Original action | Existing compatible-version workaround |
| --- | --- | --- |
| `RELENT.EXE:0x0f83f` | `PlayAnimFla("INTROD")` | 13 verified NOP bytes |
| `RELENT.EXE:0x10e71` | `PlayAnimFla("DRAGON3")` | 13 verified NOP bytes |

The source-specific patcher
`scripts/hqr-tools/patch-relent.js` additionally modifies two
CD-detection / installation-check sites (`0x10a5f`, `0x10af1`).
All four signatures are checked before modifying the commercial
executable in an owner-local, ignored output directory.
`scripts/runtime/build-private-jsdos.py` already validates the
four *patched* signatures when constructing the 6.22 baseline.

**New regression guard:** `scripts/runtime/prepare-jsdos8-bundle.py`
now verifies those same four patched signatures BEFORE copying game
files into any v8 archive. If one is absent or if another executable
revision has different offsets, it refuses the conversion, without
altering the original ZIP. CI contains both a successful synthetic
fixture and separate corrupt-signature cases.

Sources:
- [Historical reverse-engineering notes](LEGACY_LBA_README.md)
- [Guarded patcher](../scripts/hqr-tools/patch-relent.js)
- [v8 private bundle converter](../scripts/runtime/prepare-jsdos8-bundle.py)
- [Synthetic regression tests](../scripts/runtime/test_r05_media_probes.py)

## Important limitation: these patches do NOT skip every map cinematic

The engine source has **scene-script opcodes** that can invoke video
playback independently of the two static startup sites:

- `SOURCES/GERELIFE.C::LM_PLAY_FLA` around line 1096:
  stops samples, calls `FadeToBlack`, then
  `PlayAnimFla(PtrPrg)`, restores timer and marks a fade.
- `SOURCES/GERETRAK.C::TM_PLAY_FLA` around line 78:
  reads a null-terminated video name from a track script,
  fades to black, plays it, then calls `AffScene(TRUE)`.
- `SOURCES/GAMEMENU.C::MenuDemo()` around lines 3197–3225:
  the AFK menu demo separately calls `PlayAnimFla("DRAGON3")`
  and `PlayAnimFla("BATEAU")`. The two hardcoded startup
  patches do not establish safety for these calls.
- Initial dialogue screens and quest transitions can remain even
  after a static FLA call is bypassed.

Original engine sources:
- https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GERELIFE.C
- https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GERETRAK.C
- https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/GAMEMENU.C
- https://github.com/LBALab/lba1-classic-community/blob/main/SOURCES/PERSO.C

A **scene-entry black screen** may be caused by a missing script-
referenced FLA, but that is a *hypothesis* until the selected scene's
life/track script and running guest behavior are inspected.
Do not ascribe the separate death/GameOver black screen to missing FLA:
`GameOver()` has its own 3D model/sample path.

## Preflight before authoring against a new DOS scene

1. Retain the currently working private v8 archive, original `RELENT.EXE`
   signatures, known 16-bit wave driver, English voices, and accessible
   `S003` Museum save as controls. **Do not overwrite them**.
2. Choose the scene explicitly in an owner-local `Snnn.LBA` save
   using the existing `create-savegame.js` tool. Its generated quest
   flags are intended to skip specific prologue states, but they are
   **not a blanket cinematic-disable option**.
3. Identify script-driven FLA triggers for the *chosen* entry scene
   (life and track scripts, including quest-flag dependencies), before
   deciding whether to exclude a missing video or change a script.
   We do not yet have a validated universal scene-script FLA linter;
   do not claim one.
4. Test the unmodified candidate scene with the patched executable
   on the owner-local js-dos 8 player. Record entry time, whether
   animation/dialogue occurs, guest responsiveness, scene movement
   and any black-screen state.
5. If blocked, distinguish a missing FLA from non-video dialogue,
   fade/palette, quest-state, collision or resource problems.
   Preserve timer/script semantics: blindly NOPing a script opcode
   can corrupt instruction-pointer alignment and scene state.
6. Only then adapt that original scene's assets using the existing
   palette/brick/sprite injection tools; retest the identical saved
   entry and first interaction. CI synthetic packaging alone is not
   sufficient evidence of real scene compatibility.

The **automatic launch into a chosen scene has never been merged**.
The verified route is currently **Continue Saved Game → Museum S003**.
Inserting a save into a ZIP is not automatic scene boot.

## Target architecture and publication boundary

Original authoring masters -> existing image/animation atlas QA ->
`adapters/lba-dos/` indexed export -> `inject-sprite.js`,
`inject-brick.js` and when needed `inject-scene-image.js` ->
private HQR overlays -> signature-checked DOS bundle -> js-dos 8.5.4.

This preserves the engine's existing animation, spatial, scene and
script behavior, including its technical constraints (shared tile
stamps, limited scene layout count and fixed palette). The original
asset pipeline does **not** yet have a usable character/animation
creation GUI. These deficits remain open; the earlier JS workshop
preview is not a substitute.

The commercial GOG executable, original game assets, scene scripts,
FLAs and original music/voices are not distributable as part of a
public open-source portfolio template without independent rights
clearance. Keep all such files owner-local. A separate, appropriately
licensed DOS engine build with 100% cleared replacement resources
would require its own integration and rights validation.

**Acceptance gate for every newly selected DOS scene:**
real engine loads without unresolved FLA playback, maintains control
after entering and leaving the scene, and survives the chosen first
interaction. An indexed PNG/HQR conversion by itself is not proof
of that behavior.
