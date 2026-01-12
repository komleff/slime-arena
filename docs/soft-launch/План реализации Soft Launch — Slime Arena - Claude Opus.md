## План реализации Soft Launch — Slime Arena

### Резюме

Текущее состояние: рабочий прототип с `MatchServer` (Colyseus), Canvas-клиентом и god-объектами (`ArenaRoom.ts` ~4000 строк, `main.ts` ~5000 строк). Отсутствуют: `MetaServer`, PostgreSQL/Redis, платформенные адаптеры, система конфигураций `RuntimeConfig`, экономика, авторизация.

Для Soft Launch необходимо: создать `MetaServer` с HTTP API, реализовать платформенную абстракцию, добавить базы данных, перевести UI на Preact, обеспечить идемпотентность операций экономики.

------

### Часть 1: Этап A — Подготовка окружений (P0)

**Цель:** получить `stage` и `prod` с минимальной наблюдаемостью.

| Шаг  | Ожидаемый результат                                          | Затрагиваемые файлы/модули                                   | Риски/неопределённости                                       |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| A.1  | PostgreSQL запущен локально и в `stage`; выполняются миграции | `server/src/db/` (новый), [docker-compose.yml](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html), `scripts/migrate.ts` (новый) | Выбор ORM: Prisma (из techContext) или сырые запросы. Нужно решение по типизации. |
| A.2  | Redis запущен для очереди матчмейкинга и кеша                | [docker-compose.yml](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html), `server/src/cache/` (новый) | Необходим клиент: `ioredis` или `redis`.                     |
| A.3  | Созданы таблицы БД согласно Приложению B                     | SlimeArena-Architecture-v4.2.5-Part4.md, миграции SQL/Prisma | 18 таблиц — значительный объём работы.                       |
| A.4  | Настроено резервное копирование PostgreSQL в `stage`         | `scripts/backup-db.sh` (новый), документация операций        | Требует доступа к инфраструктуре.                            |
| A.5  | Базовый сбор логов и ошибок (Winston + Sentry)               | [telemetry](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) (существует), `client/src/telemetry/` (новый) | Интеграция Sentry требует ключей окружения.                  |
| A.6  | `MetaServer` запускается как отдельный процесс               | `server/src/meta/` (новый), `server/src/metaIndex.ts` (новый), [package.json](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) скрипты | Архитектурное решение: отдельный процесс или монолит с разными точками входа. |

**Критерий приёмки:** smoke-проверки маршрутов `/api/v1/auth/verify`, `/api/v1/config/runtime` проходят.

------

### Часть 2: Этап B — Функциональный минимум (P0)

**Цель:** базовый игровой цикл с авторизацией и записью результатов.

#### B.1 Авторизация и профиль

| Шаг   | Ожидаемый результат                                  | Затрагиваемые файлы/модули                                   | Риски/неопределённости                                       |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| B.1.1 | Платформенная абстракция на клиенте                  | `client/src/platform/` (новый): `PlatformManager.ts`, `TelegramAdapter.ts`, `StandaloneAdapter.ts` | Telegram Mini Apps SDK — внешняя зависимость, нужно тестирование в реальном окружении. |
| B.1.2 | `IAuthProvider` реализован для Telegram и Standalone | `client/src/platform/providers/` (новый)                     | Верификация `initData` на сервере требует криптографии.      |
| B.1.3 | `AuthService` на `MetaServer`                        | `server/src/meta/services/AuthService.ts` (новый)            | JWT или опак-токены — нужно архитектурное решение.           |
| B.1.4 | Маршруты `/auth/verify`, `/profile`                  | `server/src/meta/routes/auth.ts`, `server/src/meta/routes/profile.ts` (новые) | —                                                            |
| B.1.5 | `PlayerService` — CRUD профиля                       | `server/src/meta/services/PlayerService.ts` (новый)          | —                                                            |

#### B.2 Матчмейкинг

| Шаг   | Ожидаемый результат                                      | Затрагиваемые файлы/модули                                   | Риски/неопределённости                                       |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| B.2.1 | `MatchmakingService` с очередью в Redis                  | `server/src/meta/services/MatchmakingService.ts` (новый)     | Алгоритм подбора: окно рейтинга, расширение, боты — сложная логика. |
| B.2.2 | Маршруты `/matchmaking/join`, `/status`, `/cancel`       | `server/src/meta/routes/matchmaking.ts` (новый)              | Идемпотентность `join` по `operationId`.                     |
| B.2.3 | `MatchAssignment` передаётся клиенту                     | [types.ts](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) (расширение) | Протокол: `joinToken` должен быть валидируем `MatchServer`.  |
| B.2.4 | Клиент подключается к `MatchServer` по `MatchAssignment` | `client/src/network/` (новый или рефакторинг `main.ts`)      | Рефакторинг: выделение сетевого слоя из `main.ts`.           |

#### B.3 Матч и завершение

| Шаг   | Ожидаемый результат                         | Затрагиваемые файлы/модули                                   | Риски/неопределённости                                       |
| ----- | ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| B.3.1 | `MatchServer` формирует `MatchSummary`      | [ArenaRoom.ts](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html), [types.ts](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) | `ArenaRoom.ts` — god-object, изменения рискованны без рефакторинга. |
| B.3.2 | `MatchSummary` отправляется в `MetaServer`  | [helpers](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) (новый хелпер), HTTP-клиент | Устойчивость: повторная отправка при сбое (`summaryOutbox`). |
| B.3.3 | `MetaServer` применяет результаты к профилю | `server/src/meta/services/MatchResultService.ts` (новый)     | Идемпотентность по `matchId`.                                |
| B.3.4 | Запись в `match_results`                    | Миграции, `server/src/meta/repositories/` (новый)            | —                                                            |

#### B.4 Валюты и транзакции

| Шаг   | Ожидаемый результат                         | Затрагиваемые файлы/модули                                   | Риски/неопределённости                    |
| ----- | ------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| B.4.1 | `WalletService` — начисления/списания       | `server/src/meta/services/WalletService.ts` (новый)          | Транзакционность PostgreSQL, блокировки.  |
| B.4.2 | Запись в `transactions` с `operationId`     | `server/src/meta/repositories/TransactionRepository.ts` (новый) | Уникальность (`user_id`, `operation_id`). |
| B.4.3 | Повтор операции возвращает тот же результат | Тесты идемпотентности                                        | **P0 риск:** ошибки здесь = дюп валюты.   |

------

### Часть 3: Этап C — Монетизация и liveOps (P1)

**Цель:** магазин, реклама, конфигурации без релиза клиента.

#### C.1 Система конфигураций

| Шаг   | Ожидаемый результат                          | Затрагиваемые файлы/модули                                | Риски/неопределённости                          |
| ----- | -------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| C.1.1 | Структура `RuntimeConfig` на сервере         | `server/src/meta/config/` (новый): схемы JSON, валидаторы | Миграция с `balance.json` на новую структуру.   |
| C.1.2 | `ConfigService` — версионирование, откат     | `server/src/meta/services/ConfigService.ts` (новый)       | Хранение: файлы или БД? Нужно решение.          |
| C.1.3 | Маршрут `/config/runtime`                    | `server/src/meta/routes/config.ts` (новый)                | —                                               |
| C.1.4 | Клиент загружает и применяет `RuntimeConfig` | `client/src/services/ConfigService.ts` (новый)            | Замена текущего `loadBalanceConfig` на клиенте. |

#### C.2 Магазин

| Шаг   | Ожидаемый результат                        | Затрагиваемые файлы/модули                             | Риски/неопределённости                 |
| ----- | ------------------------------------------ | ------------------------------------------------------ | -------------------------------------- |
| C.2.1 | `ShopService` — каталог, покупка за валюту | `server/src/meta/services/ShopService.ts` (новый)      | Офферы из `shop.json`, лимиты покупок. |
| C.2.2 | Маршруты `/shop/catalog`, `/shop/purchase` | `server/src/meta/routes/shop.ts` (новый)               | Идемпотентность покупок.               |
| C.2.3 | `InventoryService` — выдача предметов      | `server/src/meta/services/InventoryService.ts` (новый) | —                                      |

#### C.3 Реклама с наградой

| Шаг   | Ожидаемый результат         | Затрагиваемые файлы/модули                             | Риски/неопределённости                      |
| ----- | --------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| C.3.1 | `IAdsProvider` на клиенте   | `client/src/platform/providers/AdsProvider.ts` (новый) | Telegram Ads SDK — внешняя зависимость.     |
| C.3.2 | `AdsService` на сервере     | `server/src/meta/services/AdsService.ts` (новый)       | Награда по `grantId` из `economy.json`.     |
| C.3.3 | Маршрут `/ads/reward/claim` | `server/src/meta/routes/ads.ts` (новый)                | Лимиты (`daily_rewards.ads_watched_today`). |

#### C.4 A/B тесты (SHOULD)

| Шаг   | Ожидаемый результат             | Затрагиваемые файлы/модули                          | Риски/неопределённости |
| ----- | ------------------------------- | --------------------------------------------------- | ---------------------- |
| C.4.1 | Назначение варианта по `userId` | `server/src/meta/services/ABTestService.ts` (новый) | Детерминированный хэш. |
| C.4.2 | Запись в `ab_tests`             | Миграции, репозиторий                               | —                      |

------

### Часть 4: Рефакторинг UI (P0 для навигации)

**Цель:** Preact UI с `ScreenManager`, платформенные экраны.

| Шаг  | Ожидаемый результат                              | Затрагиваемые файлы/модули                                   | Риски/неопределённости                       |
| ---- | ------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------- |
| D.1  | Подключение Preact                               | [package.json](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html), [vite.config.ts](vscode-file://vscode-app/d:/Programs/Microsoft VS Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) | Совместимость с существующим DOM-кодом.      |
| D.2  | `ScreenManager` — стек экранов, модалки          | `client/src/ui/ScreenManager.ts` (новый)                     | Обработка кнопки «назад» в Telegram.         |
| D.3  | `AppState` — централизованное состояние          | `client/src/state/AppState.ts` (новый)                       | Рефакторинг: перенос состояния из `main.ts`. |
| D.4  | Экран лобби                                      | `client/src/ui/screens/LobbyScreen.tsx` (новый)              | —                                            |
| D.5  | Экран матчмейкинга                               | `client/src/ui/screens/MatchmakingScreen.tsx` (новый)        | —                                            |
| D.6  | Экран результатов                                | `client/src/ui/screens/ResultsScreen.tsx` (новый)            | Замена текущего Results Modal.               |
| D.7  | Экран профиля (минимум)                          | `client/src/ui/screens/ProfileScreen.tsx` (новый)            | —                                            |
| D.8  | `HUDController` — ограничение частоты обновлений | `client/src/ui/HUDController.ts` (новый)                     | Производительность: HUD не через Preact.     |

------

### Часть 5: Этап D — Тестирование и предрелиз

| Шаг  | Ожидаемый результат                          | Затрагиваемые файлы/модули              | Риски/неопределённости                     |
| ---- | -------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| E.1  | Smoke-тесты API                              | `tests/smoke/` (новый)                  | Автоматизация: Playwright или k6.          |
| E.2  | Тесты идемпотентности экономики              | `tests/idempotency/` (новый)            | **P0:** повтор `operationId` не дублирует. |
| E.3  | Нагрузочные тесты (CCU=500, RPS=100)         | `tests/load/` (новый), k6 скрипты       | Пороги: p99 < 2000ms, 5xx < 1%.            |
| E.4  | Проверка восстановления PostgreSQL из бэкапа | Документация, ручная проверка в `stage` | —                                          |
| E.5  | Тестовый релиз на ограниченную аудиторию     | CI/CD, feature flags                    | Постепенный rollout.                       |

------

### Открытые вопросы

1. **ORM:** Prisma (из techContext) или сырые SQL-запросы? Prisma упрощает типизацию, но добавляет зависимость.
2. **Токены:** JWT с подписью или опак-токены в Redis? JWT проще для stateless, но сложнее отзывать.
3. **Хранение конфигов:** Файлы в Git или таблица `configs` в БД? Файлы проще версионировать, БД — проще откатывать.
4. **Рефакторинг god-objects:** Выполнять параллельно или последовательно с Soft Launch? Риск регрессий.
5. **Telegram Ads SDK:** Доступен ли для Mini Apps? Альтернатива?

------

### Приоритизация по Плану v1.0.5

| Этап                       | Приоритет     | Оценка (раб. дни) | Блокирует релиз |
| -------------------------- | ------------- | ----------------- | --------------- |
| A (окружения)              | P0            | 5-7               | Да              |
| B (функциональный минимум) | P0            | 12-15             | Да              |
| C.1-C.3 (магазин, реклама) | P1            | 8-10              | Да (реклама)    |
| C.4 (A/B тесты)            | SHOULD        | 3-4               | Нет             |
| D (Preact UI)              | P0 (частично) | 10-12             | Да (навигация)  |
| E (тестирование)           | P0            | 5-7               | Да              |

**Итого:** 40-55 рабочих дней до готовности Soft Launch.