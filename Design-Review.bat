@echo off
rem Opens a Claude Code session in this folder that runs the design review loop:
rem it screenshots each page, proposes fixes with options, and applies what you approve.
rem Say "done" in that session to stop. Decisions are recorded in docs\DESIGN_LOG.md.
rem The rules for running it next to the builder and the tester are in docs\TEAM.md.
title Design review - Financial Planner
call "%~dp0tools\run-claude.bat" --permission-mode acceptEdits "/design-review"
