# Code Review Prompt — Sprite System Redesign

> Передай этот промпт внешнему ИИ-агенту (ChatGPT, Gemini, Claude в отдельной сессии, Cursor и т.п.) для независимого ревью.

---

## Роль

Ты — Senior Code Reviewer для проекта **Slime Arena** (мультиплеерная HTML5-игра). Проведи ревью двух коммитов: `03de755` и `e1aad77` — редизайн системы спрайтов + исправление LAN-доступа в dev-режиме.

## Контекст проекта

- **Стек:** Colyseus (сервер) + Preact + Canvas 2D (клиент) + Express (мета-API) + PostgreSQL
- **Архитектура:** монорепозиторий с `client/`, `server/`, `shared/`
- **Критичное правило — детерминизм:** в коде симуляции (`server/src/rooms/`) **запрещены** `Math.random()`, `Date.now()`. В мета-слое (`server/src/meta/`) — допустимы.
- **Баланс:** все числовые константы в `config/balance.json`, не хардкодить в коде.
- **БД:** PostgreSQL. Поле `profiles.selected_skin_id` хранит идентификатор скина/спрайта.
- **Спрайты:** 21 файл `.webp` в `assets-dist/sprites/slimes/base/`.

## Проблема

Визуальный спрайт игрока (самурай, пират, дракон и т.д.) определялся хешем имени на клиенте (`pickSpriteForPlayer(name)`), но в профиле сохранялся **цветной skinId** из `config/skins.json` (4 цвета: `slime_green`, `slime_blue`, `slime_red`, `slime_yellow`). Две системы не были связаны:
- В матче игрок видел «самурая» → регистрировался → в профиле записывался `slime_green`
- В следующем матче мог получить другой спрайт
- Лидерборд показывал цветной кружок вместо спрайта
- `config/skins.json` был ошибочным артефактом — цветные скины не существуют как ассеты

## Решение

Заменить цветную skinId-систему на спрайтовую:
1. `SPRITE_NAMES` — единый массив из 21 имени файла спрайта в `shared/`
2. `spriteId` синхронизируется через Colyseus (JoinToken → Player schema → клиент)
3. Для ботов и анонимов — детерминированный выбор по хешу имени (`pickSpriteByName`)
4. Для зарегистрированных — из `profiles.selected_skin_id`
5. Удалён `config/skins.json` и все зависимости

## Что входит в коммиты

2 коммита, 17 файлов (без docs/), +214 / −753 строк. Группы изменений:

| # | Компонент | Описание |
|---|-----------|----------|
| 1 | `shared/src/sprites.ts` | Добавлен `SPRITE_NAMES`, `hashString`, `pickSpriteByName`, `isValidSprite` |
| 2 | `shared/src/index.ts` | Экспорт новых функций |
| 3 | `server/src/rooms/schema/GameState.ts` | `spriteId` в Player schema (Colyseus sync) |
| 4 | `server/src/meta/services/JoinTokenService.ts` | `spriteId` в JoinTokenPayload |
| 5 | `server/src/rooms/ArenaRoom.ts` | Передача `spriteId` из payload в Player |
| 6 | `server/src/meta/routes/auth.ts` | Замена `generateRandomBasicSkin()` → `pickSpriteByName()` |
| 7 | `server/src/meta/routes/matchResults.ts` | Валидация через `isValidSprite()` вместо `getBasicSkins()` |
| 8 | `server/src/meta/routes/leaderboard.ts` | SQL fallback `'slime-base.webp'` вместо `'slime_green'` |
| 9 | `client/src/main.ts` | Приоритет `player.spriteId`, fallback на хеш, удалён дублирующий массив |
| 10 | `client/src/services/authService.ts` | Гостевой скин из `SPRITE_NAMES` вместо 4 цветов |
| 11 | `client/src/api/metaServerClient.ts` | LAN-фикс: DEV-режим всегда через Vite proxy |
| 12 | `client/src/ui/components/LeaderboardScreen.tsx` | Иконка спрайта вместо цветного кружка |
| 13 | Удалено: `config/skins.json` | Ошибочный артефакт цветных скинов (88 строк) |
| 14 | Удалено: `server/src/meta/utils/skinGenerator.ts` | `generateRandomBasicSkin()` (29 строк) |
| 15 | Удалено: `server/src/utils/generators/skinGenerator.ts` | `getBasicSkins()`, `skinExists()` и т.д. (107 строк) |
| 16 | Удалено: `server/tests/skin-generator.test.js` | Тесты для удалённого генератора (253 строки) |

## Критерии ревью

Проверь по трём направлениям:

### 1. Безопасность
- Валидация `skinId` от клиента (инъекция / подмена премиумных скинов)
- SQL-инъекция через имена таблиц/колонок (leaderboard.ts)
- Путь к файлу спрайта в `<img src>` — возможен path traversal?
- JWT payload: можно ли подменить `spriteId` в joinToken?

### 2. Архитектура
- Единый источник правды `SPRITE_NAMES` в shared — корректно ли используется?
- Поток данных spriteId: JoinToken → ArenaRoom → Player → Client — нет ли разрывов?
- Обратная совместимость: старые записи в БД с `slime_green` — обработаны?
- Дублирование кода — есть ли?

### 3. Корректность
- `hashString()` — корректен ли хеш (overflow, пустая строка)?
- `pickSpriteByName()` — равномерное распределение по 21 спрайту?
- `onChange` в main.ts — race condition при синхронизации spriteId?
- Fallback-цепочки — покрыты ли все edge cases (пустой spriteId, невалидный, null)?
- LAN-фикс: не ломает ли production-поведение?

## Diff

```diff
diff --git a/client/src/api/metaServerClient.ts b/client/src/api/metaServerClient.ts
index eea5680..10b3896 100644
--- a/client/src/api/metaServerClient.ts
+++ b/client/src/api/metaServerClient.ts
@@ -31,8 +31,8 @@ const getMetaServerUrl = () => {
   if (typeof window !== 'undefined') {
     const hostname = window.location.hostname;

-    // Dev-режим: localhost — Vite proxy работает, используем относительные пути
-    if (import.meta.env?.DEV && hostname === 'localhost') {
+    // Dev-режим: Vite proxy работает для всех хостов (localhost и LAN IP)
+    if (import.meta.env?.DEV) {
       return '';
     }

@@ -59,11 +59,12 @@ const IS_PROXY_MODE = (() => {
   if (import.meta.env?.VITE_META_SERVER_URL) return false;
   if (typeof window === 'undefined') return false;

+  // DEV: Vite proxy работает для всех хостов (localhost, LAN IP)
+  if (import.meta.env?.DEV) return true;
+
   const hostname = window.location.hostname;
-  // DEV + localhost: Vite proxy
-  if (import.meta.env?.DEV && hostname === 'localhost') return true;
   // Production + домен (не IP): обратный прокси-сервер
-  if (!import.meta.env?.DEV && !isIPAddress(hostname) && hostname !== 'localhost') return true;
+  if (!isIPAddress(hostname) && hostname !== 'localhost') return true;

   return false;
 })();
diff --git a/client/src/main.ts b/client/src/main.ts
index 729835c..c50ade8 100644
--- a/client/src/main.ts
+++ b/client/src/main.ts
@@ -23,6 +23,7 @@ import {
     OBSTACLE_TYPE_SPIKES,
     clamp,
     generateRandomName,
+    SPRITE_NAMES,
 } from "@slime-arena/shared";
 import {
     type JoystickState,
@@ -686,29 +687,8 @@ const logJoystick = (label: string, payload: Record<string, unknown> = {}) => {
     console.log(`[joystick] ${label}`, { t: now, ...payload, ...state });
 };

-const slimeSpriteNames = [
-    "slime-angrybird.webp",
-    "slime-astronaut.webp",
-    "slime-base.webp",
-    "slime-cccp.webp",
-    "slime-crazy.webp",
-    "slime-crystal.webp",
-    "slime-cyberneon.webp",
-    "slime-frost.webp",
-    "slime-greeendragon.webp",
-    "slime-mecha.webp",
-    "slime-pinklove.webp",
-    "slime-pirate.webp",
-    "slime-pumpkin.webp",
-    "slime-reddragon.webp",
-    "slime-redfire.webp",
-    "slime-samurai.webp",
-    "slime-shark.webp",
-    "slime-tomato.webp",
-    "slime-toxic.webp",
-    "slime-wizard.webp",
-    "slime-zombi.webp",
-];
+// Используем SPRITE_NAMES из shared — единый источник правды
+const slimeSpriteNames = SPRITE_NAMES;
 const baseUrl = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
 const assetBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
 const spriteCache = new Map<
@@ -1973,14 +1953,18 @@ async function connectToServer(playerName: string, classId: number) {
                 refreshTalentModal();
                 player.onChange(() => refreshTalentModal());
             }
-            // Выбираем спрайт по имени (или обновим когда имя придёт)
-            if (player.name) {
+            // Спрайт: приоритет spriteId из Colyseus, fallback на хеш имени
+            if (player.spriteId) {
+                playerSpriteById.set(sessionId, player.spriteId);
+            } else if (player.name) {
                 playerSpriteById.set(sessionId, pickSpriteForPlayer(player.name));
             }

             player.onChange(() => {
-                // Обновляем спрайт когда имя изменилось
-                if (player.name && !playerSpriteById.has(sessionId)) {
+                // spriteId с сервера всегда приоритетнее — перезаписываем даже fallback
+                if (player.spriteId && playerSpriteById.get(sessionId) !== player.spriteId) {
+                    playerSpriteById.set(sessionId, player.spriteId);
+                } else if (!playerSpriteById.has(sessionId) && player.name) {
                     playerSpriteById.set(sessionId, pickSpriteForPlayer(player.name));
                 }
             });
diff --git a/client/src/services/authService.ts b/client/src/services/authService.ts
index d4ab415..a3aa3ee 100644
--- a/client/src/services/authService.ts
+++ b/client/src/services/authService.ts
@@ -21,7 +21,7 @@ import {
   type Profile,
 } from '../ui/signals/gameState';
 import balanceConfig from '../../../config/balance.json';
-import { GUEST_DEFAULT_NICKNAME } from '@slime-arena/shared';
+import { GUEST_DEFAULT_NICKNAME, SPRITE_NAMES } from '@slime-arena/shared';

 /**
  * Ответ сервера на /auth/guest
@@ -472,11 +472,10 @@ class AuthService {
   }

   /**
-   * Генерация случайного скина для гостя.
+   * Генерация спрайта для гостя — случайный из SPRITE_NAMES.
    */
   private generateGuestSkinId(): string {
-    const basicSkins = ['slime_green', 'slime_blue', 'slime_red', 'slime_yellow'];
-    return basicSkins[Math.floor(Math.random() * basicSkins.length)];
+    return SPRITE_NAMES[Math.floor(Math.random() * SPRITE_NAMES.length)];
   }

   /**
@@ -639,10 +638,10 @@ class AuthService {
   }

   /**
-   * Получить ID выбранного скина.
+   * Получить ID выбранного спрайта.
    */
   getSkinId(): string {
-    return localStorage.getItem('selected_skin_id') || localStorage.getItem('guest_skin_id') || 'slime_green';
+    return localStorage.getItem('selected_skin_id') || localStorage.getItem('guest_skin_id') || SPRITE_NAMES[0];
   }

   /**
@@ -653,9 +652,10 @@ class AuthService {
    */
   async getRoomJoinToken(nickname: string): Promise<string | null> {
     try {
+      const skinId = this.getSkinId();
       const response = await metaServerClient.post<{ joinToken: string; expiresIn: number }>(
         '/api/v1/auth/join-token',
-        { nickname }
+        { nickname, skinId }
       );
       console.log('[AuthService] Room join token obtained');
       return response.joinToken;
diff --git a/client/src/ui/components/LeaderboardScreen.tsx b/client/src/ui/components/LeaderboardScreen.tsx
index 085e95b..aea03d4 100644
--- a/client/src/ui/components/LeaderboardScreen.tsx
+++ b/client/src/ui/components/LeaderboardScreen.tsx
@@ -804,12 +804,21 @@ export function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
                       } ${isHighlighted ? 'is-user-highlighted' : ''}`}
                     >
                       <div class="leaderboard-place">{entry.place}</div>
-                      {/* LB-013: Миниатюра скина */}
-                      <div
-                        class="leaderboard-skin"
-                        style={{ backgroundColor: getSkinColor(entry.skinId) }}
-                        title={entry.skinId || 'Скин'}
-                      />
+                      {/* LB-013: Миниатюра скина — иконка спрайта или цветной круг */}
+                      {entry.skinId?.endsWith('.webp') ? (
+                        <img
+                          class="leaderboard-skin"
+                          src={`sprites/slimes/base/${entry.skinId}`}
+                          alt={entry.skinId}
+                          loading="lazy"
+                        />
+                      ) : (
+                        <div
+                          class="leaderboard-skin"
+                          style={{ backgroundColor: getSkinColor(entry.skinId) }}
+                          title={entry.skinId || 'Скин'}
+                        />
+                      )}
                       <div class="leaderboard-info">
                         <div class="leaderboard-name">{getDisplayNickname(entry.nickname, entry.userId)}</div>
                         {entry.gamesPlayed !== undefined && (
diff --git a/config/skins.json b/config/skins.json
deleted file mode 100644
index 01ef5d8..0000000
--- a/config/skins.json
+++ /dev/null
@@ -1,88 +0,0 @@
-{
-  "skins": [
-    { "id": "slime_green", "name": "Зелёный слайм", "tier": "basic", "price": 0, "color": "#10b981" },
-    { "id": "slime_blue", "name": "Синий слайм", "tier": "basic", "price": 0, "color": "#3b82f6" },
-    { "id": "slime_red", "name": "Красный слайм", "tier": "basic", "price": 0, "color": "#ef4444" },
-    { "id": "slime_yellow", "name": "Жёлтый слайм", "tier": "basic", "price": 0, "color": "#fbbf24" },
-    { "id": "slime_pink", "name": "Розовый слайм", "tier": "basic", "price": 0, "color": "#ec4899" },
-    { "id": "slime_purple", "name": "Фиолетовый слайм", "tier": "basic", "price": 0, "color": "#a855f7" },
-    { "id": "slime_orange", "name": "Оранжевый слайм", "tier": "basic", "price": 0, "color": "#f97316" },
-    { "id": "slime_cyan", "name": "Бирюзовый слайм", "tier": "basic", "price": 0, "color": "#06b6d4" },
-    { "id": "slime_lime", "name": "Лаймовый слайм", "tier": "basic", "price": 0, "color": "#84cc16" },
-    { "id": "slime_teal", "name": "Бирюзово-зелёный слайм", "tier": "basic", "price": 0, "color": "#14b8a6" },
-    { "id": "slime_gold", "name": "Золотой слайм", "tier": "rare", "price": 500, "color": "#f59e0b" },
-    { "id": "slime_rainbow", "name": "Радужный слайм", "tier": "epic", "price": 1000, "color": "#ff00ff" }
-  ]
-}
diff --git a/server/src/meta/routes/auth.ts b/server/src/meta/routes/auth.ts
index 4a421e5..9dac223 100644
--- a/server/src/meta/routes/auth.ts
+++ b/server/src/meta/routes/auth.ts
@@ -27,8 +27,7 @@ import { getPostgresPool } from '../../db/pool';
 import { getRedisClient } from '../../db/redis';
 import { authRateLimiter, oauthRateLimiter } from '../middleware/rateLimiter';
 import { validateAndNormalize, normalizeNickname, NICKNAME_MAX_LENGTH } from '../../utils/generators/nicknameValidator';
-import { GUEST_DEFAULT_NICKNAME } from '@slime-arena/shared';
-import { generateRandomBasicSkin } from '../utils/skinGenerator';
+import { GUEST_DEFAULT_NICKNAME, pickSpriteByName, isValidSprite } from '@slime-arena/shared';

 const router = express.Router();

@@ -164,12 +163,21 @@ router.post('/join-token', async (req: Request, res: Response) => {
           // Невалидный nickname — используем fallback
         }
       }
+      // spriteId из body (клиент передаёт guest_skin_id), валидация + fallback по хешу имени
+      let spriteId: string | undefined;
+      if (req.body.skinId && typeof req.body.skinId === 'string' && isValidSprite(req.body.skinId)) {
+        spriteId = req.body.skinId;
+      } else {
+        spriteId = pickSpriteByName(nickname);
+      }
+
       const joinToken = joinTokenService.generateToken(
         '', // userId (empty for guests)
         '', // matchId (not known yet)
         '', // roomId (not known yet)
         nickname,
-        guestPayload.sub // guestSubjectId for claim verification
+        guestPayload.sub, // guestSubjectId for claim verification
+        spriteId
       );

       return res.json({
@@ -192,11 +200,33 @@ router.post('/join-token', async (req: Request, res: Response) => {
           // Невалидный nickname — используем fallback
         }
       }
+      // Получаем spriteId из профиля зарегистрированного пользователя
+      let spriteId: string | undefined;
+      try {
+        const pool = getPostgresPool();
+        const profileResult = await pool.query(
+          'SELECT selected_skin_id FROM profiles WHERE user_id = $1',
+          [userPayload.sub]
+        );
+        if (profileResult.rows.length > 0 && profileResult.rows[0].selected_skin_id
+            && isValidSprite(profileResult.rows[0].selected_skin_id)) {
+          spriteId = profileResult.rows[0].selected_skin_id;
+        }
+      } catch (err) {
+        console.warn('[Auth] Failed to fetch spriteId from profile:', err);
+      }
+      // Fallback: хеш от никнейма
+      if (!spriteId) {
+        spriteId = pickSpriteByName(nickname);
+      }
+
       const joinToken = joinTokenService.generateToken(
         userPayload.sub, // userId
         '', // matchId
         '', // roomId
-        nickname
+        nickname,
+        undefined, // guestSubjectId
+        spriteId
       );

       return res.json({
@@ -470,7 +500,7 @@ router.post('/oauth', async (req: Request, res: Response) => {
         nickname = `User${Date.now() % 100000}`;
       }

-      const skinId = generateRandomBasicSkin();
+      const skinId = pickSpriteByName(nickname);

       try {
         user = await authService.createUserFromOAuth(
@@ -1091,7 +1121,7 @@ router.post('/upgrade', async (req: Request, res: Response) => {
         }
       } else {
         // Путь без claimToken — гость регистрируется без матча (slime-arena-ias0)
-        const skinForUser = generateRandomBasicSkin();
+        const skinForUser = pickSpriteByName(finalNickname);
         user = await authService.createUserFromOAuth(
           finalProvider as AuthProvider,
           providerUserId,
diff --git a/server/src/meta/routes/leaderboard.ts b/server/src/meta/routes/leaderboard.ts
index 2de762e..4283619 100644
--- a/server/src/meta/routes/leaderboard.ts
+++ b/server/src/meta/routes/leaderboard.ts
@@ -127,7 +127,7 @@ async function getLeaderboardEntries(
        ROW_NUMBER() OVER (ORDER BY lb.${valueColumn} DESC, lb.updated_at DESC) as position,
        lb.user_id,
        u.nickname,
-       COALESCE(p.selected_skin_id, 'slime_green') as skin_id,
+       COALESCE(p.selected_skin_id, 'slime-base.webp') as skin_id,
        lb.${valueColumn} as value
        ${matchesPlayedColumn}
      FROM ${table} lb
diff --git a/server/src/meta/routes/matchResults.ts b/server/src/meta/routes/matchResults.ts
index e867e79..9fe09caf 100644
--- a/server/src/meta/routes/matchResults.ts
+++ b/server/src/meta/routes/matchResults.ts
@@ -13,8 +13,7 @@ import {
 import { loadBalanceConfig } from '../../config/loadBalanceConfig';
 import { ratingService } from '../services/RatingService';
 import { authRateLimiter } from '../middleware/rateLimiter';
-import { generateRandomBasicSkin } from '../utils/skinGenerator';
-import { getBasicSkins } from '../../utils/generators/skinGenerator';
+import { pickSpriteByName, isValidSprite } from '@slime-arena/shared';

 const router = express.Router();

@@ -369,11 +368,9 @@ router.post('/claim', authRateLimiter, async (req: Request, res: Response) => {
     // Get skinId: for registered users fetch from profile, for guests use from request body
     let skinId: string | undefined;
     if (isGuest) {
-      // Гости передают skinId из localStorage через request body
-      // Валидация: принимаем только базовые скины (защита от подмены премиумных)
-      const basicSkinIds = getBasicSkins().map(s => s.id);
+      // Гости передают skinId (имя спрайта) из localStorage через request body
       if (req.body.skinId && typeof req.body.skinId === 'string'
-          && req.body.skinId.length <= 64 && basicSkinIds.includes(req.body.skinId)) {
+          && req.body.skinId.length <= 64 && isValidSprite(req.body.skinId)) {
         skinId = req.body.skinId;
       }
     } else if (subjectId) {
@@ -381,19 +378,15 @@ router.post('/claim', authRateLimiter, async (req: Request, res: Response) => {
         'SELECT selected_skin_id FROM profiles WHERE user_id = $1',
         [subjectId]
       );
-      if (profileResult.rows.length > 0 && profileResult.rows[0].selected_skin_id) {
+      if (profileResult.rows.length > 0 && profileResult.rows[0].selected_skin_id
+          && isValidSprite(profileResult.rows[0].selected_skin_id)) {
         skinId = profileResult.rows[0].selected_skin_id;
       }
     }

-    // Fallback: если skinId не определён — генерируем случайный базовый скин
+    // Fallback: хеш от subjectId (детерминированный выбор спрайта)
     if (!skinId) {
-      try {
-        skinId = generateRandomBasicSkin();
-      } catch (err) {
-        console.warn('[MatchResults] generateRandomBasicSkin() failed, using slime_green:', err);
-        skinId = 'slime_green';
-      }
+      skinId = pickSpriteByName(subjectId || 'unknown');
     }

     // Generate claimToken
diff --git a/server/src/meta/services/JoinTokenService.ts b/server/src/meta/services/JoinTokenService.ts
index 23c5dc8..ef7d91c 100644
--- a/server/src/meta/services/JoinTokenService.ts
+++ b/server/src/meta/services/JoinTokenService.ts
@@ -12,6 +12,8 @@ export interface JoinTokenPayload {
   matchId: string;
   roomId: string;
   nickname: string;
+  /** Имя файла спрайта (например "slime-samurai.webp") */
+  spriteId?: string;
   /** Guest subject ID (UUID) for standalone guests - used for match claim verification */
   guestSubjectId?: string;
   /** Token issue time (Unix timestamp) */
@@ -74,7 +76,7 @@ export class JoinTokenService {
    * @param nickname - Player nickname
    * @param guestSubjectId - Guest subject ID (UUID) for standalone guests
    */
-  generateToken(userId: string, matchId: string, roomId: string, nickname: string, guestSubjectId?: string): string {
+  generateToken(userId: string, matchId: string, roomId: string, nickname: string, guestSubjectId?: string, spriteId?: string): string {
     const payload: JoinTokenPayload = {
       userId,
       matchId,
@@ -82,6 +84,11 @@ export class JoinTokenService {
       nickname,
     };

+    // Add spriteId only if provided
+    if (spriteId) {
+      payload.spriteId = spriteId;
+    }
+
     // Add guestSubjectId only if provided (for standalone guests)
     if (guestSubjectId) {
       payload.guestSubjectId = guestSubjectId;
diff --git a/server/src/meta/utils/skinGenerator.ts b/server/src/meta/utils/skinGenerator.ts
deleted file mode 100644
index eb2ee30..0000000
--- a/server/src/meta/utils/skinGenerator.ts
+++ /dev/null
@@ -1,29 +0,0 @@
-/**
- * Генератор случайных скинов для мета-сервера.
- * Использует Math.random() — это допустимо,
- * поскольку вызывается ТОЛЬКО из мета-слоя.
- */
-import { getBasicSkins } from '../../utils/generators/skinGenerator';
-
-export function generateRandomBasicSkin(): string {
-  const basicSkins = getBasicSkins();
-  if (basicSkins.length === 0) {
-    throw new Error('No basic skins found in config/skins.json');
-  }
-  const randomIndex = Math.floor(Math.random() * basicSkins.length);
-  return basicSkins[randomIndex].id;
-}
diff --git a/server/src/rooms/ArenaRoom.ts b/server/src/rooms/ArenaRoom.ts
index d527467..21e6fd3 100644
--- a/server/src/rooms/ArenaRoom.ts
+++ b/server/src/rooms/ArenaRoom.ts
@@ -380,7 +380,7 @@ export class ArenaRoom extends Room<GameState> {
             ? authPayload.nickname
             : null;

-        // Extract userId and guestSubjectId from joinToken for match results (server-only)
+        // Extract userId, guestSubjectId, spriteId from joinToken (server-only)
         if (authPayload && typeof authPayload === 'object') {
             if (authPayload.userId) {
                 player.userId = authPayload.userId;
@@ -388,6 +388,9 @@ export class ArenaRoom extends Room<GameState> {
             if (authPayload.guestSubjectId) {
                 player.guestSubjectId = authPayload.guestSubjectId;
             }
+            if (authPayload.spriteId) {
+                player.spriteId = authPayload.spriteId;
+            }
         }

         // Priority: token nickname > options.name > generated name
diff --git a/server/src/rooms/schema/GameState.ts b/server/src/rooms/schema/GameState.ts
index 49e7b7e..18747a1 100644
--- a/server/src/rooms/schema/GameState.ts
+++ b/server/src/rooms/schema/GameState.ts
@@ -28,6 +28,7 @@ export class AbilityCard extends Schema {
 export class Player extends Schema {
     @type("string") id: string = "";
     @type("string") name: string = "";
+    @type("string") spriteId: string = "";
     @type("number") x: number = 0;
     @type("number") y: number = 0;
     @type("number") vx: number = 0;
diff --git a/server/src/utils/generators/skinGenerator.ts b/server/src/utils/generators/skinGenerator.ts
deleted file mode 100644
index b919314..0000000
--- a/server/src/utils/generators/skinGenerator.ts
+++ /dev/null
@@ -1,107 +0,0 @@
-/**
- * Генератор скинов, зависящий от config/skins.json.
- * Удалён вместе с config/skins.json — заменён на SPRITE_NAMES из shared.
- */
-(полный файл — 107 строк, загрузка конфига, getBasicSkins, generateBasicSkin, skinExists, getSkinById)
diff --git a/server/tests/skin-generator.test.js b/server/tests/skin-generator.test.js
deleted file mode 100644
index 948d2ca..0000000
--- a/server/tests/skin-generator.test.js
+++ /dev/null
@@ -1,253 +0,0 @@
-(полный файл — 253 строки тестов для удалённого skinGenerator)
diff --git a/shared/src/index.ts b/shared/src/index.ts
index 19e11a0..c6349d3 100644
--- a/shared/src/index.ts
+++ b/shared/src/index.ts
@@ -53,6 +53,10 @@ export {
 } from "./constants";
 export type { SlimeSprite } from "./sprites";
 export {
+    SPRITE_NAMES,
+    hashString,
+    pickSpriteByName,
+    isValidSprite,
     SLIME_SPRITES,
     SPRITE_SIZE,
     SPRITE_CACHE,
diff --git a/shared/src/sprites.ts b/shared/src/sprites.ts
index 9d0975d..95bc0b9 100644
--- a/shared/src/sprites.ts
+++ b/shared/src/sprites.ts
@@ -1,5 +1,62 @@
 // Sprite-related constants and utilities for slime skins

+/**
+ * Все доступные имена спрайтов слаймов (файлы из assets-dist/sprites/slimes/base/).
+ */
+export const SPRITE_NAMES: readonly string[] = [
+    "slime-angrybird.webp",
+    "slime-astronaut.webp",
+    "slime-base.webp",
+    "slime-cccp.webp",
+    "slime-crazy.webp",
+    "slime-crystal.webp",
+    "slime-cyberneon.webp",
+    "slime-frost.webp",
+    "slime-greeendragon.webp",
+    "slime-mecha.webp",
+    "slime-pinklove.webp",
+    "slime-pirate.webp",
+    "slime-pumpkin.webp",
+    "slime-reddragon.webp",
+    "slime-redfire.webp",
+    "slime-samurai.webp",
+    "slime-shark.webp",
+    "slime-tomato.webp",
+    "slime-toxic.webp",
+    "slime-wizard.webp",
+    "slime-zombi.webp",
+] as const;
+
+/**
+ * Хеш-функция для детерминированного выбора спрайта по имени.
+ */
+export function hashString(str: string): number {
+    let h = 0;
+    for (let i = 0; i < str.length; i++) {
+        h = (h * 31 + str.charCodeAt(i)) >>> 0;
+    }
+    return h;
+}
+
+/**
+ * Детерминированный выбор спрайта по имени игрока (хеш).
+ * Используется для ботов, анонимов и как fallback.
+ */
+export function pickSpriteByName(playerName: string): string {
+    const name = playerName || 'Unknown';
+    const hash = hashString(name);
+    return SPRITE_NAMES[hash % SPRITE_NAMES.length];
+}
+
+/**
+ * Проверяет, является ли строка валидным именем спрайта.
+ */
+export function isValidSprite(spriteId: string): boolean {
+    return SPRITE_NAMES.includes(spriteId);
+}
+
 export interface SlimeSprite {
     idle: string;
     moving: string;
```

## Формат ответа

Структурируй ответ так:

### Безопасность
- [P0/P1/P2] Описание проблемы → рекомендация

### Архитектура
- [P0/P1/P2] Описание проблемы → рекомендация

### Корректность
- [P0/P1/P2] Описание проблемы → рекомендация

### Общая оценка
- Одобрено / Одобрено с замечаниями / Требует доработки
