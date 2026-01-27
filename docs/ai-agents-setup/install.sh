#!/bin/bash
# AI Agents Setup Script
# Автоматическая настройка среды разработки с AI-агентами
# Запуск: ./install.sh /path/to/your/project

set -e

PROJECT_ROOT="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  AI Agents Setup Installer v1.0"
echo "========================================"
echo ""
echo "Целевой проект: $PROJECT_ROOT"
echo ""

# Проверяем что мы в правильной папке
if [ ! -f "$SCRIPT_DIR/README.md" ]; then
    echo "ОШИБКА: Запустите скрипт из папки ai-agents-setup"
    exit 1
fi

# Проверяем целевой проект
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "ОШИБКА: Папка проекта не найдена: $PROJECT_ROOT"
    exit 1
fi

# Создаём структуру папок
echo "[1/7] Создание структуры папок..."
mkdir -p "$PROJECT_ROOT/.vscode"
mkdir -p "$PROJECT_ROOT/.github"
mkdir -p "$PROJECT_ROOT/.beads/roles"
mkdir -p "$PROJECT_ROOT/.memory_bank"

# Копируем VS Code настройки
echo "[2/7] Копирование настроек VS Code..."
cp "$SCRIPT_DIR/vscode/settings.json" "$PROJECT_ROOT/.vscode/settings.json"
cp "$SCRIPT_DIR/vscode/extensions.json" "$PROJECT_ROOT/.vscode/extensions.json"

# Копируем инструкции для Copilot
echo "[3/7] Копирование Copilot инструкций..."
cp "$SCRIPT_DIR/COPILOT_INSTRUCTIONS.md" "$PROJECT_ROOT/.github/copilot-instructions.md"

# Копируем настройки Claude
echo "[4/7] Копирование настроек Claude..."
cp "$SCRIPT_DIR/CLAUDE_SETTINGS.md" "$PROJECT_ROOT/CLAUDE.md"

# Копируем роли агентов
echo "[5/7] Копирование ролей AI-агентов..."
cp "$SCRIPT_DIR/roles/AGENT_ROLES.md" "$PROJECT_ROOT/.beads/AGENT_ROLES.md"
cp "$SCRIPT_DIR/roles/ART_DIRECTOR.md" "$PROJECT_ROOT/.beads/roles/ART_DIRECTOR.md"
cp "$SCRIPT_DIR/beads/config.yaml" "$PROJECT_ROOT/.beads/config.yaml"

# Копируем вспомогательные документы
echo "[6/7] Копирование документации..."
cp "$SCRIPT_DIR/QUICK_START.md" "$PROJECT_ROOT/How to use AGENT_ROLES.md"
cp "$SCRIPT_DIR/MEMORY_BANK_GUIDE.md" "$PROJECT_ROOT/agents.md"

# Создаём базовые файлы Memory Bank
echo "[7/7] Инициализация Memory Bank..."
if [ ! -f "$PROJECT_ROOT/.memory_bank/projectbrief.md" ]; then
    echo "# Project Brief

> Заполните описание проекта" > "$PROJECT_ROOT/.memory_bank/projectbrief.md"
fi

if [ ! -f "$PROJECT_ROOT/.memory_bank/activeContext.md" ]; then
    echo "# Active Context

## Текущее состояние

> Обновляйте этот файл при каждом значительном изменении" > "$PROJECT_ROOT/.memory_bank/activeContext.md"
fi

if [ ! -f "$PROJECT_ROOT/.memory_bank/progress.md" ]; then
    echo "# Progress

## Завершённые задачи

- [ ] Настройка AI-агентов" > "$PROJECT_ROOT/.memory_bank/progress.md"
fi

echo ""
echo "========================================"
echo "  Установка завершена!"
echo "========================================"
echo ""
echo "Следующие шаги:"
echo "1. Откройте проект в VS Code"
echo "2. Установите рекомендуемые расширения (VS Code предложит)"
echo "3. Установите Beads CLI: pip install beads-cli"
echo "4. Инициализируйте Beads: bd init"
echo "5. Прочитайте QUICK_START.md для активации ролей"
echo ""
echo "Документация: README.md в этой папке"
