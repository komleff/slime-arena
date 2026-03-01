# План: Server Monitoring Dashboard — Настройка параллельной разработки

**Версия:** 1.0
**Дата:** 2026-02-04
**Автор:** PM Agent
**ТЗ:** TZ-MON v1.6 (5 документов в `docs/monitor/`)

---

## 1. Обзор ТЗ-MON v1.6

### 1.1 Структура документации

| Файл | Содержание | Для кого |
|------|-----------|----------|
| `TZ-MON-v1_6-Index.md` | Карта, план спринтов, интеграция | Супервайзер |
| `TZ-MON-v1_6-Core.md` | API-контракты, статусы, требования | Оба кодера |
| `TZ-MON-v1_6-Backend.md` | БД, безопасность, outbox, буферы | Coder A |
| `TZ-MON-v1_6-Frontend.md` | UI/UX, экраны, responsive | Coder B |
| `TZ-MON-v1_6-Ops.md` | Watchdog, systemd, Nginx, Docker | Coder A |

### 1.2 Распределение работы

| Coder A (Backend + Ops) | Coder B (Frontend) |
|------------------------|-------------------|
| Миграции PostgreSQL | Preact scaffold |
| Auth endpoints (login, refresh, logout) | Login/Settings экраны |
| 2FA endpoints (TOTP) | Dashboard/Rooms/Audit экраны |
| Middleware (requireAdmin, require2FA) | TabBar, StatusCard компоненты |
| Audit service | Polling (5 сек) |
| System metrics (/proc/, cgroup) | Restart dialog + 2FA input |
| Log buffer + маскирование | Mobile layout (320px) |
| Watchdog script (outbox + health) | |
| systemd unit | |
| Nginx config | |

### 1.3 Спринты

1. **Спринт 1** (3 дня) — Auth + Scaffold (параллельно)
2. **Спринт 2** (3 дня) — Monitoring endpoints + UI (параллельно)
3. **Спринт 3** (2-3 дня) — Restart + Ops (последовательно)
4. **Спринт 4** (1-2 дня) — Review + Deploy

---

## 2. Git Worktree для параллельной разработки

### 2.1 Порядок действий (ВАЖНО!)

**Сначала ТЗ в main, потом worktree!** Иначе кодеры не увидят документацию.

```bash
# 1. Закоммитить ТЗ в main
cd D:\GitHub\slime-arena
git add docs/monitor/
git commit -m "docs: add TZ-MON v1.6 monitoring dashboard specification"
git push origin main

# 2. Только после push — создать worktree
git worktree add D:\GitHub\slime-arena-mon-backend -b sprint-mon/backend-ops
git worktree add D:\GitHub\slime-arena-mon-frontend -b sprint-mon/frontend
```

### 2.2 Структура после создания

```
D:\GitHub\
├── slime-arena\                    # Основной репозиторий (PM)
├── slime-arena-mon-backend\        # Coder A: Backend + Ops
│   └── ветка: sprint-mon/backend-ops
└── slime-arena-mon-frontend\       # Coder B: Frontend
    └── ветка: sprint-mon/frontend
```

### 2.3 Изоляция работы

| Coder A работает в | Coder B работает в |
|-------------------|-------------------|
| `server/src/meta/routes/admin.ts` | `admin-dashboard/` (новая папка) |
| `server/src/meta/middleware/adminAuth.ts` | `admin-dashboard/src/pages/` |
| `server/src/meta/services/` | `admin-dashboard/src/components/` |
| `server/prisma/schema.prisma` | `admin-dashboard/src/api/` |
| `server/src/rooms/ArenaRoom.ts` (tick buffer) | `admin-dashboard/src/auth/` |
| `ops/watchdog/` (новая папка) | |
| `docker-compose.yml` | |
| `nginx/admin.conf` | |

**Конфликтных файлов нет** — Backend и Frontend изолированы.

---

## 3. Настройки автономной работы Claude Code

### 3.1 Текущие настройки

Есть два файла:
- `.claude/settings.json` — базовые настройки (в git)
- `.claude/settings.local.json` — локальные настройки (приоритет выше, не в git)

**Редактировать нужно `settings.local.json`.** Добавить:

```jsonc
// В секцию "allow" добавить:
"Bash(git worktree *)",
"Bash(cp *)",
"Bash(mv *)",
"Bash(curl *)",
"Bash(type *)"

// В секцию "deny" добавить:
"Bash(git push origin main)",
"Bash(gh repo delete *)",
"Bash(gh api -X DELETE *)"
```

### 3.2 Полный итоговый settings.local.json

**Заменить весь файл `.claude/settings.local.json` на:**

```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "auto:5"
  },
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(pnpm:*)",
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(npm run *)",
      "Bash(npm test*)",
      "Bash(npm install*)",
      "Bash(git status*)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git push *)",
      "Bash(git pull *)",
      "Bash(git checkout *)",
      "Bash(git branch *)",
      "Bash(git log *)",
      "Bash(git diff *)",
      "Bash(git fetch *)",
      "Bash(git stash *)",
      "Bash(git rebase *)",
      "Bash(git cherry-pick *)",
      "Bash(git tag *)",
      "Bash(git remote *)",
      "Bash(git show *)",
      "Bash(git worktree *)",
      "Bash(gh pr *)",
      "Bash(gh release *)",
      "Bash(gh issue *)",
      "Bash(gh api *)",
      "Bash(bd *)",
      "Bash(ls *)",
      "Bash(dir *)",
      "Bash(mkdir *)",
      "Bash(cat *)",
      "Bash(echo *)",
      "Bash(pwd)",
      "Bash(cd *)",
      "Bash(which *)",
      "Bash(node *)",
      "Bash(npx *)",
      "Bash(docker *)",
      "Bash(docker-compose *)",
      "Bash(docker exec *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Bash(curl *)",
      "Bash(type *)",
      "Bash(netstat *)",
      "Bash(taskkill *)",
      "Bash(wmic *)",
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "TodoWrite",
      "Task",
      "NotebookEdit"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/credentials*)",
      "Bash(rm -rf:*)",
      "Bash(rm *)",
      "Bash(del *)",
      "Bash(rmdir *)",
      "Bash(Remove-Item *)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git push origin main)",
      "Bash(gh pr merge *)",
      "Bash(gh repo delete *)",
      "Bash(gh api -X DELETE *)"
    ]
  },
  "enableAllProjectMcpServers": true,
  "language": "russian",
  "alwaysThinkingEnabled": true,
  "autoUpdatesChannel": "latest",
  "plansDirectory": "./docs/plans",
  "notebooksDirectory": "./docs/notebooks"
}
```

**Что изменено:**
- ✅ Удалён мусор (for id, do, done, Get-ChildItem, etc.)
- ✅ Добавлены: `cd`, `git worktree`, `cp`, `mv`, `curl`, `type`, `dir`, `docker-compose`, `docker exec`
- ✅ В deny: `git push origin main`, `gh repo delete`, `gh api -X DELETE`

### 3.3 Что запрещено (deny)

| Команда | Причина |
|---------|---------|
| `git push origin main` | Прямой пуш в main запрещён (AGENT_ROLES) |
| `git push --force` | Опасная перезапись истории |
| `rm`, `del`, `rmdir` | Удаление файлов |
| `gh pr merge` | Merge только человек-оператор |
| `gh repo delete` | Удаление репозитория |
| `gh api -X DELETE` | Удаление ресурсов в GitHub |
| `.env*`, `credentials*` | Чтение секретов |

### 3.4 Что разрешено (allow)

- ✅ npm/pnpm (все команды)
- ✅ git (кроме push main/force)
- ✅ git worktree (для параллельной работы)
- ✅ npx (включая prisma migrate)
- ✅ docker (все команды)
- ✅ gh pr/issue/release (кроме merge)
- ✅ curl (тестирование API)
- ✅ Все инструменты Claude (Read, Edit, Write, Task, etc.)

### 3.5 Beads (bd) — только PM

Кодеры **не управляют** статусами задач (часто преждевременно отмечают выполненными до ревью). PM координирует:

- `bd update <id> --status=in_progress` — PM назначает задачу кодеру
- `bd update <id> --status=ready_for_review` — PM после завершения кодером
- `bd close <id>` — PM после успешного ревью

### 3.6 Три файла settings.local.json

`.claude/settings.local.json` **не в git** — не скопируется автоматически в worktree!

**PM создаёт 3 файла после `git worktree add`:**

| Путь | bd разрешён |
|------|-------------|
| `D:\GitHub\slime-arena\.claude\settings.local.json` | ✅ Да (PM) |
| `D:\GitHub\slime-arena-mon-backend\.claude\settings.local.json` | ❌ Нет (Coder A) |
| `D:\GitHub\slime-arena-mon-frontend\.claude\settings.local.json` | ❌ Нет (Coder B) |

**Для кодеров** — скопировать JSON из раздела 3.2, **убрав строку:**
```json
"Bash(bd *)",
```

---

## 4. Workflow обмена отчётами через PR

### 4.1 Почему комментарии, а не review

Все агенты работают под одним GitHub-аккаунтом оператора. GitHub не позволяет автору PR делать review/approve своему PR. Поэтому:

- ✅ `gh pr comment` — комментарии работают
- ❌ `gh pr review --approve` — невозможно для автора PR

### 4.2 Кто что пишет

| Роль | Действие | Формат |
|------|----------|--------|
| **Кодер** | После каждой итерации правок | Developer Report в PR комментарии |
| **Ревьювер** | После проверки кода | Review Report в PR комментарии |
| **PM** | Собирает отчёты ревьюверов | Консолидированный отчёт в PR |

### 4.3 Формат отчёта кодера (Developer Report)

```markdown
<!-- {"reviewer": "opus", "iteration": N, "type": "developer_report"} -->

## Developer Report (Iteration N)

### Выполненные исправления

| Замечание | Файл | Исправление |
|-----------|------|-------------|
| P0: Описание | `file.ts:123` | Что сделано |

### Тесты

npm test — PASS / FAIL

### Статус

Все замечания учтены. Готов к повторному ревью.
```

### 4.4 Формат консолидированного отчёта PM

```markdown
### Сводка review iteration #N

**Ревьюверы:** Opus ✅, Codex ✅, Gemini ❌

**Консенсус:** Достигнут / Не достигнут (требуется 3+ APPROVED)

**Блокирующие проблемы (P0-P1):**
1. [P0] file.ts:123 — описание (Opus, Codex)

**Действие:** Создана задача для исправления / Готов к merge
```

### 4.5 Команды публикации

```bash
# Кодер публикует отчёт
gh pr comment <PR> --body "..."

# PM публикует консолидированный отчёт
gh pr comment <PR> --body "..."

# Просмотр комментариев
gh api repos/komleff/slime-arena/pulls/<PR>/comments
```

PR — единственный канал обмена информацией между итерациями.

---

## 5. Следующие шаги

### 5.1 Для оператора (сейчас)

1. ✅ Создать worktree (команды в разделе 2.1)
2. ✅ Создать `.claude/settings.json` с разрешениями
3. ✅ Запустить Coder A в `D:\GitHub\slime-arena-mon-backend`
4. ✅ Запустить Coder B в `D:\GitHub\slime-arena-mon-frontend`

### 5.2 Для Coder A (первая задача)

```
Читай: TZ-MON-v1_6-Core.md + TZ-MON-v1_6-Backend.md + TZ-MON-v1_6-Ops.md

Спринт 1:
1. Создать миграции Prisma (admin_users, admin_sessions, audit_log)
2. Реализовать POST /api/v1/admin/login
3. Реализовать POST /api/v1/admin/refresh
4. Реализовать POST /api/v1/admin/logout
5. Реализовать POST /api/v1/admin/totp/setup
6. Реализовать POST /api/v1/admin/totp/verify
7. Создать middleware requireAdmin, require2FA
8. Создать auditService
```

### 5.3 Для Coder B (первая задача)

```
Читай: TZ-MON-v1_6-Core.md + TZ-MON-v1_6-Frontend.md

Спринт 1:
1. Создать admin-dashboard/ с Vite + Preact scaffold
2. Реализовать LoginPage (username, password, обработка 401/429)
3. Реализовать SettingsPage (2FA setup: QR-код, verify)
4. Создать TabBar (4 вкладки)
5. Настроить auth signals (access token в памяти)
6. Настроить api/ с интерцептором для 401 → refresh
7. Mobile layout foundation (320px, 1 колонка)
```

---

## 6. Интеграционные точки

| После спринта | Проверка |
|---------------|----------|
| Спринт 1 | Login → токен → refresh → 2FA setup → verify |
| Спринт 2 | Dashboard показывает реальные метрики |
| Спринт 3 | Restart: UI → outbox → watchdog → recovery |

---

## 7. Критерии приёмки (сводка)

Полный список в ТЗ. Ключевые:

- **ACC-MON-001–008**: Auth flow
- **ACC-MON-009–010**: Dashboard метрики и статусы
- **ACC-MON-011–012a**: Restart с TOTP
- **ACC-MON-013**: Recovery после restart
- **ACC-MON-015**: Mobile layout 320px
- **ACC-MON-016**: Watchdog auto-restart
- **ACC-MON-017**: Маскирование логов

