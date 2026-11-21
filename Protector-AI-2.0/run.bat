@echo off
title Protector AI 2.0 - Launcher
echo ========================================================
echo          STARTING PROTECTOR AI 2.0 APPLICATION
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting Python Flask Backend on http://127.0.0.1:5000 ...
start "Protector AI - Backend" cmd /k "cd Backend && python app.py"

timeout /t 3 /nobreak >nul

echo [2/2] Starting React + Vite Frontend on http://localhost:5173 ...
start "Protector AI - Frontend" cmd /k "cd Frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo Opening Protector AI Dashboard in your default browser...
start http://localhost:5173

echo.
echo ========================================================
echo   Protector AI 2.0 is now RUNNING!
echo   Frontend : http://localhost:5173
echo   Backend  : http://127.0.0.1:5000
echo ========================================================
