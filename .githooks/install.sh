#!/bin/bash
# Скрипт установки Git hooks для защиты ветки main

echo "Установка Git hooks..."

# Получаем путь к репозиторию
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"

if [ -z "$REPO_ROOT" ]; then
    echo "❌ Ошибка: не удалось найти корень Git репозитория"
    exit 1
fi

# Путь к директории с hooks
HOOKS_DIR="$REPO_ROOT/.githooks"
GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

# Проверяем наличие .githooks
if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ Ошибка: директория .githooks не найдена"
    exit 1
fi

# Конфигурируем Git для использования .githooks
echo "Настройка Git для использования .githooks..."
git config core.hooksPath "$HOOKS_DIR"

# Делаем hooks исполняемыми
echo "Настройка прав доступа..."
chmod +x "$HOOKS_DIR"/*

echo "✅ Git hooks установлены успешно!"
echo ""
echo "Теперь попытки прямой отправки в main будут заблокированы локально."
echo ""
