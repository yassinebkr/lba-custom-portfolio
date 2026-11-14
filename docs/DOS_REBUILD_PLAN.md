# DOS portfolio reconstruction and visual verification roadmap

Status (2026-11-14): **R05 DOS boot, Museum S003 save, 16-bit stereo sound effects and separate English VOX playback are owner-confirmed under js-dos 8.5.4.** CD-DA music, the Adeline MIDI jingle and the v8 death/terminal-Game-Over path are still open. A right-side host-volume slider (30% initial level) and a non-image black-frame diagnostic have been added. See [R05.7 evidence and death protocol](R05_85_VOLUME_GAMEOVER.md).
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
  HOST["R04: public Pages DOS loader"] --> SOURCE["R05: private game source and repeatable bundle"]
  SOURCE --> RENDER["R06: in-engine sprite fidelity study"]
  RENDER --> ROOM["R07: playable original workshop"]
  ROOM --> REVIEW["R08: GitHub Pages visual QA"]
  REVIEW --> RELEASE["R09: approved public portfolio release"]
~~~

### R04 — Public GitHub Pages runtime bootstrap

**Evidence:** [Pages deployment 43357784746](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43357784746), [real js-dos ZIP extraction CI 43358129663](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43358129663). The external site URL has not been independently fetched in an outside browser.


- Serve the existing js-dos 6.22 browser runtime and a local-file import interface on GitHub Pages.
- Provide a clearly labeled **Import local .jsdos** control. The browser reads the file selected by its visitor through a temporary blob URL and passes it to the legacy `fs.extract` ZIP loader.
- Preserve the private game archive on the visitor's device. No archive upload, GitHub commit, external telemetry, permanent storage or automatic fetch of official assets is allowed.
- Validate file extension, minimum ZIP signature and size before extraction. Report ZIP and emulator startup errors with a recoverable import control.
- Hide the import prompt only after extraction succeeds, then start the game in the existing js-dos canvas. A page reload clears the selected archive.
- Publish only the loader, js-dos runtime code, original/approved preview artwork, and verification tools. Keep proprietary HQR/EXE/ISO/.jsdos bytes out of Git and Pages.
- Add an explicit README link, branch-root route, allowlisted Actions artifact and a browser test under the repository Pages subpath.

**Acceptance:** the live Pages URL loads the js-dos import page; a test ZIP exercises the import, error and visibility states; the public artifact contains zero proprietary game data.

**Runtime gate:** loading the actual private game and rendering a frame remain open until R05 supplies a compatible bundle. An upload UI passing tests alone is insufficient.

### R05 — Rebuild the private DOS bundle from a clean game installation

**Technical evidence:** [Linux ISO/ZIP packaging](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43359708088) and [real js-dos 6.22 extraction of the Linux-generated ZIP](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43360752067). [Private owner-local build instructions](R05_PRIVATE_DOS_BUILD.md). Real DOS gameplay is still unverified.

- Obtain a fresh, lawfully acquired DOS-compatible game installation independently of the damaged NVMe; use official assets locally during early engine validation.
- Inventory `RELENT.EXE`, original HQR archives and palette, required CD inputs, patch-site bytes and source version. Prefer a compatible open-source engine build where verified.
- Reconcile the Windows-based `build-bundle.js` and Linux shell script into a reproducible Debian build, with ISO9660 volume label checks and portable ZIP packaging.
- Confirm `RELENT.EXE`, `LBA.ISO`, `.jsdos/dosbox.conf` and resource paths at bundle root.
- Test private bundle startup through the **R04 GitHub Pages import page**: upload, ZIP extraction, emulator start, first DOS frame, menu, input and scene load.
- Record a real in-engine screenshot for a controlled visual baseline. Keep official content in local private files throughout.

**Acceptance:** a fresh private .jsdos bundle boots through the publicly hosted loader after a local file selection, with evidence from the real DOS runtime.

**Stop condition:** no compatible licensed game files are available, or the engine cannot boot. Do not move to the rendering pipeline or DOS gameplay integration until the failure has been diagnosed.

### R05.1 — Stabilize the real DOS gameplay baseline

**Evidence:** [synthetic CI with DOS save import](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43368679235); [historical recovery audit and private reproduction steps](R05_RUNTIME_RECOVERY.md). Owner reports that the actual GOG-derived private game booted and played on GitHub Pages. This owner report is real-play evidence but it does not establish that sound, direct scene entry and game over work.

- Inventory the GOG DOS source directory and audio config without changing its files.
- Keep `--audio off` as the known playable baseline. Trial `--audio source-wave` is gated on a real source WaveDriver DLL, verified port/IRQ/DMA and a private manual test. MIDI and voice remain off.
- Reuse the historical `create-savegame.js` to generate DOS `Snnn.LBA` slots for named known scenes. Include them with `--saves-dir` and test *Continue Saved Game* in the real DOS menu.
- Verify the scene coordinates, collision and transitions. Do not claim an automatic direct scene launch based on ZIP inclusion alone.
- Characterize the after-death black screen in a controlled scene and identify whether it is the final `GameOver()` transition, failed model/palette rendering or a timer/input deadlock. Make no binary changes without reproduction.
- Do not begin cinematic authoring before art quality validation in R06. The launch page's visual redesign is a separate UI gate; preserve its local-file privacy behavior during any redesign.

**Acceptance:** audible SFX from a real validated DOS driver, a scene-specific save load with controllable Twinsen, and a reproducible game-over outcome without permanent black screen. Mark each sub-gate independently; no synthetic test counts as audible playback or navigable gameplay.

**Owner gate update (2026-11-14):** S003 loads, the v8 16-bit driver produces correct spatial SFX, and authentic English VOX speech is audible with all 12 banks in a *separate* test bundle. Combined 16-bit/VOX interaction, CDDA transport and MIDI jingle are not yet validated. The owner currently observes a black screen after death under v8, so **R05.1 is not accepted**. Never call the old 6.22 checkpoint result proof that v8 terminal Game Over works. The exact on-death framebuffer, clover count and responsive guest state must be checked first.

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

### R08 — Extended GitHub Pages visual QA

- Extend the already functioning R04 GitHub Pages runtime page with a separate, clearly labeled **original-asset comparison** route.
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

Their current live availability has not been confirmed during this plan revision. The R04 local-bundle import page is the next deployment gate. The extended R08 original-asset comparison route remains planned. Existing V6/V7 Pages demos exercise the original browser preview rather than `RELENT.EXE`.

## Engineering and review rules

- Preserve modular boundaries. Shared world data stays independent of HQR and js-dos.
- Follow existing English documentation, consistent headers, predictable error handling, edge-case tests, and smallest independently testable modules.
- Keep source code comments focused on technical behavior, invariants and external API contracts.
- Review artifacts are generated from reproducible source inputs and labeled by version and source.
- Perform one scoped commit and push at each accepted milestone. CI and real-browser verification are separate evidence.
- Preserve `main` until an explicit merge approval is given.
- Preserve the damaged Windows NVMe. The reconstruction uses clean data sources.
- Seek visual approval before promoting an artistic variant to the final portfolio.

**Immediate next work:** use the new read-only DOS installation audit, test a historical Museum save via the `--saves-dir` private bundle option, then diagnose the sound driver dependency and the game-over black screen using the known-good silent build. [Procedure](R05_RUNTIME_RECOVERY.md). No change to R06/R07 artistic implementation until these baseline results are recorded.
