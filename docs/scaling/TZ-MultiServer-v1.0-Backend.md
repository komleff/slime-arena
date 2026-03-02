# Slime Arena — ТЗ: Горизонтальное масштабирование MatchServer

## Часть: Backend (серверные изменения)

**Версия:** 1.0
**Дата:** 2026-03-02
**Статус:** Draft
**Аудитория:** Backend-разработчик

**Связанные части:**

- `TZ-MultiServer-v1.0-Core.md` — архитектура, терминология, потоки данных
- `TZ-MultiServer-v1.0-Client.md` — клиентский роутинг
- `TZ-MultiServer-v1.0-Ops.md` — инфраструктура

---

## 1. Самонаблюдение MatchServer

### 1.1. Регистрация при запуске

`REQ-SCALE-010`: При запуске `MatchServer` создаёт запись о себе в Redis-реестре (`matchserver:registry`) со схемой, описанной в `TZ-MultiServer-v1.0-Core.md` §3.3.

- Значение `serverId` берётся из переменной окружения `MATCH_SERVER_ID`. Если переменная не задана, генерируется UUID и логируется предупреждение.
- Значения `host` и `port` берутся из `MATCH_SERVER_PUBLIC_HOST` и `MATCH_SERVER_PUBLIC_PORT`. Это адрес, видимый клиентам (может отличаться от `HOST`/`PORT`, на которых слушает процесс).
- Начальный статус: `active`.
- `roomCount` и `playerCount` — 0.
- `maxRooms` — из `MAX_ROOMS_PER_SERVER`.

`REQ-SCALE-011`: Одновременно с записью в реестр создаётся ключ `matchserver:{serverId}:alive` с TTL = `HEARTBEAT_TIMEOUT_SEC`. Наличие этого ключа означает доступность сервера.

**Местоположение:** `server/src/index.ts` — после `gameServer.listen()`.

### 1.2. Heartbeat

`REQ-SCALE-012`: С интервалом `HEARTBEAT_INTERVAL_SEC` `MatchServer` обновляет:

- Запись в реестре: актуальные `roomCount`, `playerCount`, `lastHeartbeat`.
- TTL ключа `matchserver:{serverId}:alive`.

Для получения `roomCount` и `playerCount` используется существующий `matchMaker.query({ name: "arena" })`.

`REQ-SCALE-013`: Heartbeat не блокирует игровой цикл. Реализуется через `setInterval` в event loop `MatchServer`, не внутри `onTick()` комнат.

### 1.3. Дерегистрация

`REQ-SCALE-014`: При получении сигнала `SIGTERM`/`SIGINT` (graceful shutdown) `MatchServer`:

1. Устанавливает статус `offline` в реестре.
2. Удаляет ключ `matchserver:{serverId}:alive`.
3. Выполняет `gameServer.gracefullyShutdown()` (существующая логика).

При аварийном завершении (crash, kill -9) запись в реестре остаётся, но ключ `alive` исчезнет по TTL.

---

## 2. Новые internal API на MatchServer

Все новые endpoints защищены `MATCH_SERVER_TOKEN` (заголовок `Authorization: Bearer {token}`), аналогично существующим `GET /api/internal/rooms` и `POST /api/internal/shutdown-notify`.

### 2.1. Создание комнаты

`REQ-SCALE-025`: `POST /api/internal/create-room`

**Назначение:** `MetaServer` вызывает для предварительного создания комнаты на выбранном `MatchServer`.

**Параметры запроса:**

| Поле | Тип | Обязательный | Описание |
|------|-----|--------------|----------|
| `matchId` | строка (UUID) | Да | Идентификатор матча, сгенерированный `MetaServer` |
| `seed` | число | Нет | Seed для детерминированной генерации арены |

**Ответ (успех, 201):**

| Поле | Тип | Описание |
|------|-----|----------|
| `roomId` | строка | Идентификатор созданной комнаты Colyseus |
| `serverId` | строка | Идентификатор `MatchServer` |

**Ответ (ошибка, 503):**

Возвращается если `roomCount >= maxRooms` или сервер в статусе `draining`.

**Реализация:** Использует `matchMaker.createRoom("arena", { seed, matchId })`. Передача `matchId` позволяет `ArenaRoom.onCreate()` использовать его вместо самостоятельной генерации UUID.

**Местоположение:** `server/src/index.ts` — рядом с существующими internal endpoints.

### 2.2. Health endpoint

`REQ-SCALE-030`: `GET /api/internal/health`

**Назначение:** Проверка доступности и состояния `MatchServer`. Используется `MetaServer` для верификации heartbeat и Nginx для upstream health checks.

**Ответ (200):**

| Поле | Тип | Описание |
|------|-----|----------|
| `serverId` | строка | Идентификатор сервера |
| `status` | строка | `active` / `draining` |
| `roomCount` | число | Текущее число комнат |
| `playerCount` | число | Текущее число игроков |
| `uptimeSeconds` | число | Время работы процесса |

### 2.3. Drain endpoint

`REQ-SCALE-031`: `POST /api/internal/drain`

**Назначение:** Перевод `MatchServer` в режим draining. Новые комнаты не создаются, существующие доигрывают.

**Поведение:**

1. Устанавливает внутренний флаг `isDraining = true`.
2. Обновляет статус в Redis-реестре на `draining`.
3. Endpoint `POST /api/internal/create-room` начинает возвращать 503.
4. Существующие комнаты продолжают работу до естественного завершения.

**Ответ (200):**

| Поле | Тип | Описание |
|------|-----|----------|
| `serverId` | строка | Идентификатор сервера |
| `status` | строка | `draining` |
| `activeRooms` | число | Число комнат, ожидающих завершения |

---

## 3. Изменения MatchmakingService

### 3.1. Новый сервис: MatchServerRegistry

`REQ-SCALE-020`: Создать сервис `MatchServerRegistry` в `MetaServer`, отвечающий за чтение реестра из Redis.

**Ответственность:**

- Чтение списка активных серверов из `matchserver:registry`.
- Проверка наличия ключа `matchserver:{serverId}:alive` для каждого сервера.
- Фильтрация серверов по условиям §4.1 из `TZ-MultiServer-v1.0-Core.md`.
- Выбор сервера по алгоритму (наименьший `roomCount`).

**Местоположение:** `server/src/meta/services/MatchServerRegistry.ts` (новый файл).

### 3.2. Изменения в createMatch

`REQ-SCALE-021`: Метод `createMatch()` в `MatchmakingService` заменяет:

- Чтение `MATCH_SERVER_HOST`/`MATCH_SERVER_PORT` из env → вызов `MatchServerRegistry.selectServer()`.
- Формирование `roomId` из результата `matchMaker.createRoom()` на клиенте → вызов `POST /api/internal/create-room` на выбранном `MatchServer`.

`REQ-SCALE-022`: `MatchAssignment` заполняется значениями `host` и `port` из записи выбранного сервера в реестре.

### 3.3. Обратная совместимость

`REQ-SCALE-023`: Если реестр пуст (ни один `MatchServer` не зарегистрирован), `MatchmakingService` использует `MATCH_SERVER_HOST`/`MATCH_SERVER_PORT` как fallback. Это обеспечивает работоспособность до миграции на Stage 1.

---

## 4. Авторизация создания комнат

### 4.1. JOIN_TOKEN_REQUIRED

`REQ-SCALE-100`: В production-окружении переменная `JOIN_TOKEN_REQUIRED` установлена в `true`. Метод `onAuth()` в `ArenaRoom` отклоняет подключения без валидного `joinToken`.

**Местоположение:** `server/src/rooms/ArenaRoom.ts`, метод `onAuth()` (строки 344-370).

### 4.2. Отключение joinOrCreate через публичный WebSocket

`REQ-SCALE-103`: `MatchServer` в production не принимает запросы `joinOrCreate` от клиентов через публичный WebSocket. Клиент использует `joinById(roomId, { joinToken })`.

Реализация: при `JOIN_TOKEN_REQUIRED=true` метод `onAuth()` уже отклоняет подключения без токена. Дополнительно: если комната с указанным `roomId` не существует, подключение отклоняется (стандартное поведение `joinById`).

---

## 5. Административная панель: multi-server

### 5.1. Получение комнат со всех серверов

`REQ-SCALE-040`: Функция `fetchRoomsFromMatchServer()` в `admin.ts` заменяется на `fetchRoomsFromAllMatchServers()`:

1. Читает реестр из Redis (через `MatchServerRegistry`).
2. Параллельно отправляет `GET /api/internal/rooms` на каждый зарегистрированный `MatchServer`.
3. Объединяет результаты. К каждой записи комнаты добавляет поле `serverId`.
4. Если один из серверов не ответил в пределах таймаута, возвращает частичные данные с заголовком `X-Partial-Data: true`.

**Местоположение:** `server/src/meta/routes/admin.ts`, функция `fetchRoomsFromMatchServer()` (строки 516-558).

### 5.2. Агрегация метрик

`REQ-SCALE-041`: Endpoint `GET /api/v1/admin/stats` агрегирует данные со всех серверов:

| Метрика | Агрегация |
|---------|-----------|
| `rooms` | Сумма `roomCount` по всем серверам |
| `players` | Сумма `playerCount` по всем серверам |
| `tick.avg` | Средневзвешенное по числу комнат |
| `tick.max` | Максимум по всем серверам |
| `servers` | Новое поле: число активных серверов |

### 5.3. Список серверов

`REQ-SCALE-042`: Новый endpoint `GET /api/v1/admin/servers` возвращает список зарегистрированных `MatchServer` с их текущим состоянием (из реестра). Позволяет оператору видеть топологию.

### 5.4. Управление сервером

`REQ-SCALE-043`: Новый endpoint `POST /api/v1/admin/servers/{serverId}/drain` проксирует вызов `POST /api/internal/drain` на указанный `MatchServer`. Позволяет оператору переводить сервер в режим draining через админ-панель.

---

## 6. Конфигурация

### 6.1. Redis-ключи

| Ключ | Тип | TTL | Описание |
|------|-----|-----|----------|
| `matchserver:registry` | Hash | Нет | `serverId` → JSON записи реестра |
| `matchserver:{serverId}:alive` | String | `HEARTBEAT_TIMEOUT_SEC` | Маркер доступности |

### 6.2. Новые переменные окружения

Полный перечень — в `TZ-MultiServer-v1.0-Core.md` §8.1.

### 6.3. Изменения ArenaRoom.onCreate

`REQ-SCALE-026`: Если при создании комнаты передан `matchId` в `options`, `ArenaRoom` использует его вместо генерации собственного UUID. Это обеспечивает соответствие `matchId` между `MetaServer` (создание матча) и `MatchServer` (симуляция).

**Местоположение:** `server/src/rooms/ArenaRoom.ts`, метод `onCreate()`, вызов `initMatchId()`.

---

## 7. Что не меняется

| Компонент | Обоснование |
|-----------|-------------|
| `MatchResultService` | Уже работает через HTTP с `META_SERVER_URL`. Каждый MatchServer независимо отправляет результаты |
| `GameState` schema | Игровое состояние комнаты не затрагивается |
| Порядок систем в `onTick()` | Детерминизм не затрагивается |
| `config/balance.json` | Параметры баланса общие для всех серверов |
| `JoinTokenService` | JWT-верификация работает на каждом MatchServer одинаково при общем `JWT_SECRET` |
