$ErrorActionPreference = 'Stop'
$credentialPath = Join-Path $env:LOCALAPPDATA 'BoardMCP\client.xml'
$credential = Import-Clixml -LiteralPath $credentialPath
$plain = $credential.GetNetworkCredential()
$token = Invoke-RestMethod -Method Post -Uri 'http://localhost/identity/connect/token' `
    -ContentType 'application/x-www-form-urlencoded' `
    -Body @{ grant_type = 'client_credentials'; scope = 'public-api'; client_id = $plain.UserName; client_secret = $plain.Password }
$results = @()
foreach ($resource in @('Leonardo/schema/Entities', 'Leonardo/schema/Cubes', 'presentations')) {
    $request = [System.Net.WebRequest]::Create("http://localhost/public/$resource")
    $request.Headers['Authorization'] = "Bearer $($token.access_token)"
    try {
        $response = $request.GetResponse()
        $results += [pscustomobject]@{ resource = $resource; status = [int]$response.StatusCode; body = $null }
        $response.Close()
    } catch {
        $response = if ($_.Exception.Response) { $_.Exception.Response } else { $_.Exception.InnerException.Response }
        $body = $null
        if ($response) {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $body = $reader.ReadToEnd()
            if ($body.Length -gt 1000) { $body = $body.Substring(0, 1000) }
        }
        $results += [pscustomobject]@{ resource = $resource; status = if ($response) { [int]$response.StatusCode } else { 0 }; body = $body; errorType = $_.Exception.GetType().FullName; error = $_.Exception.Message }
    }
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$PSScriptRoot\diagnostic-result.json" -Encoding UTF8
