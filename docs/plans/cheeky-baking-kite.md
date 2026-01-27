# План: PM Orchestration Setup и Cleanup

**Дата:** 27 января 2026
**PM:** Claude Opus 4.5
**Задача:** Зафиксировать роль PM, настроить субагентов, очистить main

---

## Контекст

**Текущее состояние:**
- Sprint 13 Phase 1 ✅ (PR #105 MERGED)
- Sprint 13 Phase 2 ✅ (PR #109 MERGED)
- PR #107 OPEN — модули оркестратора (consensus.py, developer_requester.py, etc.)
- PR #108 OPEN — hybrid workflow (external_reviewers.py)

**Проблемы:**
1. PR #107 и #108 открыты, но не смержены
2. В main есть untracked файлы (включая файл с API ключами!)
3. Роль PM и workflow субагентов не финализированы

---

## Часть 1: Безопасность (P0)

### ⚠️ КРИТИЧНО: Утечка API ключей

**Файл:** `setup-api-keys.ps1`

Содержит реальные API ключи в открытом виде:
- ANTHROPIC_API_KEY
- GOOGLE_API_KEY
- OPENAI_API_KEY

**Действия:**
1. **НЕ коммитить** этот файл
2. Добавить в `.gitignore`: `setup-api-keys.ps1`
3. **Рекомендация пользователю:** ротировать все три ключа у провайдеров

---

## Часть 2: Cleanup main

### 2.1. Untracked файлы

| Файл | Решение | Причина |
|------|---------|---------|
| `setup-api-keys.ps1` | .gitignore | Содержит секреты |
| `fix-github-token.ps1` | Удалить | Одноразовый скрипт |
| `phase-1-gemini.md` | Удалить | Временный файл ревью |
| `phase1-gemini-3.md` | Удалить | Временный файл ревью |
| `phase1-summary.md` | Переместить в docs/sprint-13/ | Полезная документация |
| `tmp_review_comment.md` | Удалить | Временный файл |
| `tools/__pycache__/` | .gitignore | Кэш Python |

### 2.2. Обновить .gitignore

```gitignore
# Secrets
setup-api-keys.ps1
*.secret
.env.local

# Python cache
__pycache__/
*.pyc
.pytest_cache/

# Temp files
tmp_*.md
```

---

## Часть 3: PR #107 и #108

### Анализ

**PR #107** — базовые модули оркестратора:
- `tools/consensus.py` — логика консенсуса (3 APPROVED)
- `tools/developer_requester.py` — создание задач в Beads
- `tools/pr_parser.py` — парсинг комментариев PR
- `tools/review_state.py` — состояние ревью

**PR #108** — hybrid workflow:
- `tools/external_reviewers.py` — вызов Codex/Gemini через API
- Обновлённый `docs/PM-ROLE.md` с hybrid workflow

### Решение: Смержить оба PR

1. PR #107 содержит полезные модули для автоматизации
2. PR #108 дополняет #107 hybrid подходом (Opus нативно, остальные через API)
3. Оба PR не конфликтуют между собой

**Порядок:**
1. Merge PR #107 (базовые модули)
2. Merge PR #108 (hybrid workflow)

---

## Часть 4: PM Workflow — Финальная версия

### 4.1. Роли субагентов

| Роль | Модель | Способ вызова | Отчёт |
|------|--------|---------------|-------|
| **Developer** | Opus 4.5 | Task tool (нативно) | Комментарий в PR |
| **Developer (fallback)** | Codex 5.2 | Человек запускает | Комментарий в PR |
| **Reviewer: Opus** | Opus 4.5 | Task tool (нативно) | Комментарий в PR |
| **Reviewer: Codex** | Codex 5.2 | Человек запускает | Комментарий в PR |
| **Reviewer: Gemini** | Gemini Pro | tools/gemini_reviewer.py | Комментарий в PR |
| **Reviewer: Copilot** | GitHub Copilot | Автоматически | PR Review |

### 4.2. PM автоматически запускает

- ✅ Opus (Developer/Reviewer) — через Task tool
- ✅ Gemini — через `python tools/gemini_reviewer.py --pr=XXX`
- ❌ Codex — **только человек** (требует ручной запуск)

### 4.3. PR как информационный канал

**Формат комментария субагента:**

```markdown
<!-- {"reviewer": "opus", "iteration": 1, "timestamp": "...", "type": "review"} -->

## Review by Claude Opus 4.5 (Iteration 1)

### Позитивные моменты
- ...

### Замечания
1. **[P0]** `file:line` — Критическая проблема
2. **[P1]** `file:line` — Важная проблема

### Вердикт
**APPROVED** ✅ / **CHANGES_REQUESTED** ❌
```

**Метаданные в HTML-комментарии позволяют:**
- Парсить комментарии автоматически
- Фильтровать по reviewer, iteration, type
- Собирать консенсус программно

### 4.4. Workflow цикл

```
┌─────────────────────────────────────────────────────────┐
│ 1. PM создаёт PR и запускает ревью                      │
├─────────────────────────────────────────────────────────┤
│ 2. PM запускает параллельно:                            │
│    - Opus review (Task tool)                            │
│    - Gemini review (gemini_reviewer.py)                 │
│    - Ждёт Copilot (автоматически)                       │
│    - Codex review (человек запускает)                   │
├─────────────────────────────────────────────────────────┤
│ 3. PM собирает результаты из комментариев PR            │
├─────────────────────────────────────────────────────────┤
│ 4. Если консенсус (3+ APPROVED):                        │
│    → Готово к merge (человек мержит)                    │
│                                                         │
│ 5. Если есть P0/P1:                                     │
│    → PM запускает Developer (Opus) для фиксов           │
│    → Повторить с шага 2                                 │
├─────────────────────────────────────────────────────────┤
│ 6. Эскалация:                                           │
│    - Попытки 1-3: Opus                                  │
│    - Попытки 4-5: Codex (человек запускает)             │
│    - Попытка 6+: Человек-оператор                       │
└─────────────────────────────────────────────────────────┘
```

---

## Часть 5: Обновить документацию

### 5.1. Файлы для обновления

| Файл | Изменения |
|------|-----------|
| `.beads/AGENT_ROLES.md` | Добавить секцию "PR как информационный канал" |
| `docs/PM-ROLE.md` | Уточнить что Codex запускает только человек |
| `.gitignore` | Добавить исключения для секретов и кэша |

### 5.2. Ключевое правило

> **PM автоматически запускает всех субагентов, КРОМЕ Codex.**
> Codex запускается только человеком-оператором.

---

## Порядок выполнения

1. **Безопасность:** добавить `setup-api-keys.ps1` в `.gitignore`
2. **Cleanup:** удалить временные файлы, переместить полезные
3. **Merge PR #107:** базовые модули оркестратора
4. **Merge PR #108:** hybrid workflow + external_reviewers.py
5. **Обновить AGENT_ROLES.md:** добавить правила про PR-комментарии
6. **Коммит:** все изменения в main

---

## Верификация

```bash
# После cleanup
git status  # Должен быть чистым

# Проверить инструменты
python tools/gemini_reviewer.py --help
python -c "import tools.consensus"

# Проверить документацию
cat .beads/AGENT_ROLES.md | grep -A20 "PR как информационный"
```

---

## Критерии завершения

- [ ] `setup-api-keys.ps1` в .gitignore (не закоммичен)
- [ ] Временные файлы удалены
- [ ] PR #107 смержен
- [ ] PR #108 смержен
- [ ] AGENT_ROLES.md обновлён с правилами субагентов
- [ ] `git status` чистый
