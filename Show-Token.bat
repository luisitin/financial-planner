@echo off
rem Shows this PC's planner access token so you can type it into a phone (System > Settings >
rem Access token). The token lives only in planner.properties, which the server never serves.
cd /d "%~dp0"
echo.
for /f "tokens=1,* delims==" %%A in ('findstr /b "auth.token=" planner.properties') do echo   Access token:  %%B
echo.
echo   Type it into the phone once: System ^> Settings ^> PC server ^> Access token ^> Save.
echo.
pause
