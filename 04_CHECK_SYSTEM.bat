@echo off
title Track Bite - Check system
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\check.ps1"
pause
