@echo off
REM Edit LBA1 Dialogue - Windows Version

echo === LBA1 Dialogue Editor ===
echo.

cd /d "%~dp0hqr-tools"

if "%1"=="" (
    echo Usage:
    echo   edit-dialogue.bat extract   - Extract strings to JSON
    echo   edit-dialogue.bat repack    - Rebuild TEXT.HQR from JSON
    echo.
    echo Workflow:
    echo   1. Run: edit-dialogue.bat extract
    echo   2. Edit: modded_assets\text\dialogue_strings.json
    echo   3. Run: edit-dialogue.bat repack
    echo   4. Find output in: output\TEXT.HQR
    echo.
    pause
    exit /b 0
)

node edit-text.js %1

echo.
pause
