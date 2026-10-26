@echo off
rem Opens a Claude Code session in this folder that tests the app like a person would, on a
rem pretend plan (the sandbox), and files findings with suggestions in docs\FEEDBACK.md.
rem It never edits code; it asks before any file change, so decline anything outside
rem docs\FEEDBACK.md and qa\. Say "done" in that session to stop. Rules: docs\TEAM.md.
title Tester - Financial Planner
call "%~dp0tools\run-claude.bat" "/tester"
