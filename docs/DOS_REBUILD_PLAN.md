# DOS portfolio reconstruction and visual verification roadmap

Status: **revised plan, awaiting execution**.
Branch: `feature/portfolio-studio-j1-j8`.
Scope: reconstruction from a clean, lawfully obtained game installation, separate authoring and runtime products, reproducible evidence and reviewed GitHub Pages previews.

## Current baseline

The previous modified LBA1 DOS game booted under js-dos 6.22. The compiled bundle and original HQR archives were ignored by Git. Their historical bytes cannot be recovered from this repository alone.

The damaged Windows NVMe is excluded from the reconstruction workflow. Recovery operations on that device belong to a separate data-preservation process.

| Milestone | Evidence | Status |
| --- | --- | --- |
| R01 — Runtime and dependency audit | [R01 audit](R01_DOS_AUDIT.md) | Complete |
| R02 — Portable world package contract | [R02 contract](R02_WORLD_PACKAGE.md) | Complete |
| R03 — Original asset to DOS codec | [R03 measurements](R03_DOS_COMPAT.md) | Binary conversion passed. In-engine fidelity pending |

The existing public browser renderer in `apps/portfolio/` remains a visual prototype. The DOS reconstruction uses `web_deploy/` and `adapters/lba-dos/`. The creator owns `pipeline/`, `apps/studio/` and the world package. The boundary enables the future creator repository split.

## Delivery sequence

~~~mermaid
flowchart LR
  SOURCE["R04: clean game input and patch compatibility"] --> BUILD["R05: reproducible Debian js-dos bundle"]
  BUILD --> RENDER["R06: in-engine sprite fidelity study"]
  RENDER --> ROOM["R07: playable original workshop"]
  ROOM --> REVIEW["R08: GitHub Pages visual QA"]
  REVIEW --> RELEASE["R09: approved public portfolio release"]
~~~

### R04 — Recover a legally obtained baseline

- Obtain a fresh, legitimate DOS-compatible installation independently of the damaged NVMe.
- Inventory `RELENT.EXE`, required HQR archives, palette, executable version and CD inputs.
- Record hashes and executable patch-site byte signatures. Apply only verified patches.
- Inspect executable and asset redistribution terms. Document whether a distributable engine build is actually available.
- Keep original and derived proprietary files in ignored private directories.

**Acceptance:** the patch script identifies a known binary version, every required private input is accounted for, and incompatible patch sites fail safely.

**Stop condition:** no compatible lawful input is available. Continue only with the original-data-free visual QA track while this is unresolved.

### R05 — Rebuild js-dos 6.22 on Debian

- Reconcile `scripts/build-web-bundle.sh` and `scripts/hqr-tools/build-bundle.js` into a single documented Linux build path.
- Replace Windows PowerShell and IMAPI2 ISO packaging with a deterministic, validated Linux-compatible implementation.
- Verify the ISO9660 volume label, required CD entries, ZIP directory entries, `.jsdos/dosbox.conf`, relative paths and command line.
- Run private browser smoke tests for boot, menu, scene entry, input and rendering. Record browser console errors and bundle size.
- Keep generated DOS binaries and game archives outside Git and the public Pages artifact.

**Acceptance:** a new private bundle starts the DOS game without using the old bundle. A real browser test records the result. The result can be repeated from the same private inputs.

### R06 — Compare source art and the real DOS rendering path

- Export the same original V5 radio at 128, 160 and 192 px where header offsets and pivot placement permit it.
- Consider cropping transparent margins and recalculating the anchor before changing engine code.
- Compare original RGBA, decoded indexed pixels, the original DOS palette and a custom palette only where compatible.
- Measure color error, alpha-edge loss, image occupancy, frame clipping, encoded bytes and browser performance.
- Present equivalent camera angles and at-game-scale screenshots. Preserve original masters.
- Require a documented user visual decision before selecting the final conversion preset.

**Acceptance:** four orientations have correct pivots, visible detail survives at the intended screen size, and the selected preset has a reproducible private in-engine screenshot.

**Stop condition:** if the existing DOS renderer cannot reach acceptable quality, evaluate a source-level renderer adaptation against the simpler exporter changes.

### R07 — Integrate one playable original DOS workshop

- Bind the chosen sprite entries to actual DOS runtime scene references.
- Convert approved original architectural elements into valid brick, layout and grid data.
- Verify `LBA_BRK.HQR`, `LBA_BLL.HQR` and `LBA_GRI.HQR` relationships and in-game collision behavior.
- Run one complete interaction with keyboard navigation and scene transition.
- Keep the art master, engine adapter and generated DOS archives independently testable.

**Acceptance:** an original workshop runs in the DOS game with one interactive original object, correct depth, collisions and a repeatable private gameplay recording.

### R08 — Public GitHub Pages visual QA

- Add a dedicated, clearly labeled **visual QA** route under the existing GitHub Pages site.
- Display only original/licensed graphics: source artwork, original test-scene frames, 128/160/192 px codec previews and measurements.
- Include directional selection, side-by-side comparisons, checkerboard and dark/light backgrounds, integer scaling and pixel-grid inspection.
- Offer a direct clickable link near the top of `README.md`.
- Add a Pages-subpath browser smoke test, screenshot artifact and strict distribution allowlist to CI.
- Display screenshots from the running DOS game only after verifying every visible resource and embedded executable is distributable.
- Validate the actual GitHub Pages URL in a browser. Workflow success alone is insufficient.

**Acceptance:** the maintainer can open the README link, inspect each real exported variant and provide visual approval with a traceable build revision.

**Publication boundary:** GitHub Pages is publicly accessible. The private modded original game bundle must remain private. A protected/local runtime session is used for DOS screenshots until legal clearance.

### R09 — Deliver the finished portfolio

- Package a playable runtime with cleared executable and original or otherwise redistributable game resources.
- Verify the complete license chain, credits and distributable dependencies.
- Enforce an explicit allowlist containing only the finished site and required runtime files.
- Verify loading, interactions, browser support, accessibility and performance from the deployed Pages URL.
- Remove temporary visual QA pages from the final public artifact, or move them to an independent QA site.
- Link the final playable portfolio from the README after deployment verification.
- Keep creator tools and their source data available independently for a future standalone repository.

**Acceptance:** an ordinary visitor can open the final GitHub Page and explore the portfolio without a private game installation. Public release remains blocked until the necessary rights and runtime checks pass.

## Public review URLs

The project already records these links for **original-asset review**:

- [V6 directional sprite comparison](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/compare.html)
- [V7 original workshop scene lab](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/scene-lab.html)

Their current live availability has not been confirmed during this plan revision. The R08 DOS-compatibility QA page is planned and must acquire a separately verified URL. Existing V6/V7 Pages demos exercise the original browser preview rather than `RELENT.EXE`.

## Engineering and review rules

- Preserve modular boundaries. Shared world data stays independent of HQR and js-dos.
- Follow existing English documentation, consistent headers, predictable error handling, edge-case tests, and smallest independently testable modules.
- Keep source code comments focused on technical behavior, invariants and external API contracts.
- Review artifacts are generated from reproducible source inputs and labeled by version and source.
- Perform one scoped commit and push at each accepted milestone. CI and real-browser verification are separate evidence.
- Preserve `main` until an explicit merge approval is given.
- Preserve the damaged Windows NVMe. The reconstruction uses clean data sources.
- Seek visual approval before promoting an artistic variant to the final portfolio.

**Immediate next work:** R04 inventory, rights and patch compatibility. Start R05 after R04 passes. Keep the existing V6/V7 QA links available in the README during reconstruction.
