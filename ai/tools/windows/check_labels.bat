@echo off
chcp 65001 >nul
rem SlimLog: drag AI Hub label zip files onto this file
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check_labels.ps1" %*
echo.
pause
