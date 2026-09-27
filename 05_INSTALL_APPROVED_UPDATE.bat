@echo off
set /p TRACKBITE_RELEASE_VERSION=Approved release version (for example 0.6.0):
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install-update.ps1" -Version "%TRACKBITE_RELEASE_VERSION%"
pause
