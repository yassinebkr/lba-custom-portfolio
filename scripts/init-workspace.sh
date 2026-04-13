#!/bin/bash
#
# LBA1 Modding Workspace Initialization Script
# Tested on: Ubuntu 22.04+, Debian 12+, macOS 14+
#

set -e

echo "=== LBA1 Portfolio Modding Workspace Setup ==="
echo ""

# --- Prerequisites Check ---
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "[MISSING] $1 is required but not installed."
        return 1
    else
        echo "[OK] $1"
        return 0
    fi
}

echo "Checking prerequisites..."
MISSING=0
check_command git || MISSING=1
check_command node || MISSING=1
check_command npm || MISSING=1
check_command make || MISSING=1
check_command gcc || MISSING=1

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "Please install missing dependencies:"
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo apt update"
    echo "    sudo apt install git build-essential nodejs npm libsdl1.2-dev libsdl-mixer1.2-dev"
    echo ""
    echo "  macOS (Homebrew):"
    echo "    brew install node git sdl12-compat sdl_mixer"
    echo ""
    echo "  Windows (WSL2 recommended):"
    echo "    Follow Ubuntu instructions inside WSL2"
    echo ""
    exit 1
fi
echo ""

# --- Directory Structure ---
echo "Creating directory structure..."
mkdir -p base_game        # Place your original LBA1 .HQR files here
mkdir -p modded_assets    # Extracted and modified assets
mkdir -p tools            # LBALab tools
mkdir -p output           # Final repacked game
mkdir -p web_deploy       # js-dos web deployment

# --- Clone Repositories ---
echo ""
echo "Cloning LBALab repositories..."

# Twin-E Engine (for desktop testing)
if [ ! -d "tools/twin-e" ]; then
    git clone https://github.com/LBALab/twin-e.git tools/twin-e
    echo "[CLONED] twin-e"
else
    echo "[EXISTS] twin-e"
fi

# LBArchitect (Windows only, but useful reference)
if [ ! -d "tools/LBArchitect" ]; then
    git clone https://github.com/LBALab/LBArchitect.git tools/LBArchitect
    echo "[CLONED] LBArchitect"
else
    echo "[EXISTS] LBArchitect"
fi

# lba-packager (for local web-based editing)
if [ ! -d "tools/lba-packager" ]; then
    git clone https://github.com/LBALab/lba-packager.git tools/lba-packager
    echo "[CLONED] lba-packager"
else
    echo "[EXISTS] lba-packager"
fi

# --- Install Node.js HQR Library ---
echo ""
echo "Setting up Node.js HQR extraction toolkit..."
mkdir -p scripts/hqr-tools
cd scripts/hqr-tools

if [ ! -f "package.json" ]; then
    npm init -y > /dev/null
    npm install @lbalab/hqr
    echo "[INSTALLED] @lbalab/hqr"
else
    echo "[EXISTS] hqr-tools"
fi

cd ../..

# --- Build twin-e (Linux/macOS) ---
echo ""
echo "Attempting to build twin-e engine..."

cd tools/twin-e/src

# Detect OS and use appropriate Makefile
if [[ "$OSTYPE" == "darwin"* ]]; then
    MAKEFILE="Makefile.MacOSX"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    MAKEFILE="Makefile.linux"
else
    MAKEFILE="Makefile"
fi

if make -f "$MAKEFILE" 2>/dev/null; then
    echo "[BUILT] twin-e engine compiled successfully"
else
    echo "[WARN] twin-e build failed. Check SDL 1.2 dependencies."
    echo "       You may need: libsdl1.2-dev libsdl-mixer1.2-dev"
fi

cd ../../..

echo ""
echo "=== Workspace Initialization Complete ==="
echo ""
echo "Directory structure:"
echo "  base_game/       - Place LBA1 .HQR files here (LBA.HQR, RESS.HQR, etc.)"
echo "  modded_assets/   - Extracted/modified assets"
echo "  tools/           - LBALab tool repositories"
echo "  scripts/         - Node.js extraction scripts"
echo "  output/          - Final repacked game files"
echo "  web_deploy/      - js-dos browser deployment"
echo ""
echo "Next steps:"
echo "  1. Copy your legitimate LBA1 game files to base_game/"
echo "  2. Run: node scripts/extract-hqr.js"
echo ""
