# Code Review Prompt — OAuth Login Fix (slime-arena-ias0)

> Передай этот промпт внешнему ИИ-агенту (ChatGPT, Gemini, Claude в отдельной сессии, Cursor и т.п.) для независимого ревью.

---

## Роль

Ты — Senior Code Reviewer для проекта **Slime Arena** (мультиплеерная HTML5-игра). Проведи ревью коммита `885392d` — исправление критического бага OAuth login для новых пользователей.

## Контекст проекта

- **Стек:** Colyseus (сервер) + Preact + Canvas 2D (клиент) + Express (мета-API) + PostgreSQL
- **Архитектура:** монорепозиторий с `client/`, `server/`, `shared/`, `admin-dashboard/`
- **Критичное правило — детерминизм:** в коде симуляции (`server/src/rooms/`) **запрещены** `Math.random()`, `Date.now()`. В мета-слое (`server/src/meta/`) — допустимы.
- **UI-фреймворк:** Preact + `@preact/signals` (НЕ React). Реактивность через сигналы.
- **Баланс:** все числовые константы в `config/balance.json`, не хардкодить в коде.
- **БД:** PostgreSQL с UNIQUE constraint на `oauth_links(auth_provider, provider_user_id)`.

## Проблема (P1)

**7 из 23 OAuth-попыток на production (30%) завершились 404.** Новые пользователи потеряны. Последняя регистрация — 7 февраля, за 3 недели ни одного нового игрока.

**Корневая причина:** Кнопка «Войти» на главном экране отправляла `POST /oauth` с `intent='login'`. Этот endpoint искал существующий аккаунт по OAuth-ссылке и возвращал 404 для новых пользователей. OAuth-код одноразовый — после 404 повторить нельзя. Клиент молча откатывался на гостя.

## Что входит в коммит

1 коммит, 6 файлов, +222 / −109 строк. Три группы изменений:

| # | Компонент | Описание |
|---|-----------|----------|
| 1 | Сервер: `/oauth` endpoint | Вместо 404 — создаёт аккаунт для новых пользователей |
| 2 | Сервер: `AuthService` | Новый метод `createUserFromOAuth()` |
| 3 | Сервер: `/prepare-upgrade` | `claimToken` стал опциональным |
| 4 | Сервер: `/upgrade` | Путь без `claimToken` — создание через `createUserFromOAuth()` |
| 5 | Клиент: `MainScreen.tsx` | intent для гостей изменён с `"login"` на `"convert_guest"` |
| 6 | Клиент: `OAuthProviderSelector.tsx` | Убрана блокировка `convert_guest` без `claimToken` |
| 7 | Клиент: `OAuthRedirectHandler.ts` | `claimToken` опционален, `handleOAuthPrepare` принимает `null` |
| 8 | Сервер: `skinGenerator.ts` | Фикс `.js` в импорте (CommonJS) |

## Diff

```diff
diff --git a/client/src/oauth/OAuthRedirectHandler.ts b/client/src/oauth/OAuthRedirectHandler.ts
index 0c6e942..d400266 100644
--- a/client/src/oauth/OAuthRedirectHandler.ts
+++ b/client/src/oauth/OAuthRedirectHandler.ts
@@ -200,14 +200,15 @@ export async function handleOAuthCallback(
       result = await handleOAuthLogin(provider, params.code, codeVerifier);
     } else {
       // P1-4: Конвертация гостя — сначала prepare, потом подтверждение никнейма
-      if (!guestToken || !claimToken) {
+      // slime-arena-ias0: guestToken обязателен, claimToken опционален
+      if (!guestToken) {
         clearOAuthState();
         return {
           success: false,
-          error: 'Missing guest data for convert_guest flow',
+          error: 'Missing guest token for convert_guest flow',
         };
       }
-      result = await handleOAuthPrepare(provider, params.code, guestToken, claimToken);
+      result = await handleOAuthPrepare(provider, params.code, guestToken, claimToken || null);
     }

     // Очищаем состояние после обработки
@@ -274,14 +275,16 @@ async function handleOAuthPrepare(
   provider: OAuthProviderName,
   code: string,
   guestToken: string,
-  claimToken: string
+  claimToken: string | null
 ): Promise<OAuthHandlerResult> {
-  const body = {
+  const body: Record<string, string> = {
     provider,
     code,
-    claimToken,
     redirectUri: `${window.location.origin}/`,
   };
+  if (claimToken) {
+    body.claimToken = claimToken;
+  }

   const response = await metaServerClient.postRaw('/api/v1/auth/oauth/prepare-upgrade', body, {
     headers: {
diff --git a/client/src/ui/components/MainScreen.tsx b/client/src/ui/components/MainScreen.tsx
index 183380a..26ccd07 100644
--- a/client/src/ui/components/MainScreen.tsx
+++ b/client/src/ui/components/MainScreen.tsx
@@ -774,7 +774,7 @@ export function MainScreen({ onArena }: MainScreenProps) {
       {/* Модал авторизации для гостей */}
       {showAuthModal && (
         <RegistrationPromptModal
-          intent="login"
+          intent={isGuest.value ? "convert_guest" : "login"}
           onClose={() => {
             setShowAuthModal(false);
             // isGuest пересчитывается автоматически через useComputed(currentUser)
diff --git a/client/src/ui/components/OAuthProviderSelector.tsx b/client/src/ui/components/OAuthProviderSelector.tsx
index 9f8edcc..7ac9293 100644
--- a/client/src/ui/components/OAuthProviderSelector.tsx
+++ b/client/src/ui/components/OAuthProviderSelector.tsx
@@ -212,16 +212,8 @@ export function OAuthProviderSelector({
       // LB-009: Пытаемся взять токен из сигнала или из localStorage (если сессия была прервана)
       const effectiveClaimToken = claimToken.value || localStorage.getItem('registration_claim_token');

-      // FIX-002: Блокируем редирект для convert_guest если нет claimToken
-      // Без токена OAuth callback вернёт ошибку "Missing guest data"
-      if (intent === 'convert_guest' && !effectiveClaimToken) {
-        const errorMessage = 'Нет данных для сохранения прогресса. Сначала сыграйте матч.';
-        setError(errorMessage);
-        onError?.(errorMessage);
-        setStartingOAuth(null);
-        return;
-      }
-
+      // slime-arena-ias0: claimToken опционален для convert_guest
+      // Если есть — сохраняем, если нет — регистрация без прогресса
       if (intent === 'convert_guest' && effectiveClaimToken) {
         localStorage.setItem('registration_claim_token', effectiveClaimToken);
         // Сохраняем и под старым ключом для обратной совместимости во время миграции
diff --git a/server/src/meta/routes/auth.ts b/server/src/meta/routes/auth.ts
index 504b512..4a421e5 100644
--- a/server/src/meta/routes/auth.ts
+++ b/server/src/meta/routes/auth.ts
@@ -28,6 +28,7 @@ import { getRedisClient } from '../../db/redis';
 import { authRateLimiter, oauthRateLimiter } from '../middleware/rateLimiter';
 import { validateAndNormalize, normalizeNickname, NICKNAME_MAX_LENGTH } from '../../utils/generators/nicknameValidator';
 import { GUEST_DEFAULT_NICKNAME } from '@slime-arena/shared';
+import { generateRandomBasicSkin } from '../utils/skinGenerator';

 const router = express.Router();

@@ -375,10 +376,10 @@ router.post('/verify', async (req: Request, res: Response) => {

 /**
  * POST /api/v1/auth/oauth
- * OAuth login (Google/Yandex) - for existing accounts only
+ * OAuth login (Google/Yandex)
  *
- * Does NOT create new accounts. Returns 404 if account not found.
- * Account creation happens via auth/upgrade endpoint.
+ * For existing accounts — returns accessToken.
+ * For new users — creates account and returns accessToken (slime-arena-ias0).
  */
 router.post('/oauth', async (req: Request, res: Response) => {
   try {
@@ -419,13 +420,17 @@ router.post('/oauth', async (req: Request, res: Response) => {
     }

     let providerUserId: string;
+    let displayName: string;
+    let avatarUrl: string | undefined;

-    // Exchange code for user info (только для получения providerUserId)
+    // Exchange code for user info
     if (provider === 'google') {
       try {
         const googleProvider = getGoogleOAuthProvider();
         const userInfo = await googleProvider.exchangeCode(code);
         providerUserId = userInfo.id;
+        displayName = userInfo.name || (userInfo.email ? userInfo.email.split('@')[0] : `User${Date.now() % 100000}`);
+        avatarUrl = userInfo.picture;
       } catch (err: any) {
         if (err.message.includes('must be set')) {
           return res.status(500).json({
@@ -440,6 +445,8 @@ router.post('/oauth', async (req: Request, res: Response) => {
         const yandexProvider = getYandexOAuthProvider();
         const userInfo = await yandexProvider.exchangeCode(code);
         providerUserId = userInfo.id;
+        displayName = userInfo.display_name || userInfo.login || `User${Date.now() % 100000}`;
+        avatarUrl = YandexOAuthProvider.getAvatarUrl(userInfo.default_avatar_id);
       } catch (err: any) {
         if (err.message.includes('must be set')) {
           return res.status(500).json({
@@ -452,25 +459,48 @@ router.post('/oauth', async (req: Request, res: Response) => {
     }

     // Look up user by oauth_link
-    const user = await authService.findUserByOAuthLink(provider as AuthProvider, providerUserId);
+    let user = await authService.findUserByOAuthLink(provider as AuthProvider, providerUserId);

     if (!user) {
-      // Account not found - return 404
-      // User must use auth/upgrade to create account
-      return res.status(404).json({
-        error: 'account_not_found',
-        message: 'No account found for this OAuth provider. Use upgrade flow to create account.',
-      });
-    }
+      // Account not found — создаём нового пользователя (fix slime-arena-ias0)
+      let nickname: string;
+      try {
+        nickname = validateAndNormalize(displayName);
+      } catch {
+        nickname = `User${Date.now() % 100000}`;
+      }

-    // Update last login
-    await authService.updateLastLogin(user.id);
+      const skinId = generateRandomBasicSkin();
+
+      try {
+        user = await authService.createUserFromOAuth(
+          provider as AuthProvider,
+          providerUserId,
+          nickname,
+          avatarUrl,
+          skinId
+        );
+        console.log(`[Auth] OAuth new user: ${provider} ${providerUserId.slice(0, 8)}... → ${user.id.slice(0, 8)}... (${nickname})`);
+      } catch (createError: any) {
+        // Race condition: duplicate oauth_link (unique constraint 23505)
+        if (createError.code === '23505') {
+          user = await authService.findUserByOAuthLink(provider as AuthProvider, providerUserId);
+          if (!user) throw createError;
+          await authService.updateLastLogin(user.id);
+          console.log(`[Auth] OAuth race resolved: ${provider} ${providerUserId.slice(0, 8)}... → ${user.id.slice(0, 8)}...`);
+        } else {
+          throw createError;
+        }
+      }
+    } else {
+      // Update last login for existing user
+      await authService.updateLastLogin(user.id);
+      console.log(`[Auth] OAuth login: ${provider} user ${providerUserId.slice(0, 8)}... -> ${user.id.slice(0, 8)}...`);
+    }

     // Generate access token
     const accessToken = generateAccessToken(user.id, user.isAnonymous);

-    console.log(`[Auth] OAuth login: ${provider} user ${providerUserId.slice(0, 8)}... -> ${user.id.slice(0, 8)}...`);
-
     res.json({
       accessToken,
       userId: user.id,
@@ -495,7 +525,7 @@ router.post('/oauth', async (req: Request, res: Response) => {
  *
  * Input:
  * - Authorization: Bearer <guestToken>
- * - Body: { provider, code, claimToken, redirectUri }
+ * - Body: { provider, code, claimToken? (optional), redirectUri }
  *
  * Returns:
  * - { displayName, avatarUrl, prepareToken } - user confirms nickname, then calls /upgrade
@@ -505,10 +535,10 @@ router.post('/oauth/prepare-upgrade', async (req: Request, res: Response) => {
   try {
     const { provider, code, claimToken, redirectUri } = req.body;

-    if (!provider || !code || !claimToken) {
+    if (!provider || !code) {
       return res.status(400).json({
         error: 'missing_parameters',
-        message: 'provider, code, and claimToken are required',
+        message: 'provider and code are required',
       });
     }

@@ -537,13 +567,15 @@ router.post('/oauth/prepare-upgrade', async (req: Request, res: Response) => {
       });
     }

-    // Verify claimToken
-    const claimPayload = verifyClaimToken(claimToken);
-    if (!claimPayload) {
-      return res.status(401).json({
-        error: 'invalid_claim_token',
-        message: 'Invalid or expired claim token',
-      });
+    // Verify claimToken (optional — гость мог не сыграть матч, slime-arena-ias0)
+    if (claimToken) {
+      const claimPayload = verifyClaimToken(claimToken);
+      if (!claimPayload) {
+        return res.status(401).json({
+          error: 'invalid_claim_token',
+          message: 'Invalid or expired claim token',
+        });
+      }
     }

     // Exchange OAuth code for user info
@@ -698,18 +730,20 @@ router.post('/upgrade', async (req: Request, res: Response) => {
         });
       }

-      // Use data from prepareToken, but verify claimToken again
-      const claimPayload = verifyClaimToken(preparePayload.claimToken);
-      if (!claimPayload) {
-        return res.status(401).json({
-          error: 'invalid_claim_token',
-          message: 'Claim token in prepare token is invalid or expired',
-        });
+      // Verify claimToken if present (optional — гость мог не сыграть матч, slime-arena-ias0)
+      if (preparePayload.claimToken) {
+        const claimPayload = verifyClaimToken(preparePayload.claimToken);
+        if (!claimPayload) {
+          return res.status(401).json({
+            error: 'invalid_claim_token',
+            message: 'Claim token in prepare token is invalid or expired',
+          });
+        }
+        req.body.claimToken = preparePayload.claimToken;
       }

       // Process upgrade with prepareToken data
       req.body.mode = 'convert_guest';
-      req.body.claimToken = preparePayload.claimToken;
       req.body.provider = preparePayload.provider;
       req.body._preparePayload = preparePayload; // Pass to later processing
     }
@@ -718,10 +752,12 @@ router.post('/upgrade', async (req: Request, res: Response) => {
     const finalMode = req.body.mode;
     const finalClaimToken = req.body.claimToken;

-    if (!finalMode || !finalClaimToken) {
+    // claimToken optional при наличии preparePayload (slime-arena-ias0)
+    const hasPreparePayload = !!req.body._preparePayload;
+    if (!finalMode || (!finalClaimToken && !hasPreparePayload)) {
       return res.status(400).json({
         error: 'missing_parameters',
-        message: 'mode and claimToken are required',
+        message: 'mode is required; claimToken is required unless using prepareToken',
       });
     }

@@ -732,29 +768,36 @@ router.post('/upgrade', async (req: Request, res: Response) => {
       });
     }

-    // Verify claimToken
-    const claimPayload = verifyClaimToken(finalClaimToken);
-    if (!claimPayload) {
-      return res.status(401).json({
-        error: 'invalid_claim_token',
-        message: 'Invalid or expired claim token',
-      });
-    }
-
-    const { matchId, subjectId, finalMass, skinId } = claimPayload;
+    // Verify claimToken (optional — гость мог не сыграть матч, slime-arena-ias0)
+    let claimPayload: any = null;
+    let matchId: string | null = null;
+    let subjectId: string | null = null;
+    let finalMass = 0;
+    let skinId: string | null = null;

-    // Get match info for player count (P1-4)
-    // Note: claim consumption check moved to atomic markClaimConsumed inside transaction
-    const matchInfo = await getMatchResultInfo(matchId);
-    if (!matchInfo) {
-      return res.status(404).json({
-        error: 'match_not_found',
-        message: 'Match not found',
-      });
+    if (finalClaimToken) {
+      claimPayload = verifyClaimToken(finalClaimToken);
+      if (!claimPayload) {
+        return res.status(401).json({
+          error: 'invalid_claim_token',
+          message: 'Invalid or expired claim token',
+        });
+      }
+      ({ matchId, subjectId, finalMass, skinId } = claimPayload);
     }

-    // Get actual players count from match_results (P1-4)
-    const playersInMatch = matchInfo.playersCount;
+    // Get match info for player count (P1-4) — only if claimToken provided
+    let playersInMatch = 0;
+    if (matchId) {
+      const matchInfo = await getMatchResultInfo(matchId);
+      if (!matchInfo) {
+        return res.status(404).json({
+          error: 'match_not_found',
+          message: 'Match not found',
+        });
+      }
+      playersInMatch = matchInfo.playersCount;
+    }

     // Extract auth header
     const authHeader = req.get('authorization');
@@ -805,8 +848,8 @@ router.post('/upgrade', async (req: Request, res: Response) => {
           });
         }

-        // Verify claim belongs to this guest
-        if (preparePayload.guestSubjectId !== subjectId) {
+        // Verify claim belongs to this guest (only if claimToken provided)
+        if (subjectId && preparePayload.guestSubjectId !== subjectId) {
           return res.status(403).json({
             error: 'forbidden',
             message: 'Claim token does not belong to this guest',
@@ -1002,52 +1045,67 @@ router.post('/upgrade', async (req: Request, res: Response) => {
         });
       }

-      // RACE CONDITION PROTECTION (slime-arena-ww8):
-      // All operations executed in a single DB transaction.
-      // markClaimConsumed uses UPDATE ... WHERE claim_consumed_at IS NULL
-      // to atomically check and set, preventing double-claim race conditions.
-      const client = await authService.getClient();
       let user;
-      try {
-        await client.query('BEGIN');

-        // Atomically mark claim as consumed first to prevent race conditions (P1-5)
-        const claimConsumed = await authService.markClaimConsumed(matchId, subjectId, client);
-        if (!claimConsumed) {
+      if (matchId && subjectId) {
+        // Путь с claimToken — есть данные матча
+        // RACE CONDITION PROTECTION (slime-arena-ww8):
+        // All operations executed in a single DB transaction.
+        // markClaimConsumed uses UPDATE ... WHERE claim_consumed_at IS NULL
+        // to atomically check and set, preventing double-claim race conditions.
+        const client = await authService.getClient();
+        try {
+          await client.query('BEGIN');
+
+          // Atomically mark claim as consumed first to prevent race conditions (P1-5)
+          const claimConsumed = await authService.markClaimConsumed(matchId, subjectId, client);
+          if (!claimConsumed) {
+            await client.query('ROLLBACK');
+            client.release();
+            return res.status(409).json({
+              error: 'claim_already_consumed',
+              message: 'This claim token has already been used',
+            });
+          }
+
+          // Create registered user
+          user = await authService.createUserFromGuest(
+            finalProvider as AuthProvider,
+            providerUserId,
+            finalNickname,
+            avatarUrl,
+            matchId,
+            skinId!,
+            client
+          );
+
+          // Initialize ratings with actual players count from match_results (P1-4)
+          await ratingService.initializeRating(user.id, claimPayload, playersInMatch, client);
+
+          await client.query('COMMIT');
+        } catch (txError) {
           await client.query('ROLLBACK');
+          throw txError;
+        } finally {
           client.release();
-          return res.status(409).json({
-            error: 'claim_already_consumed',
-            message: 'This claim token has already been used',
-          });
         }
-
-        // Create registered user
-        user = await authService.createUserFromGuest(
+      } else {
+        // Путь без claimToken — гость регистрируется без матча (slime-arena-ias0)
+        const skinForUser = generateRandomBasicSkin();
+        user = await authService.createUserFromOAuth(
           finalProvider as AuthProvider,
           providerUserId,
           finalNickname,
           avatarUrl,
-          matchId,
-          skinId,
-          client
+          skinForUser
         );
-
-        // Initialize ratings with actual players count from match_results (P1-4)
-        await ratingService.initializeRating(user.id, claimPayload, playersInMatch, client);
-
-        await client.query('COMMIT');
-      } catch (txError) {
-        await client.query('ROLLBACK');
-        throw txError;
-      } finally {
-        client.release();
       }

       // Generate access token
       const accessTokenNew = generateAccessToken(user.id, false);

-      console.log(`[Auth] Upgrade convert_guest: guest ${subjectId.slice(0, 8)}... -> user ${user.id.slice(0, 8)}... (${playersInMatch} players)`);
+      const logSubject = subjectId ? subjectId.slice(0, 8) + '...' : 'no-match';
+      console.log(`[Auth] Upgrade convert_guest: guest ${logSubject} -> user ${user.id.slice(0, 8)}... (${playersInMatch} players)`);

       res.json({
         accessToken: accessTokenNew,
@@ -1057,16 +1115,23 @@ router.post('/upgrade', async (req: Request, res: Response) => {
           locale: user.locale,
         },
         isAnonymous: false,
-        rating: {
+        rating: matchId ? {
           totalMass: finalMass,
           bestMass: finalMass,
           matchesPlayed: 1,
-        },
+        } : undefined,
       });

     } else {
       // Mode: complete_profile
       // Auth: accessToken (for Telegram-anonymous user)
+      // claimToken обязателен для complete_profile
+      if (!matchId || !subjectId || !skinId) {
+        return res.status(400).json({
+          error: 'missing_parameters',
+          message: 'claimToken is required for complete_profile mode',
+        });
+      }

       // Verify accessToken
       const accessPayload = verifyAccessToken(token);
diff --git a/server/src/meta/services/AuthService.ts b/server/src/meta/services/AuthService.ts
index 54c5d50..07ffc09 100644
--- a/server/src/meta/services/AuthService.ts
+++ b/server/src/meta/services/AuthService.ts
@@ -415,6 +415,59 @@ export class AuthService {
     return user;
   }

+  /**
+   * Создать нового пользователя из OAuth login (без гостевой сессии).
+   * Используется когда пользователь нажимает «Войти» и у него нет аккаунта.
+   */
+  async createUserFromOAuth(
+    provider: AuthProvider,
+    providerUserId: string,
+    nickname: string,
+    avatarUrl: string | undefined,
+    skinId: string
+  ): Promise<User> {
+    const client = await this.pool.connect();
+    try {
+      await client.query('BEGIN');
+
+      const userResult = await client.query(
+        `INSERT INTO users (platform_type, platform_id, nickname, avatar_url, is_anonymous,
+                            registration_skin_id, nickname_set_at, last_login_at)
+         VALUES ($1, $2, $3, $4, FALSE, $5, NOW(), NOW())
+         RETURNING id, platform_type, platform_id, nickname, avatar_url, locale,
+                   is_anonymous, registration_skin_id, registration_match_id, nickname_set_at`,
+        [provider, providerUserId, nickname, avatarUrl || null, skinId]
+      );
+
+      const user = this.mapUserRow(userResult.rows[0]);
+
+      await client.query(
+        'INSERT INTO oauth_links (user_id, auth_provider, provider_user_id) VALUES ($1, $2, $3)',
+        [user.id, provider, providerUserId]
+      );
+
+      await client.query(
+        'INSERT INTO profiles (user_id, selected_skin_id) VALUES ($1, $2)',
+        [user.id, skinId]
+      );
+
+      await client.query(
+        'INSERT INTO wallets (user_id) VALUES ($1)',
+        [user.id]
+      );
+
+      await client.query('COMMIT');
+
+      console.log(`[AuthService] Created new user ${user.id.slice(0, 8)}... via OAuth ${provider}`);
+      return user;
+    } catch (error) {
+      await client.query('ROLLBACK');
+      throw error;
+    } finally {
+      client.release();
+    }
+  }
+
   /**
    * Complete anonymous profile (Telegram-anonymous → registered)
    * Updates is_anonymous to false
diff --git a/server/src/utils/generators/skinGenerator.ts b/server/src/utils/generators/skinGenerator.ts
index fed8f5d..b919314 100644
--- a/server/src/utils/generators/skinGenerator.ts
+++ b/server/src/utils/generators/skinGenerator.ts
@@ -5,7 +5,7 @@

 import { readFileSync, existsSync } from 'fs';
 import { join } from 'path';
-import { Rng } from '../rng.js';
+import { Rng } from '../rng';

 interface Skin {
   id: string;
```

## Критерии ревью

Проанализируй каждый изменённый файл и ответь по следующим пунктам:

### 1. Корректность

- Решает ли фикс заявленную проблему (404 для новых пользователей при OAuth login)?
- Нет ли регрессий для **существующих пользователей** (login → 200)?
- Все ли 4 потока OAuth корректны:
  - a) Login — существующий пользователь (`/oauth` → 200)
  - b) Login — новый пользователь (`/oauth` → создание + 200)
  - c) convert_guest **с** claimToken (`/prepare-upgrade` → `/upgrade` с матчем)
  - d) convert_guest **без** claimToken (`/prepare-upgrade` → `/upgrade` без матча)
- `complete_profile` mode — не сломан ли добавлением guard `if (!matchId || !subjectId || !skinId)`?

### 2. Безопасность

- **SQL Injection:** все SQL-запросы в `createUserFromOAuth()` используют параметризацию ($1, $2, ...)?
- **Race condition:** при двух одновременных `/oauth` запросах с одним `providerUserId` — может ли создаться два аккаунта? Корректна ли обработка `23505` (duplicate key violation)?
- **Авторизация:** можно ли через новый код зарегистрировать аккаунт от имени другого пользователя?
- **Token leakage:** не попадают ли токены или полные `providerUserId` в логи?
- **Обход ограничений:** можно ли через опциональный `claimToken` обойти какие-либо защиты (например, получить рейтинг без матча)?

### 3. Транзакционность

- `createUserFromOAuth()` создаёт 4 записи (users, oauth_links, profiles, wallets) в транзакции. При ошибке после INSERT users, но до COMMIT — останутся ли мусорные записи?
- В `/upgrade` без claimToken — `createUserFromOAuth()` вызывается вне существующего transaction block. Это корректно?

### 4. Типы и TypeScript

- `claimPayload: any` — оправдано ли использование `any`? Можно ли типизировать точнее?
- `skinId!` (non-null assertion) в `createUserFromGuest()` — безопасно ли? Гарантируется ли, что `skinId !== null` в этой ветке?
- `Record<string, string>` для body в `handleOAuthPrepare` — не теряется ли типизация?
- `claimToken || null` вместо `claimToken ?? null` — есть ли разница?

### 5. Клиентская логика

- `intent={isGuest.value ? "convert_guest" : "login"}` — что происходит, если `isGuest` изменится между рендером и нажатием кнопки? Может ли зарегистрированный пользователь попасть в `convert_guest` flow?
- Убранная блокировка в `OAuthProviderSelector` — не создаёт ли это проблемы, если `convert_guest` flow на сервере ожидает guestToken, а пользователь уже зарегистрирован?
- Мёртвый код: на клиенте осталась обработка 404 от `/oauth` (handleOAuthLogin). Нужно ли её удалить?

### 6. Консистентность данных

- `createUserFromOAuth()` vs `createUserFromGuest()` — создают ли оба одинаковый набор записей?
- `createUserFromOAuth()` не ставит `registration_match_id` — это ожидаемо? Не сломает ли это другие запросы, которые join-ят users с match_results по этому полю?
- Пользователь, созданный через `/oauth` без claimToken, получает `rating: undefined` в ответе. Как клиент обрабатывает этот случай?

### 7. Стиль и поддерживаемость

- Дублирование OAuth code exchange (Google/Yandex) присутствует в 3 endpoints: `/oauth`, `/prepare-upgrade`, `/upgrade`. Нужен ли рефакторинг?
- `req.body._preparePayload` — паттерн мутации req.body внутри handler. Есть ли лучший подход?
- Достаточно ли комментариев с `slime-arena-ias0` для прослеживаемости?
- JSDoc `/prepare-upgrade` — обновлён ли sufficiently (claimToken? optional)?

## Формат ответа

Для каждого найденного замечания укажи:
- **Файл и строку** (или диапазон строк в diff)
- **Серьёзность**: `critical` / `warning` / `nit`
- **Описание проблемы**
- **Предложение исправления** (если применимо)

В конце — общая оценка: `APPROVE`, `REQUEST_CHANGES`, или `APPROVE_WITH_COMMENTS`.
