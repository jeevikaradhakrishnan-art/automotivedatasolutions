@echo off
title Automotive Data Solutions Launcher

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "XDAS Backend" cmd /k "cd /d "%~dp0Backend" && uvicorn main:app --host 0.0.0.0 --port 8000"

echo [2/2] Starting Frontend (Vite preview on port 8080)...
start "XDAS Frontend" cmd /k "cd /d "%~dp0Frontend" && npm run start"

echo.
echo Services launched. Access at http://%COMPUTERNAME%:8080
exit
