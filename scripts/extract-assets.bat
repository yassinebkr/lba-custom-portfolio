@echo off
REM Extract LBA1 HQR Assets - Windows Version

echo === LBA1 Asset Extraction ===
echo.

cd /d "%~dp0hqr-tools"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Run extraction
echo Running extraction script...
echo.
node extract-all.js

echo.
echo === Extraction Complete ===
echo.
echo Extracted assets are in: modded_assets\
echo.
pause
