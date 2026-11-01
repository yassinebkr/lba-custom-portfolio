# Project Atlas

An original isometric portfolio for GitHub Pages, with a **local asset-first pipeline** for characters, furniture, electronics, architectural elements and animations. **No ROM, game purchase, backend or account is required.**

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
