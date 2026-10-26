@echo off
rem Makes the Planner server start by itself when you log on (no admin needed).
rem Re-run to replace; "Install-Autostart.bat remove" takes it out again.
rem For a start at boot before anyone logs on: powershell -ExecutionPolicy Bypass -File tools\install-autostart.ps1 -AtStartup
cd /d "%~dp0"
if /i "%~1"=="remove" (
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\install-autostart.ps1 -Remove
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\install-autostart.ps1
)
pause
