@echo off
title Taskeen Desktop (Dev)
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1420 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
taskkill /F /IM taskeen.exe >nul 2>&1

echo Building SQLite database...
call npm run build:db
if errorlevel 1 (
    echo Failed to build database.
    pause
    exit /b 1
)

echo Starting Taskeen Desktop...
call npm run tauri dev

if errorlevel 1 (
    echo.
    echo Taskeen exited with an error.
    pause
)
