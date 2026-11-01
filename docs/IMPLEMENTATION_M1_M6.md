# Project Atlas — M1–M6 implementation and acceptance

**Feature branch only:** feature/portfolio-studio-j1-j8. Do not merge to main or publish unreviewed art. The user approved this architecture on 2026-11-01.

## Code and content boundary

~~~mermaid
flowchart LR
  ORIGINAL["Original PNGs / GLB / licensed sources"] --> BLENDER["Local Blender directional renders"]
  ORIGINAL --> RENDER["Local sprite converter / palette"]
  BLENDER --> RENDER
  RENDER --> ISO["Isometric bricks, atlas, frames, pivots"]
  ISO --> REVIEW{"Rights + visual review"}
  REVIEW -->|reject| ORIGINAL
  REVIEW -->|approve| MANIFEST["Approved asset + scene catalog"]
  MANIFEST --> BUILDER["Allowlisted static build"]
  BUILDER --> DIST["dist/ on GitHub Pages"]
~~~

The *project code* borrows algorithmic ideas from the main-branch LBA image tools. It never copies original LBA game graphics, rooms, characters, sounds, palettes, models or archives into the new runtime. The optional indexed codec uses the same RLE **format**, with palettes generated from owner-supplied originals, not RESS.HQR.

## Actual milestone evidence

| Gate | Implemented and verified | Not yet demonstrated |
| --- | --- | --- |
| **M1** | Dependency-free sprite/brick RLE, palette conversion and dimetric projection; malformed-input tests and 80 deterministic fuzz frames | No right to redistribute third-party extracted game assets is assumed |
| **M2** | Original PNG→palette→private indexed format and PNG/JSON source manifest, independent of LBA files; GitHub Actions tests | A source photograph or detailed original illustration with approved production art quality |
| **M3** | Blender GLB four-direction export script, optional named armature action, actual original static GLB → four distinct PNG images ([CI 41261590066](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41261590066)), export-spec tests, and [Blender→recipe adapter](../pipeline/original_recipe.py) | **Animated rigged GLB playback and actual production-art evaluation** (static original GLB rendering has now been verified in CI) |
| **M4** | Instance-preserving scene renderer, painter sorting, pivots, footprint collisions and atlas frames; pure canvas tests | **A completed, rich original room composed of reviewed artwork** |
| **M5** | Browser runtime loads approved PNG atlases (with real-browser image drawing CI), plus the [reviewed-assets→public scene compiler](../pipeline/compile-approved.mjs) ([CI 41261554873](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41261554873)); build copies only approved art | There are currently **zero approved assets and zero approved scenes**, so procedural fallback remains visible |
| **M6** | Technical public audit, licensing checks, allowlisted staged modules, PNG verification and strict release gate | **Visual acceptance, real Pages deployment, animation QA and final art approval** |

## Public build invariants

- Source images, palettes, intermediate mesh files and Blender programs are not distributed.
- The site includes only necessary HTML/JS, the approved catalog and any explicitly approved PNGs referenced by that catalog.
- Unknown, pending or unlicensed art **fails** the public manifest validator.
- The browser uses the exact same compilation and module paths as the tested dist artifact.
- A missing approved artwork collection means **no game assets are silently added**.

## Quality gate and release policy

~~~bash
node scripts/release-audit.mjs --ci
node --test tests/release-audit.test.mjs

# Fails until artist and rights review have actually been completed:
node scripts/release-audit.mjs --strict
~~~

\`--strict\` must remain failing while there is no visually approved scene. Passing code tests is not a substitute for the quality of LBA1-era sprite artwork or proof that the live GitHub Pages address is correct. The current site is a **prototype**, not a visually completed J4/J8 release.

For source-to-sprite validation, see \`pipeline/compat/\`. For deterministic Blender frames, see \`pipeline/blender/\`. The generic scene compositor lives in \`packages/scene-core/\`. The approved-only catalog used for publishing lives in \`apps/portfolio/assets/approved-worlds.json\`.

## M6 final attestation contract

The strict release gate does **not** self-approve graphics. After actual visual inspection at game scale and checking rights, the owner can explicitly create a **nonexistent until reviewed** file at docs/art-release-approval.json with:

~~~json
{"schemaVersion":1,"manifestSha256":"<sha256 of dist/assets/approved-worlds.json>","reviewedBy":"maintainer","confirmedPagesURL":"https://yassinebkr.github.io/lba-custom-portfolio/","visualEvidence":["real desktop screenshot reference","real mobile screenshot reference"],"confirmedRights":true,"confirmedVisualQuality":true,"confirmedMobileAndDesktop":true}
~~~

The release audit compares the exact SHA-256 digest of the approved manifest and requires all stated attestations before marking the manual part satisfied. The file is intentionally **not created** by automation. The live URL and real images must be checked by the maintainer; an automated test cannot certify art ownership or artistic quality.

## Reproducible original-model → portfolio route

1. Start with a model, photo or other artwork **created from scratch or properly licensed**. For 3D objects, render four views:

~~~bash
blender -b --python pipeline/blender/render_iso.py -- --input originals/my-camera.glb --output /tmp/camera-views --size 256
python3 pipeline/original_recipe.py /tmp/camera-views/animation.json --id my-camera --kind prop --creator 'project-owner'
python3 -m pip install Pillow==11.3.0
python3 pipeline/asset_batch.py /tmp/camera-views/recipe.json --out /tmp/camera-atlas
~~~

2. Inspect the actual PNG outputs and rights. A manifest is **pending by default**; the scripts must not change that. Only after explicit original-content and visual review set the source review state to approved and public permission to true.

3. Export the authored scene from a creator tool or a scene JSON document referencing the reviewed asset IDs. Compile and validate:

~~~bash
node pipeline/compile-approved.mjs --assets /tmp/camera-atlas/assets.json --scenes my-original-scene.json --out apps/portfolio/assets
node scripts/build-portfolio.mjs
node scripts/release-audit.mjs --ci
# Strict release remains blocked pending actual art and owner evidence:
node scripts/release-audit.mjs --strict
~~~

The Blender test's four-view object is an **original synthetic testing fixture**, not artwork ready for the site. Its actual PNG renders are attached to [GitHub Actions run 41261590066](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41261590066). The browser CI uses a one-pixel in-memory test image, never public art. The current public catalog remains empty, and the original six isometric rooms remain low-fidelity functional placeholders.
