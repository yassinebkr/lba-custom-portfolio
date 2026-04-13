@echo off
setlocal EnableDelayedExpansion
REM Test LBA1 Game - Multiple options to play

echo === LBA1 Game Tester ===
echo.

cd /d "%~dp0.."
set "GAME_DIR=%CD%\base_game"
set "GOG_DIR=E:\Program Files (x86)\GOG Galaxy\Games\tlba-classic"

REM Check if game files exist
if not exist "%GAME_DIR%\RESS.HQR" (
    echo [ERROR] Game files not found in base_game\
    pause
    exit /b 1
)

echo Game files found in: %GAME_DIR%
echo.
echo Choose how to play:
echo.
echo   [1] GOG Remaster - Best quality, built-in language switching
echo   [2] DOS via DOSBox - Original experience
echo   [3] Open game folder
echo   [4] Cancel
echo.

set /p choice="Enter choice (1/2/3/4): "

if "!choice!"=="1" goto launch_remaster
if "!choice!"=="2" goto launch_dosbox
if "!choice!"=="3" goto open_folder
goto cancelled

:launch_remaster
echo.
echo Launching GOG Remaster...
cd /d "!GOG_DIR!"
start "" "TLBA1C.exe"
goto end

:launch_dosbox
echo.
echo Launching via DOSBox...
cd /d "!GOG_DIR!\Speedrun\Windows"
start "" "DOSBOX\DOSBox.exe" -conf "LBA1.conf"
goto end

:open_folder
explorer "%GAME_DIR%"
goto end

:cancelled
echo Cancelled.

:end
echo.
pause
endlocal
