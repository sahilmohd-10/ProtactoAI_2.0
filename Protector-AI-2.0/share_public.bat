@echo off
title Protector AI 2.0 - Public Internet Tunnel
echo ========================================================
echo        PROTECTOR AI 2.0 - INSTANT PUBLIC TUNNEL
echo ========================================================
echo.
echo Connecting to secure public tunnel on port 5173...
echo Copy the https://....pinggy.link URL displayed below to access from anywhere.
echo.
ssh -p 443 -R0:localhost:5173 a.pinggy.io
pause
