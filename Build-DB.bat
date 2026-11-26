@echo off
title Taskeen - Rebuild Database
cd /d "%~dp0"

echo Building SQLite database from data\tahqeeq\entries.json...
call npm run build:db

echo.
pause
