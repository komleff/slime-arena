# AI Agents Setup Script
# Автоматическая настройка среды разработки с AI-агентами
# Запуск: .\install.ps1 -ProjectRoot "C:\path\to\your\project"

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectRoot = (Get-Location).Path
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Agents Setup Installer v1.0" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Целевой проект: $ProjectRoot" -ForegroundColor Yellow
Write-Host ""

# Проверяем что мы в правильной папке
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$ScriptDir\README.md")) {
    Write-Host "ОШИБКА: Запустите скрипт из папки ai-agents-setup" -ForegroundColor Red
    exit 1
}

# Проверяем целевой проект
if (-not (Test-Path $ProjectRoot)) {
    Write-Host "ОШИБКА: Папка проекта не найдена: $ProjectRoot" -ForegroundColor Red
    exit 1
}

# Создаём структуру папок
Write-Host "[1/7] Создание структуры папок..." -ForegroundColor Green
$folders = @(
    ".vscode",
    ".github",
    ".beads",
    ".beads/roles",
    ".memory_bank"
)

foreach ($folder in $folders) {
    $path = Join-Path $ProjectRoot $folder
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "  + Создана папка: $folder" -ForegroundColor Gray
    } else {
        Write-Host "  = Папка существует: $folder" -ForegroundColor DarkGray
    }
}

# Копируем VS Code настройки
Write-Host "[2/7] Копирование настроек VS Code..." -ForegroundColor Green
Copy-Item "$ScriptDir\vscode\settings.json" "$ProjectRoot\.vscode\settings.json" -Force
Copy-Item "$ScriptDir\vscode\extensions.json" "$ProjectRoot\.vscode\extensions.json" -Force
Write-Host "  + .vscode/settings.json" -ForegroundColor Gray
Write-Host "  + .vscode/extensions.json" -ForegroundColor Gray

# Копируем инструкции для Copilot
Write-Host "[3/7] Копирование Copilot инструкций..." -ForegroundColor Green
Copy-Item "$ScriptDir\COPILOT_INSTRUCTIONS.md" "$ProjectRoot\.github\copilot-instructions.md" -Force
Write-Host "  + .github/copilot-instructions.md" -ForegroundColor Gray

# Копируем настройки Claude
Write-Host "[4/7] Копирование настроек Claude..." -ForegroundColor Green
Copy-Item "$ScriptDir\CLAUDE_SETTINGS.md" "$ProjectRoot\CLAUDE.md" -Force
Write-Host "  + CLAUDE.md" -ForegroundColor Gray

# Копируем роли агентов
Write-Host "[5/7] Копирование ролей AI-агентов..." -ForegroundColor Green
Copy-Item "$ScriptDir\roles\AGENT_ROLES.md" "$ProjectRoot\.beads\AGENT_ROLES.md" -Force
Copy-Item "$ScriptDir\roles\ART_DIRECTOR.md" "$ProjectRoot\.beads\roles\ART_DIRECTOR.md" -Force
Copy-Item "$ScriptDir\beads\config.yaml" "$ProjectRoot\.beads\config.yaml" -Force
Write-Host "  + .beads/AGENT_ROLES.md" -ForegroundColor Gray
Write-Host "  + .beads/roles/ART_DIRECTOR.md" -ForegroundColor Gray
Write-Host "  + .beads/config.yaml" -ForegroundColor Gray

# Копируем вспомогательные документы
Write-Host "[6/7] Копирование документации..." -ForegroundColor Green
Copy-Item "$ScriptDir\QUICK_START.md" "$ProjectRoot\How to use AGENT_ROLES.md" -Force
Copy-Item "$ScriptDir\MEMORY_BANK_GUIDE.md" "$ProjectRoot\agents.md" -Force
Write-Host "  + How to use AGENT_ROLES.md" -ForegroundColor Gray
Write-Host "  + agents.md" -ForegroundColor Gray

# Создаём базовые файлы Memory Bank (если не существуют)
Write-Host "[7/7] Инициализация Memory Bank..." -ForegroundColor Green
$memoryBankFiles = @{
    "projectbrief.md" = "# Project Brief`n`n> Заполните описание проекта`n"
    "activeContext.md" = "# Active Context`n`n## Текущее состояние`n`n> Обновляйте этот файл при каждом значительном изменении`n"
    "progress.md" = "# Progress`n`n## Завершённые задачи`n`n- [ ] Настройка AI-агентов`n"
}

foreach ($file in $memoryBankFiles.Keys) {
    $path = Join-Path $ProjectRoot ".memory_bank\$file"
    if (-not (Test-Path $path)) {
        Set-Content -Path $path -Value $memoryBankFiles[$file] -Encoding UTF8
        Write-Host "  + .memory_bank/$file (создан)" -ForegroundColor Gray
    } else {
        Write-Host "  = .memory_bank/$file (существует)" -ForegroundColor DarkGray
    }
}

# Завершение
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Установка завершена!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Yellow
Write-Host "1. Откройте проект в VS Code" -ForegroundColor White
Write-Host "2. Установите рекомендуемые расширения (VS Code предложит)" -ForegroundColor White
Write-Host "3. Установите Beads CLI: pip install beads-cli" -ForegroundColor White
Write-Host "4. Инициализируйте Beads: bd init" -ForegroundColor White
Write-Host "5. Прочитайте QUICK_START.md для активации ролей" -ForegroundColor White
Write-Host ""
Write-Host "Документация: README.md в этой папке" -ForegroundColor Cyan
