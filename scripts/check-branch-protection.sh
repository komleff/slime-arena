#!/bin/bash
# Скрипт проверки настройки защиты ветки main

echo "======================================"
echo "Проверка защиты ветки main"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Проверка 1: Git hooks
echo "1. Проверка локальных Git hooks..."
HOOKS_PATH=$(git config core.hooksPath)
if [ -z "$HOOKS_PATH" ]; then
    echo "   ❌ Git hooks не настроены"
    echo "      Запустите: npm install"
    ERRORS=$((ERRORS + 1))
elif [ ! -f "$HOOKS_PATH/pre-push" ]; then
    echo "   ❌ Hook файл pre-push не найден"
    ERRORS=$((ERRORS + 1))
elif [ ! -x "$HOOKS_PATH/pre-push" ]; then
    echo "   ⚠️  Hook файл не является исполняемым"
    echo "      Запустите: chmod +x $HOOKS_PATH/pre-push"
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ Git hooks настроены и активны"
fi
echo ""

# Проверка 2: GitHub Actions workflows
echo "2. Проверка GitHub Actions workflows..."
if [ -f ".github/workflows/ci.yml" ]; then
    echo "   ✅ CI workflow найден (.github/workflows/ci.yml)"
else
    echo "   ❌ CI workflow не найден"
    ERRORS=$((ERRORS + 1))
fi

if [ -f ".github/workflows/branch-protection.yml" ]; then
    echo "   ✅ Branch Protection workflow найден"
else
    echo "   ⚠️  Branch Protection workflow не найден"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Проверка 3: CODEOWNERS
echo "3. Проверка CODEOWNERS..."
if [ -f ".github/CODEOWNERS" ]; then
    echo "   ✅ Файл CODEOWNERS найден"
else
    echo "   ⚠️  Файл CODEOWNERS не найден"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Проверка 4: Документация
echo "4. Проверка документации..."
if [ -f ".github/BRANCH_PROTECTION.md" ]; then
    echo "   ✅ Документация по защите ветки найдена"
else
    echo "   ⚠️  Документация не найдена"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f ".githooks/README.md" ]; then
    echo "   ✅ Документация по hooks найдена"
else
    echo "   ⚠️  Документация по hooks не найдена"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Проверка 5: Тест работы hook
echo "5. Тест работы pre-push hook..."
if [ -n "$HOOKS_PATH" ] && [ -f "$HOOKS_PATH/pre-push" ] && [ -x "$HOOKS_PATH/pre-push" ]; then
    # Тестируем блокировку main
    TEST_OUTPUT=$(echo "refs/heads/main 0000000000000000000000000000000000000000 refs/heads/main 0000000000000000000000000000000000000000" | "$HOOKS_PATH/pre-push" origin https://github.com/test/test.git 2>&1)
    if echo "$TEST_OUTPUT" | grep -q "ОШИБКА"; then
        echo "   ✅ Hook корректно блокирует отправку в main"
    else
        echo "   ❌ Hook не блокирует отправку в main"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Тестируем разрешение для feature веток
    TEST_OUTPUT=$(echo "refs/heads/feature/test 0000000000000000000000000000000000000000 refs/heads/feature/test 0000000000000000000000000000000000000000" | "$HOOKS_PATH/pre-push" origin https://github.com/test/test.git 2>&1)
    if ! echo "$TEST_OUTPUT" | grep -q "ОШИБКА"; then
        echo "   ✅ Hook разрешает отправку в feature ветки"
    else
        echo "   ❌ Hook блокирует отправку в feature ветки"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "   ⚠️  Невозможно протестировать hook (не установлен)"
fi
echo ""

# Итоговая сводка
echo "======================================"
echo "Результат проверки"
echo "======================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ Все проверки пройдены успешно!"
    echo ""
    echo "Локальная защита ветки main настроена и работает."
    echo ""
    echo "⚠️  ВАЖНО: Для полной защиты необходимо также настроить"
    echo "    Branch Protection Rules в GitHub:"
    echo ""
    echo "    1. Откройте Settings > Branches на GitHub"
    echo "    2. Добавьте правило для ветки 'main'"
    echo "    3. Включите 'Require pull request before merging'"
    echo "    4. Включите 'Require status checks to pass'"
    echo ""
    echo "    Подробнее: .github/BRANCH_PROTECTION.md"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Найдены предупреждения: $WARNINGS"
    echo ""
    echo "Локальная защита настроена, но есть рекомендации выше."
    exit 0
else
    echo "❌ Найдены ошибки: $ERRORS"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  Найдены предупреждения: $WARNINGS"
    fi
    echo ""
    echo "Локальная защита НЕ настроена корректно."
    echo "Исправьте ошибки выше и запустите проверку снова."
    exit 1
fi
