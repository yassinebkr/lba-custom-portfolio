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
| **M3** | Blender GLB four-direction export script, optional named armature action and deterministic timed frame metadata; pure export-spec tests | **Blender rendering with an actual licensed rigged GLB and artistic evaluation** |
| **M4** | Instance-preserving scene renderer, painter sorting, pivots, footprint collisions and atlas frames; pure canvas tests | **A completed, rich original room composed of reviewed artwork** |
| **M5** | Browser runtime can load approved PNG atlas scenes, preserving directory/navigation fallback; build copies only reviewed assets | There are currently **zero approved assets and zero approved scenes**, so procedural fallback remains visible |
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
