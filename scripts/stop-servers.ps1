# PowerShell скрипт для остановки всех запущенных серверов
# Использование: .\scripts\stop-servers.ps1

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host " SLIME ARENA - Stopping servers" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

$portsToKill = @(2567, 5173)
$processesKilled = $false

foreach ($port in $portsToKill) {
    Write-Host "[*] Looking for processes on port $port..." -ForegroundColor Yellow
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            
            if ($process) {
                Write-Host "    Found: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Yellow
                Write-Host "    Stopping..." -ForegroundColor Yellow
                
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                
                Write-Host "    [+] Process stopped" -ForegroundColor Green
                $processesKilled = $true
            }
        } else {
            Write-Host "    [+] No processes found" -ForegroundColor Green
        }
    } catch {
        Write-Host "    [!] Error: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

if ($processesKilled) {
    Write-Host "=========================================================================" -ForegroundColor Cyan
    Write-Host "[OK] All servers stopped!" -ForegroundColor Green
    Write-Host "=========================================================================" -ForegroundColor Cyan
} else {
    Write-Host "=========================================================================" -ForegroundColor Cyan
    Write-Host "[i] No processes found on ports 2567, 5173" -ForegroundColor Blue
    Write-Host "=========================================================================" -ForegroundColor Cyan
}

Write-Host ""
