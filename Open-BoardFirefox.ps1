$ErrorActionPreference = 'Stop'
$listener = Get-NetTCPConnection -LocalPort 9228 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host 'The Board automation browser is already running on port 9228.'
    exit 0
}
$boardProfile = Join-Path $env:LOCALAPPDATA 'BoardMCP\firefox-profile'
New-Item -ItemType Directory -Path $boardProfile -Force | Out-Null
$firefoxArgs = '-no-remote -profile "' + $boardProfile + '" --remote-debugging-port 9228 http://localhost/en/'
Start-Process -FilePath 'C:\Program Files\Mozilla Firefox\firefox.exe' -ArgumentList $firefoxArgs -WindowStyle Normal
Write-Host 'Sign in to Board in the dedicated Firefox window and keep it open for MCP reads.'
