**Claude’s Plan**

# План следующего спринта Soft Launch — Slime Arena

**Версия:** 1.0.0 **Дата:** 6 января 2026 **Автор:** Claude Opus 4.5 (технический архитектор)

------

## Резюме

Текущее состояние: MetaServer (Stage A+B+C) реализован, UI рефакторинг завершён (v0.3.0). Критический пробел — отсутствие интеграции между компонентами системы.

 

**Цель спринта:** Связать Client ↔ MetaServer ↔ MatchServer в единый игровой цикл Soft Launch.

 

**Ключевые задачи:**

1. Client-side интеграция с MetaServer (авторизация, RuntimeConfig, Matchmaking)
2. MatchServer → MetaServer отправка MatchSummary
3. Stage D: Smoke-тесты и нагрузочное тестирование

**Оценка:** 8-12 рабочих дней

------

## 1. Цели спринта

### 1.1 Бизнес-цели

| ID   | Цель                                                         | Приоритет |
| ---- | ------------------------------------------------------------ | --------- |
| G1   | Игрок может авторизоваться через платформу (Telegram/Standalone) | P0        |
| G2   | Игрок получает RuntimeConfig с сервера, не из хардкода       | P0        |
| G3   | Игрок проходит matchmaking через MetaServer                  | P0        |
| G4   | Результаты матча сохраняются в БД и влияют на профиль        | P0        |
| G5   | Система проходит нагрузочные тесты (CCU=500)                 | P0        |

### 1.2 Технические цели

| ID   | Цель                                         | Метрика успеха                     |
| ---- | -------------------------------------------- | ---------------------------------- |
| T1   | Создать **Service Layer** на клиенте         | 4 новых сервиса                    |
| T2   | Реализовать **Platform Adapters** на клиенте | TelegramAdapter, StandaloneAdapter |
| T3   | Реализовать **MatchSummary** flow            | HTTP POST в MetaServer             |
| T4   | Покрыть критические пути smoke-тестами       | 15+ тестов                         |
| T5   | Пройти нагрузочные тесты                     | p99 < 2000ms, 5xx < 1%             |

------

## 2. Контекст

### 2.1 Текущая архитектура (AS-IS)



```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌────────────┐    ┌─────────────┐    ┌─────────────────┐   │
│  │  MainMenu  │───→│ main.ts     │───→│ Colyseus Client │   │
│  │  (Preact)  │    │ connectTo() │    │ joinOrCreate()  │   │
│  └────────────┘    └─────────────┘    └────────┬────────┘   │
└────────────────────────────────────────────────┼────────────┘
                                                 │ WebSocket
                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     MATCH SERVER                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ArenaRoom.ts                                        │    │
│  │  - endMatch() → telemetry log only                   │    │
│  │  - NO connection to MetaServer                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     META SERVER (isolated)                   │
│  Auth, Profile, Wallet, Shop, Matchmaking, Analytics        │
│  PostgreSQL, Redis — ready but NOT INTEGRATED               │
└─────────────────────────────────────────────────────────────┘
```

**Проблемы AS-IS:**

- Client напрямую подключается к MatchServer без авторизации
- RuntimeConfig захардкожен в `DEFAULT_BALANCE_CONFIG`
- Результаты матча не сохраняются
- Matchmaking отсутствует (любой игрок попадает в любую комнату)

### 2.2 Целевая архитектура (TO-BE)



```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌────────────┐    ┌─────────────┐    ┌─────────────────┐   │
│  │  MainMenu  │───→│ AuthService │───→│ MetaServerAPI   │   │
│  │  (Preact)  │    │ ConfigSvc   │    │ HTTP Client     │   │
│  └────────────┘    │ MatchmakSvc │    └────────┬────────┘   │
│                    └─────────────┘             │ HTTP/REST
└────────────────────────────────────────────────┼────────────┘
                                                 │
                    ┌────────────────────────────┼────────────┐
                    │                            ▼            │
                    │              ┌─────────────────────┐    │
                    │              │    META SERVER      │    │
                    │              │  /auth/verify       │    │
                    │              │  /config/runtime    │    │
                    │              │  /matchmaking/join  │◄───┼──┐
                    │              │  /match-results     │    │  │
                    │              └──────────┬──────────┘    │  │
                    │                         │               │  │
                    │              ┌──────────▼──────────┐    │  │
                    │              │  PostgreSQL/Redis   │    │  │
                    │              └─────────────────────┘    │  │
                    └─────────────────────────────────────────┘  │
                                                                 │
┌─────────────────────────────────────────────────────────────┐ │
│                     MATCH SERVER                             │ │
│  ┌─────────────────────────────────────────────────────┐    │ │
│  │  ArenaRoom.ts                                        │    │ │
│  │  - validateJoinToken()                               │    │ │
│  │  - endMatch() → sendMatchSummary() ────────────────────────┘
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

------

## 3. Компоненты

### 3.1 Обзор компонентов

| #    | Компонент                       | Тип              | Приоритет | Статус |
| ---- | ------------------------------- | ---------------- | --------- | ------ |
| C1   | **MetaServerClient**            | Client Service   | P0        | NEW    |
| C2   | **AuthService** (client)        | Client Service   | P0        | NEW    |
| C3   | **ConfigService** (client)      | Client Service   | P0        | NEW    |
| C4   | **MatchmakingService** (client) | Client Service   | P0        | NEW    |
| C5   | **PlatformManager**             | Client Adapter   | P0        | NEW    |
| C6   | **MatchResultService**          | Server Service   | P0        | NEW    |
| C7   | **MatchSummary Endpoint**       | MetaServer Route | P0        | NEW    |
| C8   | **Auth Signals**                | Client State     | P0        | NEW    |

### 3.2 Зависимости компонентов



```
C5 PlatformManager
 └──► C2 AuthService (client)
       └──► C1 MetaServerClient
             ├──► C3 ConfigService (client)
             └──► C4 MatchmakingService (client)
                   └──► main.ts connectToServer()

C6 MatchResultService (server)
 └──► C7 MatchSummary Endpoint (MetaServer)
```

------

## 4. Детальное описание компонентов

### 4.1 C1: MetaServerClient

**Назначение:** HTTP-клиент для взаимодействия с MetaServer API.

 

**Расположение:** `client/src/api/metaServerClient.ts`

 

**Интерфейс:**

| Метод        | Параметры                  | Возврат    | Описание                  |
| ------------ | -------------------------- | ---------- | ------------------------- |
| `get<T>`     | path: string               | Promise<T> | GET-запрос с auth header  |
| `post<T>`    | path: string, body: object | Promise<T> | POST-запрос с auth header |
| `setToken`   | token: string              | void       | Установить Bearer token   |
| `clearToken` | —                          | void       | Очистить token            |

**Требования:**

- `[MUST]` Автоматически добавлять `Authorization: Bearer {token}` ко всем запросам
- `[MUST]` Обрабатывать 401 ошибки и очищать сессию
- `[MUST]` Поддерживать timeout (default: 10000ms)
- `[SHOULD]` Retry логика для 5xx ошибок (3 попытки, exponential backoff)

------

### 4.2 C2: AuthService (client)

**Назначение:** Управление авторизацией и сессией на клиенте.

 

**Расположение:** `client/src/services/authService.ts`

 

**Flow авторизации:**

1. `[MUST]` PlatformManager определяет платформу (Telegram/Standalone)
2. `[MUST]` PlatformAdapter получает platform credentials (initData для Telegram)
3. `[MUST]` AuthService отправляет credentials на `/api/v1/auth/verify`
4. `[MUST]` MetaServer валидирует и возвращает `{token, user, profile}`
5. `[MUST]` AuthService сохраняет token в localStorage и MetaServerClient
6. `[MUST]` AuthService обновляет auth signals

**Signals (в `gameState.ts`):**

| Signal            | Тип                    | Описание            |
| ----------------- | ---------------------- | ------------------- |
| `authToken`       | Signal<string \| null> | Bearer token        |
| `currentUser`     | Signal<User \| null>   | Данные пользователя |
| `isAuthenticated` | Signal<boolean>        | Статус авторизации  |
| `authError`       | Signal<string \| null> | Ошибка авторизации  |

------

### 4.3 C3: ConfigService (client)

**Назначение:** Загрузка и кэширование RuntimeConfig с MetaServer.

 

**Расположение:** `client/src/services/configService.ts`

 

**Flow загрузки:**

1. `[MUST]` После успешной авторизации вызвать `GET /api/v1/config/runtime`
2. `[MUST]` Применить config через существующий `applyBalanceConfig()`
3. `[SHOULD]` Кэшировать config в localStorage с TTL
4. `[MAY]` Подписаться на обновления config (polling каждые 5 минут)

**Signal:**

| Signal          | Тип                           | Описание             |
| --------------- | ----------------------------- | -------------------- |
| `runtimeConfig` | Signal<RuntimeConfig \| null> | Текущая конфигурация |

------

### 4.4 C4: MatchmakingService (client)

**Назначение:** Взаимодействие с очередью matchmaking.

 

**Расположение:** `client/src/services/matchmakingService.ts`

 

**Flow matchmaking:**

1. `[MUST]` Игрок нажимает "Играть" → `POST /api/v1/matchmaking/join`
2. `[MUST]` Клиент polling `GET /api/v1/matchmaking/status` каждые 2 секунды
3. `[MUST]` При получении **MatchAssignment** → подключиться к MatchServer
4. `[MUST]` При отмене → `POST /api/v1/matchmaking/cancel`

**Структура MatchAssignment:**

| Поле        | Тип           | Описание                           |
| ----------- | ------------- | ---------------------------------- |
| `matchId`   | string (UUID) | ID матча                           |
| `roomId`    | string        | Colyseus room ID                   |
| `roomHost`  | string        | Hostname MatchServer               |
| `roomPort`  | number        | Port MatchServer                   |
| `joinToken` | string        | Token для валидации на MatchServer |

**Signals:**

| Signal              | Тип                                                      | Описание          |
| ------------------- | -------------------------------------------------------- | ----------------- |
| `matchmakingStatus` | Signal<'idle' \| 'searching' \| 'found' \| 'connecting'> | Статус поиска     |
| `queuePosition`     | Signal<number \| null>                                   | Позиция в очереди |
| `matchAssignment`   | Signal<MatchAssignment \| null>                          | Назначение матча  |

------

### 4.5 C5: PlatformManager

**Назначение:** Абстракция платформы (Telegram, Standalone).

 

**Расположение:** `client/src/platform/PlatformManager.ts`

 

**Адаптеры:**

| Адаптер             | Платформа         | Метод получения credentials       |
| ------------------- | ----------------- | --------------------------------- |
| `TelegramAdapter`   | Telegram Mini App | `window.Telegram.WebApp.initData` |
| `StandaloneAdapter` | Web (dev/iframe)  | localStorage или prompt           |

**Интерфейс IAuthAdapter:**

| Метод               | Возврат                      | Описание                   |
| ------------------- | ---------------------------- | -------------------------- |
| `getPlatformType()` | string                       | 'telegram' \| 'standalone' |
| `getCredentials()`  | Promise<PlatformCredentials> | Данные для авторизации     |
| `isAvailable()`     | boolean                      | Доступна ли платформа      |

------

### 4.6 C6: MatchResultService (server)

**Назначение:** Формирование и отправка MatchSummary в MetaServer.

 

**Расположение:** `server/src/services/MatchResultService.ts`

 

**Flow отправки результатов:**

1. `[MUST]` ArenaRoom.endMatch() вызывает `MatchResultService.createSummary(state)`
2. `[MUST]` Service формирует **MatchSummary** из GameState
3. `[MUST]` Service отправляет HTTP POST на MetaServer `/api/v1/match-results/submit`
4. `[MUST]` MetaServer сохраняет в `match_results` таблицу
5. `[SHOULD]` MetaServer обновляет рейтинги игроков (Glicko-2)
6. `[SHOULD]` MetaServer начисляет награды (coins, XP)

**Структура MatchSummary:**

| Поле            | Тип            | Описание             |
| --------------- | -------------- | -------------------- |
| `matchId`       | string (UUID)  | ID матча             |
| `mode`          | string         | Режим игры ('arena') |
| `startedAt`     | ISO8601        | Время начала         |
| `endedAt`       | ISO8601        | Время окончания      |
| `configVersion` | string         | Версия RuntimeConfig |
| `buildVersion`  | string         | Версия билда         |
| `playerResults` | PlayerResult[] | Результаты игроков   |
| `matchStats`    | MatchStats     | Статистика матча     |

**Структура PlayerResult:**

| Поле        | Тип            | Описание                             |
| ----------- | -------------- | ------------------------------------ |
| `odtUserId` | string \| null | UUID пользователя (если авторизован) |
| `sessionId` | string         | Colyseus session ID                  |
| `placement` | number         | Место (1-10)                         |
| `finalMass` | number         | Финальная масса                      |
| `killCount` | number         | Количество убийств                   |
| `level`     | number         | Уровень в матче                      |
| `classId`   | number         | ID класса                            |
| `isDead`    | boolean        | Мёртв в конце матча                  |

------

### 4.7 C7: MatchSummary Endpoint

**Назначение:** Приём и обработка результатов матча от MatchServer.

 

**Расположение:** `server/src/meta/routes/matchResults.ts`

 

**Endpoint:**

| Метод | Path                           | Auth         | Описание                   |
| ----- | ------------------------------ | ------------ | -------------------------- |
| POST  | `/api/v1/match-results/submit` | Server Token | Сохранить результаты матча |

**Требования:**

- `[MUST]` Валидация Server Token (shared secret)
- `[MUST]` Валидация структуры MatchSummary
- `[MUST]` Идемпотентность по matchId
- `[MUST]` Запись в `match_results` таблицу
- `[SHOULD]` Обновление рейтингов игроков
- `[MAY]` Начисление наград

------

## 5. Этапы реализации

### Sprint 1: Client ↔ MetaServer Integration (5-7 дней)

| #    | Задача                               | Файлы                                       | Приоритет |
| ---- | ------------------------------------ | ------------------------------------------- | --------- |
| 1.1  | Создать MetaServerClient             | `client/src/api/metaServerClient.ts`        | P0        |
| 1.2  | Создать PlatformManager + Adapters   | `client/src/platform/*.ts`                  | P0        |
| 1.3  | Создать AuthService (client)         | `client/src/services/authService.ts`        | P0        |
| 1.4  | Добавить auth signals в gameState.ts | `client/src/ui/signals/gameState.ts`        | P0        |
| 1.5  | Создать ConfigService (client)       | `client/src/services/configService.ts`      | P0        |
| 1.6  | Создать MatchmakingService (client)  | `client/src/services/matchmakingService.ts` | P0        |
| 1.7  | Интегрировать в MainMenu.tsx         | `client/src/ui/components/MainMenu.tsx`     | P0        |
| 1.8  | Рефакторинг connectToServer()        | `client/src/main.ts`                        | P0        |

### Sprint 2: MatchServer → MetaServer Integration (2-3 дня)

| #    | Задача                               | Файлы                                       | Приоритет |
| ---- | ------------------------------------ | ------------------------------------------- | --------- |
| 2.1  | Создать MatchResultService           | `server/src/services/MatchResultService.ts` | P0        |
| 2.2  | Создать match-results endpoint       | `server/src/meta/routes/matchResults.ts`    | P0        |
| 2.3  | Интегрировать в ArenaRoom.endMatch() | `server/src/ArenaRoom.ts`                   | P0        |
| 2.4  | Добавить joinToken validation        | `server/src/ArenaRoom.ts`                   | P1        |

### Sprint 3: Stage D Testing (2-3 дня)

| #    | Задача                     | Файлы                    | Приоритет |
| ---- | -------------------------- | ------------------------ | --------- |
| 3.1  | Smoke-тесты полного flow   | `tests/smoke/*.ts`       | P0        |
| 3.2  | Тесты идемпотентности      | `tests/idempotency/*.ts` | P0        |
| 3.3  | Нагрузочные тесты (k6)     | `tests/load/*.js`        | P0        |
| 3.4  | Документация развёртывания | `docs/deployment.md`     | P1        |

------

## 6. Изменяемые файлы

### Новые файлы (12)

| Путь                                        | Описание                   |
| ------------------------------------------- | -------------------------- |
| `client/src/api/metaServerClient.ts`        | HTTP клиент для MetaServer |
| `client/src/services/authService.ts`        | Сервис авторизации         |
| `client/src/services/configService.ts`      | Сервис конфигурации        |
| `client/src/services/matchmakingService.ts` | Сервис matchmaking         |
| `client/src/platform/PlatformManager.ts`    | Менеджер платформ          |
| `client/src/platform/IAuthAdapter.ts`       | Интерфейс адаптера         |
| `client/src/platform/TelegramAdapter.ts`    | Telegram Mini App адаптер  |
| `client/src/platform/StandaloneAdapter.ts`  | Standalone адаптер         |
| `server/src/services/MatchResultService.ts` | Сервис результатов матча   |
| `server/src/meta/routes/matchResults.ts`    | Endpoint результатов       |
| `tests/smoke/full-flow.test.ts`             | Smoke-тесты                |
| `tests/load/soft-launch.js`                 | k6 нагрузочные тесты       |

### Модифицируемые файлы (5)

| Путь                                    | Изменения                                             |
| --------------------------------------- | ----------------------------------------------------- |
| `client/src/main.ts`                    | Рефакторинг connectToServer(), добавление init flow   |
| `client/src/ui/signals/gameState.ts`    | Auth signals, config signal                           |
| `client/src/ui/components/MainMenu.tsx` | Auth UI, matchmaking UI                               |
| `server/src/ArenaRoom.ts`               | endMatch() → MatchResultService, joinToken validation |
| `server/src/meta/server.ts`             | Регистрация matchResults route                        |

------

## 7. Принятые решения

| #    | Вопрос                     | Решение                   | Обоснование                                                  |
| ---- | -------------------------- | ------------------------- | ------------------------------------------------------------ |
| D1   | Валидация joinToken        | **JWT с подписью**        | Stateless проверка, MetaServer подписывает, MatchServer проверяет |
| D2   | Mapping sessionId → userId | **Передавать при join**   | Проще реализовать, userId в payload JWT                      |
| D3   | Начисление наград          | **Синхронно в submit**    | Для MVP достаточно, не требует очереди                       |
| D4   | Платформы Soft Launch      | **Telegram + Standalone** | Telegram для production, Standalone для тестирования         |

------

## 8. Глоссарий

| Термин              | Определение                                                  |
| ------------------- | ------------------------------------------------------------ |
| **MetaServer**      | HTTP-сервер для авторизации, профилей, экономики, matchmaking |
| **MatchServer**     | Colyseus-сервер для игровой симуляции в реальном времени     |
| **RuntimeConfig**   | Конфигурация баланса и фич, загружаемая с MetaServer         |
| **MatchAssignment** | Данные для подключения к конкретному матчу (host, port, token) |
| **MatchSummary**    | Структура результатов завершённого матча                     |
| **joinToken**       | Одноразовый токен для валидации подключения к MatchServer    |
| **PlatformAdapter** | Абстракция для получения credentials конкретной платформы    |
| **Signal**          | Реактивная переменная из @preact/signals                     |

------

## 9. Критерии приёмки спринта

### Функциональные

-  Игрок авторизуется через Telegram или Standalone
-  RuntimeConfig загружается с MetaServer
-  Игрок попадает в матч через matchmaking queue
-  Результаты матча сохраняются в БД
-  Профиль игрока обновляется после матча

### Нефункциональные

-  Smoke-тесты проходят: 15+ тестов
-  Нагрузка: CCU=500, p99 < 2000ms
-  Ошибки: 5xx < 1% за 5 минут
-  Идемпотентность: повтор операций не дублирует данные

User approved the plan