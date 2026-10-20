@echo off
title SafeCut Defender
cd /d "%~dp0"
echo ==============================================================
echo   SafeCut DEFENDER laptop
echo ==============================================================

where node >nul 2>&1 || (echo [X] Node.js is not installed. Install it from nodejs.org, then run this again. & pause & exit /b 1)

if not exist node_modules goto install
echo [1/3] Packages already installed.
goto build

:install
echo [1/3] Installing packages, first run only, needs internet...
call npm install
if errorlevel 1 (echo [X] npm install failed. Check the internet connection. & pause & exit /b 1)

:build
echo [2/3] Building the app...
call npm run build
if not errorlevel 1 goto start

if defined SAFECUT_REPAIRED (echo [X] Build failed again after a clean reinstall. Scroll up for the error. & pause & exit /b 1)
echo.
echo [!] Build failed. Packages look damaged, doing a clean reinstall. Needs internet...
set SAFECUT_REPAIRED=1
if exist .next rmdir /s /q .next
if exist node_modules rmdir /s /q node_modules
call npm cache verify >nul 2>&1
goto install

:start
set SAFECUT_DEMO_MODE=1
echo.
echo [3/3] Starting the defender server on port 3000.
echo.
echo   Open on THIS laptop:   http://localhost:3000/console
echo   The console shows the IP the attacker must type, under "Attacker Connection".
echo.
echo   Your network addresses, use the Wi-Fi one, NOT vEthernet/WSL:
ipconfig | findstr /R /C:"adapter" /C:"IPv4"
echo.
echo   If the attacker cannot connect, run ALLOW_FIREWALL.bat once. It asks for admin.
echo   Keep this window open during the demo. Ctrl+C to stop.
echo ==============================================================
start "" http://localhost:3000/console
call npm start
pause
