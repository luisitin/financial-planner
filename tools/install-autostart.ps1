# tools/install-autostart.ps1 -- make the Planner server start by itself.
#
#   powershell -ExecutionPolicy Bypass -File tools\install-autostart.ps1            at logon (no admin)
#   powershell -ExecutionPolicy Bypass -File tools\install-autostart.ps1 -AtStartup at boot, no logon needed (asks for admin)
#   powershell -ExecutionPolicy Bypass -File tools\install-autostart.ps1 -Remove    take it out again
#
# Default: a Task Scheduler job "Financial Planner server" runs when this user logs on, opens a
# minimised console window with the server (same as Start-Planner.bat), and restarts it if it
# dies. -AtStartup instead runs it hidden at boot under this account (S4U: no password stored),
# which needs one administrator approval. Tailscale is a Windows service and already starts at
# boot on its own. Re-running replaces the job. Install-Autostart.bat calls this file.
param([switch]$AtStartup, [switch]$Remove)
$ErrorActionPreference = "Stop"
$name = "Financial Planner server"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$node = (Get-Command node.exe -ErrorAction Stop).Source

if ($AtStartup -and -not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`" -AtStartup"
  exit
}

$existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $name -Confirm:$false; Write-Host "Removed the old '$name' job." }
if ($Remove) { Write-Host "Done: the server no longer starts by itself."; exit }

if ($AtStartup) {
  $action = New-ScheduledTaskAction -Execute $node -Argument "server\server.mjs" -WorkingDirectory $root
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
  $how = "at boot, hidden, even before anyone logs on"
} else {
  # a visible (minimised) window, like Start-Planner.bat, so the log can be looked at
  $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\cmd.exe" -Argument "/c start `"Financial Planner server`" /min `"$node`" server\server.mjs" -WorkingDirectory $root
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
  $how = "when $env:USERNAME logs on, in a minimised window"
}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Serves the Financial Planner app on port 8787 (C:\FinancialPlanner). Installed by tools/install-autostart.ps1." | Out-Null
Write-Host "Installed '$name': starts $how. Task Scheduler > Task Scheduler Library shows it."
if (-not (Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue)) {
  Start-ScheduledTask -TaskName $name
  Write-Host "The server was not running, so the job was started now."
} else { Write-Host "The server is already running; the job takes over from the next logon." }
