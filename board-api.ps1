param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('list_models', 'list_entities', 'list_cubes')]
    [string]$Operation,
    [string]$Model
)

$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost'
$databasePath = 'C:\Board\Database'
$credentialPath = Join-Path $env:LOCALAPPDATA 'BoardMCP\client.xml'
$stage = 'enumerate models'

try {
    $models = @(Get-ChildItem -LiteralPath $databasePath -Directory -Filter '*.hbmp' |
        ForEach-Object { $_.Name.Substring(0, $_.Name.Length - 5) })
    if ($Operation -eq 'list_models') {
        @{ models = $models } | ConvertTo-Json -Compress -Depth 10
        exit 0
    }
    if ($models -cnotcontains $Model) {
        @{ error = "Data Model '$Model' was not found on this server." } | ConvertTo-Json -Compress
        exit 0
    }
    if (-not (Test-Path -LiteralPath $credentialPath)) {
        @{ error = 'Board API credentials are not configured. Run Configure-BoardMcp.ps1 after creating a Board Client API user.' } | ConvertTo-Json -Compress
        exit 0
    }
    $stage = 'read credentials'
    $credential = Import-Clixml -LiteralPath $credentialPath
    $plain = $credential.GetNetworkCredential()
    $stage = 'request token'
    $token = Invoke-RestMethod -Method Post -Uri "$baseUrl/identity/connect/token" `
        -ContentType 'application/x-www-form-urlencoded' `
        -Body @{ grant_type = 'client_credentials'; scope = 'public-api'; client_id = $plain.UserName; client_secret = $plain.Password } `
        -TimeoutSec 20
    if (-not $token.access_token) { throw 'Board did not return an access token.' }
    $resource = if ($Operation -eq 'list_entities') { 'Entities' } else { 'Cubes' }
    $escapedModel = [Uri]::EscapeDataString($Model)
    $stage = 'request schema'
    $response = Invoke-RestMethod -Method Get -Uri "$baseUrl/public/$escapedModel/schema/$resource" `
        -Headers @{ Authorization = "Bearer $($token.access_token)" } -TimeoutSec 30
    @{ model = $Model; resource = $resource; data = $response } | ConvertTo-Json -Compress -Depth 50
} catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $message = if ($status -eq 401 -or $status -eq 403) {
        'Board rejected the API credentials or access to this Data Model.'
    } elseif ($status -eq 500) {
        'Board Public API returned HTTP 500. See BOARD-API-ISSUE.md for the known local server error.'
    } elseif ($status) {
        "Board API returned HTTP $status."
    } else {
        'Could not reach the local Board API or read its credentials.'
    }
    @{ error = $message; stage = $stage } | ConvertTo-Json -Compress
}
