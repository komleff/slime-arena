# PowerShell скрипт для запуска сервера и клиента в отдельных терминалах
# Использование: .\scripts\start-servers.ps1

param(
    [switch]$NoWait = $false
)

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$logDir = Join-Path $projectRoot "logs"

# Создаём директорию логов, если её нет
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host " SLIME ARENA - Starting servers" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project root: $projectRoot" -ForegroundColor Yellow
Write-Host "Logs: $logDir" -ForegroundColor Yellow
Write-Host ""

# Check if node_modules exists
if (!(Test-Path (Join-Path $projectRoot "node_modules"))) {
    Write-Host "[!] node_modules not found. Running npm install..." -ForegroundColor Yellow
    Push-Location $projectRoot
    npm install
    Pop-Location
}

# Start server in new PowerShell window
Write-Host "[*] Starting server (ws://localhost:2567)" -ForegroundColor Green
$serverLogPath = Join-Path $logDir "server.log"
$serverWindow = Start-Process -FilePath "pwsh.exe" -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$projectRoot'; npm run dev:server 2>&1 | Tee-Object -FilePath '$serverLogPath'" `
    -PassThru

Write-Host "    [+] Server started (PID: $($serverWindow.Id))" -ForegroundColor Green
Write-Host ""

# Wait before starting client
Start-Sleep -Seconds 2

# Start client in new PowerShell window
Write-Host "[*] Starting client (http://localhost:5173)" -ForegroundColor Green
$clientLogPath = Join-Path $logDir "client.log"
$clientWindow = Start-Process -FilePath "pwsh.exe" -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$projectRoot'; npm run dev:client 2>&1 | Tee-Object -FilePath '$clientLogPath'" `
    -PassThru

Write-Host "    [+] Client started (PID: $($clientWindow.Id))" -ForegroundColor Green
Write-Host ""

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "[OK] Both servers are running!" -ForegroundColor Green
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Addresses:" -ForegroundColor Yellow
Write-Host "   Server:  ws://localhost:2567" -ForegroundColor Cyan
Write-Host "   Client:  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "   - Close server:  close the server window" -ForegroundColor Gray
Write-Host "   - Close client:  close the client window" -ForegroundColor Gray
Write-Host "   - Stop all:      run 'npm run stop:servers'" -ForegroundColor Gray
Write-Host ""
Write-Host "Logs: $logDir" -ForegroundColor Yellow
Write-Host ""

# Опционально ждём окончания процессов
if (!$NoWait) {
    Write-Host "⏳ Ожидаю закрытия процессов..." -ForegroundColor Gray
    $serverWindow.WaitForExit()
    $clientWindow.WaitForExit()
    Write-Host "✓ Процессы завершены" -ForegroundColor Green
}
