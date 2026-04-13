@echo off
REM LBA1 Multi-Language Setup
REM Run this after you have both GOG and Abandonware versions

cd /d "%~dp0.."
set "GAME_DIR=%CD%\base_game"
set "VOICES_DIR=%GAME_DIR%\voices"

echo === LBA1 Multi-Language Setup ===
echo.
echo This script helps you set up both French and English voices.
echo.
echo You will need:
echo   - GOG version (for English voices + clean game files)
echo   - Abandonware version (for original French voices)
echo.

REM Create directory structure
mkdir "%VOICES_DIR%\english" 2>nul
mkdir "%VOICES_DIR%\french" 2>nul

echo Directory structure created:
echo   %VOICES_DIR%\english\
echo   %VOICES_DIR%\french\
echo.

REM Check current state
echo Current status:
echo.

if exist "%GAME_DIR%\VOX000.HQR" (
    echo   [OK] VOX000.HQR found in base_game\
    echo        (This is probably from GOG - backup it now)
    echo.

    if not exist "%VOICES_DIR%\english\VOX000.HQR" (
        echo   Copying to voices\english\ as backup...
        copy "%GAME_DIR%\VOX000.HQR" "%VOICES_DIR%\english\VOX000.HQR" >nul
        echo   [OK] English voices backed up
    ) else (
        echo   [OK] English voices already backed up
    )
) else (
    echo   [!] No VOX000.HQR in base_game\ yet
)

echo.

if exist "%VOICES_DIR%\french\VOX000.HQR" (
    echo   [OK] French voices ready
) else (
    echo   [!] French voices missing
    echo       Copy VOX000.HQR from Abandonware to:
    echo       %VOICES_DIR%\french\
)

echo.
echo ================================================
echo.
echo Next steps:
echo.
echo   1. Download GOG version, copy all files to base_game\
echo.
echo   2. Run this script again (it will backup English voices)
echo.
echo   3. Download Abandonware version, extract it
echo      Copy ONLY the VOX000.HQR to: base_game\voices\french\
echo.
echo   4. Use switch-language.bat to swap between FR/EN
echo.
pause
