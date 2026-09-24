$ErrorActionPreference = 'Stop'
$summary = @()
foreach ($operation in @('list_entities', 'list_cubes')) {
    $result = & "$PSScriptRoot\board-api.ps1" -Operation $operation -Model Leonardo | ConvertFrom-Json
    $data = $result.data
    $summary += [pscustomobject]@{
        operation = $operation
        model = $result.model
        error = $result.error
        stage = $result.stage
        responseType = if ($null -eq $data) { $null } else { $data.GetType().Name }
        responseKeys = if ($null -ne $data -and $data -isnot [array]) { @($data.PSObject.Properties.Name) } else { @() }
        count = if ($data -is [array]) { $data.Count } elseif ($null -eq $data) { 0 } else { 1 }
    }
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$PSScriptRoot\smoke-test.json" -Encoding UTF8
