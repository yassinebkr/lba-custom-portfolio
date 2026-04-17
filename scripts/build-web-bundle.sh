#!/bin/bash
#
# Build js-dos Bundle for LBA1 Portfolio
#
# This script creates a .jsdos bundle containing the original LBA1 game
# files with your modded assets overlaid.
#

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_GAME="$PROJECT_ROOT/base_game"
OUTPUT="$PROJECT_ROOT/output"
WEB_DEPLOY="$PROJECT_ROOT/web_deploy"
BUNDLE_DIR="$WEB_DEPLOY/bundle"

echo "=== Building LBA1 Web Bundle ==="
echo ""

# --- Check Prerequisites ---
echo "Checking prerequisites..."

if [ ! -d "$BASE_GAME" ]; then
    echo "ERROR: base_game/ directory not found."
    echo "Please place your LBA1 game files there."
    exit 1
fi

# Check for essential game files
REQUIRED_FILES=("LBA.EXE" "LBA.HQR" "RESS.HQR" "SCENE.HQR")
for file in "${REQUIRED_FILES[@]}"; do
    # Case-insensitive check
    if ! ls "$BASE_GAME"/*.[Ee][Xx][Ee] 2>/dev/null | grep -qi "LBA" && \
       ! ls "$BASE_GAME"/*.[Hh][Qq][Rr] 2>/dev/null | grep -qi "${file%.*}"; then
        if [ ! -f "$BASE_GAME/$file" ]; then
            echo "WARNING: $file not found in base_game/ (case sensitivity may differ)"
        fi
    fi
done

if ! command -v zip &> /dev/null; then
    echo "ERROR: 'zip' command not found. Please install it:"
    echo "  Ubuntu/Debian: sudo apt install zip"
    echo "  macOS: brew install zip"
    exit 1
fi

echo "[OK] Prerequisites checked"
echo ""

# --- Create Bundle Structure ---
echo "Creating bundle structure..."

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR/.jsdos"
mkdir -p "$BUNDLE_DIR/LBA"

# --- Create dosbox.conf ---
cat > "$BUNDLE_DIR/.jsdos/dosbox.conf" << 'EOF'
[sdl]
fullscreen=false
output=opengl

[cpu]
core=auto
cputype=pentium_slow
cycles=max

[mixer]
rate=44100

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5

[autoexec]
@echo off
mount c .
c:
cd LBA
LBA.EXE
exit
EOF

echo "[CREATED] dosbox.conf"

# --- Copy Original Game Files ---
echo "Copying original game files..."

# Copy all files from base_game to bundle/LBA
cp "$BASE_GAME"/* "$BUNDLE_DIR/LBA/" 2>/dev/null || true

# Count files
ORIG_COUNT=$(ls -1 "$BUNDLE_DIR/LBA/" 2>/dev/null | wc -l)
echo "[COPIED] $ORIG_COUNT original files"

# --- Overlay Modded Files ---
echo "Overlaying modded assets..."

if [ -d "$OUTPUT" ]; then
    MOD_COUNT=0
    for modfile in "$OUTPUT"/*; do
        if [ -f "$modfile" ]; then
            filename=$(basename "$modfile")
            cp "$modfile" "$BUNDLE_DIR/LBA/$filename"
            echo "  [MOD] $filename"
            ((MOD_COUNT++)) || true
        fi
    done
    echo "[APPLIED] $MOD_COUNT modded files"

    # Overlay DOS saves if they exist
    if [ -d "$OUTPUT/saves/dos" ]; then
        for savefile in "$OUTPUT/saves/dos"/LBA.S*; do
            if [ -f "$savefile" ]; then
                savename=$(basename "$savefile")
                cp "$savefile" "$BUNDLE_DIR/LBA/$savename"
                echo "  [SAVE] $savename"
            fi
        done
    fi
else
    echo "[SKIP] No output/ directory found (no mods to apply)"
fi

# --- Create .jsdos Bundle ---
echo ""
echo "Creating .jsdos bundle..."

BUNDLE_FILE="$WEB_DEPLOY/lba1_portfolio.jsdos"
rm -f "$BUNDLE_FILE"

cd "$BUNDLE_DIR"
zip -r "$BUNDLE_FILE" . -x "*.DS_Store" > /dev/null

BUNDLE_SIZE=$(du -h "$BUNDLE_FILE" | cut -f1)
echo "[CREATED] lba1_portfolio.jsdos ($BUNDLE_SIZE)"

# --- Cleanup ---
echo ""
echo "Cleaning up temporary files..."
rm -rf "$BUNDLE_DIR"
echo "[DONE]"

# --- Summary ---
echo ""
echo "=== Build Complete ==="
echo ""
echo "Bundle: $BUNDLE_FILE"
echo ""
echo "To test locally:"
echo "  cd $WEB_DEPLOY"
echo "  npx serve ."
echo "  Open http://localhost:3000 in your browser"
echo ""
echo "To deploy to VPS:"
echo "  scp $WEB_DEPLOY/index.html $WEB_DEPLOY/lba1_portfolio.jsdos user@yourserver:/var/www/html/"
echo ""
