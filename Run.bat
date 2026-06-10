@echo off
title Automotive Data Solutions Launcher

echo Starting Backend...
start "Backend - FastAPI" cmd /k "cd /d "%~dp0Backend" && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

echo Starting Frontend...
start "Frontend - Vite" cmd /k "cd /d "%~dp0Frontend" && npm run dev"

exit
