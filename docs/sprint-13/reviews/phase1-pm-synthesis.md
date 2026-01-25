# PM Synthesis — Sprint 13 Phase 1 Code Review

**Дата:** 2026-01-26
**PM:** Claude Sonnet 4.5
**Ревьюверы:** Claude Opus 4.5, Gemini 3 Pro
**PR:** https://github.com/komleff/slime-arena/pull/105

---

## Итоговое решение

**Статус:** ⚠️ **CHANGES_REQUESTED**

**Обоснование:**
- Найдено **2 критичные проблемы P1** от Opus (оба влияют на функциональность)
- Замечания Gemini P0/P1 признаны **ложными** после верификации кода

---

## Сводка по ревьюверам

| Ревьювер | Статус | P0 | P1 | P2 | Точность |
|----------|--------|----|----|----|----|
| **Claude Opus 4.5** | CHANGES_REQUESTED | 0 | 2 | 2 | ✅ Высокая |
| **Gemini 3 Pro** | CHANGES_REQUESTED | 1 | 1 | 2 | ⚠️ Ложные P0/P1 |

---

## Критические проблемы (P1) — ОБЯЗАТЕЛЬНО ИСПРАВИТЬ

### 1. [P1] Путь к `config/skins.json` зависит от `process.cwd()`

**Источник:** Claude Opus 4.5
**Файл:** `server/src/utils/generators/skinGenerator.ts:30`
**Статус:** ✅ ВАЛИДНАЯ

**Проблема:**
```typescript
const configPath = path.join(process.cwd(), 'config/skins.json');
```

При запуске `npm run dev --workspace=server` рабочая директория = `server/`, а файл лежит в корне монорепозитория → ошибка чтения → срыв гостевого входа.

**Риск:**
- Гостевой вход не работает в dev-окружении
- Первичная регистрация не может назначить скин

**Решение:**
Вычислять путь относительно файла или через переменную окружения:

```typescript
// Вариант 1: относительно корня монорепозитория
const configPath = path.join(__dirname, '../../../config/skins.json');

// Вариант 2: через env (рекомендуется)
const configPath = process.env.SKINS_CONFIG_PATH || path.join(process.cwd(), 'config/skins.json');
```

**Приоритет:** P1 (блокирует dev-тестирование мета-геймплея)

---

### 2. [P1] Тест `determinism.test.js` падает из-за неверного пути

**Источник:** Claude Opus 4.5
**Файл:** `server/tests/determinism.test.js:6`
**Статус:** ✅ ВАЛИДНАЯ

**Проблема:**
Тест ожидает `server/dist/rooms/ArenaRoom.js`, но TypeScript компилятор создаёт `server/dist/server/src/rooms/ArenaRoom.js`.

**Риск:**
- CI/CD не проверяет детерминизм симуляции
- Можно случайно внести `Math.random()` в серверный код

**Решение:**
```javascript
// server/tests/determinism.test.js:6
- const ArenaRoom = require('../dist/rooms/ArenaRoom.js').ArenaRoom;
+ const ArenaRoom = require('../dist/server/src/rooms/ArenaRoom.js').ArenaRoom;
```

**Приоритет:** P1 (критично для проверки детерминизма)

---

## Желательные улучшения (P2)

### 3. [P2] `validateAndNormalize()` принимает `null/undefined`

**Источник:** Claude Opus 4.5
**Файл:** `server/src/utils/generators/nicknameValidator.ts:128`

**Проблема:**
`String(null)` → `'null'`, `String(undefined)` → `'undefined'` → проходит валидацию.

**Решение:**
```typescript
export function validateAndNormalize(nickname: string | null | undefined): boolean {
  if (nickname == null) return false; // защита от null/undefined
  const normalized = normalizeNickname(nickname);
  return validateNickname(normalized);
}
```

---

### 4. [P2] Изоляция `Math.random()` в мета-сервере

**Источник:** Claude Opus 4.5
**Файл:** `server/src/utils/generators/skinGenerator.ts:59`

**Проблема:**
Функция `generateRandomBasicSkin()` использует `Math.random()` на сервере.

**Контекст:**
Функция предназначена только для мета-сервера (недетерминированный код OK), но находится в общей папке `utils/`.

**Решение:**
Переместить в `server/src/meta/utils/` или добавить JSDoc:

```typescript
/**
 * ONLY FOR META-SERVER (non-deterministic)
 * For match-server use generateBasicSkin(seed) instead
 */
export function generateRandomBasicSkin(): Skin { ... }
```

---

## Отклонённые замечания (ложные срабатывания)

### ❌ [Gemini P0] AuthService.ts — отсутствуют изменения логики

**Причина отклонения:**
Изменения **ПРИСУТСТВУЮТ** в `server/src/meta/services/AuthService.ts`:

```typescript
// Строки 38-42 (интерфейс User)
export interface User {
  // ... existing fields
  isAnonymous: boolean;           // ✅ ДОБАВЛЕНО
  registrationSkinId: string | null;  // ✅ ДОБАВЛЕНО
  registrationMatchId: string | null; // ✅ ДОБАВЛЕНО
  nicknameSetAt: Date | null;     // ✅ ДОБАВЛЕНО
}

// Строка 67 (SQL SELECT)
SELECT id, email, nickname, skin_id, rating, created_at, last_login_at,
       is_anonymous, registration_skin_id, registration_match_id, nickname_set_at  // ✅ ДОБАВЛЕНО

// Строка 185 (mapUserRow)
isAnonymous: row.is_anonymous ?? false,  // ✅ ДОБАВЛЕНО
```

**Вердикт:** Gemini не имел доступа к актуальной версии файла или неправильно проанализировал diff.

---

### ❌ [Gemini P1] Отсутствуют индексы для сортировки

**Причина отклонения:**
Индексы **ПРИСУТСТВУЮТ** в `server/src/db/migrations/007_meta_gameplay_tables.sql`:

```sql
-- Строки 13-14
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_mass_score
  ON leaderboard_total_mass (total_mass DESC);

-- Строки 35-36
CREATE INDEX IF NOT EXISTS idx_leaderboard_best_mass_score
  ON leaderboard_best_mass (best_mass DESC);
```

**Вердикт:** Gemini не проанализировал файл миграции полностью.

---

## Позитивные находки

**От Claude Opus 4.5:**
- ✅ Миграции идемпотентны (`IF NOT EXISTS`)
- ✅ SQL параметризован (нет инъекций)
- ✅ 374/374 тестов проходят
- ✅ Корректные foreign key constraints

**От Gemini 3 Pro:**
- ✅ Разделение таблиц `leaderboard_total_mass` и `leaderboard_best_mass` снижает lock contention
- ✅ Предложение добавить `metadata JSONB` в `oauth_links` (P2, но разумное)

---

## План действий

### Шаг 1: Исправить P1 проблемы (Developer)

Создать задачи в Beads:

**beads-xxx:** Исправить путь к `config/skins.json` в `skinGenerator.ts`
- Приоритет: P1
- Оценка: 15 минут
- Assignee: Developer

**beads-yyy:** Исправить путь в `determinism.test.js`
- Приоритет: P1
- Оценка: 5 минут
- Assignee: Developer

### Шаг 2: Опционально исправить P2 (если есть время)

**beads-zzz:** Улучшить валидацию `null/undefined` в `nicknameValidator.ts`
- Приоритет: P2
- Оценка: 10 минут

### Шаг 3: Re-review после фикса

После исправления P1 проблем:
- Запустить `npm test` и убедиться, что determinism.test.js проходит
- Протестировать гостевой вход в dev-окружении
- Обновить PR и запросить повторное ревью

---

## Рекомендации для следующих фаз

1. **Для Phase 2 (API):**
   - Тщательно проверять пути к конфигам (использовать env variables)
   - Добавить интеграционные тесты для эндпоинтов

2. **Для Phase 3 (Client):**
   - Помнить про Mobile-First: никаких CSS-градиентов в анимациях
   - Использовать `Math.random()` только на клиенте (не на сервере)

3. **Для всех фаз:**
   - Не доверять слепо замечаниям AI-ревьюверов — всегда верифицировать через чтение кода
   - Приоритизировать замечания: Claude Opus > Claude Sonnet > Gemini > Copilot

---

## Статистика ревью

| Метрика | Значение |
|---------|----------|
| Файлов изменено | 11 |
| Строк кода добавлено | ~500 |
| Тестов написано | 374 |
| Проблем P1 найдено | 2 |
| Ложных срабатываний | 2 (Gemini) |
| Время ревью | ~15 минут (параллельно) |

---

**Итоговый вердикт:** CHANGES_REQUESTED — исправить 2 проблемы P1, затем APPROVED.
