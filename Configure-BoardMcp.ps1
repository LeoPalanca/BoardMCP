$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:LOCALAPPDATA 'BoardMCP'
$credentialPath = Join-Path $directory 'client.xml'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
Write-Host 'Enter the Board Client API credentials created for this local server.'
Write-Host 'The secret is encrypted for this Windows user and will not be printed.'
$clientId = Read-Host 'Client ID'
if ([string]::IsNullOrWhiteSpace($clientId)) { throw 'Client ID cannot be empty.' }
$secret = Read-Host 'Client secret' -AsSecureString
if ($secret.Length -eq 0) { throw 'Client secret cannot be empty.' }
$credential = New-Object System.Management.Automation.PSCredential($clientId, $secret)
$credential | Export-Clixml -LiteralPath $credentialPath -Force
Write-Host "Board credentials saved for the current Windows user at $credentialPath"
