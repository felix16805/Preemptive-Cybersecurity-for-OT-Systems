@echo off
title SafeCut - allow firewall
:: Re-launch as administrator if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo Opening Windows Firewall for SafeCut (TCP 3000 web console, TCP 5020 Modbus demo)...
netsh advfirewall firewall delete rule name="SafeCut Defender 3000" >nul 2>&1
netsh advfirewall firewall delete rule name="SafeCut Modbus 5020" >nul 2>&1
netsh advfirewall firewall add rule name="SafeCut Defender 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall add rule name="SafeCut Modbus 5020" dir=in action=allow protocol=TCP localport=5020 profile=any
echo.
echo Done. These rules apply on Public networks too (phone hotspots are usually "Public").
echo To remove them later:  netsh advfirewall firewall delete rule name="SafeCut Defender 3000"
pause
