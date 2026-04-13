@echo off
REM LBA1 Modding Workspace Initialization - Windows Version
REM Run this from the project root directory

echo === LBA1 Portfolio Modding Workspace Setup (Windows) ===
echo.

REM Check for Git
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git not found. Install from https://git-scm.com/download/win
    pause
    exit /b 1
)
echo [OK] Git found

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found
echo.

REM Create directory structure
echo Creating directory structure...
if not exist "base_game" mkdir base_game
if not exist "modded_assets" mkdir modded_assets
if not exist "tools" mkdir tools
if not exist "output" mkdir output
if not exist "web_deploy" mkdir web_deploy
echo [OK] Directories created
echo.

REM Clone repositories
echo Cloning LBALab repositories...

if not exist "tools\twin-e" (
    git clone https://github.com/LBALab/twin-e.git tools\twin-e
    echo [CLONED] twin-e
) else (
    echo [EXISTS] twin-e
)

if not exist "tools\LBArchitect" (
    git clone https://github.com/LBALab/LBArchitect.git tools\LBArchitect
    echo [CLONED] LBArchitect
) else (
    echo [EXISTS] LBArchitect
)

if not exist "tools\lba-packager" (
    git clone https://github.com/LBALab/lba-packager.git tools\lba-packager
    echo [CLONED] lba-packager
) else (
    echo [EXISTS] lba-packager
)

echo.

REM Install Node.js HQR library
echo Setting up Node.js HQR tools...
cd scripts\hqr-tools
call npm install
cd ..\..
echo [OK] @lbalab/hqr installed
echo.

echo === Workspace Initialization Complete ===
echo.
echo Directory structure:
echo   base_game\       - Place LBA1 .HQR and .EXE files here
echo   modded_assets\   - Extracted/modified assets
echo   tools\           - LBALab tool repositories
echo   scripts\         - Node.js extraction scripts
echo   output\          - Final repacked game files
echo   web_deploy\      - Browser deployment files
echo.
echo Next steps:
echo   1. Copy your LBA1 game files to base_game\
echo   2. Run: test-game.bat (to play original)
echo   3. Run: extract-assets.bat (to start modding)
echo.
pause
