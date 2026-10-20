@echo off
title SafeCut Attacker
cd /d "%~dp0attacker-cli"
echo ==============================================================
echo   SafeCut ATTACKER laptop
echo ==============================================================
where node >nul 2>&1 || (echo [X] Node.js is not installed. Install it from nodejs.org, then run this again. & pause & exit /b 1)
if not exist node_modules (
  echo Installing attacker CLI packages, first run only, needs internet...
  call npm install || (echo [X] npm install failed & pause & exit /b 1)
)
echo.
echo When asked, type the IP shown on the defender console ("Attacker Connection").
echo.
call npm run dev
pause
