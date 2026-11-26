@echo off
title Taskeen Desktop (Dev)
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Install Node 22.13 or newer from https://nodejs.org
    pause
    exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
    echo Node 22.13 or newer is required ^(node:sqlite is used to build the database^).
    node -v
    pause
    exit /b 1
)

where cargo >nul 2>&1
if errorlevel 1 (
    echo Rust/Cargo not found. Install from https://rustup.rs
    pause
    exit /b 1
)

echo Syncing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
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
