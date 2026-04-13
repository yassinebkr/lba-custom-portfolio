@echo off
REM Test LBA1 Game - Multiple options to play
REM Supports GOG version (remaster + DOS)

echo === LBA1 Game Tester ===
echo.

cd /d "%~dp0.."
set "GAME_DIR=%CD%\base_game"
set "GOG_DIR=E:\Program Files (x86)\GOG Galaxy\Games\tlba-classic"

REM Check if game files exist
if not exist "%GAME_DIR%\RELENT.EXE" (
    if not exist "%GAME_DIR%\RESS.HQR" (
        echo [ERROR] Game files not found in base_game\
        echo.
        echo Run init-workspace.bat first, or copy files manually.
        pause
        exit /b 1
    )
)

echo Game files found in: %GAME_DIR%
echo.
echo Choose how to play:
echo.
echo   [1] GOG Remaster (TLBA1C.exe) - Best quality, built-in language switching
echo   [2] DOS via DOSBox (RELENT.EXE) - Original experience
echo   [3] Open game folder
echo   [4] Cancel
echo.

set /p choice="Enter choice (1/2/3/4): "

if "%choice%"=="1" (
    echo.
    echo Launching GOG Remaster...
    if exist "%GOG_DIR%\TLBA1C.exe" (
        start "" "%GOG_DIR%\TLBA1C.exe"
    ) else (
        echo [ERROR] TLBA1C.exe not found at:
        echo         %GOG_DIR%
        echo.
        echo Please update GOG_DIR in this script.
    )
    goto :end
)

if "%choice%"=="2" (
    echo.
    echo Launching via DOSBox...

    REM Try GOG's bundled DOSBox first
    set "DOSBOX_EXE=%GOG_DIR%\Speedrun\Windows\DOSBOX\DOSBox.exe"
    set "DOSBOX_CONF=%GOG_DIR%\Speedrun\Windows\LBA1.conf"

    if exist "%DOSBOX_EXE%" (
        echo Using GOG's DOSBox...
        start "" "%DOSBOX_EXE%" -conf "%DOSBOX_CONF%"
        goto :end
    )

    REM Try system DOSBox
    where dosbox >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Using system DOSBox...
        dosbox -c "mount c %GAME_DIR%" -c "c:" -c "RELENT.EXE" -c "exit"
        goto :end
    )

    echo [ERROR] DOSBox not found.
    echo Install DOSBox or use option 1 (Remaster).
    goto :end
)

if "%choice%"=="3" (
    explorer "%GAME_DIR%"
    goto :end
)

echo Cancelled.

:end
echo.
pause
