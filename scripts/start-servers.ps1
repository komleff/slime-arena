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

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🚀 SLIME ARENA — Запуск серверов" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📂 Корневая директория: $projectRoot" -ForegroundColor Yellow
Write-Host "📝 Логи: $logDir" -ForegroundColor Yellow
Write-Host ""

# Проверяем наличие node_modules
if (!(Test-Path (Join-Path $projectRoot "node_modules"))) {
    Write-Host "⚠️  node_modules не найдены. Запускаю npm install..." -ForegroundColor Yellow
    Push-Location $projectRoot
    npm install
    Pop-Location
}

# Запускаем сервер в новом PowerShell окне
Write-Host "▶️  Запуск сервера (ws://localhost:2567)" -ForegroundColor Green
$serverLogPath = Join-Path $logDir "server.log"
$serverWindow = Start-Process -FilePath "pwsh.exe" -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$projectRoot'; npm run dev:server 2>&1 | Tee-Object -FilePath '$serverLogPath'" `
    -PassThru

Write-Host "   ✓ Сервер запущен (PID: $($serverWindow.Id))" -ForegroundColor Green
Write-Host ""

# Небольшая задержка перед запуском клиента
Start-Sleep -Seconds 2

# Запускаем клиент в новом PowerShell окне
Write-Host "▶️  Запуск клиента (http://localhost:5173)" -ForegroundColor Green
$clientLogPath = Join-Path $logDir "client.log"
$clientWindow = Start-Process -FilePath "pwsh.exe" -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$projectRoot'; npm run dev:client 2>&1 | Tee-Object -FilePath '$clientLogPath'" `
    -PassThru

Write-Host "   ✓ Клиент запущен (PID: $($clientWindow.Id))" -ForegroundColor Green
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Оба сервера запущены!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Адреса:" -ForegroundColor Yellow
Write-Host "   Server:  ws://localhost:2567" -ForegroundColor Cyan
Write-Host "   Client:  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Команды:" -ForegroundColor Yellow
Write-Host "   • Закрыть сервер:  закройте окно сервера" -ForegroundColor Gray
Write-Host "   • Закрыть клиент:  закройте окно клиента" -ForegroundColor Gray
Write-Host "   • Остановить всё:  введите 'npm run stop:servers' в главном терминале" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Логи: $logDir" -ForegroundColor Yellow
Write-Host ""

# Опционально ждём окончания процессов
if (!$NoWait) {
    Write-Host "⏳ Ожидаю закрытия процессов..." -ForegroundColor Gray
    $serverWindow.WaitForExit()
    $clientWindow.WaitForExit()
    Write-Host "✓ Процессы завершены" -ForegroundColor Green
}
