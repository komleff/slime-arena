# PowerShell скрипт для остановки всех запущенных серверов
# Использование: .\scripts\stop-servers.ps1

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🛑 SLIME ARENA — Остановка серверов" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$portsToKill = @(2567, 5173)
$processesKilled = $false

foreach ($port in $portsToKill) {
    Write-Host "🔍 Поиск процессов на порту $port..." -ForegroundColor Yellow
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            
            if ($process) {
                Write-Host "   Найден процесс: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Yellow
                Write-Host "   Остановка..." -ForegroundColor Yellow
                
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                
                Write-Host "   ✓ Процесс остановлен" -ForegroundColor Green
                $processesKilled = $true
            }
        } else {
            Write-Host "   ✓ Процессов не найдено" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠️  Ошибка: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

if ($processesKilled) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "✅ Все серверы остановлены!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
} else {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "ℹ️  Нет запущенных процессов на портах 2567, 5173" -ForegroundColor Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

Write-Host ""
