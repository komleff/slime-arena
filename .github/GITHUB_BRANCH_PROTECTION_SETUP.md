# Настройка Branch Protection Rules на GitHub

Этот документ содержит пошаговую инструкцию по настройке защиты ветки `main` на уровне GitHub.

## Зачем это нужно?

Локальные git hooks защищают от случайных коммитов в main на вашей машине, но они:
- Могут быть обойдены с флагом `--no-verify`
- Не применяются автоматически к новым участникам без установки

Branch Protection Rules на GitHub — это **серверная защита**, которая:
- Применяется ко всем без исключения
- Не может быть обойдена локально
- Требует прохождения CI/CD проверок перед слиянием

## Инструкция по настройке

### Шаг 1: Откройте настройки репозитория

1. Перейдите в репозиторий на GitHub: https://github.com/komleff/slime-arena
2. Нажмите **Settings** (настройки) в верхнем меню
3. В левом меню выберите **Branches** (ветки)

### Шаг 2: Добавьте правило защиты

1. Нажмите кнопку **Add branch protection rule** (добавить правило защиты ветки)
2. В поле **Branch name pattern** введите: `main`

### Шаг 3: Настройте параметры защиты

Включите следующие опции:

#### ✅ Require a pull request before merging
**Обязательно!** Это основная защита от прямых push в main.
- ✅ Require approvals: **1** (минимум одно одобрение)
- ✅ Dismiss stale pull request approvals when new commits are pushed
  (сброс одобрений при новых коммитах)
- ✅ Require review from Code Owners (если используется CODEOWNERS)

#### ✅ Require status checks to pass before merging
**Обязательно!** Требует успешного прохождения CI перед слиянием.

После включения опции появится поле для выбора проверок:
- Введите "build" в поле поиска
- Выберите: **build-and-test** (из CI workflow)
- ✅ Require branches to be up to date before merging

#### ✅ Require conversation resolution before merging
Все комментарии в PR должны быть разрешены перед слиянием.

#### ✅ Require signed commits (опционально)
Требует, чтобы коммиты были подписаны GPG ключом.

#### ✅ Require linear history (опционально)
Запрещает merge commits, разрешает только rebase или squash.

#### ⚠️ Do not allow bypassing the above settings
**Важно!** Применяет правила даже к администраторам репозитория.

### Шаг 4: Сохраните правило

1. Прокрутите вниз до конца страницы
2. Нажмите **Create** или **Save changes**

## Проверка работы

После настройки попробуйте выполнить прямой push в main:

```bash
git checkout main
git commit --allow-empty -m "Test commit"
git push origin main
```

Вы должны получить ошибку:
```
! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs to 'github.com:komleff/slime-arena.git'
```

Это означает, что защита работает корректно! ✅

## Настройки для разных типов проектов

### Для production проектов (строгая защита)
- ✅ Require approvals: **2**
- ✅ Require status checks to pass before merging
- ✅ Require conversation resolution before merging
- ✅ Require signed commits
- ✅ Require linear history
- ✅ Do not allow bypassing the above settings

### Для development проектов (умеренная защита)
- ✅ Require approvals: **1**
- ✅ Require status checks to pass before merging
- ✅ Require conversation resolution before merging
- ⬜ Require signed commits
- ⬜ Require linear history
- ✅ Do not allow bypassing the above settings

### Для personal/experimental проектов (легкая защита)
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
- ⬜ Require approvals
- ⬜ Do not allow bypassing the above settings (чтобы владелец мог обойти при необходимости)

## Дополнительные настройки

### Защита других веток

Вы можете создать дополнительные правила для других веток:
- `develop` — для development ветки
- `release/*` — для всех release веток
- `hotfix/*` — для hotfix веток

### Автоматическое удаление веток

В настройках репозитория (Settings → General → Pull Requests):
- ✅ Automatically delete head branches — автоматически удаляет feature-ветки после слияния PR

## Проблемы и решения

### "Required status check is not enabled"
**Проблема:** Проверка CI не отображается в списке доступных.
**Решение:** 
1. Убедитесь, что CI workflow был запущен хотя бы один раз
2. Создайте тестовый PR и дождитесь выполнения CI
3. После этого проверка появится в списке

### "Administrator can bypass"
**Проблема:** Администраторы могут обходить защиту.
**Решение:** Включите опцию "Do not allow bypassing the above settings"

### "Проверки не проходят"
**Проблема:** Все PR блокируются из-за падающих тестов.
**Решение:** 
1. Исправьте тесты в отдельной ветке
2. Временно отключите требование status checks
3. Слейте исправление
4. Верните требование status checks

## Ссылки

- [GitHub Docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Docs: Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
