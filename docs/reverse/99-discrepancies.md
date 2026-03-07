# 99. Сводка расхождений и технического долга

**Дата:** 2026-03-07
**Версия кода:** v0.8.7
**Источник:** модули 01–16 реверс-документации

---

## Содержание

1. [Критические расхождения (P0)](#1-критические-расхождения-p0)
2. [Важные расхождения (P1)](#2-важные-расхождения-p1)
3. [Средние расхождения (P2)](#3-средние-расхождения-p2)
4. [Сводная таблица технического долга](#4-сводная-таблица-технического-долга)
5. [Статистика по модулям](#5-статистика-по-модулям)

---

## 1. Критические расхождения (P0)

### 1.1 Безопасность

| # | Модуль | Проблема | Файл / строка |
|---|--------|----------|---------------|
| S1 | 08 | **Yandex Games JWT подпись НЕ верифицируется** — позволяет подделать userId | `YandexAuthProvider.ts:44` |
| S2 | 08 | **CrazyGames JWT подпись НЕ верифицируется** — `getPublicKey()` закомментирован | `CrazyGamesAuthProvider.ts:36-37` |
| S3 | 09 | **Webhook-и без signature verification** — Telegram и Yandex webhooks не проверяют подпись | `paymentRoutes.ts` |
| S4 | 09 | **Нет server-side validation рекламы** — клиент может клеймить reward без просмотра | `AdsService.claimReward` |
| S5 | 08 | **Poki и GameDistribution** — полностью client-trusted auth без серверной верификации | `PokiAuthProvider.ts`, `GameDistributionAuthProvider.ts` |
| S6 | 10 | **Config public routes без auth** — `/api/v1/config/runtime` доступен без авторизации, может содержать A/B тесты и параметры экономики | `configRoutes.ts` |
| S7 | 08 | **OAuth state parameter не реализован** — CSRF-уязвимость | `GoogleOAuthProvider.ts:5-8`, `YandexOAuthProvider.ts:5-8` |
| S8 | 08 | **DevAuthProvider** зарегистрирован в production — нет проверки `NODE_ENV` | `AuthProviderFactory.ts` |

### 1.2 Игровой баланс: код vs GDD

| # | Модуль | Параметр | GDD | Код (balance.json) | Расхождение |
|---|--------|----------|-----|-------------------|-------------|
| B1 | 01, 03 | matchDurationSec | 180 сек | **90 сек** | 2× короче |
| B2 | 01, 04 | turnTorqueNm | 175 Нм | **24 000 Нм** | 137× выше |
| B3 | 01, 04 | thrustForwardN | 9 000 Н | **27 000 Н** | 3× выше |
| B4 | 01, 04 | restitution | 0.3 | **0.9** | Почти упругие столкновения вместо гасящих |
| B5 | 01 | biteMassPercent | 10–15% | **2%** | 5–7× слабее |
| B6 | 04 | angularSpeedLimitDegps | 80 | **180** | 2.25× выше |
| B7 | 05 | death orbs count | 6–8 шт | **4 шт** | В 1.5–2× меньше |
| B8 | 05 | death orb speed | 20–40 м/с | **150 м/с** (захардкожено) | 4–7× быстрее |
| B9 | 04 | torque mass scaling exp | 0.5 | **1.7** | Суперлинейное вместо sqrt |

### 1.3 Функциональные P0

| # | Модуль | Проблема |
|---|--------|----------|
| F1 | 09 | **Level-up не срабатывает при получении XP** — `matchResults.ts` пишет `UPDATE SET xp = xp + $2` напрямую, минуя `PlayerService.addXP()` с проверкой уровня |
| F2 | 03 | **Нет reconnect** — `onLeave` полностью удаляет игрока, повторное подключение невозможно |
| F3 | 05 | **SafeZone `finalStartSec=120`** при матче 90 сек — система фактически мёртвый код |
| F4 | 10 | **A/B тесты без salt** — хеш `userId:testId` даёт коррелированные распределения между тестами |

---

## 2. Важные расхождения (P1)

### 2.1 Архитектурные

| # | Модуль | Описание |
|---|--------|----------|
| A1 | 09 | **Rating: mass-based вместо Glicko-2** — документация описывает Glicko-2 с сезонами и рейтинговым подбором; код использует простой FIFO + total_mass/best_mass |
| A2 | 09 | **Matchmaking: FIFO без рейтинга** — нет `ratingWindowStart`, `ratingWindowExpandPerSec` |
| A3 | 11 | **main.ts God Object (3985 строк)** — архитектура предполагает `BattleContainer`, `GameSession`, `AppState`, `RenderSystem` — ничего не реализовано |
| A4 | 15 | **techContext.md: "Prisma"** — реально используется raw pg Pool |
| A5 | 08 | **Двойная система auth** — legacy session-based + JWT, middleware пробует оба |
| A6 | 12 | **UIFacade и ScreenManager не реализованы** — сервисы импортируются напрямую |
| A7 | 03 | **24 системы в тике вместо 16** — systemPatterns.md устарел, порядок изменён |
| A8 | 01 | **Два механизма конфигурации** — старая (`formulas.*`) и новая (`slimeConfigs.*`) существуют параллельно |

### 2.2 Нереализованные фичи из документации

| # | Модуль | Фича | Статус |
|---|--------|------|--------|
| NI1 | 09 | BattlePass endpoints | Не реализованы |
| NI2 | 09 | Achievements endpoint | Не реализован |
| NI3 | 09 | Daily Rewards | Не реализованы |
| NI4 | 09 | Inventory endpoint | Не реализован |
| NI5 | 14 | IPaymentProvider | Не реализован |
| NI6 | 14 | ISocialProvider | Не реализован |
| NI7 | 14 | Interstitial ads | Не реализованы |
| NI8 | 06 | Таланты: momentum, berserk, symbiosisBubbles | Не реализованы (GDD описывает) |
| NI9 | 09 | Сезонная система | Не реализована |
| NI10 | 10 | Prometheus / Grafana / Sentry | Не реализованы |

### 2.3 Функциональные P1

| # | Модуль | Проблема |
|---|--------|----------|
| P1-1 | 06 | **`sense` и `regeneration` — мёртвые таланты** — в пуле common, можно выбрать, но эффект не реализован |
| P1-2 | 07 | **Нет TTL сундуков** — GDD: 35 сек, код: вечные |
| P1-3 | 07 | **Нет проверки расстояния при спавне сундуков** — нет minDistanceToPlayer и minDistanceToChest |
| P1-4 | 09 | **Нет проверки `paymentsEnabled` kill switch** |
| P1-5 | 09 | **Нет проверки `adsRewardEnabled` kill switch** |
| P1-6 | 09 | **Нет проверки владения скином** при `updateSelectedSkin()` |
| P1-7 | 09 | **Транзакции без DB-level UNIQUE constraint** — race condition |
| P1-8 | 03 | **deathCount и totalBubblesCollected** — TODO, метрики не собираются |
| P1-9 | 03 | **buildVersion/configVersion захардкожены** как `"0.3.1"/"1.0.0"` вместо реальной v0.8.7 |

---

## 3. Средние расхождения (P2)

### 3.1 Код vs документация

| # | Модуль | Описание |
|---|--------|----------|
| D1 | 02 | Фаза `"Spawn"` не входит в `MatchPhaseId` — `GameState.phase` объявлен как `string` |
| D2 | 02 | systemPatterns.md: 6 флагов, код: 12 флагов с другими именами |
| D3 | 03 | GDD: "2–30 игроков зависит от карты", код: maxPlayers=20 фиксировано |
| D4 | 04 | Формула радиуса орба: код без π, GDD с π |
| D5 | 04 | Нет валидации проходимости арены (графовая связность) |
| D6 | 04 | Нет ограничения площади зон (лава ≤10%, нектар ≤5%) |
| D7 | 04 | Узкий проход: GDD говорит 350 кг, расчёт через формулу даёт ~156 кг |
| D8 | 05 | `pvpBiteVictimLossPct` в memory_bank, но не в коде |
| D9 | 07 | chestSpawnIntervalSec: GDD 18–26 сек, код 20 фиксировано |
| D10 | 09 | Endpoint каталога: документация `/shop/catalog`, код `/shop/offers` |
| D11 | 09 | Ads: документация одноэтапный, код двухэтапный (grant+claim) |
| D12 | 10 | A/B buckets: документация 10000 buckets, код 100 |
| D13 | 10 | A/B storage: документация `user_experiment_assignments`, код Redis cache 24h |
| D14 | 13 | Карточки выбора: GDD правый край, код левый; нет автосворачивания |
| D15 | 13 | Нет отдельного MatchmakingScreen, ProfileScreen, ShopScreen, SettingsScreen |
| D16 | 15 | `purchase_receipts` — схема полностью изменена относительно документации |
| D17 | 15 | `ab_tests` PK — другая структура (справочник vs назначение пользователя) |
| D18 | 16 | 2FA/TOTP не упомянута в архитектуре, но полностью реализована |
| D19 | 16 | Admin API = 1 строка в документации, реально 8 endpoints |

---

## 4. Сводная таблица технического долга

### По приоритетам

| Приоритет | Количество | Описание |
|-----------|-----------|----------|
| **P0** | 15 | Безопасность (6: JWT/OAuth/DevAuth/webhooks/ads), broken features (4: level-up), config leak (1), balance edge (4) |
| **P1** | 43 | Архитектурные (8), нереализованные фичи (11), функциональные (8), UI/UX (16) |
| **P2** | 45+ | Расхождения с документацией, отсутствие валидаций, UX |
| **P3** | 30+ | Косметические, i18n, типизация |

### Топ-10 рекомендаций к немедленному исправлению

| # | Приоритет | Модуль | Действие |
|---|-----------|--------|----------|
| 1 | P0 | 08 | Реализовать верификацию JWT подписи Yandex и CrazyGames |
| 2 | P0 | 09 | Добавить signature verification для payment webhooks |
| 3 | P0 | 09 | Реализовать server-side ad validation |
| 4 | P0 | 09 | Исправить level-up при XP claim — вызывать `PlayerService.addXP()` |
| 5 | P0 | 08 | Реализовать OAuth state parameter (CSRF protection) |
| 6 | P0 | 08 | Отключить DevAuthProvider в production |
| 7 | P0 | 10 | Добавить salt в A/B хеш-функцию |
| 8 | P0 | 10 | Закрыть public config routes за auth |
| 9 | P1 | 06 | Убрать sense/regeneration из talent pool или реализовать |
| 10 | P1 | 07 | Реализовать TTL сундуков (35 сек) |

### Технический долг по модулям (детально)

#### Модуль 01 — Shared Foundation
1. Дублирование SlimeConfig для всех классов (base/hunter/warrior/collector идентичны)
2. Два механизма конфигурации параллельно (formulas.* vs slimeConfigs.*)
3. `getOrbRadius` захардкожен (slimeBaseMass=100, slimeBaseRadius=10)
4. DOM-зависимый код в shared/ (SPRITE_CACHE, loadSprite, loadClassSprites)
5. Отсутствие валидации по диапазонам в resolveBalanceConfig
6. Огромный config.ts (3138 строк), 60% — ручной парсинг
7. `generateRandomName()` в shared/ помечена "ТОЛЬКО ДЛЯ КЛИЕНТА"
8. Линейный поиск в `isValidSprite` (O(n))
9. Отсутствие `formulas.speed.scale` и `formulas.radius.scale` в balance.json

#### Модуль 02 — Game State Schema
1. Player — God Object (~175 полей)
2. Дублирование: `talentChoicePressed` и `talentChoicePressed2`
3. `abilityCooldownTick` — вероятно deprecated
4. `phase` как string вместо enum
5. Default-значения в Schema vs balance.json (Projectile.radius=8, Mine.damagePct=0.15)
6. Отсутствие типизации для chest.type и projectileType
7. SafeZone без id (ArraySchema вместо MapSchema)

#### Модуль 03 — ArenaRoom Lifecycle
1. **[КРИТ]** `deathCount: 0` — метрика не реализована
2. **[КРИТ]** `totalBubblesCollected: 0` — метрика не реализована
3. **[КРИТ]** Нет reconnect — onLeave удаляет игрока
4. Захардкоженные buildVersion/configVersion ("0.3.1")
5. `classAbilities` дублированы (стр. 233 и 434)
6. `maxTalentQueue = 3` не используется
7. `collectInputs()` — noop метод
8. Монолитные inline-методы (updatePlayerFlags, applyInputs, orbOrbCollisions)
9. `"Spawn"` вне MatchPhaseId
10. `matchIndex` инкрементируется, но не используется

#### Модуль 04 — Физика и движение
1. Три реализации `clamp()` и две `normalizeAngle()` (потенциальные расхождения)
2. 6 неиспользуемых полей конфига (collisionRestitution, collisionImpulseCap, environmentDrag, slimeLinearDamping, maxSlimeSpeed, maxOrbSpeed)
3. Нет CCD (Continuous Collision Detection) — возможно туннелирование
4. Монолитный ArenaRoom — коллизионные методы зависят от room
5. Итеративный решатель без warm-starting (4 итерации)
6. Inconsistent rect wall reflection (другая формула чем для объектов)

#### Модуль 05 — Боевая система
1. Все системы типизированы как `any`
2. Захардкоженные множители (scatter 0.5, magnet force 2, death orb speed 150)
3. SafeZone `finalStartSec=120` при матче 90 сек — мёртвый код
4. Hunger scaling слишком слабый (0.01 разница на 900 кг)
5. Bomb без knockback (только урон)
6. Self damage без модификаторов (намеренно?)
7. Rebel система — только назначает rebelId, нет бонусов/штрафов

#### Модуль 06 — Способности и таланты
1. **sense и regeneration** — мёртвые таланты (можно выбрать, эффект не работает)
2. **momentum, berserk, symbiosisBubbles** — не определены
3. Дублирование `invisible` и `hunterInvisible`
4. `pull`/`magnet` — двойной маппинг
5. push визуальная длительность захардкожена
6. applyPushWave — захардкоженные лимиты для орбов и сундуков
7. respawnMass перезаписывает вместо += (последний talent выигрывает)
8. Типизация `any` во всех системах
9. magnet maxLevel=1 (GDD описывает 2 уровня)

#### Модуль 07 — Сундуки и зоны
1. **[P1]** Нет TTL сундуков (GDD: 35 сек)
2. **[P1]** Нет проверки расстояния при спавне сундуков
3. Нет типоспецифичной физики сундуков
4. Нет валидации проходимости арены
5. Нет ограничения площади зон
6. `getZoneForPlayer` — возвращает только первую зону
7. Захардкоженные spreadSpeed=150, spread=30
8. Нет ограничения массы для узких проходов
9. spawnIntervalSec фиксирован (20), GDD: 18–26

#### Модуль 08 — Аутентификация
1. **[P0]** Yandex JWT без верификации подписи
2. **[P0]** CrazyGames JWT без верификации подписи
3. **[P0]** OAuth state parameter не реализован
4. Rate limiter в памяти (не работает при нескольких инстансах)
5. Двойная система auth (session + JWT)
6. `UNKNOWN` регион разрешает Google (TODO в коде)
7. Poki и GameDistribution — client-trusted auth
8. DevAuthProvider без проверки NODE_ENV
9. AuthProvider тип ограничен 3 платформами (реально 7)
10. Вложенный JWT в upgradePrepareToken

#### Модуль 09 — Экономика
1. **[P0]** Нет server-side ad validation
2. **[P0]** Level-up не срабатывает при XP claim
3. **[P0]** Нет проверки paymentsEnabled kill switch
4. **[P1]** Нет проверки adsRewardEnabled kill switch
5. **[P1]** Нет проверки владения скином
6. **[P1]** Нет лимитов на рекламу (ads_watched_today не используется)
7. **[P1]** Транзакции без DB-level UNIQUE constraint
8. **[P1]** Webhooks без signature verification
9. **[P1]** pre_checkout_query всегда accept
10. Нет кеширования leaderboard
11. `reward.type === 'item'` не реализован
12. Нет сезонной системы
13. YandexPayProvider.refundPayment не отзывает предметы
14. Matchmaking: линейный поиск O(N)
15. Fallback URL захардкожен (не актуальный домен)

#### Модуль 10 — Админка, аналитика, A/B
1. **[P0]** A/B без salt
2. **[P0]** Нет configVersion в аналитических событиях
3. **[P0]** Config public routes без auth
4. A/B назначения не персистируются (Redis TTL 24h)
5. A/B нет state machine валидации (произвольные переходы)
6. Rate limiter in-memory
7. Analytics trackToRedis не используется
8. AdsService item reward не реализован
9. GeoIP кеш без max size
10. CORS фактически разрешает всё

#### Модуль 11 — Клиент: game loop
1. main.ts — God Object (3985 строк)
2. Нет DPR-масштабирования (размытость на Retina)
3. Inline DOM creation вместо Preact
4. Нет формальной Camera class
5. Дублирование captureSnapshot
6. Нет frustum culling для minimap
7. Sprite loading без retry/error
8. Нет frame time budget monitoring
9. splice в цикле эффектов — O(n)
10. joystick followSpeed не используется

#### Модуль 12 — Клиентские сервисы
1. VK OAuth не реализован (есть в OAuthProviderName)
2. IPaymentProvider и ISocialProvider отсутствуют
3. UIFacade не реализован
4. PKCE не используется (возвращает null)
5. Двойное хранение токена (authService + metaServerClient)
6. ConfigService: нет event-based обновления (только polling 5 мин)
7. MatchmakingService: HTTP polling вместо WebSocket/SSE
8. LeaderboardService: жёсткий кеш 30 сек

#### Модуль 13 — Клиент UI
1. Валюта-заглушка (coins/gems всегда 0)
2. Settings/Skins — заглушки без функционала
3. XP прогресс захардкожен (/1000)
4. ScreenManager не используется (есть но не интегрирован)
5. renderUI() вызывается императивно
6. Отсутствие i18n (все строки на русском)
7. Нет выбора класса на ResultsScreen (GDD требует)
8. playerCount и serverUrl signals не используются

#### Модуль 14 — Платформенные адаптеры
1. **[P1]** IPaymentProvider не реализован
2. **[P1]** ISocialProvider не реализован
3. TelegramAdsProvider.showAd — нестандартный API
4. GameDistribution gameId пустой
5. Дублирование generateUserId() (3 адаптера)
6. Дублирование localStorage-паттерна (3 адаптера)
7. providerPayload не заполняется ни одним провайдером
8. Нет interstitial ads API
9. Смешение языков в логах

#### Модуль 15 — Инфраструктура
1. Нет таблицы миграций (schema_migrations)
2. Пропущена нумерация миграций 003–006
3. Захардкоженные credentials в supervisord.conf
4. Node 18 в CI vs Node 20 в Docker
5. make-packages-public.yml устарел
6. Телеметрия пишет синхронно (fs.appendFileSync)
7. Redis без reconnect strategy
8. PG Pool max=20 захардкожен
9. Нет тестов в CI (только build)
10. purchase_receipts: деструктивная миграция (DROP COLUMN)
11. Дублирование config/ в Dockerfile
12. Версия в корневом package.json (0.8.6) ≠ workspaces (0.8.7)
13. Нет health check для Redis

#### Модуль 16 — Admin Dashboard
1. Глобальные сигналы без очистки при unmount
2. Нет URL-роутинга (нельзя поделиться ссылкой)
3. Emoji иконки в TabBar
4. Нет i18n (смесь ru/en)
5. Нет WebSocket/SSE для real-time (polling 5s)
6. Audit details — raw JSON без форматирования
7. Нет поиска/фильтрации в аудит-логе
8. Нет управления пользователями/админами
9. Нет runtime config editing
10. CSS без modules (глобальные стили)

---

## 5. Статистика по модулям

| Модуль | Расхождений | Тех. долг | P0 | P1 |
|--------|:-----------:|:---------:|:--:|:--:|
| 01 — Shared Foundation | 18 | 10 | 4 | 6 |
| 02 — Game State Schema | 5 | 8 | 0 | 1 |
| 03 — ArenaRoom Lifecycle | 6 | 14 | 1 | 4 |
| 04 — Physics & Movement | 11 | 6 | 0 | 2 |
| 05 — Combat System | 14 | 10 | 1 | 2 |
| 06 — Abilities & Talents | 13 | 9 | 0 | 2 |
| 07 — Chests & Zones | 17 | 9 | 0 | 3 |
| 08 — Auth & Identity | 12 | 12 | 3 | 2 |
| 09 — Economy | 27 | 18 | 3 | 6 |
| 10 — Admin, Analytics, A/B | 14 | 14 | 3 | 4 |
| 11 — Client Game Loop | 5 | 10 | 0 | 1 |
| 12 — Client Services | 8 | 12 | 0 | 2 |
| 13 — Client UI | 17 | 15 | 0 | 5 |
| 14 — Client Platforms | 5 | 10 | 0 | 2 |
| 15 — Infrastructure | 15 | 13 | 0 | 1 |
| 16 — Admin Dashboard | 6 | 12 | 0 | 0 |
| **ИТОГО** | **~193** | **~182** | **15** | **43** |

---

## Заключение

Кодовая база v0.8.7 значительно разошлась с архитектурной документацией (v4.2.5) и GDD (v3.3.2). Основные категории расхождений:

1. **Безопасность (8 P0)** — отсутствие верификации JWT/webhooks, client-trusted auth, CSRF. Требует немедленного исправления перед soft-launch.

2. **Баланс vs GDD (9 P0)** — значения в balance.json радикально отличаются от GDD (matсh 90 vs 180 сек, torque 137×). Нужно решить: обновить GDD или вернуть баланс к GDD-значениям.

3. **Нереализованные фичи (10 P1)** — BattlePass, Achievements, DailyRewards, IPaymentProvider, ISocialProvider, Glicko-2, сезоны. Определить scope для soft-launch.

4. **Архитектурный дрифт** — монолитные God Objects (ArenaRoom 2800 строк, main.ts 3985 строк, Player 175 полей), два параллельных механизма конфигурации, двойная auth-система.

5. **Документация устарела** — techContext.md ссылается на Prisma (используется raw pg), systemPatterns.md описывает 16 систем (реально 24), Part4 auth API не покрывает 80% реальных endpoints.
