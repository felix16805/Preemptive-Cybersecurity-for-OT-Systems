@echo off
title SafeCut - repair packages
cd /d "%~dp0"
echo Deleting installed packages and build cache, then reinstalling. Needs internet.
if exist .next rmdir /s /q .next
if exist node_modules rmdir /s /q node_modules
call npm cache verify
call npm install
if errorlevel 1 (echo [X] npm install failed. Check the internet connection. & pause & exit /b 1)
echo.
echo Done. Now run START_DEFENDER.bat
pause
