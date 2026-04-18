# LBA1 Custom Portfolio

An interactive portfolio built on a modded **Little Big Adventure 1** (1994) running in-browser via js-dos 6.22. Visitors explore the LBA world; each location tells the story of a project.

> Requires a legitimate copy of LBA1. This repo ships tooling only — no game assets.

## What this is

The original LBA1 DOS binary boots into a CD probe that aborts without a mounted CD-ROM. Four binary patches to `RELENT.EXE` plus a synthetic `LBA.ISO` (ISO9660, volume label `ADELINE`) get it booting cleanly under js-dos, with both intro FLA cinematics NOPed out so the WASM heap doesn't explode.

On top of that bootable base we overlay:

- Patched `RELENT.EXE` (boot-to-game, no intros, no CD probe)
- Custom save files pre-positioned at six portfolio locations
- Modded `TEXT.HQR` with portfolio dialogue
- Modded `SPRITES.HQR` (drop-in sprite replacements, palette-snapped)
- Modded `LBA_BRK.HQR` (tile/brick art — floors, walls, decorative props)
- A reversible scene-painting pipeline: render the full isometric room to a flat PNG, paint over it, and the inverse-mapper slices the painted pixels back into the right bricks

## Project layout

```
base_game/                     # Original LBA1 files (user-provided, .HQR/.EXE)
modded_assets/
  sprites/                     # Extracted PNG sprites for GIMP/Photoshop editing
  bricks/                      # Extracted PNG bricks (8715 tiles)
  scenes/                      # Painted whole-scene PNGs (drop target for the inverse mapper)
  text/                        # Portfolio dialogue JSON
output/                        # Build artefacts: patched RELENT.EXE, modded HQRs, saves
  scenes/                      # Scene render templates (PNG) + pixelmap.bin + placements.json
web_deploy/                    # Static site + bundle
  index.html                   # Landing page with location grid + js-dos launcher
  lba1_portfolio.jsdos         # The bundle (ZIP with game files + LBA.ISO)
  vendor/jsdos622/             # Self-hosted js-dos 6.22 runtime
metadata-ui/                   # React dev tool: browse/edit assets by scene (Vite + React)
scripts/hqr-tools/             # Node tooling (extract/inject/render/analyze)
tools/                         # Vendored LBALab repos (twin-e, metadata, etc.)
memory/                        # Long-term project notes (Claude auto-memory)
```

## Prerequisites

- Node.js 18+
- Windows (build uses PowerShell + IMAPI2 to produce `LBA.ISO`)
- Original LBA1 `.HQR` and `.EXE` files in `base_game/`
- Optional: GIMP / Photoshop / Procreate / Krita / any image editor for paint work
- Optional: Python 3 + capstone for EXE analysis

## Build pipeline (CLI)

```bash
# 1. Patch RELENT.EXE (CD bypass + skip intro FLAs → output/RELENT.EXE)
node scripts/hqr-tools/patch-relent.js

# 2. Generate portfolio save files (S001.LBA … S007.LBA)
node scripts/hqr-tools/create-savegame.js --dos --no-deploy

# 3. (Optional) Apply portfolio dialogue
node scripts/hqr-tools/edit-text.js repack

# 4. Build the web bundle (.jsdos + CD ISO + config)
bash scripts/build-web-bundle.sh
# or: node scripts/hqr-tools/build-bundle.js

# 5. Serve locally
cd web_deploy && python -m http.server 8765
# open http://localhost:8765
```

The build overlays every `.HQR` under `output/` on top of `base_game/` originals, so any repacked asset is picked up automatically.

## Asset workflows

### Sprites (2D billboards)

```bash
# from scripts/hqr-tools/
npm run sprites:extract            # all entries → modded_assets/sprites/
node extract-sprites.js 11         # just entry 11
# edit PNGs — use _palette.png, index 0 = transparent
npm run sprites:inject             # repack all edited sprites
npm run sprites:inject:strict      # CI-style: fail on any off-palette px
node build-bundle.js               # rebundle
```

Alpha < 128 becomes palette index 0 (transparent). Other pixels snap to the nearest LBA palette color (Euclidean distance); add `--strict` to fail fast on any off-palette RGB instead of silently snapping.

**Test the codec before shipping:**

```bash
npm test
```

Runs four suites against `lib/sprite-codec.js`:
1. Round-trip every base sprite (encode/decode is lossless)
2. Palette hygiene on every PNG in `modded_assets/sprites/`
3. Metadata ↔ PNG consistency (dims, orphans)
4. Encoder fuzz (edge dims, long runs, 20 random indexed buffers)

### Bricks (iso tiles)

Bricks compose the 3D-looking isometric rooms — floors, walls, pillars, barrels, display plinths, railings, lamps. 8715 entries in `LBA_BRK.HQR`.

```bash
node scripts/hqr-tools/extract-bricks.js             # → modded_assets/bricks/*.png (8715)
node scripts/hqr-tools/extract-scene-bricks.js       # → metadata-ui/public/scene-bricks.json
node scripts/hqr-tools/analyze-scene-bricks.js 43    # rank bricks by render-volume for scene 43
node scripts/hqr-tools/analyze-scene-bricks.js --portfolio   # all 6 portfolio rooms

node scripts/hqr-tools/inject-brick.js               # inject every modified PNG (mtime-based)
node scripts/hqr-tools/inject-brick.js 2092          # single brick
node scripts/hqr-tools/inject-brick.js 2092,2093,3518 # several
```

Brick encoding = sprite-frame row-RLE *without* the u32 offset table (header starts at byte 0). Shared codec at `scripts/hqr-tools/lib/sprite-codec.js` (`decodeBrick`, `encodeRow`).

`analyze-scene-bricks.js` ranks bricks by **render-volume** in a scene, not just presence — i.e. which bricks the engine places the most times when composing the room. Example for the museum (scene 43):

```
brick 2092  1246 placements  18.2%  48×26  floor
brick 2093  1246 placements  18.2%  48×38  wall
→ editing top 10 bricks covers 48.1% of the scene's visual volume
```

### Whole-scene painting

The flagship workflow: treat a whole room as one image.

```bash
# 1. Render a scene to a flat iso template + reversible pixelmap.
node scripts/hqr-tools/render-scene.js 43
node scripts/hqr-tools/render-scene.js --portfolio

# 2. Paint over output/scenes/scene-43-template.png in any editor (keep dims).

# 3. Inverse-map painted PNG back into LBA_BRK.HQR.
node scripts/hqr-tools/inject-scene-image.js 43 modded_assets/scenes/scene-43-painted.png

# 4. Rebundle.
bash scripts/build-web-bundle.sh
```

See [Scene painting architecture](#scene-painting-architecture) below for the math and the known-limits.

### Dialogue

`scripts/hqr-tools/edit-text.js` extracts and repacks `TEXT.HQR`. Edit `modded_assets/text/dialogue_strings.json`. See `scripts/hqr-tools/apply-portfolio-dialogue.js` for the full portfolio text overlay.

### Save files

`scripts/hqr-tools/create-savegame.js` generates `.LBA` saves placing Twinsen at specific scenes with pre-filled inventory/chapter flags. Edit the `LOCATIONS` map to change portfolio spots. Scene IDs are documented in `tools/metadata/LBA1/HQR/SCENE.HQR.json`.

## Web UI (metadata-ui)

A React dev tool for browsing and editing assets scene-by-scene.

```bash
cd metadata-ui
npm install
npm run dev
# open http://localhost:5173
```

Three tabs:

- **Scenes** — 6 portfolio rooms, each with a flat iso template (download), a drop zone (drag painted PNG back in to auto-inject), and live log output from `inject-scene-image.js`.
- **Sprites** — all 118 billboard sprites filterable by category, portfolio scene, or name. Click a sprite for a modal with metadata + drop-in replacement.
- **Bricks** — 8715 tiles filterable by bucket (`floor`/`wall`/`pillar`/`thin`/...) and portfolio scene. Click for metadata + replacement.

Vite dev plugins expose two writer endpoints:

- `PUT /api/save-asset/{sprites|bricks}/{filename}.png` — palette-snap + write to `modded_assets/<kind>/` AND `metadata-ui/public/<kind>/` for instant preview.
- `PUT /api/save-scene/{sceneIdx}` — write to `modded_assets/scenes/`, then spawn `inject-scene-image.js` and stream its log back to the client.

Client-side palette-snap uses a cached nearest-neighbor LUT against `/_palette.bin` (LBA1's 256-color RGB palette). Alpha < 128 → transparent index 0.

## Portfolio scenes

| Scene | Name               | Portfolio role                 |
|-------|--------------------|--------------------------------|
| 43    | Maritime Museum    | Main hub — portfolio showroom  |
| 5     | Twinsen's House    | Personal intro                 |
| 42    | Proxim City        | Electronics lab (CinePi)       |
| 54    | Inventor's House   | Workshop                       |
| 60    | Rebel Camp         | Maker space (GSAT CubeSat)     |
| 17    | Ruins              | Archaeology (OpenClaw)         |

Defined in both `metadata-ui/src/App.jsx` (`PORTFOLIO_SCENES`) and `scripts/hqr-tools/analyze-scene-bricks.js`. Render-volume stats per room are computed by `analyze-scene-bricks.js --portfolio`.

## The boot patches (`patch-relent.js`)

All four patches are fixup-free windows verified with `check-fixups.js`:

| # | File offset | Bytes | Effect |
|---|-------------|-------|--------|
| 1 | `0x10a5f`   | 13    | Skip `find_cd_drive`, force drive idx = 3 (`D:`) |
| 2 | `0x10af1`   | 2     | `jne → jmp` on "Type INSTALL" check |
| 3 | `0x0f83f`   | 13    | NOP out `INTROD.FLA` playback (15.9 MB file) |
| 4 | `0x10e71`   | 13    | NOP out `DRAGON3.FLA` playback (not on CD) |

See `memory/lba1_no_cd_probe.md` for the reverse-engineering notes.

## Scene painting architecture

LBA1 is a tile engine. A scene is composed by the `LBA_GRI.HQR` grid (per-column run-length of layout indices) referencing `LBA_BLL.HQR` layouts (3D volumes of brick indices) which resolve to `LBA_BRK.HQR` bricks (2D iso stamps). A brick can be placed hundreds of times in one room — the floor of the museum is the same 48×26 stamp at 1246 positions.

### Projection

LBA1 uses a fixed dimetric 2:1 camera. For a grid cell at `(gx, gy, gz)`:

```
screenX = (gx - gz) * 24
screenY = (gx + gz) * 12 - gy * 15
```

Each brick is drawn at `(screenX + brick.offsetX, screenY + brick.offsetY)` with `image-rendering: pixelated`, painter-sorted by depth `(gx + gz)` ascending then `gy` ascending.

### The render (`render-scene.js`)

Emits three artefacts per scene:

- `scene-N-template.png` — full iso composite (the paintable canvas, 600–3000 px wide).
- `scene-N-placements.json` — every brick stamp, with `(gx, gy, gz, brickIdx, width, height, offsetX, offsetY, bucket)`.
- `scene-N-pixelmap.bin` — Int32 per pixel → index into `placements[]`, or `-1` for empty.

### The inverse (`inject-scene-image.js`)

Walks the painted PNG pixel-by-pixel, looks up the owning placement via `pixelmap.bin`, and buckets the RGB into `samples[brickIdx][dy*w+dx]` (where `dx, dy` are the brick-local coords).

For each brick used in the scene, the mode pixel across all instances wins (palette-snapped). Pixels that are **always occluded** across every instance keep the original — so we never stamp transparency over hidden content.

A paint-consistency score is reported per brick: `<75%` means you painted the same brick inconsistently across grid cells and the mode-pick dropped minority detail.

### Known limitation: per-cell uniqueness

The engine caps scene layouts at 256 (32-byte bitmap at the end of each `LBA_GRI.HQR` entry). Allocating a unique brick per grid cell would require unfolding layouts 1:1 per cell, which blows past the 256 cap. So the V1 pipeline accepts **engine-level tiling**: if you paint the 1246 floor cells with the same pattern, the engine reproduces it faithfully; if you paint each differently, the mode wins and minority variants are lost.

A V2 path exists (one giant 64×25×64 "override" layout stamped once at grid origin, with careful painter-order management so it wins over vanilla layouts) — deferred until needed.

### What's NOT in the scene template

Non-tile content is placed by scene scripts at runtime and isn't composited into the static iso render:

- 3D characters (Twinsen, guards, NPCs) — `BODY.HQR` meshes
- Billboard sprites (doors, padlocks, keypads, signs) — runtime 2D actors
- Animated water, flickering fire, etc.

So the template = bricks only (floors, walls, pillars, barrels, cannons, shark statues — everything static). Characters and interactive props are still sprites/meshes you edit via the Sprites tab or dedicated tooling.

## Known limitations

- **Voice files (`VOX.HQR`) excluded** — 33 MB uncompressed exceeds the js-dos 6.22 WASM heap (~32 MB). `FlagKeepVoice: OFF` in `LBA.CFG`.
- **Main menu still shown** — visitor clicks "New Game" once to enter. Direct-boot-to-Museum patch is designed but not yet merged (see `patch-relent.js` comments).
- **Output HQRs are ~1.6× base size** — `@lbalab/hqr`'s `HQRWriter` hardcodes `CompressionType.NONE`. Functional; just larger bundles.
- **Scene painting is tile-granular, not cell-granular** — see [Scene painting architecture](#scene-painting-architecture).
- **3D characters not paintable** — `BODY.HQR` mesh+texture editing is deferred. Retexturing vanilla Twinsen / NPCs into portfolio-specific avatars is a future task.

## Pending / next session

- Direct-boot-to-museum patch (task #4)
- First portfolio paintover (museum: floor brick 2092, wall brick 2093 + variants; sprites: doors 11, 12, padlock 58)
- Optional V2 scene painter (per-cell uniqueness via giant-layout override)
- Character retexture workflow (body meshes)
- Propagate painted rooms through `build-web-bundle.sh` → deploy

## References

- **twin-e** (engine reimplementation, reference only): https://github.com/LBALab/twin-e
- **@lbalab/hqr** (Node.js HQR library): https://www.npmjs.com/package/@lbalab/hqr
- **lba-packager** (web HQR editor): https://lbalab.github.io/lba-packager/
- **LBArchitect** (Windows level editor): https://github.com/LBALab/LBArchitect
- **metadata** (JSON schemas for every HQR entry): https://github.com/LBALab/metadata
- **js-dos 6.22**: https://js-dos.com
- **Save format wiki**: https://lbafileinfo.kaziq.net/index.php/LBA1:Savegame

## Legal

Little Big Adventure is © Adeline Software / 2.21. This repository contains no game content — you must supply your own copy of the game files. Scripts here are MIT-licensed.
