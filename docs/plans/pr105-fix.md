# План 2: Исправление PR #105 (тестирование оркестрации)

**Дата:** 2026-01-26
**Цель:** Применить PM оркестрацию к реальному PR с багами
**Приоритет:** P0
**Зависимости:** План 1 (pm-setup.md) должен быть выполнен
**Статус:** В ожидании утверждения

---

## Контекст

**PR:** https://github.com/komleff/slime-arena/pull/105
**Название:** Sprint 13 Phase 1: Database and Infrastructure
**Ветка:** sprint-13/meta-gameplay
**Worktree:** d:/slime-arena-meta/

**Текущий статус:**
- ✅ Код написан (4 задачи завершены)
- ✅ Тесты проходят (374/374)
- ✅ Ревью проведено (Opus, Gemini)
- ⚠️ Найдены 2 P1 проблемы (Opus review)
- ❌ Консенсус не достигнут

**Найденные проблемы:**

1. **P1:** `server/src/utils/generators/skinGenerator.ts:30`
   - Путь к `config/skins.json` зависит от `process.cwd()`
   - Не работает при запуске из workspace

2. **P1:** `server/tests/determinism.test.js:6`
   - Тест ожидает `dist/rooms/ArenaRoom.js`
   - Реальный путь: `dist/server/src/rooms/ArenaRoom.js`

**Задачи в Beads:**
- `slime-arena-qf9` — fix config/skins.json path
- `slime-arena-iu4` — fix determinism.test.js path

---

## Фаза 1: Ручное исправление (попытка 1)

### Задача 1.1: Исправить проблемы

**Разработчик:** Claude Opus 4.5 (попытка 1/5)

> **Примечание:** В дальнейших спринтах Developer будет вызываться автоматически через pm-orchestrator.py. Здесь делаем вручную для первого теста системы.

**Действия:**

1. **Fix slime-arena-qf9:**

```typescript
// server/src/utils/generators/skinGenerator.ts

// Было:
const configPath = path.join(process.cwd(), 'config/skins.json');

// Должно быть:
const configPath = path.join(__dirname, '../../../config/skins.json');
```

2. **Fix slime-arena-iu4:**

```javascript
// server/tests/determinism.test.js

// Было:
const ArenaRoom = require('../dist/rooms/ArenaRoom.js').ArenaRoom;

// Должно быть:
const ArenaRoom = require('../dist/server/src/rooms/ArenaRoom.js').ArenaRoom;
```

3. **Верификация:**

```bash
cd d:/slime-arena-meta

# Сборка
npm run build

# Тесты
npm test -- determinism
npm test -- skin-generator

# Убедиться что оба проходят
```

4. **Коммит:**

```bash
git add server/src/utils/generators/skinGenerator.ts server/tests/determinism.test.js
git commit -m "fix: address Opus 4.5 review feedback (attempt 1)

- Fix config/skins.json path to use __dirname
- Fix determinism.test.js path to ArenaRoom

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push
```

5. **Добавить комментарий в PR #105:**

```markdown
## Исправления (Attempt 1/5)
**Fixed by:** Claude Opus 4.5

### Что исправлено:

**[P1] server/src/utils/generators/skinGenerator.ts:30:**
- Изменён путь с `process.cwd()` на `__dirname`
- Теперь работает независимо от рабочей директории

**[P1] server/tests/determinism.test.js:6:**
- Исправлен путь к `ArenaRoom.js`
- Учтена структура `dist/server/src/rooms/`

### Верификация:

- ✅ `npm run build` — успешно
- ✅ `npm test -- determinism` — проходит
- ✅ `npm test -- skin-generator` — проходит

**Готово к повторному ревью.**
```

6. **Закрыть задачи в Beads:**

```bash
bd close slime-arena-qf9 --reason="Fixed: changed to __dirname"
bd close slime-arena-iu4 --reason="Fixed: corrected ArenaRoom path"
```

**Критерий приёмки:**
- ✅ Оба фикса применены
- ✅ Тесты проходят
- ✅ Коммит запушен
- ✅ Комментарий добавлен в PR
- ✅ Задачи закрыты в Beads

---

## Фаза 2: Автоматическое повторное ревью

### Задача 2.1: Запустить pm-orchestrator.py

**Команда:**

```bash
cd d:/GitHub/slime-arena
# PR #105 был создан ранее командой: gh pr create ...
python tools/pm-orchestrator.py --pr=105 --cycle --max-iterations=5 --wait-copilot
```

**Что произойдёт:**

1. **Iteration 1 (после фикса):**
   - Оркестратор запускает 3 ревьювера параллельно:
     - Claude Opus 4.5 (Anthropic API)
     - ChatGPT 5.2 Codex (OpenAI API)
     - Gemini 3 Pro (Google AI API)
   - Ожидание GitHub Copilot review (до 10 минут, опционально)

2. **Публикация отчётов:**
   - Каждый ревьювер публикует комментарий в PR #105
   - Метаданные в HTML: `<!-- {"reviewer": "opus", "iteration": 1, ...} -->`

3. **Проверка консенсуса:**
   - Если 3+ APPROVED → SUCCESS
   - Если есть P0/P1 → создать задачу для попытки 2

**Ожидаемый результат:**
- ✅ Все 3 ревьювера дали APPROVED (Opus 4.5, Codex 5.2, Gemini 3 Pro)
- ✅ Консенсус достигнут (3/3 APPROVED)
- ✅ GitHub Copilot review опционально (не влияет на консенсус)
- ✅ PR готов к мержу

**Критерий приёмки:**
- ✅ Оркестратор завершился с SUCCESS
- ✅ В PR есть 3+ APPROVED комментария
- ✅ Метаданные корректны (iteration: 1)

---

## Фаза 3: Если консенсус не достигнут (условная)

**Условие:** Если после iteration 1 остались проблемы P0/P1

### Задача 3.1: Попытка 2 (Opus)

**Автоматически:**
- Оркестратор создаёт задачу в Beads
- Запускает Developer (Opus, попытка 2)
- Ждёт фикса (до 1 часа)
- Запускает iteration 2

**Критерий приёмки:**
- ✅ Задача создана в Beads
- ✅ Developer исправил
- ✅ Iteration 2 проведена

### Задача 3.2: Попытка 3 (Opus) — если нужно

Аналогично попытке 2.

### Задача 3.3: Попытка 4 (Codex) — эскалация

**Условие:** Если Opus не справился за 3 попытки

**Автоматически:**
- Оркестратор переключается на Codex
- Создаёт задачу с пометкой "developer: codex, attempt: 4"
- Запускает Developer (Codex, попытка 4)

**Критерий приёмки:**
- ✅ Эскалация на Codex произошла
- ✅ Задача содержит метаданные о смене разработчика

### Задача 3.4: Попытка 5 (Codex) — если нужно

Аналогично попытке 4.

### Задача 3.5: Эскалация к оператору

**Условие:** Если 5 попыток не помогли

**Автоматически:**
- Оркестратор возвращает ESCALATE_TO_HUMAN
- Создаёт P0 задачу в Beads с тегом `escalation`
- Добавляет комментарий в PR:

```markdown
## ⚠️ Эскалация к оператору

После 5 попыток исправления (3x Opus + 2x Codex) консенсус не достигнут.

**Оставшиеся проблемы:**
- [список P0/P1 проблем]

**История попыток:**
1. Opus (попытка 1) - FAILED
2. Opus (попытка 2) - FAILED
3. Opus (попытка 3) - FAILED
4. Codex (попытка 4) - FAILED
5. Codex (попытка 5) - FAILED

**Требуется вмешательство человека-оператора.**
```

**Критерий приёмки:**
- ✅ P0 задача создана в Beads
- ✅ Комментарий в PR добавлен
- ✅ Оператор уведомлён

---

## Фаза 4: Финализация (после консенсуса)

### Задача 4.1: Обновить progress.md

**Файл:** `.memory_bank/progress.md`

**Добавить:**

```markdown
## Sprint 13 Phase 1 - Code Review Cycle

**Итерации:** 1
**Разработчики:**
- Claude Opus 4.5 (попытка 1) - SUCCESS

**Ревьюверы (оркестратор запустил параллельно):**
- Claude Opus 4.5: APPROVED
- ChatGPT 5.2 Codex: APPROVED
- Gemini 3 Pro: APPROVED
- GitHub Copilot: APPROVED (опционально, не влияет на консенсус)

**Найденные проблемы:** 2 P1
**Исправления:** 2 успешных фикса

**Время:** ~2 часа (от ревью до консенсуса)
```

**Критерий приёмки:**
- ✅ progress.md обновлён
- ✅ Метрики зафиксированы

### Задача 4.2: Документировать процесс

**Файл:** `docs/sprint-13/phase1-fix-cycle.md`

**Что включить:**

1. **Обзор:**
   - Какие проблемы были найдены
   - Сколько итераций потребовалось
   - Какие модели участвовали

2. **Детали итераций:**
   - Iteration 0 (initial review):
     - Opus: CHANGES_REQUESTED (2 P1)
     - Gemini: CHANGES_REQUESTED (1 P0 false positive, 1 P1)
   - Iteration 1 (после фикса):
     - Opus: APPROVED
     - Codex: APPROVED
     - Gemini: APPROVED

3. **Метрики:**
   - Время от фикса до консенсуса
   - Количество попыток разработчика
   - Точность ревьюверов (false positives)

4. **Выводы:**
   - Что работает хорошо
   - Что можно улучшить

**Критерий приёмки:**
- ✅ Документ создан
- ✅ Все метрики зафиксированы
- ✅ Ссылки на PR комментарии

### Задача 4.3: Подготовить к мержу

**Действия PM:**

1. **Обновить описание PR:**

```markdown
## ✅ Ready to Merge

**Phase 1:** Database & Infrastructure (COMPLETED)

**Review cycle:**
- Initial review: 2 P1 issues found
- Iteration 1: All issues fixed
- Final consensus: 3/3 APPROVED

**Reviewers (запущены оркестратором параллельно):**
- ✅ Claude Opus 4.5 (Anthropic API)
- ✅ ChatGPT 5.2 Codex (OpenAI API)
- ✅ Gemini 3 Pro (Google AI API)
- ✅ GitHub Copilot (автоматически, опционально)

**All checks passed:**
- ✅ Build successful
- ✅ All tests passing (374/374)
- ✅ No P0/P1 issues remaining
- ✅ Code review approved

**Ready for manual merge by operator.**
```

2. **Пометить PR:**

```bash
gh pr edit 105 --add-label "ready-to-merge"
```

3. **Уведомить оператора:**

Добавить комментарий:

```markdown
@komleff PR готов к мержу.

Все проблемы исправлены, консенсус достигнут.
```

**Критерий приёмки:**
- ✅ Описание PR обновлено
- ✅ Label добавлен
- ✅ Оператор уведомлён

---

## Критические файлы

**Изменённые:**
1. `server/src/utils/generators/skinGenerator.ts` — фикс пути
2. `server/tests/determinism.test.js` — фикс пути
3. `.memory_bank/progress.md` — метрики

**Новые:**
1. `docs/sprint-13/phase1-fix-cycle.md` — документация процесса

---

## Верификация

### Проверка всех требований

**Код:**
- ✅ Все P1 проблемы исправлены
- ✅ `npm run build` проходит
- ✅ `npm test` проходит (374/374)
- ✅ Тесты детерминизма работают

**Review:**
- ✅ 3+ APPROVED от ревьюверов
- ✅ Консенсус достигнут
- ✅ Нет P0/P1 замечаний

**Процесс:**
- ✅ Fix-комментарий с подписью модели
- ✅ Задачи в Beads закрыты
- ✅ progress.md обновлён
- ✅ Документация создана

**PR:**
- ✅ Описание обновлено
- ✅ Label "ready-to-merge" добавлен
- ✅ Оператор уведомлён

---

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Copilot не отвечает | Высокая | Не блокирует (3/3 APPROVED достаточно) |
| Новые проблемы после фикса | Низкая | Повторные итерации (макс 5) |
| Разработчик не справился | Очень низкая | Эскалация Opus → Codex → Человек |

---

## Итого

**Фазы:** 4 (1 обязательная, 3 условные)
**Задачи:** 10
**Приоритет:** P0
**Время:** 2-4 часа

**Ожидаемый результат:**
- Все P1 проблемы исправлены
- Консенсус достигнут (3+ APPROVED)
- PR #105 готов к мержу
- Процесс оркестрации проверен на реальном примере

**Следующий шаг:** План 3 (Sprint 13 продолжение)
