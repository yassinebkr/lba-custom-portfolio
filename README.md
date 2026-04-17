# LBA1 Custom Portfolio

An interactive portfolio built on a modded **Little Big Adventure 1** (1994) running in-browser via js-dos 6.22. Visitors explore the LBA world; each location tells the story of a project.

> ⚠️ Requires a legitimate copy of LBA1. This repo ships tooling only — no game assets.

## What this is

The original LBA1 DOS binary boots straight into Twinsen's prison cell with a "No CD" check that aborts without a mounted CD-ROM. Four binary patches to `RELENT.EXE` plus a synthetic `LBA.ISO` (ISO9660, volume label `ADELINE`) get it booting cleanly under js-dos, with both intro FLA cinematics NOPed out so the WASM heap doesn't explode.

On top of that bootable base we overlay:
- Custom save files pre-positioned at six portfolio locations
- Modded `TEXT.HQR` with portfolio dialogue
- (WIP) Modded `SPRITES.HQR` with personalised sprites

## Project layout

```
base_game/                  # Original LBA1 files (user-provided, .HQR/.EXE)
modded_assets/sprites/      # Extracted PNG sprites for GIMP editing
output/                     # Build artefacts: patched RELENT.EXE, modded HQRs, saves
web_deploy/                 # Static site + bundle
  index.html                # Landing page with location grid + js-dos launcher
  lba1_portfolio.jsdos      # The bundle (ZIP with game files + LBA.ISO)
  vendor/jsdos622/          # Self-hosted js-dos 6.22 runtime
scripts/hqr-tools/          # Node + Python tooling
tools/                      # Vendored LBALab repos (twin-e, metadata, etc.)
memory/                     # Long-term project notes (Claude auto-memory)
```

## Prerequisites

- Node.js 18+
- Windows (build uses PowerShell + IMAPI2 to produce `LBA.ISO`)
- Original LBA1 `.HQR` and `.EXE` files in `base_game/`
- Optional: GIMP for sprite edits, Python 3 + capstone for EXE analysis

## Build pipeline

```bash
# 1. Patch RELENT.EXE (CD bypass + skip intro FLAs → output/RELENT.EXE)
node scripts/hqr-tools/patch-relent.js

# 2. Generate portfolio save files (S001.LBA … S007.LBA)
node scripts/hqr-tools/create-savegame.js --dos --no-deploy

# 3. (Optional) Apply portfolio dialogue
node scripts/hqr-tools/edit-text.js repack

# 4. Build the web bundle (.jsdos + CD ISO + config)
node scripts/hqr-tools/build-bundle.js

# 5. Serve locally
cd web_deploy && python -m http.server 8765
# open http://localhost:8765
```

The build overlays every `.HQR` under `output/` on top of `base_game/` originals, so any repacked asset is picked up automatically.

## Asset workflows

### Sprites (2D, GIMP-friendly)

```bash
node scripts/hqr-tools/extract-sprites.js        # all entries → modded_assets/sprites/
node scripts/hqr-tools/extract-sprites.js 11     # just entry 11
# edit PNGs in GIMP — use _palette.png, index 0 = transparent
node scripts/hqr-tools/inject-sprite.js          # repack all edited sprites
node scripts/hqr-tools/build-bundle.js           # rebundle
```

Output RGBAs are indexed to the LBA1 VGA palette via nearest-neighbour matching; transparent pixels must use palette index 0.

### Dialogue

`scripts/hqr-tools/edit-text.js` extracts and repacks `TEXT.HQR`. Edit `modded_assets/text/dialogue_strings.json`. See `scripts/hqr-tools/apply-portfolio-dialogue.js` for the full portfolio text overlay.

### Save files

`scripts/hqr-tools/create-savegame.js` generates `.LBA` saves placing Twinsen at specific scenes with pre-filled inventory/chapter flags. Edit the `LOCATIONS` map to change portfolio spots. Scene IDs are documented in `tools/metadata/LBA1/HQR/SCENE.HQR.json`.

## Key scenes

| Scene | Name | Portfolio role |
|-------|------|----------------|
| 1 | Citadel Island | Main Hub |
| 5 | Twinsen's House | Personal Intro |
| 42 | Proxima City | Electronics Lab (CinePi) |
| 13 | Old Burg | AI Workshop (OpenClaw) |
| 60 | Rebel Camp | Maker Space (GSAT CubeSat) |
| 43 | Maritime Museum | Portfolio Showroom |

## The boot patches (`patch-relent.js`)

All four patches are fixup-free windows verified with `check-fixups.js`:

| # | File offset | Bytes | Effect |
|---|-------------|-------|--------|
| 1 | `0x10a5f`   | 13    | Skip `find_cd_drive`, force drive idx = 3 (`D:`) |
| 2 | `0x10af1`   | 2     | `jne → jmp` on "Type INSTALL" check |
| 3 | `0x0f83f`   | 13    | NOP out `INTROD.FLA` playback (15.9 MB file) |
| 4 | `0x10e71`   | 13    | NOP out `DRAGON3.FLA` playback (not on CD) |

See `memory/lba1_no_cd_probe.md` for the reverse-engineering notes.

## Known limitations

- **Voice files (`VOX.HQR`) excluded** — 33 MB uncompressed exceeds the js-dos 6.22 WASM heap (~32 MB). `FlagKeepVoice: OFF` in `LBA.CFG`.
- **Main menu still shown** — visitor clicks "New Game" once to enter. Direct-boot-to-Museum patch is designed but not yet merged (see `patch-relent.js` comments).
- **Output HQRs are ~1.6× base size** — `@lbalab/hqr`'s `HQRWriter` hardcodes `CompressionType.NONE`. Functional; just larger bundles.

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
