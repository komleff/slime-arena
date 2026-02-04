# Скрипт установки git hooks для защиты ветки main (PowerShell)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$HooksDir = Join-Path $ProjectRoot ".githooks"
$GitHooksDir = Join-Path $ProjectRoot ".git\hooks"

Write-Host "Установка git hooks для защиты ветки main..." -ForegroundColor Cyan
Write-Host ""

# Проверяем наличие директории .githooks
if (-not (Test-Path $HooksDir)) {
    Write-Host "❌ Ошибка: Директория .githooks не найдена" -ForegroundColor Red
    exit 1
}

# Проверяем наличие директории .git/hooks
if (-not (Test-Path $GitHooksDir)) {
    Write-Host "❌ Ошибка: Это не git репозиторий или .git\hooks не найдена" -ForegroundColor Red
    exit 1
}

# Копируем hooks
Get-ChildItem -Path $HooksDir | ForEach-Object {
    $hookName = $_.Name
    
    # Пропускаем README и другие не-hook файлы
    if ($hookName -eq "README.md" -or $hookName -like "*.md") {
        return
    }
    
    $target = Join-Path $GitHooksDir $hookName
    
    if (Test-Path $target) {
        Write-Host "⚠️  Файл $hookName уже существует, пропускаем..." -ForegroundColor Yellow
    } else {
        Copy-Item $_.FullName -Destination $target
        Write-Host "✅ Установлен hook: $hookName" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Установка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "Установленные hooks:"
Write-Host "  - pre-commit: блокирует коммиты в main"
Write-Host "  - pre-push: блокирует push в main"
Write-Host "  - prepare-commit-msg: предупреждает при работе в main"
Write-Host ""
