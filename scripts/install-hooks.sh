#!/bin/bash
# Скрипт установки git hooks для защиты ветки main

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.githooks"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "Установка git hooks для защиты ветки main..."
echo ""

# Проверяем наличие директории .githooks
if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ Ошибка: Директория .githooks не найдена"
  exit 1
fi

# Проверяем наличие директории .git/hooks
if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "❌ Ошибка: Это не git репозиторий или .git/hooks не найдена"
  exit 1
fi

# Копируем или создаем символические ссылки на hooks
for hook in "$HOOKS_DIR"/*; do
  hook_name=$(basename "$hook")
  
  # Пропускаем README и другие не-hook файлы
  if [[ "$hook_name" == "README.md" ]] || [[ "$hook_name" == *.md ]]; then
    continue
  fi
  
  # Используем абсолютный путь для символической ссылки
  hook_abs_path=$(cd "$(dirname "$hook")" && pwd)/$(basename "$hook")
  target="$GIT_HOOKS_DIR/$hook_name"
  
  # Создаем символическую ссылку
  if [ -e "$target" ] || [ -L "$target" ]; then
    echo "⚠️  Файл $hook_name уже существует, пропускаем..."
  else
    ln -s "$hook_abs_path" "$target"
    echo "✅ Установлен hook: $hook_name"
  fi
done

echo ""
echo "✅ Установка завершена!"
echo ""
echo "Установленные hooks:"
echo "  - pre-commit: блокирует коммиты в main"
echo "  - pre-push: блокирует push в main"
echo "  - prepare-commit-msg: предупреждает при работе в main"
echo ""
