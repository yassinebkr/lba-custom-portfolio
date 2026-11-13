# Deployment decision — GitHub Pages

**Deployment history:** the original configuration supplied by the maintainer was branch `feature/portfolio-studio-j1-j8`, folder `/(root)`. GitHub Actions Pages publishing subsequently reported a successful deployment of commit `c681b395` via [run 43357784746](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43357784746). Direct external HTTP verification of the live page remains outstanding.

## DOS bootstrap — client-side private bundle import

The [R04–R09 plan](DOS_REBUILD_PLAN.md) prioritizes a GitHub Pages js-dos loader with a client-side file chooser. The visitor selects their local .jsdos archive; a temporary blob URL supplies the bytes to the browser's js-dos 6.22 ZIP extractor. The archive is never uploaded to GitHub Pages or inserted into the static release.

The public loader is intentionally empty until a visitor selects their local .jsdos archive. A privately reconstructed DOS bundle assembled from an owned commercial game installation is used for verification. Publishing that bundle requires independent redistribution clearance for all embedded components. The final Pages artifact will contain only the finished portfolio. All preview links must be verified against the deployed site before they are described as working.

## R04 client-side importer verification

The public development endpoint is [js-dos local bundle import](https://yassinebkr.github.io/lba-custom-portfolio/web_deploy/), linked from the repository README.

GitHub Actions validates the allowlisted js-dos 6.22 browser files, exercises the import controls, and verifies that the **actual js-dos 6.22 ZIP extractor** can unpack a synthetic user-selected archive from a blob URL in Chromium. The DOS execution callback is intercepted to avoid attempting to run placeholder executable bytes. The test does not establish that a full commercial-game bundle has launched. See [integration run 43358129663](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43358129663). The first real private .jsdos boot remains R05.

The static release ships the importer and js-dos vendor JavaScript only. Imported archives are selected in the visitor's browser and read through a temporary blob URL. Commercial HQR/EXE/ISO files must never be committed to the feature branch or included in the deployed artifact.

A release-tagged development commit may run the optional Pages publishing job. A passing job must be followed by an actual browser check of the endpoint.

## Current publication route (no settings change)

```mermaid
flowchart LR
  G["Feature branch /(root)"] --> P["GitHub Pages branch build"]
  P --> I["/index.html"]
  I --> |"relative redirect"| W["/apps/portfolio/index.html"]
  W --> J["Original JS modules + CSS inline"]
```

- A minimal root `index.html` redirects using a relative URL; a visible HTML link works without JavaScript.
- `.nojekyll` opts out of Jekyll transformations and keeps ES modules and asset paths unchanged.
- This preserves the user’s configured branch-root deployment; no Pages settings change is necessary.
- The runtime must use only relative module and asset URLs; local and browser tests must include the repository subpath.
- The historical js-dos source remains in the repository but no proprietary game .EXE/.HQR/.ISO/.jsdos files are tracked. **With branch-root publication the rest of the repository may also be publicly retrievable; do not commit private inputs or secrets.**

## Cleaner future release (requires a conscious settings change)

Publishing a GitHub Actions artifact containing only `dist/` would reduce the exposed source surface and avoid branch-root workarounds, but this changes Pages Source settings and is **not being done silently**. The GitHub Actions publish job now runs `scripts/build-portfolio.mjs` and uploads exactly the same allowlisted `dist/` checked by CI. No manual hard-coded copying of a subset of runtime modules remains.

## Verification gate

The last recorded `pages build and deployment` run was successful, but **a successful Pages build is not proof the user-facing URL loads**. Verify the root and nested URL in a real browser after this commit, including network requests, mobile controls and all six scenes. J1/J8 remain open until live verification evidence is recorded.

## J1 artifact parity and switch-over

The project-subpath browser test now reads from **the built `dist/` artifact**, rather than the source directory. Both verification and deployment invoke the same builder. The workflow currently deploys only via an explicit `workflow_dispatch` event; there is no implicit release from code pushes.

When switching **Settings → Pages → Source → GitHub Actions**, manually run the workflow **Portfolio CI and optional Pages deployment** on the feature branch. The publishing job must pass before visiting the root URL. Never select a `/dist` folder in branch-source settings (GitHub Pages supports branch root or `/docs`, not arbitrary directories).
