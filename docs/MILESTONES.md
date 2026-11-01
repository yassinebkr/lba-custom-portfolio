# Project Atlas — milestones and evidence

**Active branch:** feature/portfolio-studio-j1-j8. No merge or force-push to main.

The initial roadmap emphasized a large GUI before proving visual production. The maintainer revised the priorities to **asset-first** on 2026-11-01. This file supersedes the old ordering; historical code and commits are preserved.

## Delivery sequence

~~~mermaid
flowchart LR
  J1["J1: static Pages runtime"] --> J2["J2: offline asset pipeline"]
  J2 --> J3["J3: representative QA batch"]
  J3 --> J4["J4: polished original room"]
  J4 --> J5["J5: simplified authoring GUI"]
  J5 --> J6["J6: interaction animations"]
  J6 --> J7["J7: six finished scenes"]
  J7 --> J8["J8: final release"]
~~~

| Gate | Acceptance requirements | Evidence / status |
| --- | --- | --- |
| **J1** | CI browsers load **the actual dist/** at the repository subpath; publishing workflow uses the same files, no proprietary LBA content or backend | **Engineering PASS** — [CI 41259293901](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41259293901), commit 1ec4808. Actions-source live site **not yet verified** |
| **J2** | One local JSON recipe → alpha sprite atlas, common scale/foot baseline, actions/directions, source hashes, review sheets and rights metadata; no cloud dependencies | **Technical PASS** — [Pipeline CI 41259496223](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41259496223), commit dbfd6b6 |
| **J3** | One character (4 directions), two furniture items, two electronic props, architecture piece, animation frames; fail-closed tests for bad paths, duplicates and licensing; deterministic outputs; actual visual inspection | **Technical PASS on synthetic original samples** — [QA artifact and tests](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41259496223), commit 9e0d052. Real photo/Blender artistic acceptance remains open |
| **J4** | Produce one visually convincing original electronics workshop, detailed assets, expressive character and interactions, with real game-scale browser screenshots | Not started; the current six rooms are fixtures, not approved art |
| **J5** | Reduce authoring workflow to Assets, Scenes, Preview with import, image comparison, placement and export; usable without manual JSON | Pending; the existing React Studio is a reference, not approved product UX |
| **J6** | Runtime consumes real animation frame assets and a tested interaction/event state machine | Pending; only a clip timing prototype exists |
| **J7** | Six finished original scenes, correct information, original artwork and working navigation | Pending; existing sparse scenes are placeholders |
| **J8** | Visual, legal, performance and accessibility verification plus successful live Pages Actions deployment | Pending |

## Asset pipeline review

~~~mermaid
flowchart LR
  SOURCE["Owned/licensed images and original model renders"] --> INPUT["Recipe + provenance"]
  INPUT --> PIL["Local Pillow packing"]
  PIL --> PNG["PNG atlases + frame metadata"]
  PIL --> REVIEW["Contact sheets"]
  REVIEW --> GATE{"Artist/rights approval"}
  GATE -->|no| SOURCE
  GATE -->|yes| RUNTIME["Future scene import"]
~~~

The seven J3 samples are original **procedural illustrations**, not photographs or final art. The contact sheets were inspected; they demonstrate recognizable sprites, stable frame geometry and an animated lamp. They do **not** prove professional LBA1-level visual fidelity or automatic single-photo 3D reconstruction. Blender integration on a real licensed model and a real photo reference still require testing before J4.

## Reproduction

~~~bash
node scripts/build-portfolio.mjs
node --test apps/portfolio/rules.test.mjs apps/portfolio/rooms.test.mjs tests/public-build.test.mjs tests/pages-root.test.mjs

python3 -m pip install Pillow==11.3.0
python3 pipeline/fixtures/generate_samples.py --out /tmp/atlas-source
python3 pipeline/asset_batch.py /tmp/atlas-source/recipe.json --out /tmp/atlas-qa
python3 -m unittest discover -s pipeline/tests -v
~~~

## Verified commits

| Scope | SHA | Result |
| --- | --- | --- |
| Branch-root Pages fallback | 983e0ea | Root index and .nojekyll on branch |
| J1 artifact parity | 1ec4808 | Public browser CI success |
| J2 pipeline | dbfd6b6 | JSON recipe + local atlas and QA exporter |
| J3 representative sources | 9e0d052 | Seven synthetic source fixtures, Python validation CI success |

The original HQR/js-dos experiments are retained, but no game-derived assets are approved for redistribution. **Do not call future milestones complete based only on code or placeholder artwork.**


## Visual Quality Pipeline — V1 to V5

| Gate | Implementation | Acceptance boundary |
| --- | --- | --- |
| V1 | Source measurements from actual previous 512px renders and 256px atlas; reusable pixel/alpha audit and tests | Measured binary alpha and inconsistent source frame occupancy |
| V2 | Original golden-sample art direction with material, silhouette, camera and rights rules | Direction documented; human artistic review not automated |
| V3 | Real model source rebuilt from zero: beveled case, service panel, layered display, buttons, engraved features, vents, side knobs, handle and mast | Blender GLB fixture tests; visual quality review required |
| V4 | Shared studio-style warm key / cool fill / rim; PBR materials and 16-bit RGBA high-res renders | Runner compatibility and rendered image inspection required |
| V5 | Non-destructive 24-way export matrix, constant per-view frame origin, truecolor baselines, preserved fractional alpha, objective errors on two backdrops | 24 PNG tests and human preset selection; **no auto-approval** |

V6–V8 are outside the current authorization. The public site retains the older demonstration until the user explicitly approves an artistic candidate. Tests show that a program works; only inspection at real game scale can establish art direction.
