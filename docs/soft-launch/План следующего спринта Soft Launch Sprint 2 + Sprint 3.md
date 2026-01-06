# План следующего спринта Soft Launch: Sprint 2 + Sprint 3

Краткое резюме: пошаговый план интеграции *MatchServer* (см. глоссарий) → *MetaServer* (см. глоссарий) и проведения *Stage D* (см. глоссарий) тестирования для готовности к Soft Launch.

 

**Версия:** 2.0.0 **Дата:** 7 января 2026 **Базовый документ:** `docs/soft-launch/SlimeArena-SoftLaunch-Plan-v1.0.5.md` **Статус предыдущего спринта:** Sprint 1 (Client Integration) — ЗАВЕРШЕНО



------

## 1. Цели

### 1.1 Бизнес-цели

| ID   | Цель                                                         | Приоритет |
| ---- | ------------------------------------------------------------ | --------- |
| G1   | Результаты матча сохраняются в БД и влияют на профиль игрока | P0        |
| G2   | Валидация *joinToken* (см. глоссарий) при подключении к матчу | P1        |
| G3   | Система проходит нагрузочные тесты (CCU=500)                 | P0        |
| G4   | Полный игровой цикл работает end-to-end                      | P0        |

### 1.2 Технические цели

| ID   | Цель                                                         | Метрика успеха                    |
| ---- | ------------------------------------------------------------ | --------------------------------- |
| T1   | [MUST] Исправить blocker X-1 (MetaServer не стартует)        | MetaServer запускается без ошибок |
| T2   | [MUST] Реализовать *MatchResultService* (см. глоссарий) на MatchServer | HTTP POST в MetaServer            |
| T3   | [MUST] Создать endpoint `/api/v1/match-results/submit`       | Идемпотентная запись в БД         |
| T4   | [SHOULD] Добавить валидацию *joinToken* в ArenaRoom          | Отклонение невалидных токенов     |
| T5   | [MUST] Smoke-тесты полного flow                              | 15+ тестов проходят               |
| T6   | [MUST] Нагрузочные тесты k6                                  | p99 < 2000ms, 5xx < 1%            |

------

## 2. Контекст

### 2.1 Текущее состояние (AS-IS)



```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (✅ READY)                     │
│  AuthService → ConfigService → MatchmakingService           │
│  MainMenu: matchmaking status UI                            │
└────────────────────────────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     META SERVER (⚠️ BLOCKER)                 │
│  Auth, Profile, Wallet, Shop, Matchmaking — готовы          │
│  ❌ X-1: AuthService инициализируется до PostgreSQL         │
│  ❌ /match-results endpoint — НЕ СОЗДАН                     │
└────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     MATCH SERVER (⚠️ NOT INTEGRATED)         │
│  ArenaRoom.endMatch() → telemetry log only                  │
│  ❌ Нет отправки MatchSummary в MetaServer                  │
│  ❌ Нет валидации joinToken                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Целевое состояние (TO-BE)



```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  → полный flow: auth → config → matchmaking → game          │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     META SERVER                              │
│  ✅ Исправлена инициализация (X-1)                          │
│  ✅ POST /api/v1/match-results/submit                       │
│  ✅ Обновление рейтингов, начисление наград                 │
└────────────────────────────────────────────────────────────┘
                    ▲              │ MatchAssignment
                    │              ▼
┌───────────────────┼─────────────────────────────────────────┐
│                   │  MATCH SERVER                            │
│  endMatch() ──────┘                                         │
│  ✅ MatchResultService → HTTP POST                          │
│  ✅ validateJoinToken() при onJoin                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Зависимости компонентов



```
[X-1 Fix] → [MetaServer starts]
    │
    └──► [match-results endpoint] ← [MatchResultService]
                                          │
                                          └──► [ArenaRoom.endMatch()]
                                                    │
                                                    └──► [joinToken validation]
                                                              │
                                                              └──► [Stage D Tests]
```

------

## 3. Блокирующие проблемы (Technical Debt)

### 3.1 X-1: MetaServer не стартует (P0 Critical)

| Аспект       | Описание                                                     |
| ------------ | ------------------------------------------------------------ |
| **Проблема** | `AuthService` создаётся на уровне модуля и вызывает `getPostgresPool()` до `initializePostgres()` |
| **Симптом**  | `Error: PostgreSQL pool not initialized` при старте MetaServer |
| **Файлы**    | `server/src/meta/services/AuthService.ts`, `server/src/meta/server.ts` |
| **Решение**  | Lazy initialization или dependency injection при старте сервера |

### 3.2 X-2: API mismatch в smoke-тестах (P1)

| Аспект       | Описание                                                     |
| ------------ | ------------------------------------------------------------ |
| **Проблема** | Smoke-тесты используют другие имена полей чем реальный API   |
| **Файлы**    | `server/tests/meta-stage-c.test.ts`, `server/src/meta/routes/auth.ts` |
| **Решение**  | Синхронизировать поля в тестах с API                         |

------

## 4. Пошаговый план реализации

### Sprint 2.0: Устранение блокера X-1 (1 день)

| Шаг   | Ожидаемый результат                               | Файлы                                     | Риски                                         |
| ----- | ------------------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| 2.0.1 | [MUST] AuthService использует lazy initialization | `server/src/meta/services/AuthService.ts` | Изменение может затронуть существующие вызовы |
| 2.0.2 | [MUST] Все сервисы инициализируются после DB      | `server/src/meta/server.ts`               | Порядок зависимостей                          |
| 2.0.3 | [MUST] Smoke-тесты Stage A+B проходят             | `tests/smoke/run-smoke-tests.ps1`         | —                                             |

### Sprint 2.1: MatchResultService (1-2 дня)

| Шаг   | Ожидаемый результат                                     | Файлы                                       | Риски                   |
| ----- | ------------------------------------------------------- | ------------------------------------------- | ----------------------- |
| 2.1.1 | [MUST] Создать интерфейс *MatchSummary* (см. глоссарий) | `shared/src/types.ts`                       | Согласование полей с БД |
| 2.1.2 | [MUST] Создать MatchResultService                       | `server/src/services/MatchResultService.ts` | —                       |
| 2.1.3 | [MUST] HTTP клиент для MetaServer                       | `server/src/services/MatchResultService.ts` | Retry логика при сбоях  |
| 2.1.4 | [SHOULD] Outbox pattern для гарантии доставки           | `server/src/services/MatchResultService.ts` | Сложность реализации    |

### Sprint 2.2: match-results endpoint (1 день)

| Шаг   | Ожидаемый результат                      | Файлы                                       | Риски                 |
| ----- | ---------------------------------------- | ------------------------------------------- | --------------------- |
| 2.2.1 | [MUST] POST /api/v1/match-results/submit | `server/src/meta/routes/matchResults.ts`    | —                     |
| 2.2.2 | [MUST] Server Token auth (shared secret) | `server/src/meta/middleware/auth.ts`        | Безопасность секрета  |
| 2.2.3 | [MUST] Идемпотентность по matchId        | SQL UPSERT или проверка                     | Конфликты при повторе |
| 2.2.4 | [SHOULD] Обновление рейтингов Glicko-2   | `server/src/meta/services/RatingService.ts` | Сложность алгоритма   |
| 2.2.5 | [MAY] Начисление наград (coins, XP)      | `server/src/meta/services/WalletService.ts` | Зависит от экономики  |

### Sprint 2.3: Интеграция ArenaRoom (1 день)

| Шаг   | Ожидаемый результат                              | Файлы                     | Риски                              |
| ----- | ------------------------------------------------ | ------------------------- | ---------------------------------- |
| 2.3.1 | [MUST] ArenaRoom.endMatch() → MatchResultService | `server/src/ArenaRoom.ts` | God-object, высокий риск регрессий |
| 2.3.2 | [MUST] Формирование MatchSummary из GameState    | `server/src/ArenaRoom.ts` | Mapping полей                      |
| 2.3.3 | [SHOULD] validateJoinToken() в onJoin            | `server/src/ArenaRoom.ts` | JWT verification                   |
| 2.3.4 | [SHOULD] Mapping sessionId → userId              | `server/src/ArenaRoom.ts` | Хранение в state                   |

### Sprint 3: Stage D Testing (2-3 дня)

| Шаг  | Ожидаемый результат                          | Файлы                               | Риски                       |
| ---- | -------------------------------------------- | ----------------------------------- | --------------------------- |
| 3.1  | [MUST] Исправить X-2 (API mismatch в тестах) | `server/tests/meta-stage-c.test.ts` | —                           |
| 3.2  | [MUST] Smoke-тесты полного flow              | `tests/smoke/full-flow.test.ts`     | Зависимости между сервисами |
| 3.3  | [MUST] Тесты идемпотентности                 | `tests/idempotency/*.ts`            | Сценарии edge cases         |
| 3.4  | [MUST] Нагрузочные тесты k6                  | `tests/load/soft-launch.js`         | Инфраструктура для CCU=500  |
| 3.5  | [SHOULD] Проверка восстановления БД          | Документация                        | Ручная проверка             |

------

## 5. Структуры данных

### 5.1 MatchSummary

| Поле            | Тип            | Обязательно | Описание               |
| --------------- | -------------- | ----------- | ---------------------- |
| `matchId`       | string (UUID)  | да          | Уникальный ID матча    |
| `mode`          | string         | да          | Режим игры ('arena')   |
| `startedAt`     | ISO8601        | да          | Время начала           |
| `endedAt`       | ISO8601        | да          | Время окончания        |
| `configVersion` | string         | да          | Версия RuntimeConfig   |
| `buildVersion`  | string         | да          | Версия билда сервера   |
| `playerResults` | PlayerResult[] | да          | Результаты игроков     |
| `matchStats`    | MatchStats     | нет         | Общая статистика матча |

### 5.2 PlayerResult

| Поле         | Тип           | Обязательно | Описание                             |
| ------------ | ------------- | ----------- | ------------------------------------ |
| `userId`     | string (UUID) | нет         | UUID пользователя (если авторизован) |
| `sessionId`  | string        | да          | Colyseus session ID                  |
| `placement`  | number        | да          | Место (1-10)                         |
| `finalMass`  | number        | да          | Финальная масса                      |
| `killCount`  | number        | да          | Количество убийств                   |
| `deathCount` | number        | да          | Количество смертей                   |
| `level`      | number        | да          | Уровень в матче                      |
| `classId`    | number        | да          | ID класса                            |
| `isDead`     | boolean       | да          | Мёртв в конце матча                  |

------

## 6. Затрагиваемые файлы

### Новые файлы (4-6)

| Путь                                        | Описание                    |
| ------------------------------------------- | --------------------------- |
| `server/src/services/MatchResultService.ts` | Сервис отправки результатов |
| `server/src/meta/routes/matchResults.ts`    | Endpoint результатов        |
| `server/src/meta/services/RatingService.ts` | (опционально) Glicko-2      |
| `tests/smoke/full-flow.test.ts`             | Smoke-тесты                 |
| `tests/load/soft-launch.js`                 | k6 нагрузочные тесты        |

### Модифицируемые файлы (5-7)

| Путь                                      | Изменения                                             |
| ----------------------------------------- | ----------------------------------------------------- |
| `server/src/meta/services/AuthService.ts` | X-1: Lazy initialization                              |
| `server/src/meta/server.ts`               | Регистрация matchResults route, порядок инициализации |
| `server/src/ArenaRoom.ts`                 | endMatch() → MatchResultService, joinToken validation |
| `server/src/meta/middleware/auth.ts`      | Server Token auth                                     |
| `shared/src/types.ts`                     | MatchSummary, PlayerResult interfaces                 |
| `server/tests/meta-stage-c.test.ts`       | X-2: Исправление полей API                            |

------

## 7. Риски и митигация

| Риск                            | Вероятность | Влияние | Митигация                                |
| ------------------------------- | ----------- | ------- | ---------------------------------------- |
| ArenaRoom.ts регрессии          | Высокая     | Высокое | Минимальные изменения, тесты перед/после |
| Потеря MatchSummary при сбоях   | Средняя     | Высокое | Outbox pattern, retry с backoff          |
| Нагрузочные тесты не проходят   | Средняя     | Высокое | Профилирование, оптимизация запросов     |
| JWT verification на MatchServer | Низкая      | Среднее | Shared secret fallback                   |
| X-1 fix ломает существующий код | Средняя     | Высокое | Smoke-тесты после каждого изменения      |

------

## 8. Критерии приёмки

### Sprint 2 (Server Integration)

-  MetaServer запускается без ошибок (X-1 fix)
-  ArenaRoom.endMatch() отправляет MatchSummary
-  POST /match-results/submit сохраняет в БД
-  Повторная отправка того же matchId не дублирует
-  Smoke-тесты Stage A+B+C проходят

### Sprint 3 (Stage D Testing)

-  Smoke-тесты полного flow: 15+ тестов
-  Нагрузка: CCU=500, p99 < 2000ms
-  Ошибки: 5xx < 1% за 5 минут
-  Идемпотентность: повтор операций не дублирует данные
-  Восстановление PostgreSQL из бэкапа проверено

------

## 9. Принятые решения

| #    | Вопрос            | Решение             | Обоснование                                           |
| ---- | ----------------- | ------------------- | ----------------------------------------------------- |
| D1   | Server Token auth | **Shared secret**   | Проще для MVP, секрет в env переменных                |
| D2   | Glicko-2 рейтинг  | **Отложить**        | Сначала запись результатов, рейтинг позже             |
| D3   | Гарантия доставки | **Retry + backoff** | 3 попытки с exponential backoff, outbox при проблемах |

------

## 10. Глоссарий

| Термин             | Описание                                                     |
| ------------------ | ------------------------------------------------------------ |
| ArenaRoom          | Colyseus room для игровой симуляции                          |
| Glicko-2           | Алгоритм рейтинга с учётом неопределённости                  |
| joinToken          | Одноразовый токен для валидации подключения                  |
| MatchResultService | Сервис на MatchServer для отправки результатов               |
| MatchServer        | Colyseus-сервер для игровой симуляции                        |
| MatchSummary       | Структура данных с итогами матча                             |
| MetaServer         | HTTP-сервер для профилей, экономики, matchmaking             |
| Outbox pattern     | Паттерн гарантированной доставки через промежуточную таблицу |
| Server Token       | Секретный токен для server-to-server авторизации             |
| Stage D            | Этап тестирования перед Soft Launch                          |

------

## 11. Оценка и приоритизация

| Этап                                    | Приоритет | Оценка         | Блокирует релиз |
| --------------------------------------- | --------- | -------------- | --------------- |
| Sprint 2.0: X-1 Fix                     | P0        | 0.5-1 день     | Да              |
| Sprint 2.1-2.3: MatchServer Integration | P0        | 2-3 дня        | Да              |
| Sprint 3: Stage D Testing               | P0        | 2-3 дня        | Да              |
| **Итого**                               |           | **4.5-7 дней** |                 |

**Рекомендация:** Начать с Sprint 2.0 (X-1 fix), затем последовательно Sprint 2.1-2.3 и Sprint 3.