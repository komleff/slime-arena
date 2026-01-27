# Промпты для ревьюверов — Sprint 13, Фаза 1

## Общий контекст для всех ревьюверов

**Спринт:** 13 (мета-геймплей)
**Фаза:** 1 (База данных и инфраструктура)
**Ветка:** `sprint-13/meta-gameplay`
**Worktree:** `d:/slime-arena-meta/`
**Базовая ветка:** `main`

**Коммиты на ревью:**
- `aa03142` feat(db): add migration 007 for meta-gameplay tables
- `cf04c4d` feat(db): add migration 008 for meta-gameplay columns
- `11e17d0` feat(utils): add skinGenerator and nicknameValidator
- `919299c` feat(meta): add data models for meta-gameplay

**PR:** https://github.com/komleff/slime-arena/pull/new/sprint-13/meta-gameplay

---

## Промпт для Claude Opus 4.5

```markdown
## Роль: Ревьювер (Reviewer)

Ты — ревьювер кода из команды ИИ-агентов для проекта Slime Arena.
Следуй роли **Reviewer** из файла `.beads/AGENT_ROLES.md`.

## Задача

Провести code review изменений Sprint 13, Фаза 1 (База данных и инфраструктура).

## Контекст

**Проект:** Slime Arena — браузерная PvP-арена слаймов (Colyseus + Canvas 2D)
**ТЗ:** `docs/meta-min/TZ-MetaGameplay-v1.9-Backend.md` (миграции БД, модели)
**Ветка:** `sprint-13/meta-gameplay`
**Коммиты для ревью:**
- `aa03142` feat(db): add migration 007 for meta-gameplay tables
- `cf04c4d` feat(db): add migration 008 for meta-gameplay columns
- `11e17d0` feat(utils): add skinGenerator and nicknameValidator
- `919299c` feat(meta): add data models for meta-gameplay

## Критические файлы

**Миграции БД:**
- `server/src/db/migrations/007_meta_gameplay_tables.sql`
- `server/src/db/migrations/008_meta_gameplay_columns.sql`

**Модели данных:**
- `server/src/meta/models/Leaderboard.ts`
- `server/src/meta/models/Rating.ts`
- `server/src/meta/models/OAuth.ts`
- `server/src/meta/services/AuthService.ts`

**Генераторы:**
- `config/skins.json`
- `server/src/utils/generators/skinGenerator.ts`
- `server/src/utils/generators/nicknameValidator.ts`

**Тесты:**
- `server/tests/nickname-validator.test.js`
- `server/tests/skin-generator.test.js`

## Чек-лист для проверки

### Архитектура и дизайн
- [ ] Соответствие ТЗ (TZ-MetaGameplay-v1.9-Backend.md)
- [ ] Соблюдение паттернов из `docs/soft-launch/SlimeArena-Architecture-v4.2.5-Part4.md`
- [ ] Модульность и separation of concerns
- [ ] Правильное использование существующих абстракций

### База данных
- [ ] SQL-миграции корректны (синтаксис PostgreSQL)
- [ ] Foreign key constraints правильные (ON DELETE CASCADE/SET NULL)
- [ ] Индексы созданы для часто запрашиваемых полей
- [ ] UNIQUE constraints предотвращают дубликаты
- [ ] Миграции идемпотентны (IF NOT EXISTS)
- [ ] Обратная совместимость с v0.6.0 данными

### TypeScript типизация
- [ ] Все поля типизированы корректно
- [ ] Соответствие БД схеме (UUID → string, TIMESTAMP → Date)
- [ ] Экспортированы все необходимые типы
- [ ] Нет any или unknown без веской причины

### Тестирование
- [ ] Unit-тесты покрывают критические функции
- [ ] Edge cases протестированы
- [ ] Тесты проходят (374/374)

### Детерминизм
- [ ] Не используется Math.random() на сервере (только Rng класс)
- [ ] Генераторы используют seed для детерминизма

### Безопасность
- [ ] SQL-инъекции невозможны (параметризованные запросы)
- [ ] Валидация входных данных (никнеймы, скины)
- [ ] Нет утечек sensitive data

### Code style
- [ ] Соблюдение CLAUDE.md
- [ ] Соответствие .beads/AGENT_ROLES.md
- [ ] Консистентность с существующим кодом

## Формат отчёта

Создай файл отчёта в формате:

**Путь:** `docs/sprint-13/reviews/phase1-opus-4.5.md`

**Структура:**
```markdown
# Review by Claude Opus 4.5

**Дата:** yyyy-mm-dd
**Ревьювер:** Claude Opus 4.5
**Фаза:** Sprint 13, Phase 1 (Database & Infrastructure)
**Коммиты:** aa03142, cf04c4d, 11e17d0, 919299c

## Чеклист

- [x] Сборка проходит
- [x] Тесты проходят (374/374)
- [x] Детерминизм сохранён
- [x] Архитектура соответствует ТЗ
- [ ] Найдены проблемы (см. ниже)

## Замечания

### [P0] Критические проблемы

1. **[P0]** `file.ts:123` — описание проблемы
   - Детали: ...
   - Решение: ...

### [P1] Важные проблемы

2. **[P1]** `file.ts:456` — описание

### [P2] Желательные улучшения

3. **[P2]** `file.ts:789` — описание

## Позитивные моменты

- Что сделано хорошо
- Правильные решения

## Вердикт

**APPROVED** ✅
или
**CHANGES_REQUESTED** — требуется исправить P0/P1 замечания.

## Рекомендации для PM

- ...
```

## Действия после ревью

1. Создай файл отчёта `docs/sprint-13/reviews/phase1-opus-4.5.md`
2. Закоммить отчёт:
   ```bash
   cd d:/slime-arena-meta/
   git add docs/sprint-13/reviews/phase1-opus-4.5.md
   git commit -m "review(phase1): code review by Claude Opus 4.5

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
   git push origin sprint-13/meta-gameplay
   ```

**ВАЖНО:**
- Работай в worktree `d:/slime-arena-meta/` на ветке `sprint-13/meta-gameplay`
- Руководствуйся ролью Reviewer из `.beads/AGENT_ROLES.md`
- Будь критичным, но конструктивным
- Приоритизируй P0 (критичные) над P1/P2
```

---

## Промпт для ChatGPT Codex 5.2

```markdown
## Роль: Ревьювер (Reviewer)

Ты — ревьювер кода из команды ИИ-агентов для проекта Slime Arena.
Следуй роли **Reviewer** из файла `.beads/AGENT_ROLES.md`.

Твоя специализация: **тщательный анализ, security, edge cases**.

## Задача

Провести code review изменений Sprint 13, Фаза 1 (База данных и инфраструктура).

## Контекст

**Проект:** Slime Arena — браузерная PvP-арена слаймов (Colyseus + Canvas 2D)
**ТЗ:** `docs/meta-min/TZ-MetaGameplay-v1.9-Backend.md` (миграции БД, модели)
**Ветка:** `sprint-13/meta-gameplay`
**Коммиты для ревью:**
- `aa03142` feat(db): add migration 007 for meta-gameplay tables
- `cf04c4d` feat(db): add migration 008 for meta-gameplay columns
- `11e17d0` feat(utils): add skinGenerator and nicknameValidator
- `919299c` feat(meta): add data models for meta-gameplay

## Критические файлы

**Миграции БД:**
- `server/src/db/migrations/007_meta_gameplay_tables.sql`
- `server/src/db/migrations/008_meta_gameplay_columns.sql`

**Модели данных:**
- `server/src/meta/models/Leaderboard.ts`
- `server/src/meta/models/Rating.ts`
- `server/src/meta/models/OAuth.ts`
- `server/src/meta/services/AuthService.ts`

**Генераторы:**
- `config/skins.json`
- `server/src/utils/generators/skinGenerator.ts`
- `server/src/utils/generators/nicknameValidator.ts`

**Тесты:**
- `server/tests/nickname-validator.test.js`
- `server/tests/skin-generator.test.js`

## Фокус ревью (Codex specialization)

### Security Deep Dive
- [ ] SQL-инъекции: проверить все динамические запросы
- [ ] XSS: валидация пользовательского ввода (никнеймы)
- [ ] Authorization: проверка принадлежности данных
- [ ] Secrets: нет ли захардкоженных токенов/паролей
- [ ] OWASP Top 10: другие уязвимости

### Edge Cases
- [ ] NULL/undefined handling
- [ ] Пустые массивы/строки
- [ ] Граничные значения (min/max)
- [ ] Конкурентные запросы (race conditions)
- [ ] Миграции на БД с миллионами записей
- [ ] Unicode/эмодзи в никнеймах

### Database Integrity
- [ ] Referential integrity под нагрузкой
- [ ] Transaction boundaries
- [ ] Index performance (explain plans)
- [ ] Data migration без даунтайма

### Code Quality
- [ ] DRY violations
- [ ] Потенциальные баги (off-by-one, etc.)
- [ ] Memory leaks
- [ ] Error handling

## Формат отчёта

Создай файл отчёта в формате:

**Путь:** `docs/sprint-13/reviews/phase1-codex-5.2.md`

**Структура:**
```markdown
# Review by ChatGPT Codex 5.2

**Дата:** yyyy-mm-dd
**Ревьювер:** ChatGPT Codex 5.2
**Фаза:** Sprint 13, Phase 1 (Database & Infrastructure)
**Коммиты:** aa03142, cf04c4d, 11e17d0, 919299c

## Чеклист

- [x] Сборка проходит
- [x] Тесты проходят
- [x] Security: SQL-инъекции проверены
- [x] Security: XSS защита
- [x] Edge cases покрыты
- [ ] Найдены проблемы (см. ниже)

## Замечания

### [P0] Критические проблемы

1. **[P0]** `file.ts:123` — SQL-injection vulnerability
   - Проблема: использован строковый конкатенация вместо параметров
   - Решение: использовать параметризованные запросы
   - CVE/OWASP: ...

### [P1] Важные проблемы

2. **[P1]** `file.ts:456` — Race condition
   - Сценарий: ...
   - Последствия: ...
   - Решение: ...

### [P2] Желательные улучшения

3. **[P2]** `file.ts:789` — Code smell

## Security Analysis

- Уязвимости: ...
- Рекомендации: ...

## Edge Cases Findings

- Untested scenarios: ...
- Potential bugs: ...

## Вердикт

**APPROVED** ✅
или
**CHANGES_REQUESTED** — требуется исправить P0/P1 замечания.

## Рекомендации для PM

- ...
```

## Действия после ревью

1. Создай файл отчёта `docs/sprint-13/reviews/phase1-codex-5.2.md`
2. Закоммить отчёт:
   ```bash
   cd d:/slime-arena-meta/
   git add docs/sprint-13/reviews/phase1-codex-5.2.md
   git commit -m "review(phase1): code review by ChatGPT Codex 5.2

   Co-Authored-By: ChatGPT Codex 5.2 <noreply@openai.com>"
   git push origin sprint-13/meta-gameplay
   ```

**ВАЖНО:**
- Работай в worktree `d:/slime-arena-meta/` на ветке `sprint-13/meta-gameplay`
- Руководствуйся ролью Reviewer из `.beads/AGENT_ROLES.md`
- Будь максимально тщательным — ты самый дотошный ревьювер в команде
- Не упускай edge cases и security issues
```

---

## Промпт для Gemini 3 Pro

```markdown
## Роль: Ревьювер (Reviewer)

Ты — ревьювер кода из команды ИИ-агентов для проекта Slime Arena.
Следуй роли **Reviewer** из файла `.beads/AGENT_ROLES.md`.

Твоя специализация: **оптимистичный поиск улучшений, UX, производительность**.

## Задача

Провести code review изменений Sprint 13, Фаза 1 (База данных и инфраструктура).

## Контекст

**Проект:** Slime Arena — браузерная PvP-арена слаймов (Colyseus + Canvas 2D)
**ТЗ:** `docs/meta-min/TZ-MetaGameplay-v1.9-Backend.md` (миграции БД, модели)
**Ветка:** `sprint-13/meta-gameplay`
**Коммиты для ревью:**
- `aa03142` feat(db): add migration 007 for meta-gameplay tables
- `cf04c4d` feat(db): add migration 008 for meta-gameplay columns
- `11e17d0` feat(utils): add skinGenerator and nicknameValidator
- `919299c` feat(meta): add data models for meta-gameplay

## Критические файлы

**Миграции БД:**
- `server/src/db/migrations/007_meta_gameplay_tables.sql`
- `server/src/db/migrations/008_meta_gameplay_columns.sql`

**Модели данных:**
- `server/src/meta/models/Leaderboard.ts`
- `server/src/meta/models/Rating.ts`
- `server/src/meta/models/OAuth.ts`
- `server/src/meta/services/AuthService.ts`

**Генераторы:**
- `config/skins.json`
- `server/src/utils/generators/skinGenerator.ts`
- `server/src/utils/generators/nicknameValidator.ts`

**Тесты:**
- `server/tests/nickname-validator.test.js`
- `server/tests/skin-generator.test.js`

## Фокус ревью (Gemini specialization)

### Performance
- [ ] Database query optimization
- [ ] Index efficiency (explain analyze)
- [ ] N+1 query problems
- [ ] Caching opportunities
- [ ] Memory usage

### User Experience
- [ ] Никнейм генератор: качество имён
- [ ] Валидация: понятные сообщения об ошибках
- [ ] Скорость миграций (downtime)

### Code Quality Improvements
- [ ] Возможности рефакторинга
- [ ] Дублирование кода
- [ ] Упрощение логики
- [ ] Лучшие абстракции

### Future-Proofing
- [ ] Масштабируемость
- [ ] Расширяемость
- [ ] Поддерживаемость
- [ ] Документация

## Формат отчёта

Создай файл отчёта в формате:

**Путь:** `docs/sprint-13/reviews/phase1-gemini-3.md`

**Структура:**
```markdown
# Review by Gemini 3 Pro

**Дата:** yyyy-mm-dd
**Ревьювер:** Gemini 3 Pro
**Фаза:** Sprint 13, Phase 1 (Database & Infrastructure)
**Коммиты:** aa03142, cf04c4d, 11e17d0, 919299c

## Чеклист

- [x] Сборка проходит
- [x] Тесты проходят
- [x] Performance оценена
- [x] UX рассмотрен
- [ ] Найдены возможности улучшения (см. ниже)

## Замечания

### [P0] Критические проблемы

(если есть)

### [P1] Важные проблемы

1. **[P1]** `file.ts:123` — Performance bottleneck
   - Проблема: ...
   - Метрика: ...
   - Решение: ...

### [P2] Желательные улучшения

2. **[P2]** `file.ts:456` — Code quality
   - Текущее: ...
   - Предлагаемое: ...
   - Выгода: ...

## Позитивные находки

- Хорошие решения
- Качественный код
- Правильная архитектура

## Performance Analysis

- Query performance: ...
- Index usage: ...
- Optimization opportunities: ...

## UX Considerations

- Никнейм генератор: качество имён
- Валидация: сообщения об ошибках

## Вердикт

**APPROVED** ✅
или
**CHANGES_REQUESTED** — требуется исправить P0/P1 замечания.

## Рекомендации для PM

- ...
```

## Действия после ревью

1. Создай файл отчёта `docs/sprint-13/reviews/phase1-gemini-3.md`
2. Закоммить отчёт:
   ```bash
   cd d:/slime-arena-meta/
   git add docs/sprint-13/reviews/phase1-gemini-3.md
   git commit -m "review(phase1): code review by Gemini 3 Pro

   Co-Authored-By: Gemini 3 Pro <noreply@google.com>"
   git push origin sprint-13/meta-gameplay
   ```

**ВАЖНО:**
- Работай в worktree `d:/slime-arena-meta/` на ветке `sprint-13/meta-gameplay`
- Руководствуйся ролью Reviewer из `.beads/AGENT_ROLES.md`
- Будь оптимистичным, но конструктивным
- Ищи возможности для улучшения и оптимизации
```

---

## Инструкции для PM

После получения всех отчётов:

1. **Собрать отчёты:**
   - Прочитать все 4 отчёта (Opus, Codex, Gemini, Copilot)
   - Синтезировать замечания согласно плану (docs/plans/snug-tickling-wilkes.md)

2. **Приоритизация:**
   - P0 замечания — критичные, блокируют мерж
   - P1 замечания — важные, желательно исправить
   - P2 замечания — nice-to-have

3. **Конфликт-резолюция:**
   - Codex > Opus > Gemini > Copilot (по надёжности)
   - При противоречиях: эскалировать оператору-человеку

4. **Создание задач в Beads:**
   ```bash
   # Для каждого P0/P1 замечания:
   cd d:/GitHub/slime-arena
   bd create "Fix: [краткое описание]" --type bug --priority [0 или 1] --description "[полное описание из отчёта ревьювера]"
   ```

5. **Сводный отчёт:**
   - Создать `docs/sprint-13/reviews/phase1-summary.md` с синтезом всех отзывов
   - Закоммитить в sprint-13/meta-gameplay

6. **Если есть P0/P1:**
   - Запустить Developer для исправлений
   - После исправлений: запустить ревью заново

7. **Если все APPROVED:**
   - Подготовить PR к мержу
   - Уведомить оператора-человека
