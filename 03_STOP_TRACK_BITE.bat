@echo off
title Track Bite - Stop services
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\stop.ps1"
pause
