# Защита ветки main

Документ описывает настройки защиты ветки `main` от прямых изменений.

## Автоматизация через GitHub Actions

Настроены процессы:

### 1. Процесс CI (`.github/workflows/ci.yml`)
- Запускается для всех запросов на слияние в ветку `main`
- Выполняет сборку проекта (`npm run build`)
- Все проверки должны пройти успешно перед слиянием

### 2. Процесс защиты ветки (`.github/workflows/branch-protection.yml`)
- Отслеживает попытки прямой отправки в ветку `main`
- Выдает предупреждение при обнаружении прямой отправки
- Помогает выявить случаи обхода защиты ветки

## Настройка защиты ветки в GitHub

Для полной защиты ветки `main` необходимо настроить правила в GitHub.

Доступно два способа настройки: **автоматический** (через скрипт) и **ручной** (через веб-интерфейс GitHub).

### Способ 1: Автоматическая настройка (рекомендуется)

Используйте скрипт для применения правил защиты через GitHub API:

1. **Создайте токен доступа GitHub:**
   - Откройте https://github.com/settings/tokens
   - Нажмите `Generate new token (classic)`
   - Выберите права: `repo` (полный доступ к репозиториям)
   - Создайте токен и сохраните его в безопасном месте

2. **Установите токен в переменную окружения:**
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

3. **Запустите скрипт:**
   ```bash
   ./scripts/apply-branch-protection.sh
   ```

   Для другого репозитория можно переопределить параметры:
   ```bash
   REPO_OWNER=myorg REPO_NAME=myrepo ./scripts/apply-branch-protection.sh
   ```

**Требования:**
- Установлена утилита `jq` (для обработки JSON)
  - Ubuntu/Debian: `sudo apt-get install jq`
  - macOS: `brew install jq`
  - Windows (Git Bash): `choco install jq`

Скрипт автоматически применит все правила из файла конфигурации `.github/branch-protection-config.json`.

**Настройки, которые будут применены:**
- ✅ Требуется запрос на слияние перед внесением изменений
- ✅ Требуется одобрение от владельца кода (1 одобрение минимум)
- ✅ Требуется прохождение проверок: `build-and-test`
- ✅ Одобрения сбрасываются при новых фиксациях
- ✅ Требуется разрешение всех комментариев перед слиянием
- ✅ Правила применяются к администраторам
- ✅ Запрещена принудительная отправка (force push)
- ✅ Запрещено удаление ветки

### Способ 2: Ручная настройка через веб-интерфейс

#### Порядок настройки:

1. **Откройте настройки репозитория:**
   - Откройте репозиторий на GitHub
   - Нажмите `Settings` → `Branches`

2. **Добавьте правило защиты ветки:**
   - Нажмите `Add branch protection rule`
   - В поле "Branch name pattern" введите: `main`

3. **Включите параметры:**

   ✅ **Require a pull request before merging**
   - Запрещает прямую отправку в main
   - Все изменения проходят через запрос на слияние
   
   ✅ **Require approvals** (рекомендуется)
   - Укажите минимальное количество одобрений (например, 1)
   - Запрос должен быть одобрен перед слиянием
   
   ✅ **Dismiss stale pull request approvals when new commits are pushed**
   - Одобрение сбрасывается при новых фиксациях
   
   ✅ **Require status checks to pass before merging**
   - Выберите проверки: `build-and-test` (из процесса CI)
   - Код должен пройти все тесты перед слиянием
   
   ✅ **Require conversation resolution before merging**
   - Все комментарии в запросе должны быть разрешены
   
   ✅ **Require linear history** (необязательно)
   - Запрещает слияние с фиксацией слияния, только rebase или squash
   
   ✅ **Include administrators**
   - Правила применяются ко всем, включая администраторов

4. **Сохраните правило:**
   - Нажмите `Create` или `Save changes`

## Процесс работы

После настройки защиты ветки:

1. **Создайте новую ветку:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Внесите изменения и зафиксируйте:**
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

3. **Отправьте ветку на GitHub:**
   ```bash
   git push origin feature/my-feature
   ```

4. **Создайте запрос на слияние:**
   - Откройте репозиторий на GitHub
   - Нажмите `Pull requests` → `New pull request`
   - Выберите вашу ветку
   - Заполните описание и создайте запрос

5. **Дождитесь проверок:**
   - Процесс CI запустится автоматически
   - Сборка должна пройти успешно
   - Получите одобрение проверяющего (если требуется)

6. **Выполните слияние:**
   - После всех проверок нажмите `Merge pull request`
   - Выберите тип слияния (merge commit, squash, или rebase)

## Файл CODEOWNERS

Файл `.github/CODEOWNERS` определяет ответственных за код:
- Автоматически назначает проверяющих для запросов
- Гарантирует, что изменения рассматривают нужные люди

## Проверка настроек

Проверка работы защиты:

1. Попробуйте выполнить прямую отправку в main (только ДО настройки защиты):
   ```bash
   git checkout main
   git commit --allow-empty -m "Test commit"
   git push origin main
   ```

2. При правильной настройке защиты появится ошибка:
   ```
   ! [remote rejected] main -> main (protected branch hook declined)
   ```

3. Если отправка проходит - защита не настроена, вернитесь к разделу настройки

**Примечание:** После настройки защиты этот тест выполнить не получится - именно это и требуется.

## Ссылки

- [GitHub: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub: About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Actions: Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
