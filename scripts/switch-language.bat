@echo off
REM LBA1 Language Switcher
REM Swaps voice files between French (original) and English

cd /d "%~dp0.."
set "GAME_DIR=%CD%\base_game"
set "VOICES_DIR=%GAME_DIR%\voices"

echo === LBA1 Language Switcher ===
echo.

if not exist "%VOICES_DIR%\french\VOX000.HQR" (
    if not exist "%VOICES_DIR%\english\VOX000.HQR" (
        echo [SETUP REQUIRED]
        echo.
        echo Please set up voice files first:
        echo.
        echo   1. Create folders:
        echo      base_game\voices\english\
        echo      base_game\voices\french\
        echo.
        echo   2. Copy GOG's VOX000.HQR to voices\english\
        echo   3. Copy Abandonware's VOX000.HQR to voices\french\
        echo.
        pause
        exit /b 1
    )
)

echo Current voice files in game:
if exist "%GAME_DIR%\VOX000.HQR" (
    echo   VOX000.HQR exists
) else (
    echo   [No voice file found]
)
echo.

echo Select language:
echo   [1] French  (Original voices - Abandonware)
echo   [2] English (GOG version)
echo   [3] Cancel
echo.

set /p choice="Enter choice (1/2/3): "

if "%choice%"=="1" (
    if exist "%VOICES_DIR%\french\VOX000.HQR" (
        copy /Y "%VOICES_DIR%\french\VOX000.HQR" "%GAME_DIR%\VOX000.HQR" >nul
        echo.
        echo [OK] Switched to FRENCH voices (original)
    ) else (
        echo [ERROR] French voice file not found at:
        echo         %VOICES_DIR%\french\VOX000.HQR
    )
) else if "%choice%"=="2" (
    if exist "%VOICES_DIR%\english\VOX000.HQR" (
        copy /Y "%VOICES_DIR%\english\VOX000.HQR" "%GAME_DIR%\VOX000.HQR" >nul
        echo.
        echo [OK] Switched to ENGLISH voices
    ) else (
        echo [ERROR] English voice file not found at:
        echo         %VOICES_DIR%\english\VOX000.HQR
    )
) else (
    echo Cancelled.
)

echo.
pause
