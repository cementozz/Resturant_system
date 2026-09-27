@echo off
title Track Bite - Start customer website
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start.ps1" -Open website
if errorlevel 1 pause
