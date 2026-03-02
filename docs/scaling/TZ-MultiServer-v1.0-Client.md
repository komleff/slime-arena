# Slime Arena — ТЗ: Горизонтальное масштабирование MatchServer

## Часть: Client (клиентские изменения)

**Версия:** 1.0
**Дата:** 2026-03-02
**Статус:** Draft
**Аудитория:** Frontend-разработчик

**Связанные части:**

- `TZ-MultiServer-v1.0-Core.md` — архитектура, терминология
- `TZ-MultiServer-v1.0-Backend.md` — серверные API-контракты

---

## 1. Динамический WebSocket-роутинг

### 1.1. Текущее поведение

Клиент формирует URL для Colyseus-подключения из hostname текущей страницы: `ws(s)://{hostname}:2567` (прямое подключение) или `ws(s)://{hostname}` (обратный прокси). URL фиксирован для всей сессии.

Подключение выполняется через `client.joinOrCreate("arena", { name, classId, joinToken })`, что позволяет Colyseus автоматически создавать новые комнаты.

**Местоположение:** `client/src/main.ts`, функция `connectToServer()` (строки 1470-1497).

### 1.2. Целевое поведение

`REQ-SCALE-050`: Клиент использует `roomHost` и `roomPort` из `MatchAssignment` для формирования URL подключения к `MatchServer`. URL определяется для каждого матча индивидуально.

`REQ-SCALE-051`: Формат URL для прямого подключения:
- HTTPS-контекст: `wss://{roomHost}:{roomPort}`
- HTTP-контекст (dev): `ws://{roomHost}:{roomPort}`

`REQ-SCALE-052`: Экземпляр `Colyseus.Client` создаётся заново для каждого матча с актуальным URL, а не переиспользуется как синглтон.

---

## 2. Замена joinOrCreate на joinById

### 2.1. Подключение к предварительно созданной комнате

`REQ-SCALE-053`: Клиент подключается к комнате через `client.joinById(roomId, { joinToken })`.

- `roomId` — идентификатор комнаты, возвращённый `MetaServer` в `MatchAssignment`.
- `joinToken` — JWT-токен для авторизации подключения.

Метод `joinOrCreate` более не используется для подключения к матчу.

### 2.2. Данные из MatchAssignment

Интерфейс `MatchAssignment` уже содержит необходимые поля:

| Поле | Текущий статус | Назначение |
|------|---------------|------------|
| `matchId` | Используется | Идентификатор матча |
| `roomId` | Используется | Идентификатор комнаты Colyseus |
| `roomHost` | Определён, не используется | Хост `MatchServer` |
| `roomPort` | Определён, не используется | Порт `MatchServer` |
| `joinToken` | Используется | JWT для авторизации |

**Местоположение:** `client/src/ui/signals/gameState.ts`, интерфейс `MatchAssignment`.

`REQ-SCALE-054`: После получения `MatchAssignment` (через polling `GET /matchmaking/status`), клиент:

1. Извлекает `roomHost`, `roomPort`, `roomId`, `joinToken`.
2. Формирует WebSocket URL из `roomHost`/`roomPort`.
3. Создаёт `new Colyseus.Client(url)`.
4. Вызывает `client.joinById(roomId, { joinToken })`.

---

## 3. Обратная совместимость

`REQ-SCALE-055`: Если `roomHost` в `MatchAssignment` пуст, не определён или равен пустой строке, клиент использует текущую логику формирования URL (из hostname страницы). Это обеспечивает работоспособность:

- При переходном периоде (Stage 0 → Stage 1).
- При откате `MetaServer` к версии без реестра.

---

## 4. Переподключение

`REQ-SCALE-056`: При потере WebSocket-соединения клиент пытается переподключиться к тому же `roomHost:roomPort` и `roomId`, используя сохранённые значения из `MatchAssignment`. Запрос нового `MatchAssignment` не выполняется — используется существующий.

`REQ-SCALE-057`: Если переподключение не удалось в пределах `reconnectWindowMs` (текущее значение: 15 секунд, `SlimeArena-Architecture-v4.2.5-Part3.md` §5.3), клиент возвращается в лобби.

---

## 5. Обработка ошибок

`REQ-SCALE-058`: Если подключение к `MatchServer` по `roomHost:roomPort` не удалось (сервер недоступен, комната не найдена), клиент:

1. Отображает сообщение «Не удалось подключиться к серверу матча».
2. Возвращается в лобби.
3. Не пытается подключиться к другому серверу самостоятельно. Повторное подключение — через новый цикл matchmaking.

---

## 6. Что не меняется

| Компонент | Обоснование |
|-----------|-------------|
| Формат `InputCommand` | Игровой протокол не затрагивается |
| Обработка `room.state` | GameState schema одинакова на всех MatchServer |
| ResultsScreen | Использует данные из `room.state`, не зависит от сервера |
| `MatchResultsService` (клиентский) | Работает с `MetaServer`, не с `MatchServer` |
| Рендеринг и UI | Не зависят от топологии серверов |
