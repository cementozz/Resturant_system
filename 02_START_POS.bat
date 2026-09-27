@echo off
title Track Bite - Start staff and POS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start.ps1" -Open pos
if errorlevel 1 pause
