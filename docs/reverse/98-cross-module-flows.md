# Кросс-модульные потоки данных

**Дата:** 2026-03-07 | **Версия:** v0.8.7 (425d333)

---

## 1. Полный жизненный цикл игрока

```
Boot → Auth → Menu → Matchmaking → Game → Results → Menu (цикл)
```

| Шаг | Модули | Описание |
| --- | --- | --- |
| 1. Boot | 11 (main.ts), 13 (BootScreen) | DOM creation, Preact init, progress bar |
| 2. Platform detect | 14 (PlatformManager) | Приоритет: Telegram → CrazyGames → GD → Yandex → Poki → Standalone |
| 3. Config load | 12 (configService) | GET /api/v1/config/runtime, кеш 5 мин в localStorage |
| 4. Auth | 12 (authService), 08 (MetaServer Auth) | Guest token или Platform login → JWT |
| 5. Menu | 13 (MainScreen, MainMenu) | Выбор класса, ник, кнопка "Играть" |
| 6. Matchmaking | 12 (matchmakingService), 09 (MatchmakingService) | POST /api/v1/matchmaking/join → polling GET /queue/status каждые 2с |
| 7. JoinToken | 08 (JoinTokenService) | Создание подписанного JWT с playerId, spriteId, classId |
| 8. Connect | 11 (main.ts) | Colyseus client.joinOrCreate("arena", {joinToken}) |
| 9. onAuth | 03 (ArenaRoom) | Валидация joinToken, проверка подписи |
| 10. onJoin | 03 (ArenaRoom), 02 (GameState) | Создание Player (175+ полей), спавн |
| 11. Game Loop | 03 (ArenaRoom тик), 04-07 (системы), 11 (рендер) | 30 Hz сервер, RAF клиент |
| 12. Results | 03 (ArenaRoom), 09 (matchResults) | Placement, XP, монеты → POST /api/v1/match-results/claim |
| 13. Return | 13 (ResultsScreen → MainScreen) | Показ наград, возврат в меню |

---

## 2. Поток аутентификации

```
Client                          MetaServer                    DB
  |                                |                           |
  |-- PlatformManager.detect() --> |                           |
  |-- authService.init() -------> |                           |
  |   (restore from localStorage) |                           |
  |                                |                           |
  | [Guest Flow]                   |                           |
  |-- POST /auth/guest ----------> |-- jwt.sign(guestToken) -> |
  |<- {guestToken} --------------- |                           |
  |                                |                           |
  | [Platform Flow]                |                           |
  |-- POST /auth/telegram -------> |-- verifyHMAC(initData) -> |
  |                                |-- SELECT/INSERT users --> |-- users table
  |<- {accessToken, refreshToken}  |<- {userId} -------------- |
  |                                |                           |
  | [OAuth Flow]                   |                           |
  |-- redirect to Google/Yandex -> |                           |
  |<- callback with code --------- |                           |
  |-- POST /auth/oauth/callback -> |-- exchange code -------> |-- provider API
  |                                |-- SELECT/INSERT users --> |-- users table
  |<- {accessToken, refreshToken}  |                           |
  |                                |                           |
  | [Guest → Registered]           |                           |
  |-- POST /auth/convert-guest --> |-- validate claimToken --> |
  |                                |-- UPDATE users ---------- |-- users table
  |<- {accessToken} -------------- |                           |
```

**7 типов токенов:** accessToken (15 мин), guestToken (7 дней), claimToken (30 мин), pendingAuthToken (15 мин), upgradePrepareToken (5 мин), joinToken (30 сек), adminAccessToken (1 ч)

---

## 3. Поток матча

```
Client MatchmakingService    MetaServer         ArenaRoom (Colyseus)
  |                            |                    |
  |-- POST /matchmaking/join ->|                    |
  |<- {queueId} -------------- |                    |
  |                            |                    |
  |-- GET /queue/status -----> | (polling 2с)       |
  |<- {status: "waiting"} ---- |                    |
  |  ...                       |                    |
  |<- {status: "matched",      |                    |
  |    joinToken, wsUrl} ----- |                    |
  |                            |                    |
  |-- WebSocket connect -------|--joinOrCreate() -> |
  |                            |                    |-- onAuth(joinToken)
  |                            |                    |-- onJoin() → Player
  |<- state.onChange ----------|-------- sync ----> |-- fixedUpdate() 30Hz
  |                            |                    |    24 системы
  |-- room.send("input") ---->|-------> msg -----> |-- onMessage()
  |<- state delta ------------|<------- sync ----- |
  |                            |                    |
  |  [Results]                 |                    |
  |<- phase="Results" --------|<------- sync ----- |-- setPhase("Results")
  |                            |                    |-- sendMatchResults()
```

---

## 4. Поток ввода (Input → Render)

```
Touch/Mouse Event
  ↓
InputManager (client/src/input/InputManager.ts)
  ↓ (joystick > mouse priority)
Joystick (client/src/input/joystick.ts)
  ↓ (deadzone, sensitivity, normalize)
handleInputTick() (client/src/main.ts, 33ms setInterval)
  ↓
room.send("input", {moveX, moveY, abilitySlot, seq})
  ↓ [WebSocket]
ArenaRoom.onMessage("input") (server/src/rooms/ArenaRoom.ts)
  ↓ (validate, store in player.inputX/inputY)
fixedUpdate() → 24 системы (33ms, 30Hz):
  1. collectInputs
  2. flightAssistSystem (assistFx, assistFy, assistTorque)
  3. physicsSystem (Euler integration, drag)
  4. collisionSystem (4 итерации, Baumgarte)
  5-24. combat, death, abilities, talents, zones, orbs...
  ↓
GameState sync (Colyseus delta compression)
  ↓ [WebSocket]
SmoothingSystem (client/src/game/SmoothingSystem.ts)
  ↓ (U2-style: velocity integration + catch-up)
GameLoopManager → RAF → Canvas render
  ↓ (20-слойный Z-order)
Canvas 2D output
```

---

## 5. Поток экономики

```
ArenaRoom (Results)           MetaServer                    DB
  |                            |                            |
  |-- POST /match-results --> |                             |
  |   {matchId, players,       |                            |
  |    placements, kills}      |                            |
  |                            |-- INSERT match_history --> |
  |                            |-- UPDATE users (xp,coins)→|
  |                            |   ⚠️ Обход PlayerService.addXP()!
  |                            |   ⚠️ Level-up НЕ срабатывает!
  |                            |                            |
  |<- {rewards} -------------- |                            |
  |                            |                            |
Client MatchResultsService     |                            |
  |-- POST /match-results/claim|                            |
  |   {claimToken}             |-- validate token -------> |
  |                            |-- UPDATE wallet --------→ |
  |<- {xp, coins, rating} --- |                            |
```

**Награды:** рассчитываются локально из balance.json (rewards секция) и верифицируются сервером.

---

## 6. Поток конфигурации

```
config/balance.json
  ↓
loadBalanceConfig() (server/src/config/loadBalanceConfig.ts)
  ↓ (4 кандидата пути, resolveBalanceConfig из shared)
ArenaRoom.config (сервер, все системы)
  ↓
room.send("balance", config) → при join
  ↓
Client main.ts → applyBalanceConfig()
  ↓
configService (параллельно: GET /api/v1/config/runtime, кеш 5 мин)
  ↓
UI signals (gameState.ts)

Два параллельных потока:
1. balance.json → Colyseus message → клиент (игровые параметры)
2. RuntimeConfig → HTTP API → configService → localStorage (платформенные настройки)
```

---

## 7. Поток платежей

```
Client UI                MetaServer Payment         Provider API
  |                        |                          |
  |-- initPayment() ----> |                          |
  |   {productId, provider}|                          |
  |                        |                          |
  | [Telegram Stars]       |                          |
  |<- invoiceUrl --------- |-- createInvoice() ----> |-- Telegram Bot API
  |-- openInvoice() -----> |                          |
  |   (WebApp.openInvoice) |                          |
  |                        |<- webhook /payment/tg -> |-- Telegram callback
  |                        |   ⚠️ Без проверки подписи!
  |                        |-- INSERT transactions -> |-- DB
  |                        |-- UPDATE wallet -------> |
  |<- payment confirmed -- |                          |
  |                        |                          |
  | [Yandex Pay]           |                          |
  |-- createOrder() -----> |-- POST /api/pay -------> |-- Yandex Pay API
  |<- paymentUrl ----------|<- {confirmation_url} --- |
  |-- redirect ----------> |                          |
  |                        |<- webhook /payment/ya -> |-- Yandex callback
  |                        |   ⚠️ Без проверки подписи!
  |                        |-- process payment -----> |-- DB
```

---

## 8. Admin поток

```
Admin Dashboard              MetaServer Admin API        DB/Redis
  |                            |                           |
  |-- POST /admin/login -----> |-- bcrypt.compare() ----> |-- admin_users
  |<- {accessToken} ---------- |                           |
  |                            |                           |
  |-- POST /admin/totp/verify >|-- speakeasy.verify() --> |-- admin_users.totp_secret
  |<- {totpSuccess: true} ---- |                           |   (AES-256-GCM encrypted)
  |                            |                           |
  |-- GET /admin/stats ------> |-- systemMetrics.get() -> |-- in-memory counters
  |<- {players, rooms, cpu} -- |                           |
  |                            |                           |
  |-- GET /admin/rooms ------> |-- Colyseus.rooms ------> |-- Room instances
  |<- [{roomId, players}] ---- |                           |
  |                            |                           |
  |-- POST /admin/restart ----> |-- shutdown-notify -----> |-- ArenaRoom.setShutdownAt()
  |                            |   (ждёт завершения матчей)|
  |<- {status: "draining"} --- |                           |
  |                            |                           |
  |-- GET /admin/audit -------> |-- SELECT audit_log ----> |-- audit_log table
  |<- [{action, admin, ts}] -- |                           |
```

---

## 9. Диаграмма зависимостей между модулями

```
                    ┌─────────────────────┐
                    │  01 Shared Foundation │
                    │  (types, config,     │
                    │   formulas, consts)  │
                    └─────────┬───────────┘
                              │ используется всеми
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
     ┌────────────┐  ┌───────────────┐  ┌──────────┐
     │ 02 Schema  │  │ 15 Infra      │  │ 11 Client│
     │ (GameState)│  │ (DB,Docker,CI)│  │ GameLoop │
     └─────┬──────┘  └───────┬───────┘  └────┬─────┘
           │                 │               │
     ┌─────┴──────┐    ┌────┴────┐     ┌────┴─────┐
     │ 03 ArenaRoom│    │ 08 Auth │     │ 12 Client│
     │ (lifecycle) │    │ 09 Econ │     │ Services │
     └─────┬──────┘    │ 10 Admin│     └────┬─────┘
           │           └────┬────┘          │
    ┌──────┼──────┐         │         ┌─────┴────┐
    ↓      ↓      ↓         │         │ 13 UI    │
  ┌──┐  ┌──┐  ┌──┐         │         │ 14 Platf │
  │04│  │05│  │06│         │         └──────────┘
  │Ph│  │Cb│  │Ab│         │
  └──┘  └──┘  └──┘         │
         ↑                  │
       ┌─┴─┐               │
       │07 │               │
       │Ch │               ↓
       └───┘          ┌──────────┐
                      │ 16 Admin │
                      │ Dashboard│
                      └──────────┘
```

---

## 10. Узкие места и Single Points of Failure

| Проблема | Модули | Влияние | Приоритет |
| --- | --- | --- | --- |
| **ArenaRoom God Object** (2789 строк) | 03 | Невозможно тестировать системы изолированно | P1 |
| **main.ts God Object** (3985 строк) | 11 | Невозможно рефакторить клиент по частям | P1 |
| **Player God Object** (~175 полей) | 02 | Высокий трафик синхронизации, сложность поддержки | P1 |
| **config.ts монолит** (3138 строк) | 01 | Невозможна модульная загрузка конфигов | P2 |
| **Нет reconnect** | 03, 11 | Потеря соединения = потеря матча | P0 |
| **Нет server-side ad validation** | 09 | Клиент может клеймить награды без просмотра | P0 |
| **JWT без верификации подписи** (Yandex, CrazyGames) | 08 | Потенциальный spoofing аутентификации | P0 |
| **Payment webhooks без проверки подписи** | 09 | Возможность фальшивых транзакций | P0 |
| **Единственный процесс** (no clustering) | 15 | Один ArenaRoom = один поток | P1 |
| **Level-up не работает** при claim XP | 09 | Игроки не получают уровни | P0 |
| **A/B тесты без salt** | 10 | Варианты коррелируют между тестами | P1 |

---

## 11. Заметки для форка BonkRace

### Потоки, переиспользуемые целиком:
- **Auth** (поток 2): без изменений
- **Config** (поток 6): адаптировать balance.json содержимое
- **Admin** (поток 8): ребрендинг
- **Payments** (поток 7): без изменений

### Потоки, требующие адаптации:
- **Жизненный цикл** (поток 1): Menu остаётся, Matchmaking → Race Lobby, Game → Race
- **Матч** (поток 3): ArenaRoom → RaceRoom, фазы → Countdown/Race/Finish, системы → physics+checkpoints
- **Input** (поток 4): Joystick → Steering (left/right + accelerate/brake), убрать abilities
- **Экономика** (поток 5): Match results → Race results, placement аналогичен

### Потоки для удаления:
- Combat, Abilities, Talents, Chests — всё game-specific для Slime Arena
