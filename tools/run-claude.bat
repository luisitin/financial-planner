@echo off
rem tools\run-claude.bat -- start Claude Code in this project with the arguments given.
rem Used by Design-Review.bat and Tester.bat. Finds a binary that actually runs: on some PCs
rem the npm "claude" on PATH is a stub whose download never finished, so prefer the
rem official install, then the newest VS Code extension build, then whatever PATH has.
setlocal EnableDelayedExpansion
cd /d "%~dp0\.."
set "CLAUDE="
if exist "%USERPROFILE%\.local\bin\claude.exe" set "CLAUDE=%USERPROFILE%\.local\bin\claude.exe"
if not defined CLAUDE (
  for /f "delims=" %%D in ('dir /b /ad /o-n "%USERPROFILE%\.vscode\extensions\anthropic.claude-code-*" 2^>nul') do (
    if not defined CLAUDE if exist "%USERPROFILE%\.vscode\extensions\%%D\resources\native-binary\claude.exe" (
      set "CLAUDE=%USERPROFILE%\.vscode\extensions\%%D\resources\native-binary\claude.exe"
    )
  )
)
if not defined CLAUDE set "CLAUDE=claude"
echo Using: !CLAUDE!
echo.
call "!CLAUDE!" %*
if errorlevel 1 (
  echo.
  echo Claude Code did not start. Install it once with PowerShell:
  echo   irm https://claude.ai/install.ps1 ^| iex
  echo then run this file again.
  pause
)
endlocal
