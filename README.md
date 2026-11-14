# Project Atlas

An original isometric portfolio project for GitHub Pages, with a **local asset-first pipeline** for characters, furniture, electronics, architectural elements and animations. The current js-dos development page accepts a user-selected, privately held game bundle. The intended final portfolio will be directly playable without a separate game installation.

**Development branch:** [feature/portfolio-studio-j1-j8](https://github.com/yassinebkr/lba-custom-portfolio/tree/feature/portfolio-studio-j1-j8). No merge into main.

**Visual status:** the six current game rooms are functional **placeholders**, not finished art. J2/J3 test the asset pipeline on original synthetic illustrations. A polished original room is the next artistic milestone (J4).

## Architecture

~~~mermaid
flowchart LR
  INPUT["Photos / illustrations / Blender PNG"] --> RECIPE["Single JSON recipe"]
  RECIPE --> CONVERT["Offline Pillow converter"]
  CONVERT --> ATLAS["PNG atlas + animation metadata"]
  CONVERT --> QA["Real rendered contact sheets"]
  QA --> APPROVE{"Visual and rights approval?"}
  APPROVE -->|no| INPUT
  APPROVE -->|yes| GAME["Future finished game scenes"]
  GAME --> DIST["Allowlisted dist/"]
  DIST --> PAGES["GitHub Pages"]
~~~

The asset pipeline precedes the editor. Blender is optional for missing camera angles or complex geometry. The existing React Studio is a prototype for later simplification, not a requirement for creating assets.

## Run the new pipeline

~~~bash
python3 -m pip install Pillow==11.3.0
python3 pipeline/fixtures/generate_samples.py --out /tmp/atlas-source
python3 pipeline/asset_batch.py /tmp/atlas-source/recipe.json --out /tmp/atlas-qa
# Open /tmp/atlas-qa/index.html to inspect the real exported frames
python3 -m unittest discover -s pipeline/tests -v
~~~

The test batch includes a four-direction character, an electronics bench, chair, cinema camera, RF console, door and four-frame lamp. They are **synthetic original fixtures**, not photographs and not production-quality, approved art. Actual QA exports are downloadable from [J3 GitHub Actions](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41259496223).

For your own sources, provide PNG/JPEG/WebP images and a JSON recipe. See the [pipeline guide](pipeline/README.md) and [asset-first contract](pipeline/ASSET_FIRST.md).

## R05 — Private DOS bundle reconstruction on Debian

[**Rebuild your private .jsdos from a clean LBA1 installation**](docs/R05_PRIVATE_DOS_BUILD.md) · [Linux ISO/ZIP test evidence](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43359708088) · [Real js-dos ZIP extraction CI](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43360752067)

The Linux builder now produces the canonical js-dos 6.22 ZIP with a verified ISO9660 volume, required root files and guarded RELENT.EXE patches. Synthetic integration tests pass. The owner has confirmed a successful private GOG-derived DOS game launch through the GitHub Pages importer (2026-11-13). Original audio remains an open R05 gate, but the Museum save and checkpoint respawn have been confirmed by the owner; terminal Game Over remains separately unverified.

## R05.1 — Stabilizing audio, scene saves and game-over behavior

[**Recover the previous LBA workflows and run the controlled tests**](docs/R05_RUNTIME_RECOVERY.md) · [**R05.5 verified v8 PCM, stereo/voices/CDDA follow-up**](docs/R05_AUDIO_85_RESULTS.md) · [**R05.6 VOX extraction size and memory diagnosis**](docs/R05_VOX_EXTRACTION_DIAGNOSIS.md) · [**R05 6.22 vs 8.5.4 and CDDA acceptance procedure**](docs/R05_EMULATOR_AB_PROCEDURE.md) · [**R05 DOS-first reassessment (js-dos 8.5.4, config bug, CDDA)**](docs/R05_JSDOS_REASSESSMENT.md) · [**R05 audio root-cause analysis and architecture decision**](docs/R05_AUDIO_ARCHITECTURE_RESEARCH.md)

The owner confirmed that generated DOS saves (including Museum S003) load and a death returns to the checkpoint. **js-dos 8.5.4 with the original W_SB16.DLL 16-bit stereo driver has owner-validated clean Sound Blaster effects and correct left/right spatialization.** The earlier 8-bit driver reversed stereo. English VOX voice playback remains unverified because the owner's first voice-bundle import stalled; CD music is still absent from the tested data-only ISO. The Adeline logo jingle remains disabled by `MidiDriver: NoMidi`. Browser packaging tests do not establish voice or CD audio fidelity. No automatic scene boot patch is proven yet.

## DOS browser bootstrap and visual verification

**[Launch the js-dos browser test — import your own local .jsdos](https://yassinebkr.github.io/lba-custom-portfolio/web_deploy/)**

On this experimental branch, `web_deploy/` now uses **js-dos 8.5.4 as the primary importer at `/`** while `/v6-local.html` retains the earlier 6.22 control. Local runtime artifacts are installed into gitignored `web_deploy/vendor/jsdos854/` via `scripts/runtime/install-jsdos8.py`; therefore the new v8 homepage is **validated locally but must not be described as deployed publicly** until the release packaging supplies the freely redistributable js-dos runtime files. The original GOG-derived game and private `.jsdos` files are never uploaded to the page.


[Open the V6 sprite comparison](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/compare.html) · [Open the V7 original workshop review](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/scene-lab.html)

R04 has a successful GitHub Pages deployment and a verified browser test of the real js-dos ZIP extractor using synthetic test files. A real commercial-game boot was confirmed by the owner; R05.1 now covers sound, targeted saves and game-over behavior. The R04 milestone puts js-dos on GitHub Pages with a local .jsdos import control and no hosted commercial game data. The launcher is a separate development route until its Pages deployment and real gameplay have been verified. These are the existing **original-art browser previews**. The visual QA routes remain subject to in-browser artistic review. They show the sprite production and original test scene. Loading the real game has been validated by the owner, while direct scene loading and sound have not.

[**Revised R04–R09 DOS reconstruction and GitHub Pages QA plan**](docs/DOS_REBUILD_PLAN.md)

R04 publishes the local-file DOS launcher first. The planned R08 extended QA page will compare real 128/160/192px original-asset exports through a stable README link. Publishing a .jsdos archive requires a separately verified right to redistribute every included executable and resource.

## GitHub Pages

The six-room playable prototype lives in [apps/portfolio](apps/portfolio/README.md).

~~~bash
node scripts/build-portfolio.mjs
node --test apps/portfolio/rules.test.mjs apps/portfolio/rooms.test.mjs
~~~

Only allowlisted public files enter dist/. The GitHub Actions publishing job uses exactly that same builder. To deploy, select **Settings → Pages → Source → GitHub Actions** and manually dispatch the Portfolio CI and optional Pages deployment workflow. The source-branch root redirect is a legacy fallback, not the intended Actions publication. A green CI result does not establish that the new live Pages URL has been verified.

## Documentation

| Document | Purpose |
| --- | --- |
| [Technical architecture](docs/ARCHITECTURE_TARGET.md) | Architecture, module ownership, data relationships and hosting |
| [J1–J8 milestones](docs/MILESTONES.md) | Current asset-first order, acceptance criteria and CI evidence |
| [Asset-first design](pipeline/ASSET_FIRST.md) | Recipe format, rights gates and third-party evaluation |
| [Pipeline guide](pipeline/README.md) | One-command build and outputs |
| [Pages deployment](docs/PAGES_DEPLOYMENT.md) | Branch-root fallback versus verified Actions artifacts |
| [Studio UX](docs/STUDIO_UX_SPEC.md) | Later simplification requirements |
| [Asset schema](packages/asset-schema/README.md) | Existing validators for rights and scene documents |
| [Legacy LBA workspace](docs/LEGACY_LBA_README.md) | Preserved historic research; excluded from the public build |

Original LBA art, models, archives and voices must never be part of the public portfolio. All development remains on the dedicated branch, with tests, small commits and no merge.

## M1–M6 implementation and public rights boundary

The [milestone implementation report](docs/IMPLEMENTATION_M1_M6.md) records the extracted original sprite codec, independently generated palettes, Blender directional render specification, separate-instance scene drawing, approved-asset browser loader and strict release checklist. The approved-asset catalog is **currently empty**: no proprietary LBA graphics and no unreviewed generated placeholders are packaged as final art.

Technical check: `node scripts/release-audit.mjs --ci`. Final-art gate: `node scripts/release-audit.mjs --strict` (expected to fail until a polished original scene and all rights/visual reviews are complete).

### Real authored content production

New: [Original Blender renderer](pipeline/blender/README.md) → [Blender-to-recipe adapter](pipeline/original_recipe.py) → [image/atlas builder](pipeline/asset_batch.py) → explicit manual art and rights approval → [public catalog compiler](pipeline/APPROVED_WORKFLOW.md) → [original-sprite browser runtime](apps/portfolio/approved-runtime.mjs). The [technical/visual acceptance status](docs/IMPLEMENTATION_M1_M6.md) contains the exact test runs and unfulfilled quality gates.

**The generated Blender smoke image and browser tests are not final art.** The site still displays the old geometric rooms until genuinely polished original graphics are explicitly reviewed and approved; no HQR archives, game sprites or game-derived palettes are used to publish public art.


## V1–V5 — visual quality production (work in progress)

[Art direction](docs/ART_DIRECTION.md) · [Source/output loss audit](docs/VISUAL_QA.md) · [Blender look-dev and V5 matrix](docs/SPRITE_RENDER_PRESETS.md)

The original telemetry receiver now has deliberately layered 3D detail and a shared warm-key/cool-fill/rim lighting setup. Its comparison workflow produces **24 real PNG atlas variants** from the same unchanged Blender originals: 192/224/256px, BOX/Lanczos, truecolor/96/160/256 colors. Every candidate preserves fractional alpha and relative camera framing, and the comparison is a local CI artifact rather than a public gallery.

**Visual approval remains pending.** Do not confuse generated test geometry with professional quality. No V6–V8 changes, no release of new art to GitHub Pages, and no merge into main are authorized by this set of changes.

## V5 verified engineering comparison

[See the actual V5 GitHub Actions render, PNG matrix and comparison files](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41267195377). Details and measurements are in [Visual QA](docs/VISUAL_QA.md). V1–V5 does not publish new art or start V6–V8.


## V6 — live comparison gallery (original pipeline evidence)

The separate [V6 Visual Quality Lab](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/compare.html) places three actual stages side by side: Blender source (768px), non-quantized RGBA sprite, and the selected 96/160/256-color variant. Controls cover NE/NW/SW/SE, 192/224/256px, Lanczos/BOX, 100/150/200% zoom, dark/light/checkerboard and optional crisp pixels. The metrics are loaded from the real V5 matrix.json, not generated from guesses.

Source content is pinned to the green [V5 Blender Action run 41267195377](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41267195377) and all 24 PNG hashes are checked before entering dist. The four original 768px PNGs are published **only for this explicit comparison demo**; Blender/GLB, internal conversion scripts, legacy HQR files and any non-reviewed gameplay art are excluded. The V6 page is **not** an approval of its art, a production scene, or an implementation of V7/V8.

Source code: [V6 comparator](apps/portfolio/sprite-demo/compare.mjs). Visual and release policies: [Visual QA](docs/VISUAL_QA.md).


## V7 — Original workshop, actual sprite at game scale

[Open the original V7 workshop QA scene](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/scene-lab.html). The receiver uses the same V5 256px RGBA sprite atlas in a wholly new 3D Blender room. Change the four directions, 160-color/truecolor, scale, table-lip foreground pass and contact-shadow preview; drag the instrument on the tabletop. The page uses two 960×640 original Blender PNG renders plus an approved-for-review-only layout, never a builder or original LBA game files.

The [V7 technical architecture, verification and limitations](docs/IN_SCENE_QA.md) describe the world-space anchor, actual depth passes, remaining shadow/artistic issues, and explicit V8 boundary. The maintainer accepted V6; the small perceived proportion difference between the V6 views remains deferred.


## DOS runtime integration — R01 to R03

The DOS LBA adaptation targets js-dos 8.5.4 for current private runtime testing, while 6.22 remains a regression control. The reusable creator workflow exports [WorldPackage v1](docs/R02_WORLD_PACKAGE.md), and the independent DOS adapter converts original images into native indexed sprite and brick payloads.

- [R01 — source and runtime dependency audit](docs/R01_DOS_AUDIT.md)
- [R02 — versioned portable world contract](docs/R02_WORLD_PACKAGE.md)
- [R03 — real V5/V7 image compatibility, size and fidelity report](docs/R03_DOS_COMPAT.md)

Original DOS files and repacked HQR archives remain private local inputs. The [R03 GitHub Actions run](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43347166066) verifies actual original-image conversion to four 128px DOS sprite payloads and one original scene brick. The live js-dos runtime integration is a separate pending gate.

The final GitHub Pages deployment will contain the playable portfolio and its reviewed runtime resources. The creator pipeline, editor, source models and QA galleries stay in the authoring project.
