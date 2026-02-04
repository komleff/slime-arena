# Sprint 19 PM Orchestration Plan

**Версия:** 1.0
**Дата:** 2026-02-05
**PM:** Claude Opus 4.5
**Ветка:** `sprint-19/admin-dashboard-phase2`
**PR:** #136

---

## Исходное состояние

| Параметр | Значение |
|----------|----------|
| PR#136 | OPEN, +2547/-17 строк, 11 файлов |
| CI/CD | ✅ build-and-test PASS |
| Ревью | Copilot (7 комментариев), Codex (настройка) |
| Версия | Рассинхронизирована (см. ниже) |

### Проблема версий

| Файл | Версия | Статус |
|------|--------|--------|
| `version.json` | 0.7.8 | ❌ Устарел |
| `package.json` (все 4) | 0.8.0 | ⚠️ Не согласовано |
| `admin-dashboard/package.json` | 0.8.0 | ❌ Не в sync-version |
| `docker/monolith-full.Dockerfile` | 0.7.8 | ❌ Вручную |
| `docker/docker-compose.monolith-full.yml` | 0.7.8 | ❌ Вручную |

**Целевая версия:** 0.8.1

---

## План работ PM

### Фаза 1: Версионирование (slime-arena-wld1)

**Задача:** Обновить версию до 0.8.1 и исправить синхронизацию.

**Шаги:**

1. Обновить `version.json`:
   ```json
   {"version": "0.8.1"}
   ```

2. Расширить `scripts/sync-version.js`:
   - Добавить `admin-dashboard/package.json`
   - Добавить `docker/monolith-full.Dockerfile` (строки 4, 59)
   - Добавить `docker/docker-compose.monolith-full.yml` (строки 4, 15)

3. Запустить синхронизацию:
   ```bash
   npm run sync-version
   ```

4. Проверить все файлы:
   ```bash
   grep -rn "0\.8\.1" --include="*.json" --include="*.yml" --include="Dockerfile" .
   ```

**Критерии приёмки:**
- [ ] Версия 0.8.1 во всех 8 файлах
- [ ] sync-version.js обновляет docker файлы
- [ ] MainMenu.tsx показывает v0.8.1

---

### Фаза 2: Запуск ревьюверов

**Стратегия:** 3 специализированных агента параллельно.

| Агент | Фокус | Приоритет проверок |
|-------|-------|-------------------|
| **Security Agent** | Безопасность | XSS, injection, auth bypass, rate limiting, secrets |
| **Code Quality Agent** | Качество кода | Dead code, null-checks, error handling, DRY |
| **Architecture Agent** | Архитектура | Паттерны, Promise handling, state management |

**Файлы для ревью (11 штук):**

| Файл | Фокус ревью |
|------|-------------|
| `server/src/meta/services/systemMetrics.ts` | Security (info disclosure), Architecture |
| `server/src/meta/routes/admin.ts` | Security (auth, rate limit), Code Quality |
| `server/src/index.ts` | Security (internal endpoint protection) |
| `server/src/rooms/ArenaRoom.ts` | Code Quality (tick metrics), Architecture |
| `ops/watchdog/watchdog.py` | Security (secrets), Code Quality (error handling) |
| `admin-dashboard/src/pages/*.tsx` | Code Quality (null-checks), Architecture (signals) |
| `admin-dashboard/src/styles/index.css` | Code Quality (mobile-first) |

**Формат отчёта ревьювера:**

```markdown
<!-- {"reviewer": "security|quality|architecture", "iteration": 1, "type": "review"} -->

## Review by [Agent Name]

### Чеклист
- [x/] Проверка 1
- [x/] Проверка 2

### Замечания
1. **[P0-P3]** `file.ts:line` — описание

### Вердикт
**APPROVED** / **CHANGES_REQUESTED**
```

---

### Фаза 3: Консолидация отчётов в PR#136

**Действия:**

1. Собрать все отчёты ревьюверов
2. Парсить JSON-метаданные
3. Удалить дубликаты (одна проблема от разных агентов)
4. Сгруппировать по приоритетам (P0 → P1 → P2+)
5. Опубликовать сводный отчёт в PR#136:

```bash
gh pr comment 136 --repo komleff/slime-arena --body "$(cat <<'EOF'
<!-- {"type": "pm_synthesis", "iteration": 1} -->

## PM Synthesis Report (Iteration 1)

### Ревьюверы
| Агент | Статус | Замечаний |
|-------|--------|-----------|
| Security | ✅/❌ | N |
| Code Quality | ✅/❌ | N |
| Architecture | ✅/❌ | N |
| Copilot | ✅ | 7 |

### Консенсус
**ДОСТИГНУТ** / **НЕ ДОСТИГНУТ** (X/4 APPROVED)

### Блокирующие проблемы (P0-P1)
1. **[P0]** file:line — проблема (агенты)
2. **[P1]** file:line — проблема (агенты)

### Некритичные (P2+)
- [P2] file:line — проблема

### Следующие шаги
- [ ] Действие 1
- [ ] Действие 2
EOF
)"
```

---

### Фаза 4: Исправление ошибок

**Если консенсус НЕ достигнут:**

1. Создать задачу для Developer:
   ```bash
   bd create --title="Fix: PR#136 review issues (opus, attempt 1)" \
     --type=bug \
     --priority=1 \
     --description="..."
   ```

2. Делегировать исправления:
   - Attempt 1-3: Claude Opus 4.5
   - Attempt 4-5: ChatGPT Codex
   - Attempt 6+: Эскалация к оператору

3. После исправлений — повторный запуск ревьюверов

**Модель эскалации:**

```
Попытка 1-3: Claude Opus 4.5
     ↓ (если не удалось)
Попытка 4-5: ChatGPT Codex
     ↓ (если не удалось)
Попытка 6+: Человек-оператор
```

---

### Фаза 5: Завершение спринта

**После достижения консенсуса (3+ APPROVED):**

1. Обновить Memory Bank:
   - `.memory_bank/activeContext.md` — статус Sprint 19
   - `.memory_bank/progress.md` — завершённые задачи

2. Закрыть задачи в Beads:
   ```bash
   bd close slime-arena-wld1 --reason="Версия 0.8.1 синхронизирована"
   bd close slime-arena-mon1 slime-arena-mon2 slime-arena-mon3 slime-arena-mon4 \
     --reason="PR#136 готов к merge"
   ```

3. Уведомить оператора:
   ```bash
   gh pr comment 136 --body="✅ **Консенсус достигнут.** PR готов к merge.

   Закрыты задачи: slime-arena-wld1, slime-arena-mon1-4"
   ```

4. **Landing the Plane:**
   ```bash
   git push origin sprint-19/admin-dashboard-phase2
   ```

---

## Критические файлы

| Файл | Действие | Фаза |
|------|----------|------|
| `version.json` | ИЗМЕНИТЬ → 0.8.1 | 1 |
| `scripts/sync-version.js` | ИЗМЕНИТЬ (добавить docker) | 1 |
| `admin-dashboard/package.json` | ИЗМЕНИТЬ (sync) | 1 |
| `docker/monolith-full.Dockerfile` | ИЗМЕНИТЬ (sync) | 1 |
| `docker/docker-compose.monolith-full.yml` | ИЗМЕНИТЬ (sync) | 1 |

---

## Верификация

### Тесты версионирования
```bash
# После sync-version
npm run sync-version

# Проверить все файлы
grep -rn "0\.8\.1" version.json package.json client/package.json \
  server/package.json shared/package.json admin-dashboard/package.json \
  docker/monolith-full.Dockerfile docker/docker-compose.monolith-full.yml
```

### Тесты сборки
```bash
npm run build
npm run test
```

---

## Риски

| Риск | Митигация |
|------|-----------|
| Ревьюверы найдут критические P0 | Эскалация по модели Opus → Codex → Человек |
| sync-version.js сломает docker | Тест: grep после запуска |
| PR#136 конфликт с main | Rebase перед merge |

---

## Первые шаги после одобрения

1. **PM:** Взять задачу `slime-arena-wld1` в работу
2. **PM:** Обновить version.json и sync-version.js
3. **PM:** Запустить 3 ревью-агента параллельно
4. **PM:** Собрать отчёты и опубликовать синтез в PR#136
