$ErrorActionPreference = 'Stop'
$reportPath = Join-Path $PSScriptRoot 'restart-result.json'
$steps = @()
$failure = $null

try {
    foreach ($serviceName in @('BoardWebAPIEngine', 'BoardEngine')) {
        $service = Get-Service -Name $serviceName
        if ($service.Status -ne 'Stopped') {
            $service.Stop()
            $service.WaitForStatus('Stopped', [TimeSpan]::FromMinutes(2))
            $steps += "Stopped $serviceName"
        }
    }
    foreach ($serviceName in @('BoardEngine', 'BoardWebAPIEngine')) {
        $service = Get-Service -Name $serviceName
        $service.Start()
        $service.WaitForStatus('Running', [TimeSpan]::FromMinutes(2))
        $steps += "Started $serviceName"
    }
} catch {
    $failure = $_.Exception.Message
} finally {
    foreach ($serviceName in @('BoardEngine', 'BoardWebAPIEngine')) {
        try {
            $service = Get-Service -Name $serviceName
            if ($service.Status -ne 'Running') {
                $service.Start()
                $service.WaitForStatus('Running', [TimeSpan]::FromMinutes(2))
                $steps += "Recovered $serviceName"
            }
        } catch {
            $steps += "Could not recover ${serviceName}: $($_.Exception.Message)"
        }
    }
    $statuses = @(Get-Service -Name BoardEngine, BoardWebAPIEngine | Select-Object Name, Status)
    [pscustomobject]@{
        time = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
        steps = $steps
        error = $failure
        services = $statuses
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
}

if ($failure) { exit 1 }
