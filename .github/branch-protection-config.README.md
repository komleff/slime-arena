# Конфигурация защиты ветки

Этот файл описывает параметры конфигурации в `branch-protection-config.json`.

## Структура конфигурации

### required_status_checks

Требует прохождения CI проверок перед слиянием.

```json
"required_status_checks": {
  "strict": true,
  "contexts": ["build-and-test"]
}
```

- **strict**: Требует, чтобы ветка была актуальной (rebased/merged с базовой веткой)
- **contexts**: Список имён CI проверок, которые должны пройти
  - `"build-and-test"` — имя job из `.github/workflows/ci.yml`
  - При настройке для другого репозитория измените на актуальное имя job

### required_pull_request_reviews

Требует код-ревью перед слиянием.

```json
"required_pull_request_reviews": {
  "dismissal_restrictions": {},
  "dismiss_stale_reviews": true,
  "require_code_owner_reviews": true,
  "required_approving_review_count": 1,
  "require_last_push_approval": false
}
```

- **dismiss_stale_reviews**: Сбрасывать одобрения при новых коммитах
- **require_code_owner_reviews**: Требовать одобрение от владельцев кода (из `CODEOWNERS`)
- **required_approving_review_count**: Минимальное количество одобрений (1)

### enforce_admins

```json
"enforce_admins": true
```

Применять правила защиты к администраторам репозитория.

### required_conversation_resolution

```json
"required_conversation_resolution": true
```

Требует разрешения всех комментариев перед слиянием.

### allow_force_pushes / allow_deletions

```json
"allow_force_pushes": false,
"allow_deletions": false
```

Запрещает force push и удаление защищённой ветки.

### required_linear_history

```json
"required_linear_history": false
```

Если `true`, запрещает merge commits (только rebase/squash).

### restrictions

```json
"restrictions": null
```

Ограничения по пользователям/командам, которые могут push в ветку.
`null` = без ограничений (используются другие правила защиты).

### allow_fork_syncing

```json
"allow_fork_syncing": true
```

Разрешает синхронизацию fork'ов с upstream.

## Настройка для другого репозитория

При использовании в другом репозитории:

1. Измените `contexts` в `required_status_checks` на имена ваших CI jobs
2. Проверьте наличие файла `CODEOWNERS`, если используете `require_code_owner_reviews`
3. Настройте `required_approving_review_count` по необходимости
4. Адаптируйте другие параметры под ваши требования

## Ссылки

- [GitHub API: Branch protection](https://docs.github.com/en/rest/branches/branch-protection)
- [GitHub: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
