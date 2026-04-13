# LBA1 Web Deployment via js-dos

Since twin-e doesn't have native Emscripten support, the most reliable way to run LBA1 in a browser is using **js-dos** (DOSBox compiled to WebAssembly).

## Prerequisites

- Original DOS version of LBA1 (the game files)
- Your modded .HQR files from the `output/` directory
- Node.js (for the build script)

## How js-dos Works

js-dos wraps DOSBox in WebAssembly, allowing DOS games to run in any modern browser. You create a "bundle" containing:
1. The game files (EXE + data files)
2. A DOSBox configuration
3. Metadata for the js-dos player

## Setup Instructions

### Step 1: Get js-dos

```bash
# Clone js-dos or use CDN
npm install js-dos
```

Or use the CDN directly in your HTML (see index.html).

### Step 2: Prepare Game Bundle

Create a `.jsdos` bundle (which is a ZIP file with specific structure):

```
lba1_portfolio.jsdos/
├── .jsdos/
│   └── dosbox.conf
├── LBA/
│   ├── LBA.EXE
│   ├── LBA.HQR       (original)
│   ├── RESS.HQR      (original)
│   ├── TEXT.HQR      (MODDED - your dialogue)
│   ├── SCENE.HQR     (MODDED - your levels)
│   ├── BODY.HQR      (original)
│   ├── SPRITES.HQR   (original)
│   ├── ...etc
│   └── SETUP.EXE
```

### Step 3: Create dosbox.conf

```ini
[sdl]
fullscreen=false
output=opengl

[cpu]
core=auto
cycles=max

[autoexec]
mount c .
c:
cd LBA
LBA.EXE
exit
```

### Step 4: Create the Bundle

```bash
cd web_deploy

# Create bundle directory structure
mkdir -p bundle/.jsdos
mkdir -p bundle/LBA

# Copy dosbox.conf
cp dosbox.conf bundle/.jsdos/

# Copy original game files
cp ../base_game/*.HQR bundle/LBA/
cp ../base_game/*.EXE bundle/LBA/
cp ../base_game/*.CFG bundle/LBA/ 2>/dev/null || true

# Overwrite with modded files
cp ../output/*.HQR bundle/LBA/

# Create the .jsdos bundle (it's just a ZIP)
cd bundle
zip -r ../lba1_portfolio.jsdos .
cd ..

echo "Created: lba1_portfolio.jsdos"
```

### Step 5: Deploy

See `index.html` for a minimal js-dos player page.

For VPS deployment:
```bash
# Simple static file server
npm install -g serve
serve web_deploy -p 8080

# Or with nginx, copy files to /var/www/html/
```

## File Structure After Setup

```
web_deploy/
├── index.html              # js-dos player page
├── lba1_portfolio.jsdos    # Game bundle
├── dosbox.conf             # DOSBox configuration
└── bundle/                 # Temporary build directory
```

## Browser Compatibility

- Chrome 67+
- Firefox 62+
- Safari 14+
- Edge 79+

All modern browsers with WebAssembly support work.

## Performance Notes

- js-dos runs at near-native speed on modern hardware
- LBA1 was designed for 486/Pentium, so any modern device handles it easily
- Mobile browsers also work, though controls need touch mapping
