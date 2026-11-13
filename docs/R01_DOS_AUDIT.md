# R01 — Runtime dependency audit

The adapted DOS build has previously booted in js-dos 6.22. The audit starts from that established baseline. The versioned repository contains browser sources and conversion scripts. The executable and original game archives are private build inputs.

~~~mermaid
flowchart LR
  MAKER["World creator"] --> WORLD["Versioned world package"]
  WORLD --> BRIDGE["LBA DOS adapter"]
  PRIVATE["Privately held licensed game files"] --> BRIDGE
  BRIDGE --> BUNDLE["Local js-dos bundle"]
  BUNDLE --> BROWSER["Browser DOS emulator"]
  BROWSER --> PAGES["GitHub Pages release"]
~~~

## Source inventory

| Boundary | Versioned directories | Build requirements |
| --- | --- | --- |
| Authoring | `pipeline/`, `apps/studio/`, `metadata-ui/` | Blender, Python, Node |
| Original source codecs | `packages/asset-core/`, `packages/asset-schema/` | Indexed images and scene manifests |
| DOS packaging | `scripts/hqr-tools/`, `scripts/build-web-bundle.sh` | Owner-provided executable and archives |
| DOS web runtime | `web_deploy/` | js-dos 6.22 and generated .jsdos ZIP |
| Canvas prototype | `apps/portfolio/` | Web scene renderer, QA gallery |
| Release artifact | `dist/` | Approved, runtime-only files |

## Resource-level dependencies

| Resource | Purpose |
| --- | --- |
| `RELENT.EXE` | Patched DOS executable and four verified binary-patch locations |
| `SPRITES.HQR` | Indexed frames stored with row RLE |
| `RESS.HQR` | Shared indexed RGB palette in entry zero |
| `LBA_BRK.HQR` | Indexed brick images |
| `LBA_GRI.HQR` | Scene grid columns |
| `LBA_BLL.HQR` | Layout tables linking cells and bricks |
| `LBA.ISO` | Local CD image required by the existing DOS boot sequence |
| `lba1_portfolio.jsdos` | ZIP bundle with js-dos configuration and game files |

Evidence comes from `build-bundle.js`, `patch-relent.js`, `inject-sprite.js`, and `analyze-scene-bricks.js`.

## Compatibility limitations

- The indexed sprite header stores dimensions in unsigned bytes, with an upper bound of 255 pixels per axis.
- Palette index zero denotes transparency. The legacy PNG injector thresholds partial transparency.
- Indexed images depend on the global game palette. Independent per-image palettes require a separate compatibility decision.
- The current codec in `packages/asset-core/` writes one frame per sprite entry. Multiple orientations can occupy separate archive entries.
- A complete DOS room requires layout and grid data in addition to brick artwork. A backdrop image alone cannot prove playable room integration.
- The existing advanced bundle builder depends on PowerShell and Windows IMAPI2. The shell packer has a different layout and needs compatibility review.
- The source README reports a memory ceiling associated with WebAssembly and large optional voice assets. In-browser memory measurements remain outstanding.

## Rights and publication

~~~mermaid
flowchart TB
  ORIGINAL["Original world resources"] --> VALIDATE["Manifest validation"]
  VALIDATE --> CONVERT["DOS asset adapter"]
  PRIVATE["Private licensed game install"] --> TEST["Local DOS smoke test"]
  CONVERT --> TEST
  TEST --> CLEARANCE{"Redistribution rights confirmed?"}
  CLEARANCE -->|Pending| HOLD["Private validation"]
  CLEARANCE -->|Confirmed| DIST["Minimal runtime distribution"]
~~~

The original DOS boot is verified historically. Redistribution of the original patched executable, the game archives and derivatives requires a distinct rights review.

`docs/PAGES_DEPLOYMENT.md` records a branch-root Pages deployment. A final site containing only runtime files requires deployment of the curated `dist/` artifact. Release controls must validate that boundary.

## Next gates

R02 defines a portable world package with predictable paths, provenance, assets and scene references. R03 will convert real original images into DOS-compatible indexed resources, quantify visual losses and prepare optional private archive integration. Binary round-trips, archive injection and game execution have independent acceptance criteria.

Run `node scripts/runtime/audit.mjs` to obtain the versioned source inventory.
