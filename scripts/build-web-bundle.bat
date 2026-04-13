@echo off
REM Build js-dos Bundle for LBA1 Portfolio
REM Creates web_deploy/lba1_portfolio.jsdos ready for GitHub Pages

echo === LBA1 Portfolio - Web Bundle Builder ===
echo.

cd /d "%~dp0.."
set "ROOT=%CD%"
set "BASE=%ROOT%\base_game"
set "OUTPUT=%ROOT%\output"
set "WEB=%ROOT%\web_deploy"
set "BUNDLE=%WEB%\bundle"
set "GAME=%BUNDLE%\LBA"

REM --- Prerequisites ---
if not exist "%BASE%\RELENT.EXE" (
    echo [ERROR] base_game\RELENT.EXE not found. Place DOS game files in base_game\
    pause & exit /b 1
)

where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell required for ZIP creation.
    pause & exit /b 1
)

REM --- Generate DOS saves ---
echo [1/5] Generating DOS-format saves...
cd "%ROOT%\scripts\hqr-tools"
node create-savegame.js --no-deploy --dos
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Save generation failed. & pause & exit /b 1 )
cd "%ROOT%"
echo [OK] Saves generated
echo.

REM --- Build bundle dir ---
echo [2/5] Assembling game files...
if exist "%BUNDLE%" rmdir /s /q "%BUNDLE%"
mkdir "%BUNDLE%\.jsdos"
mkdir "%GAME%"

REM Copy base game files (HQR, EXE)
copy "%BASE%\*.HQR" "%GAME%\" >nul
copy "%BASE%\*.EXE" "%GAME%\" >nul
copy "%BASE%\*.CFG" "%GAME%\" >nul

REM Overlay modded TEXT.HQR
if exist "%OUTPUT%\TEXT.HQR" (
    copy "%OUTPUT%\TEXT.HQR" "%GAME%\TEXT.HQR" >nul
    echo [APPLIED] Modded TEXT.HQR
) else (
    echo [WARN] output\TEXT.HQR not found - using original dialogue
)

REM Copy DOS saves (slot 0 = citadel hub, shown first on Continue)
if exist "%OUTPUT%\saves\dos" (
    copy "%OUTPUT%\saves\dos\LBA.S*" "%GAME%\" >nul
    echo [APPLIED] Portfolio save files
) else (
    echo [WARN] No DOS saves found in output\saves\dos\
)

REM Copy English voices only (keep bundle smaller)
if exist "%BASE%\VOX" (
    mkdir "%GAME%\VOX"
    copy "%BASE%\VOX\EN_*.VOX" "%GAME%\VOX\" >nul 2>&1
    echo [COPIED] English voice files
)

echo [OK] Game files assembled
echo.

REM --- dosbox.conf ---
echo [3/5] Writing dosbox.conf...
(
    echo [sdl]
    echo fullscreen=false
    echo output=opengl
    echo.
    echo [cpu]
    echo core=auto
    echo cputype=pentium_slow
    echo cycles=max
    echo.
    echo [autoexec]
    echo @echo off
    echo mount c .
    echo c:
    echo cd LBA
    echo RELENT.EXE
) > "%BUNDLE%\.jsdos\dosbox.conf"
echo [OK] dosbox.conf written
echo.

REM --- Pack .jsdos ---
echo [4/5] Packing .jsdos bundle...
set "JSDOS=%WEB%\lba1_portfolio.jsdos"
if exist "%JSDOS%" del "%JSDOS%"
powershell -Command "Compress-Archive -Path '%BUNDLE%\*' -DestinationPath '%JSDOS%' -Force"
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] ZIP creation failed. & pause & exit /b 1 )
echo [OK] Bundle created: lba1_portfolio.jsdos
echo.

REM --- Cleanup ---
echo [5/5] Cleaning up...
rmdir /s /q "%BUNDLE%"

REM --- Size report ---
for %%F in ("%JSDOS%") do set SIZE=%%~zF
set /a SIZEMB=%SIZE% / 1048576
echo.
echo === Done ===
echo Bundle: %JSDOS%
echo Size:   ~%SIZEMB% MB
echo.
echo To test locally:
echo   cd web_deploy
echo   npx serve .
echo   Open http://localhost:3000
echo.
echo To deploy: push web_deploy\ to GitHub Pages
echo.
pause
