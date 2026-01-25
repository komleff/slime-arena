# Review by ChatGPT Codex 5.2

**Дата:** 2026-01-25
**Ревьювер:** ChatGPT Codex 5.2
**Фаза:** Sprint 13, Phase 1 (Database & Infrastructure)
**Коммиты:** aa03142, cf04c4d, 11e17d0, 919299c

## Чеклист

- [x] Сборка проходит
- [x] Тесты проходят (374/374 — nickname-validator: 80, skin-generator: 294)
- [ ] Детерминизм сохранён
- [x] Архитектура соответствует ТЗ
- [x] Найдены проблемы (см. ниже)

## Замечания

### [P0] Критические проблемы

Нет.

### [P1] Важные проблемы

1. **[P1]** `server/src/utils/generators/skinGenerator.ts:30` — путь к `config/skins.json` зависит от `process.cwd()`
   - Проблема: при запуске `npm run dev --workspace=server` рабочая директория = `server/`, файл `config/skins.json` не найден → ошибка чтения и срыв гостевого/первичного профиля.
   - Решение: вычислять путь относительно файла (`__dirname`) или передавать путь через переменную окружения.

2. **[P1]** `server/tests/determinism.test.js:6` — `npm run test` падает из-за неверного пути к `ArenaRoom.js`
   - Проблема: тест ожидает `server/dist/rooms/ArenaRoom.js`, но сборка кладёт файл в `server/dist/server/src/rooms/ArenaRoom.js`.
   - Последствия: детерминизм не проверяется, тестовый контур красный.
   - Решение: поправить путь в тесте или унифицировать `outDir` в `tsconfig`.

### [P2] Желательные улучшения

3. **[P2]** `server/src/utils/generators/nicknameValidator.ts:128` — `validateAndNormalize()` принимает `null/undefined` и превращает в строку
   - Проблема: `normalizeNickname()` делает `String(null)` → `'null'`, `String(undefined)` → `'undefined'`, после чего валидация проходит.
   - Последствия: в БД могут появиться технические никнеймы.
   - Решение: проверять `null/undefined` до нормализации или вызывать `validateNicknameDetailed()` на исходном значении.

4. **[P2]** `server/src/utils/generators/skinGenerator.ts:59` — `Math.random()` в серверном коде
   - Проблема: нарушает правило детерминизма для серверного кода, если функция будет использована вне мета-сервера.
   - Решение: изолировать функцию в мета-слое или заменить на `Rng` с явным seed.

## Позитивные моменты

- Миграции идемпотентны и безопасны для повторного запуска: `IF NOT EXISTS` в таблицах и индексах. (`server/src/db/migrations/007_meta_gameplay_tables.sql:6`, `server/src/db/migrations/008_meta_gameplay_columns.sql:6`)
- Корректные внешние ключи и индексы под запросы лидербордов и idempotency. (`server/src/db/migrations/007_meta_gameplay_tables.sql:13`, `server/src/db/migrations/007_meta_gameplay_tables.sql:35`)
- SQL в AuthService параметризован, новые поля пользователя выбираются и маппятся без строковой конкатенации. (`server/src/meta/services/AuthService.ts:67`, `server/src/meta/services/AuthService.ts:185`)
- Юнит‑тесты новых генераторов прошли полностью (80 + 294). (`server/tests/nickname-validator.test.js:1`, `server/tests/skin-generator.test.js:1`)

## Вердикт

**CHANGES_REQUESTED** — требуется исправить P1 замечания.

## Рекомендации для PM

- Починить тестовый путь в `determinism.test.js`, иначе CI не подтверждает детерминизм.
- После фикса пути к `config/skins.json` перепроверить `POST /api/v1/auth/guest` и `POST /api/v1/profile/complete` в окружении, где `cwd = server/`.
