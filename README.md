# Project Atlas

An **original playable isometric portfolio** and a **local-first creative Asset Studio** for scenes, characters, furniture, sprites, and animations. The visitor-facing game is designed for GitHub Pages: **no ROM, installer, account, or server API**.

> **Development branch:** [feature/portfolio-studio-j1-j8](https://github.com/yassinebkr/lba-custom-portfolio/tree/feature/portfolio-studio-j1-j8). The default \`main\` branch remains unchanged; no merge is authorized.
>
> **Release status:** work in progress. Six prototype rooms and editing tools exist, but final art, Studio-to-runtime export parity, full animation triggers and live Pages verification remain open. Consult [milestones](docs/MILESTONES.md) for tested evidence.

## Architecture

The [technical architecture](docs/ARCHITECTURE_TARGET.md) specifies the public hosting boundary, original asset ownership, editing pipeline and scene/runtime contracts.

\`\`\`mermaid
flowchart LR
  SOURCE["Original photos / models / art"] --> PIPE["Local sprite pipeline"]
  PIPE --> STUDIO["Visual Asset Studio"]
  STUDIO --> APPROVE["Validate + approve assets"]
  APPROVE --> BUILD["Static public build"]
  BUILD --> PAGES["GitHub Pages"]
  VISITOR["Visitor"] --> PAGES
\`\`\`

The Studio and pipeline run locally. Only approved static game files are eligible for publication. Legacy Little Big Adventure resources are excluded from the public build.

## Project structure

| Component | Path | Current capability |
| --- | --- | --- |
| Public portfolio | [\`apps/portfolio/\`](apps/portfolio/README.md) | Six original isometric rooms, keyboard/touch controls, project inspector, HTML fallback |
| Asset Studio | [\`apps/studio/\`](apps/studio/README.md) | Visual asset library, isometric editor, scene selection, inspector, undo/redo, import/export and frame timeline |
| Asset contracts | [\`packages/asset-schema/\`](packages/asset-schema/README.md) | Scene, asset, rights and animation validation |
| Image pipeline | [\`pipeline/\`](pipeline/README.md) | PNG/photo preparation, shared-palette atlases, Blender multi-view adapter |
| Animation rules | \`packages/game-core/animation.mjs\` | Deterministic clip timing and frame validation |
| Legacy LBA tools | \`scripts/hqr-tools/\`, \`metadata-ui/\`, \`web_deploy/\` | Preserved for original game reverse engineering and lawful local use |

## Local development

**Public playable prototype** (Node.js 22, Python for local HTTP serving):

\`\`\`bash
node --test apps/portfolio/rules.test.mjs apps/portfolio/rooms.test.mjs
node scripts/build-portfolio.mjs
python3 -m http.server 8765
# Open http://127.0.0.1:8765/apps/portfolio/
\`\`\`

**Asset Studio**:

\`\`\`bash
cd apps/studio
npm install
npm run build
npm run dev
# Open http://127.0.0.1:5174/
\`\`\`

**Image pipeline**:

\`\`\`bash
python3 -m pip install Pillow
python3 -m unittest discover -s pipeline/tests -v
python3 pipeline/asset_factory.py --help
\`\`\`

The Studio runs locally. The public site does not rely on its file-writing endpoints or on Blender.

## Documentation

| Reference | Purpose |
| --- | --- |
| [Technical architecture](docs/ARCHITECTURE_TARGET.md) | System design, module boundaries, data model, authoring and deployment |
| [Asset Studio UX](docs/STUDIO_UX_SPEC.md) | Creative workspace design, readable inspectors, viewport and timeline |
| [Asset production](docs/ASSET_PIPELINE.md) | Photo/3D to original characters, furniture, props, scenes, and animations |
| [Milestones and commit evidence](docs/MILESTONES.md) | J0–J8 criteria, status and branch policy |
| [Release readiness](docs/PUBLIC_RELEASE_CHECKLIST.md) | GitHub Pages, licensing, build restrictions and incomplete acceptance gates |
| [Runtime decision](docs/ADR-001-J1-RUNTIME.md) | Initial Canvas2D selection and future renderer evaluation |
| [Historical LBA workflow](docs/LEGACY_LBA_README.md) | Original HQR, brick, sprites, scene painting and js-dos research |

## Publication and rights

The only intended GitHub Pages artifact is produced by \`node scripts/build-portfolio.mjs\`. The build has an explicit allowlist, and GitHub Actions runs tests before packaging. The Pages deployment job is intentionally manual while verification is incomplete. To deploy, the repository must be configured to use **GitHub Actions** as its Pages source.

The original game's code license does not grant redistribution rights for its proprietary artwork and sounds. Public Project Atlas scenes use original procedural placeholders at this stage. The legacy game bundle is never part of the public artifact.

## Development workflow

Changes are committed and pushed to \`feature/portfolio-studio-j1-j8\` in small milestone-labeled commits. A milestone is complete only after its acceptance tests and required browser/legal review pass. **Do not merge or force-push \`main\`.**
