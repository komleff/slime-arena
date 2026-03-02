# Slime Arena — ТЗ: Горизонтальное масштабирование MatchServer

## Index (сводный документ)

**Версия:** 1.0
**Дата:** 2026-03-02
**Статус:** Draft
**Приоритет:** P1
**Автор:** Claude Opus 4.6

---

## 1. Структура документации

| Файл | Аудитория | Содержание |
|------|-----------|------------|
| `TZ-MultiServer-v1.0-Index.md` | Все | Приоритеты, критерии приёмки, глоссарий |
| `TZ-MultiServer-v1.0-Core.md` | Все | Архитектура, терминология, потоки данных, стратегия миграции |
| `TZ-MultiServer-v1.0-Backend.md` | Backend | Реестр, API-контракты, MatchmakingService, авторизация комнат, админ-панель |
| `TZ-MultiServer-v1.0-Client.md` | Frontend | Динамический WebSocket-роутинг, joinById, переподключение |
| `TZ-MultiServer-v1.0-Ops.md` | DevOps | Docker Compose, отдельные VPS, TLS, drain, rolling update |

---

## 2. Зависимости

| Документ | Версия | Назначение |
|----------|--------|------------|
| `SlimeArena-Architecture-v4.2.5-Part1.md` | 4.2.5 | Компонентная модель, room model, state sync |
| `SlimeArena-Architecture-v4.2.5-Part2.md` | 4.2.5 | Сервисы MetaServer, MatchmakingService |
| `SlimeArena-Architecture-v4.2.5-Part3.md` | 4.2.5 | Reconnect, resilience, environments |
| `SlimeArena-Architecture-v4.2.5-Part4.md` | 4.2.5 | HTTP API, env-переменные, Redis-ключи, схема БД |
| `TZ-SoftLaunch-v1.4.7.md` | 1.4.7 | Ограничение single-instance (снимается для MatchServer) |
| `SlimeArena-SoftLaunch-Plan-v1.0.5.md` | 1.0.5 | Целевые значения: 500 CCU, 60 комнат |
| `TZ-MON-v1_6-Backend.md` | 1.6 | Мониторинг (потребует обновления) |

---

## 3. Приоритеты реализации

### P0 — Обязательно для первого multi-server деплоя

- [ ] `REQ-SCALE-010..014` — Самонаблюдение MatchServer: регистрация, heartbeat, дерегистрация
- [ ] `REQ-SCALE-020..023` — MatchServerRegistry + выбор сервера в MatchmakingService
- [ ] `REQ-SCALE-025..026` — Endpoint создания комнаты, matchId из MetaServer
- [ ] `REQ-SCALE-050..055` — Клиент: динамический роутинг, joinById, обратная совместимость
- [ ] `REQ-SCALE-060..061` — Docker Compose multi-server
- [ ] `REQ-SCALE-100..103` — Авторизация создания комнат, JOIN_TOKEN_REQUIRED

### P1 — Операционная зрелость

- [ ] `REQ-SCALE-003` — Ошибка matchmaking при отсутствии доступных серверов
- [ ] `REQ-SCALE-030..031` — Health endpoint, drain API
- [ ] `REQ-SCALE-040..043` — Админ-панель: multi-server комнаты, метрики, серверы, drain
- [ ] `REQ-SCALE-080..081` — Heartbeat-мониторинг, алерты

### P2 — Расширение после валидации

- [ ] `REQ-SCALE-056..057` — Переподключение к правильному серверу
- [ ] `REQ-SCALE-070..071` — Сетевая изоляция Redis, TLS для прямых подключений
- [ ] Colyseus `RedisPresence`/`RedisDriver` (при необходимости cross-server функций)
- [ ] Интеграция с внешним алертингом (Telegram-бот)
- [ ] Автоматическое масштабирование (auto-scale policy)

---

## 4. Критерии приёмки

### P0

| ID | Критерий |
|----|----------|
| `ACC-SCALE-001` | При двух запущенных MatchServer новый матч создаётся на сервере с меньшим числом активных комнат |
| `ACC-SCALE-002` | Клиент подключается к правильному MatchServer по `roomHost`/`roomPort` из `MatchAssignment` |
| `ACC-SCALE-003` | При остановке одного MatchServer новые матчи направляются исключительно на оставшиеся серверы |
| `ACC-SCALE-004` | MatchServer появляется в реестре в пределах `HEARTBEAT_INTERVAL_SEC` после запуска |
| `ACC-SCALE-005` | MatchServer исчезает из реестра в пределах `HEARTBEAT_TIMEOUT_SEC` после остановки |
| `ACC-SCALE-006` | При единственном зарегистрированном MatchServer система ведёт себя идентично текущей single-server версии |
| `ACC-SCALE-007` | Результаты матчей с любого MatchServer доставляются в MetaServer и корректно обрабатываются (экономика, рейтинг) |
| `ACC-SCALE-008` | Подключение к MatchServer без валидного `joinToken` отклоняется при `JOIN_TOKEN_REQUIRED=true` |
| `ACC-SCALE-009` | Клиент не может создать комнату через `joinOrCreate` при `JOIN_TOKEN_REQUIRED=true` |

### P1

| ID | Критерий |
|----|----------|
| `ACC-SCALE-010` | Админ-панель отображает комнаты со всех активных MatchServer |
| `ACC-SCALE-011` | Админ-панель показывает метрики (CPU, RAM, комнаты, игроки) с разбивкой по серверам |
| `ACC-SCALE-012` | После вызова drain на MatchServer новые комнаты на нём не создаются |
| `ACC-SCALE-013` | После завершения всех комнат на drained MatchServer он может быть безопасно остановлен |
| `ACC-SCALE-014` | Если один MatchServer недоступен, админ-панель показывает частичные данные с предупреждением |

---

## 5. Документы, требующие обновления после реализации

| Документ | Изменения |
|----------|-----------|
| `SlimeArena-Architecture-v4.2.5-Part2.md` | Добавить `MatchServerRegistry` в список сервисов MetaServer §3.2 |
| `SlimeArena-Architecture-v4.2.5-Part4.md` | Новые env-переменные, Redis-ключи, internal API endpoints |
| `TZ-MON-v1_6-Backend.md` | Multi-server агрегация метрик |
| `docs/operations/SERVER_SETUP.md` | Инструкция деплоя с несколькими MatchServer |
| `TZ-SoftLaunch-v1.4.7.md` §1.4 | Обновить ограничение: разрешён multi-server для MatchServer |

---

## 6. Открытые вопросы

1. **Colyseus RedisPresence/RedisDriver.** Нужен ли для P0 или достаточно независимых MatchServer? Текущая рекомендация: не нужен. Пересмотреть при появлении требования на cross-server взаимодействие.

2. **MATCH_SERVER_TOKEN.** Один общий токен или уникальный на каждый MatchServer? Текущая рекомендация: один общий для P0.

3. **Автогенерация MATCH_SERVER_ID.** UUID при первом запуске с persist в volume или явная конфигурация через env? Текущая рекомендация: env-переменная (явная) для предсказуемости.

4. **Обновление TZ-MON-v1.6.** Расширять в рамках этого ТЗ или отдельной задачей? Текущая рекомендация: отдельная задача, данное ТЗ определяет API.

5. **Уведомление игроков при аварии MatchServer.** Push через MetaServer? Текущая рекомендация: P2, клиент сам обрабатывает disconnect.

6. **TLS для прямых подключений.** Wildcard-сертификат, per-server Let's Encrypt или Nginx-терминатор? Зависит от выбранной топологии. Решение при деплое.

---

## 7. Глоссарий

| Термин | Описание |
|--------|----------|
| `MatchServer` | Процесс игрового сервера на базе Colyseus, обрабатывающий комнаты с матчами |
| `MetaServer` | HTTP API-сервер для аутентификации, экономики, matchmaking, администрирования |
| `MatchServerRegistry` | Реестр активных экземпляров MatchServer, хранящийся в Redis |
| `serverId` | Уникальный строковый идентификатор экземпляра MatchServer |
| `heartbeat` | Периодическое обновление записи MatchServer в реестре для подтверждения доступности |
| `draining` | Статус MatchServer: не принимает новые комнаты, ожидает завершения существующих |
| `MatchAssignment` | Структура данных, возвращаемая matchmaking: `roomId`, `roomHost`, `roomPort`, `joinToken` |
| `maxRooms` | Максимально допустимое число одновременных комнат на одном MatchServer |
| `roomHost` | Хост или IP-адрес MatchServer, видимый клиентам для WebSocket-подключения |
| `roomPort` | Порт MatchServer для WebSocket-подключений |
| `joinToken` | JWT-токен, подтверждающий право игрока на подключение к конкретной комнате |
| `joinOrCreate` | Метод Colyseus SDK: подключиться к существующей комнате или создать новую (устаревает в production) |
| `joinById` | Метод Colyseus SDK: подключиться к конкретной комнате по её идентификатору |
| `internal API` | HTTP endpoints MatchServer, доступные только для MetaServer (защищены токеном) |
| `graceful drain` | Процедура безопасного вывода сервера: прекращение приёма новых матчей → ожидание завершения текущих → остановка |
| `rolling update` | Процедура обновления серверов по одному без полного простоя сервиса |
| `TTL` | Time To Live — время жизни ключа в Redis, после которого он автоматически удаляется |

---

## 8. История изменений

| Версия | Дата | Автор | Изменения |
|--------|------|-------|-----------|
| 1.0 | 2026-03-02 | Claude Opus 4.6 | Первая версия. Пять частей: Index, Core, Backend, Client, Ops |
