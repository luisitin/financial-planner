@echo off
rem One-time: let phones reach the Planner server (inbound TCP 8787), but ONLY from this PC's own
rem network (Windows' LocalSubnet) and from Tailscale (100.64.0.0/10). Nothing else on the internet
rem can reach the port even if a router ever forwarded it. Double-click; Windows asks for
rem administrator approval, then a window confirms. Re-running replaces the old rule.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"Get-NetFirewallRule -DisplayName ''Financial Planner 8787'' -ErrorAction SilentlyContinue | Remove-NetFirewallRule; New-NetFirewallRule -DisplayName ''Financial Planner 8787'' -Direction Inbound -Protocol TCP -LocalPort 8787 -RemoteAddress LocalSubnet,100.64.0.0/10 -Action Allow -Profile Any | Out-Null; Write-Host ''Added: inbound TCP 8787 allowed from the home network and Tailscale (100.x) only.''; Read-Host ''Press Enter to close''\"'"
