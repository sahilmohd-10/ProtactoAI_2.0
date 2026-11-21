@echo off
title Protector AI 2.0 - Public Internet Tunnel
echo ========================================================
echo        PROTECTOR AI 2.0 - INSTANT PUBLIC TUNNEL
echo ========================================================
echo.
echo Starting secure tunnel on port 5173...
echo Copy the https://....free.pinggy.link URL displayed below!
echo.
ssh -p 443 -R0:localhost:5173 free.pinggy.io
pause
