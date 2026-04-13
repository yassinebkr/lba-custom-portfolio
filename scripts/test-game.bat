@echo off
REM Test LBA1 Game - Runs the original game via DOSBox or directly
REM Place your LBA1 files in base_game\ first

echo === LBA1 Game Tester ===
echo.

cd /d "%~dp0.."
set "GAME_DIR=%CD%\base_game"

REM Check if game files exist
if not exist "%GAME_DIR%\LBA.EXE" (
    if not exist "%GAME_DIR%\lba.exe" (
        echo [ERROR] LBA.EXE not found in base_game\
        echo.
        echo Please copy your LBA1 game files to:
        echo   %GAME_DIR%
        echo.
        echo Required files:
        echo   - LBA.EXE
        echo   - LBA.HQR
        echo   - RESS.HQR
        echo   - TEXT.HQR
        echo   - SCENE.HQR
        echo   - (and other .HQR files)
        echo.
        pause
        exit /b 1
    )
)

echo Found game files in: %GAME_DIR%
echo.

REM List HQR files
echo HQR files found:
dir /b "%GAME_DIR%\*.HQR" 2>nul
dir /b "%GAME_DIR%\*.hqr" 2>nul
echo.

REM Check for DOSBox
where dosbox >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OPTION 1] DOSBox found - launching game...
    echo.
    dosbox -c "mount c %GAME_DIR%" -c "c:" -c "LBA.EXE" -c "exit"
    goto :end
)

REM Check for DOSBox in common locations
if exist "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" (
    echo [OPTION 1] DOSBox found - launching game...
    "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -c "mount c %GAME_DIR%" -c "c:" -c "LBA.EXE" -c "exit"
    goto :end
)

if exist "C:\Program Files\DOSBox\DOSBox.exe" (
    echo [OPTION 1] DOSBox found - launching game...
    "C:\Program Files\DOSBox\DOSBox.exe" -c "mount c %GAME_DIR%" -c "c:" -c "LBA.EXE" -c "exit"
    goto :end
)

REM No DOSBox found
echo [INFO] DOSBox not found in PATH or common locations.
echo.
echo Options to run LBA1:
echo.
echo   1. Install DOSBox from https://www.dosbox.com/download.php
echo      Then run this script again.
echo.
echo   2. Use DOSBox-X (better compatibility):
echo      https://dosbox-x.com/
echo.
echo   3. If you have the GOG or Steam version, it includes DOSBox.
echo      Run it from there instead.
echo.
echo   4. Try running LBA.EXE directly (may work on some systems):
echo      cd base_game
echo      LBA.EXE
echo.

:end
pause
