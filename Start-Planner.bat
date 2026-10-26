@echo off
rem Starts the Financial Planner server in this window. Close the window or press Ctrl+C to stop.
rem Phones on the LAN open the http://<PC IP>:8787/ address printed below.
cd /d "%~dp0"
title Financial Planner server
if not exist planner.properties (
  echo No planner.properties yet: copying planner.properties.example. Edit it later for a token or a different model.
  copy planner.properties.example planner.properties >nul
)
node server\server.mjs
pause
