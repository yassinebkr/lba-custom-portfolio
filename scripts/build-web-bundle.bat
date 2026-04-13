@echo off
REM Build js-dos Bundle for LBA1 Portfolio - Windows Version

echo === Building LBA1 Web Bundle ===
echo.

cd /d "%~dp0.."
set "PROJECT_ROOT=%CD%"
set "BASE_GAME=%PROJECT_ROOT%\base_game"
set "OUTPUT=%PROJECT_ROOT%\output"
set "WEB_DEPLOY=%PROJECT_ROOT%\web_deploy"
set "BUNDLE_DIR=%WEB_DEPLOY%\bundle"

REM Check prerequisites
echo Checking prerequisites...

if not exist "%BASE_GAME%" (
    echo [ERROR] base_game\ directory not found.
    echo Please place your LBA1 game files there.
    pause
    exit /b 1
)

where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell not found (needed for zip).
    pause
    exit /b 1
)

echo [OK] Prerequisites checked
echo.

REM Create bundle structure
echo Creating bundle structure...

if exist "%BUNDLE_DIR%" rmdir /s /q "%BUNDLE_DIR%"
mkdir "%BUNDLE_DIR%\.jsdos"
mkdir "%BUNDLE_DIR%\LBA"

REM Create dosbox.conf
echo [sdl]> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo fullscreen=false>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo output=opengl>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo.>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo [cpu]>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo core=auto>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo cputype=pentium_slow>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo cycles=max>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo.>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo [autoexec]>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo @echo off>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo mount c .>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo c:>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo cd LBA>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo LBA.EXE>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"
echo exit>> "%BUNDLE_DIR%\.jsdos\dosbox.conf"

echo [CREATED] dosbox.conf

REM Copy original game files
echo Copying original game files...
copy "%BASE_GAME%\*.*" "%BUNDLE_DIR%\LBA\" >nul 2>&1
echo [COPIED] Original files

REM Overlay modded files
echo Overlaying modded assets...
if exist "%OUTPUT%" (
    copy "%OUTPUT%\*.*" "%BUNDLE_DIR%\LBA\" >nul 2>&1
    echo [APPLIED] Modded files
) else (
    echo [SKIP] No output\ directory (no mods to apply)
)

REM Create .jsdos bundle using PowerShell
echo.
echo Creating .jsdos bundle...

set "BUNDLE_FILE=%WEB_DEPLOY%\lba1_portfolio.jsdos"
if exist "%BUNDLE_FILE%" del "%BUNDLE_FILE%"

powershell -Command "Compress-Archive -Path '%BUNDLE_DIR%\*' -DestinationPath '%BUNDLE_FILE%' -Force"

echo [CREATED] lba1_portfolio.jsdos
echo.

REM Cleanup
echo Cleaning up...
rmdir /s /q "%BUNDLE_DIR%"
echo [DONE]

echo.
echo === Build Complete ===
echo.
echo Bundle: %BUNDLE_FILE%
echo.
echo To test locally:
echo   cd web_deploy
echo   npx serve .
echo   Open http://localhost:3000
echo.
pause
