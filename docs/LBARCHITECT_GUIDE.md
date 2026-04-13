# LBArchitect Level Editing Guide

LBArchitect is a Windows-only Pascal GUI application for editing LBA1/LBA2 levels.

## Installation

1. Download the latest release from: https://github.com/LBALab/LBArchitect/releases
2. Extract to a folder (e.g., `C:\LBArchitect\`)
3. Run the executables as Administrator (may be required for file access)

## The Three Programs

LBArchitect consists of three separate tools:

### 1. Factory (`Factory.exe`)
- **Purpose**: Edit brick definitions and layout libraries
- **Input Files**: `*.BRK` (brick definitions), `*.BLL` (brick library/layout)
- **Use Case**: Modify individual tiles/blocks that make up the world

### 2. Builder (`Builder.exe`)
- **Purpose**: Visual level/room editor - THIS IS YOUR MAIN TOOL
- **Input Files**: `*.GRI` (grid files from SCENE.HQR)
- **Use Case**: Place/remove bricks, edit room layouts, modify terrain

### 3. Designer (`Designer.exe`)
- **Purpose**: Create and manage HQR packages
- **Use Case**: Repack modified assets into HQR format

## Workflow for Portfolio Modding

### Step 1: Extract Scene Data

First, extract SCENE.HQR using the Node.js scripts:

```bash
cd scripts/hqr-tools
node extract-all.js
```

Scene entries in `modded_assets/scenes/` correspond to:
- Each entry is a room/area in the game
- Entry 0 = Twinsen's house
- Entry 1 = Citadel Island exterior
- etc.

### Step 2: Identify Room Indices

LBA1 uses these key locations (approximate indices):

| Index | Location |
|-------|----------|
| 0 | Twinsen's House (bedroom) |
| 1 | Citadel Island (exterior hub) |
| 8-12 | Citadel Island buildings |
| 47 | Hamalayi Mountains |
| 69 | Rebellion Base |

For a portfolio "Showroom", I recommend starting with **Index 1** (Citadel Island exterior) or **Index 0** (House) as they're simpler areas.

### Step 3: Open in Builder

1. Launch `Builder.exe`
2. Go to `View → Settings` and configure:
   - **Grid Path**: Point to `modded_assets/scenes/`
   - **Brick Path**: Point to extracted bricks (from RESS.HQR or separate extraction)
3. Open the grid file: `File → Open → entry_0001.bin` (or similar)
4. Use the toolbar to:
   - **Select** existing bricks
   - **Delete** objects
   - **Place** new bricks from the palette

### Step 4: Key Editing Operations

#### Clearing an Area for Your Showroom
1. Use the selection tool to highlight existing objects
2. Press Delete to remove them
3. This creates empty space for your portfolio layout

#### Placing Portfolio-Themed Objects
- LBA1's brick library includes signs, pedestals, platforms
- Use these to create "display areas" for portfolio items
- NPCs will reference these via script triggers

#### Saving Changes
1. `File → Save` to update the grid file
2. The modified `.GRI` file goes back into SCENE.HQR

### Step 5: Repack to SCENE.HQR

After editing in Builder:

```bash
# Copy your modified grid file back to modded_assets/scenes/
# Then repack:
node repack-hqr.js scenes
```

## Scene Scripts (Advanced)

LBA1 scene scripts control:
- NPC behavior
- Trigger zones
- Dialogue activation
- Camera movements

Scene script editing requires a hex editor or the LBA Script documentation. The scripts are embedded in the scene entries.

Key script commands:
- `MESSAGE(index)` - Display dialogue from TEXT.HQR
- `SET_TRACK(actor, track)` - Move NPC along path
- `SET_BEHAVIOR(actor, behavior)` - Change NPC state

## Alternative: Web-Based Editing

If you don't have Windows, use the web-based lba-packager:

1. Visit: https://lbalab.github.io/lba-packager/
2. Upload your .HQR files
3. Browse and export individual entries
4. Edit externally
5. Re-upload and repack

## References

- LBArchitect source: https://github.com/LBALab/LBArchitect
- LBA file format docs: https://lbalab.net/
- Community Discord for help: https://discord.gg/lba (unofficial)
