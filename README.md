# LBA1 Portfolio Mod Project

Turn Little Big Adventure 1 into an interactive portfolio using official LBALab modding tools.

## Overview

This project provides a complete workflow to:
1. Extract assets from original LBA1 game files
2. Modify dialogue, scenes, and level layouts
3. Repack modified assets
4. Deploy the modded game playable in a web browser

## Prerequisites

- **Original LBA1 game files** (legitimate copy required - .HQR files)
- **Node.js 18+**
- **Git**
- **Windows** (for LBArchitect level editor) or WSL2
- **zip** command (for bundle creation)

## Quick Start

```bash
# 1. Initialize workspace (clone tools, install dependencies)
chmod +x scripts/init-workspace.sh
./scripts/init-workspace.sh

# 2. Copy your LBA1 game files
cp /path/to/lba1/*.HQR base_game/
cp /path/to/lba1/*.EXE base_game/

# 3. Extract assets
cd scripts/hqr-tools
node extract-all.js

# 4. Edit dialogue
node edit-text.js extract
# Edit modded_assets/text/dialogue_strings.json
node edit-text.js repack

# 5. Build web bundle
cd ../..
./scripts/build-web-bundle.sh

# 6. Test locally
cd web_deploy
npx serve .
# Open http://localhost:3000
```

## Project Structure

```
lba-custom-portefolio/
├── base_game/              # Original LBA1 files (YOU PROVIDE)
│   ├── LBA.EXE
│   ├── LBA.HQR
│   ├── RESS.HQR
│   ├── TEXT.HQR
│   ├── SCENE.HQR
│   └── ...
├── modded_assets/          # Extracted & editable assets
│   ├── text/
│   │   └── dialogue_strings.json
│   ├── scenes/
│   └── ...
├── output/                 # Repacked .HQR files
├── tools/                  # LBALab repositories
│   ├── twin-e/            # Engine recreation
│   ├── lba-packager/      # Web-based HQR editor
│   └── LBArchitect/       # Level editor (Windows)
├── scripts/
│   ├── init-workspace.sh
│   ├── build-web-bundle.sh
│   └── hqr-tools/
│       ├── extract-all.js
│       ├── repack-hqr.js
│       └── edit-text.js
├── web_deploy/
│   ├── index.html
│   └── lba1_portfolio.jsdos
└── docs/
    └── LBARCHITECT_GUIDE.md
```

## Detailed Workflow

### 1. Dialogue Editing (Easiest)

Modify NPC dialogue to create portfolio content:

```bash
cd scripts/hqr-tools
node edit-text.js extract
```

Edit `modded_assets/text/dialogue_strings.json`:
```json
{
  "languages": {
    "english": {
      "strings": [
        {
          "id": 42,
          "original": "Hello stranger!",
          "modified": "Welcome to my portfolio! I'm a software developer..."
        }
      ]
    }
  }
}
```

Then repack:
```bash
node edit-text.js repack
# Creates output/TEXT.HQR
```

### 2. Level Editing (Advanced)

See `docs/LBARCHITECT_GUIDE.md` for detailed instructions.

**Short version:**
1. Use LBArchitect (Windows) to visually edit rooms
2. Or use https://lbalab.github.io/lba-packager/ for web-based editing
3. Repack with `node repack-hqr.js scenes`

### 3. Testing Locally

**With twin-e (desktop):**
```bash
cd tools/twin-e
./twin-e --datapath ../../output
```

**With js-dos (browser):**
```bash
./scripts/build-web-bundle.sh
cd web_deploy
npx serve .
```

### 4. VPS Deployment

```bash
# Build the bundle
./scripts/build-web-bundle.sh

# Deploy to nginx server
scp web_deploy/index.html user@server:/var/www/html/
scp web_deploy/lba1_portfolio.jsdos user@server:/var/www/html/

# Configure nginx
# Ensure MIME types for .jsdos (application/octet-stream)
```

## Key Resources

- **twin-e** (engine): https://github.com/LBALab/twin-e
- **lba-packager** (web editor): https://lbalab.github.io/lba-packager/
- **@lbalab/hqr** (Node.js library): https://www.npmjs.com/package/@lbalab/hqr
- **LBArchitect** (level editor): https://github.com/LBALab/LBArchitect
- **js-dos** (browser DOSBox): https://js-dos.com

## Legal Notice

This project requires a legitimate copy of Little Big Adventure 1. The tools provided here modify existing game assets - they do not include or distribute copyrighted game content.

## Troubleshooting

**"TEXT.HQR not found"**
- Ensure your LBA1 files are in `base_game/`
- Check case sensitivity (Linux is case-sensitive)

**"twin-e won't build"**
- Install SDL 1.2: `sudo apt install libsdl1.2-dev libsdl-mixer1.2-dev`
- On macOS: `brew install sdl12-compat`

**"LBArchitect crashes"**
- Run as Administrator
- Use Windows 10/11 (may have issues on older versions)
- Configure file paths in View → Settings first

**"js-dos shows black screen"**
- Check browser console for errors
- Ensure .jsdos bundle was created correctly
- Verify LBA.EXE is in the bundle

## License

Scripts in this repository: MIT
LBALab tools: See their respective licenses
LBA1 game content: Proprietary (you must own a copy)
