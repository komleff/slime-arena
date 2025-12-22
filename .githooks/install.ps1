# Скрипт установки Git hooks для защиты ветки main (PowerShell)

Write-Host "Установка Git hooks..." -ForegroundColor Cyan

# Получаем путь к репозиторию
try {
    $repoRoot = git rev-parse --show-toplevel 2>$null
    if (-not $repoRoot) {
        throw "Не удалось найти корень Git репозитория"
    }
} catch {
    Write-Host "❌ Ошибка: не удалось найти корень Git репозитория" -ForegroundColor Red
    exit 1
}

# Конвертируем Unix-путь в Windows-путь
$repoRoot = $repoRoot -replace '/', '\'

# Путь к директории с hooks
$hooksDir = Join-Path $repoRoot ".githooks"

# Проверяем наличие .githooks
if (-not (Test-Path $hooksDir)) {
    Write-Host "❌ Ошибка: директория .githooks не найдена" -ForegroundColor Red
    exit 1
}

# Конфигурируем Git для использования .githooks
Write-Host "Настройка Git для использования .githooks..." -ForegroundColor Yellow
git config core.hooksPath .githooks

Write-Host "✅ Git hooks установлены успешно!" -ForegroundColor Green
Write-Host ""
Write-Host "Теперь попытки прямой отправки в main будут заблокированы локально." -ForegroundColor White
Write-Host ""
