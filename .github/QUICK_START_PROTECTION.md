# Быстрый старт: Защита ветки main

## Что уже настроено?

✅ **Локальные git hooks** — автоматически блокируют commit и push в main  
✅ **GitHub Actions** — проверяют PR перед слиянием  
✅ **Документация** — полные инструкции по настройке

## Для разработчиков

### При клонировании репозитория

Git hooks устанавливаются автоматически при выполнении:
```bash
npm install
```

### Процесс работы

1. **Создайте feature-ветку:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Внесите изменения:**
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

3. **Запушьте ветку:**
   ```bash
   git push origin feature/my-feature
   ```

4. **Создайте Pull Request на GitHub**

### Что произойдет, если попытаться коммитить в main?

```bash
$ git checkout main
$ git commit -m "test"

❌ ОШИБКА: Запрещены коммиты напрямую в ветку main

Пожалуйста, создайте отдельную ветку для ваших изменений:
  git checkout -b feature/my-feature
```

### Если hooks не работают

Переустановите их вручную:
```bash
npm run install-hooks
```

## Для владельца репозитория

### ⚠️ ВАЖНО: Настройте GitHub Branch Protection Rules

Локальные hooks защищают только локально. Для полной защиты необходимо настроить Branch Protection Rules на GitHub.

**📖 Пошаговая инструкция:** [GITHUB_BRANCH_PROTECTION_SETUP.md](GITHUB_BRANCH_PROTECTION_SETUP.md)

**Минимальная конфигурация:**
1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. ✅ Require a pull request before merging
4. ✅ Require status checks to pass before merging
   - Выберите: `build-and-test`
5. ✅ Do not allow bypassing the above settings
6. Save changes

### Проверка настроек

После настройки Branch Protection Rules проверьте:
```bash
git checkout main
git push origin main
```

Должна появиться ошибка:
```
! [remote rejected] main -> main (protected branch hook declined)
```

## Структура файлов защиты

```
.github/
├── BRANCH_PROTECTION.md              # Обзор всех механизмов защиты
├── GITHUB_BRANCH_PROTECTION_SETUP.md # Подробная инструкция по GitHub
├── QUICK_START_PROTECTION.md         # Этот файл
└── workflows/
    ├── ci.yml                         # CI проверки для PR
    └── branch-protection.yml          # Проверка прямых push

.githooks/
├── README.md                          # Документация hooks
├── pre-commit                         # Блокирует коммиты в main
├── pre-push                           # Блокирует push в main
└── prepare-commit-msg                 # Предупреждает при работе в main

scripts/
├── install-hooks.sh                   # Установка для Linux/macOS
├── install-hooks.bat                  # Установка для Windows CMD
└── install-hooks.ps1                  # Установка для Windows PowerShell
```

## Уровни защиты

| Уровень | Механизм | Где применяется | Можно обойти? |
|---------|----------|-----------------|---------------|
| 1 | Git hooks (pre-commit, pre-push) | Локально | Да (`--no-verify`) |
| 2 | GitHub Actions (branch-protection.yml) | GitHub | Нет |
| 3 | Branch Protection Rules | GitHub | Нет (если включено "Do not allow bypassing") |

**Рекомендация:** Используйте все три уровня для максимальной защиты.

## Дополнительная информация

- [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) — полная документация по защите
- [GITHUB_BRANCH_PROTECTION_SETUP.md](GITHUB_BRANCH_PROTECTION_SETUP.md) — настройка на GitHub
- [.githooks/README.md](../.githooks/README.md) — документация git hooks
