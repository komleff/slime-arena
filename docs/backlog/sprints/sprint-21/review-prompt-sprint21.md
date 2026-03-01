# Code Review Prompt — Sprint 21 (v0.8.6)

> Передай этот промпт внешнему ИИ-агенту (ChatGPT, Gemini, Claude в отдельной сессии, Cursor и т.п.) для независимого ревью.

---

## Роль

Ты — Senior Code Reviewer для проекта **Slime Arena** (мультиплеерная HTML5-игра). Проведи ревью PR #150 по критериям ниже.

## Контекст проекта

- **Стек:** Colyseus (сервер) + Preact + Canvas 2D (клиент) + Express (мета-API) + PostgreSQL
- **Архитектура:** монорепозиторий с `client/`, `server/`, `shared/`, `admin-dashboard/`
- **Критичное правило — детерминизм:** сервер ведёт авторитативную симуляцию (30 тиков/с). В коде симуляции (`server/src/rooms/`) **запрещены** `Math.random()`, `Date.now()`, `performance.now()`. Для случайности — только `Rng` класс из `server/src/utils/rng.ts`. В мета-слое (`server/src/meta/`) — `Math.random()` допустим.
- **UI-фреймворк:** Preact + `@preact/signals` (НЕ React). Реактивность через сигналы.
- **Аудитория:** 90%+ мобильные (Telegram, Яндекс.Игры). Chrome mobile замораживает таймеры в фоновых вкладках.
- **Баланс:** все числовые константы в `config/balance.json`, не хардкодить в коде.

## Что входит в PR

10 коммитов, 12 файлов, +511 / -86 строк. Исправлены 2 P1-бага и 7 P2-задач:

| # | ID | Приоритет | Описание |
|---|----|-----------|----------|
| 1 | b7z6 | P1 | Зависание экрана выбора класса при «Играть ещё» |
| 2 | hfww | P2 | Таймер обратного отсчёта зависает на Chrome mobile |
| 3 | 3v3o | P2 | Фаза «connecting» мелькает главным экраном |
| 4 | vsn5 | P1 | Скин не сохраняется при OAuth upgrade гостя |
| 5 | n17m | P2 | `normalizeNickname(null)` возвращает строку «null» |
| 6 | mtw | P2 | Модификаторы укуса применяются несимметрично |
| 7 | 4xh | P2 | Талант Вампир не соответствует GDD |
| 8 | y2z2 | P2 | Гость видит «PLAYER» вместо «Гость» после матча |
| 9 | vpti | P2 | `generateRandomBasicSkin()` в каталоге симуляции (тех долг) |

## Diff

```diff
diff --git a/client/src/main.ts b/client/src/main.ts
index bde6ee9..3e500f6 100644
--- a/client/src/main.ts
+++ b/client/src/main.ts
@@ -1425,7 +1425,28 @@ function drawSprite(
     drawSpriteRender(canvasCtx, img, ready, x, y, radius, angleRad, fallbackFill, fallbackStroke, spriteScale);
 }

+// Таймаут безопасности для фазы "connecting" (ID для очистки)
+let connectingTimeoutId: ReturnType<typeof setTimeout> | null = null;
+const CONNECTING_TIMEOUT_MS = 10_000; // 10 секунд
+
 async function connectToServer(playerName: string, classId: number) {
+    // Очищаем предыдущий таймаут безопасности (если был)
+    if (connectingTimeoutId) {
+        clearTimeout(connectingTimeoutId);
+        connectingTimeoutId = null;
+    }
+    // Таймаут безопасности: если "connecting" > 10 сек → сбросить в "menu"
+    connectingTimeoutId = setTimeout(() => {
+        connectingTimeoutId = null;
+        if (gamePhase.value === "connecting") {
+            console.warn("[connectToServer] Таймаут подключения (10 сек), сброс в меню");
+            setConnecting(false);
+            setPhase("menu");
+            canvas.style.display = "none";
+            setGameViewportLock(false);
+        }
+    }, CONNECTING_TIMEOUT_MS);
+
     // Показываем индикатор подключения в Preact UI
     setConnecting(true);

@@ -1546,6 +1567,12 @@ async function connectToServer(playerName: string, classId: number) {
                 const waitTime = Math.ceil(room.state?.timeRemaining ?? 15);
                 console.log(`[connectToServer] Арена в фазе Results — покидаем и ждём ${waitTime} сек`);

+                // Очищаем таймаут безопасности подключения
+                if (connectingTimeoutId) {
+                    clearTimeout(connectingTimeoutId);
+                    connectingTimeoutId = null;
+                }
+
                 // ВАЖНО: Сначала покидаем комнату, потом обновляем UI
                 room.leave().catch((err) => {
                     console.error("[connectToServer] Ошибка при выходе из комнаты:", err);
@@ -1593,6 +1620,11 @@ async function connectToServer(playerName: string, classId: number) {

             // Нормальное подключение — переключаем на playing
             setArenaWaitTime(0);
+            // Очищаем таймаут безопасности подключения
+            if (connectingTimeoutId) {
+                clearTimeout(connectingTimeoutId);
+                connectingTimeoutId = null;
+            }
             setPhase("playing");
             setConnecting(false);

@@ -2358,15 +2390,15 @@ async function connectToServer(playerName: string, classId: number) {
                         console.log("Арена готова — начинаем игру");
                     }
                 }
-                // Если игрок подключился во время Results и ждал в 'waiting' (старая логика)
-                else if (gamePhase.value === "waiting") {
+                // Если игрок подключился во время Results и ждал в 'waiting' или 'connecting'
+                else if (gamePhase.value === "waiting" || gamePhase.value === "connecting") {
                     const selfPlayer = room.state.players.get(room.sessionId);
                     if (selfPlayer && !isValidClassId(selfPlayer.classId)) {
                         setClassSelectMode(true);
                         console.log("Сервер рестартировал матч — нужно выбрать класс");
                     } else {
                         setPhase("playing");
-                        console.log("Сервер рестартировал матч — переключаем из waiting в playing");
+                        console.log("Сервер рестартировал матч — переключаем из waiting/connecting в playing");
                     }
                 }
             }
@@ -2414,17 +2446,41 @@ async function connectToServer(playerName: string, classId: number) {
                     (balanceConfig.match.resultsDurationSec ?? 12) +
                     (balanceConfig.match.restartDelaySec ?? 3) +
                     BUFFER_SECONDS;
-                let resultsCountdown = resultsWaitSeconds;
-                setResultsWaitTime(resultsCountdown);
-                const resultsTimerInterval = setInterval(() => {
-                    resultsCountdown--;
-                    if (resultsCountdown <= 0) {
+                // fix(slime-arena-hfww): Используем абсолютное время вместо декремента,
+                // чтобы таймер корректно работал после background/foreground (Chrome mobile)
+                const resultsEndTime = Date.now() + resultsWaitSeconds * 1000;
+                setResultsWaitTime(resultsWaitSeconds);
+
+                const updateResultsTimer = () => {
+                    const remaining = Math.max(0, Math.ceil((resultsEndTime - Date.now()) / 1000));
+                    setResultsWaitTime(remaining);
+                    if (remaining <= 0 && resultsTimerInterval != null) {
                         clearInterval(resultsTimerInterval);
-                        setResultsWaitTime(0);
-                    } else {
-                        setResultsWaitTime(resultsCountdown);
+                        resultsTimerInterval = null;
                     }
-                }, 1000);
+                };
+                // Интервал 250 мс для плавного обновления после возврата из background
+                let resultsTimerInterval: ReturnType<typeof setInterval> | null =
+                    setInterval(updateResultsTimer, 250);
+
+                // Пересчёт таймера при возврате вкладки из background
+                const onVisibilityChange = () => {
+                    if (document.visibilityState === "visible") {
+                        updateResultsTimer();
+                    }
+                };
+                document.addEventListener("visibilitychange", onVisibilityChange);
+
+                // Очистка обработчика при уходе из фазы results (через onLeave или новый матч)
+                const cleanupResultsTimer = () => {
+                    if (resultsTimerInterval != null) {
+                        clearInterval(resultsTimerInterval);
+                        resultsTimerInterval = null;
+                    }
+                    document.removeEventListener("visibilitychange", onVisibilityChange);
+                };
+                // Привязываем очистку к onLeave комнаты
+                room.onLeave(cleanupResultsTimer);

                 // Получаем победителя
                 const leaderId = room.state.leaderboard?.[0];
@@ -3661,11 +3717,9 @@ async function connectToServer(playerName: string, classId: number) {
             // onStop колбэк вызовет inputManager.detach() и resetSnapshotBuffer()
             gameLoop.stop();

-            // Очистка визуальных сущностей для предотвращения "призраков"
-            // Проверяем что это та же комната, чтобы избежать race condition при reconnect
-            if (room === activeRoom) {
-                smoothingSystem.clear();
-            }
+            // Очистка визуальных сущностей — всегда при выходе из комнаты
+            // (activeRoom мог быть сброшен в null ранее в onPlayAgain)
+            smoothingSystem.clear();

             // Сброс направления движения для предотвращения "фантомного движения" после респауна
             lastSentInput = { x: 0, y: 0 };
@@ -3679,9 +3733,13 @@ async function connectToServer(playerName: string, classId: number) {

             // Показываем экран выбора при отключении
             canvas.style.display = "none";
-            // Сбрасываем индикатор подключения и переходим в меню
             setConnecting(false);
-            setPhase("menu");
+            // fix(slime-arena-b7z6): Не сбрасываем в "menu" если уже в "connecting" —
+            // onPlayAgain устанавливает "connecting" до вызова room.leave(),
+            // и onLeave не должен перезаписывать эту фазу
+            if (gamePhase.value !== "connecting") {
+                setPhase("menu");
+            }
             isViewportUnlockedForResults = false;
             setGameViewportLock(false);
         });
@@ -3699,6 +3757,11 @@ async function connectToServer(playerName: string, classId: number) {
         });
     } catch (e) {
         console.error("Ошибка подключения:", e);
+        // Очищаем таймаут безопасности подключения
+        if (connectingTimeoutId) {
+            clearTimeout(connectingTimeoutId);
+            connectingTimeoutId = null;
+        }
         // Вернём экран выбора при ошибке
         canvas.style.display = "none";
         // Сбрасываем индикатор подключения и возвращаем в меню
diff --git a/client/src/ui/UIBridge.tsx b/client/src/ui/UIBridge.tsx
index 09d99bc..3e411dc 100644
--- a/client/src/ui/UIBridge.tsx
+++ b/client/src/ui/UIBridge.tsx
@@ -62,6 +62,7 @@ import { MainMenu } from './components/MainMenu';
 import { AccountConflictModal } from './components/AccountConflictModal';
 import { NicknameConfirmModal } from './components/NicknameConfirmModal';
 import { LeaderboardScreen } from './components/LeaderboardScreen';
+import { ConnectingScreen } from './components/ConnectingScreen';
 import { ShutdownBanner } from './components/ShutdownBanner';

 // ========== Типы для колбеков ==========
@@ -125,6 +126,11 @@ function UIRoot() {
         <BootScreen onRetry={callbacks?.onBootRetry} />
       )}

+      {/* Connecting Screen (индикатор подключения к серверу) */}
+      {phase === 'connecting' && (
+        <ConnectingScreen />
+      )}
+
       {/* Main Screen (главный экран с кнопкой Arena) */}
       {phase === 'menu' && screen === 'main-menu' && callbacks && (
         <MainScreen onArena={callbacks.onArena} />
diff --git a/client/src/ui/components/ConnectingScreen.tsx b/client/src/ui/components/ConnectingScreen.tsx
new file mode 100644
index 0000000..b7e9c42
--- /dev/null
+++ b/client/src/ui/components/ConnectingScreen.tsx
@@ -0,0 +1,57 @@
+/**
+ * ConnectingScreen — индикатор подключения к серверу
+ *
+ * Показывается при фазе "connecting" (например, при нажатии "Играть ещё"),
+ * чтобы предотвратить мелькание главного экрана (#126).
+ */
+
+import { injectStyles } from '../utils/injectStyles';
+
+const STYLES_ID = 'connecting-screen-styles';
+
+const styles = `
+  .connecting-screen {
+    position: fixed;
+    inset: 0;
+    display: flex;
+    flex-direction: column;
+    align-items: center;
+    justify-content: center;
+    background: #090b10;
+    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
+    z-index: 1000;
+    color: #e6f3ff;
+  }
+
+  .connecting-spinner {
+    width: 48px;
+    height: 48px;
+    border: 4px solid rgba(111, 214, 255, 0.2);
+    border-top-color: #6fd6ff;
+    border-radius: 50%;
+    animation: connecting-spin 0.8s linear infinite;
+    margin-bottom: 20px;
+  }
+
+  .connecting-text {
+    font-size: 18px;
+    font-weight: 600;
+    letter-spacing: 0.5px;
+    color: #a7c6ff;
+  }
+
+  @keyframes connecting-spin {
+    to { transform: rotate(360deg); }
+  }
+`;
+
+export function ConnectingScreen() {
+  injectStyles(STYLES_ID, styles);
+
+  return (
+    <div class="connecting-screen">
+      <div class="connecting-spinner" />
+      <div class="connecting-text">Подключение...</div>
+    </div>
+  );
+}
diff --git a/client/src/ui/components/MainScreen.tsx b/client/src/ui/components/MainScreen.tsx
index 67558c9..183380a 100644
--- a/client/src/ui/components/MainScreen.tsx
+++ b/client/src/ui/components/MainScreen.tsx
@@ -6,9 +6,9 @@
  */

 import { useEffect, useState } from 'preact/hooks';
+import { useComputed } from '@preact/signals';
 import { injectStyles } from '../utils/injectStyles';
 import { currentUser, currentProfile, openLeaderboard } from '../signals/gameState';
-import { authService } from '../../services/authService';
 import { GUEST_DEFAULT_NICKNAME } from '@slime-arena/shared';
 import { RegistrationPromptModal } from './RegistrationPromptModal';

@@ -645,8 +645,16 @@ export function MainScreen({ onArena }: MainScreenProps) {
   const user = currentUser.value;
   const profile = currentProfile.value;

-  const [isGuest, setIsGuest] = useState(authService.isAnonymous());
-  const playerName = isGuest ? GUEST_DEFAULT_NICKNAME : (user?.nickname || 'PLAYER');
+  // Реактивное вычисление гостевого статуса из сигнала currentUser.
+  // При возврате из матча currentUser обновляется, и isGuest пересчитывается автоматически.
+  // FIX slime-arena-y2z2: заменили useState(authService.isAnonymous()) на useComputed,
+  // чтобы компонент реагировал на изменения currentUser без перемонтирования.
+  const isGuest = useComputed(() => {
+    const u = currentUser.value;
+    if (!u) return true;
+    return u.id === 'guest';
+  });
+  const playerName = isGuest.value ? GUEST_DEFAULT_NICKNAME : (user?.nickname || 'PLAYER');
   const level = profile?.level ?? 1;
   const avatarUrl = profile?.avatarUrl || '/hud/hud_avatar_hero_01.webp';
   const coins = 0; // Валюта пока не реализована
@@ -696,7 +704,7 @@ export function MainScreen({ onArena }: MainScreenProps) {
           </div>
           <div class="hud-info">
             <div class="hud-name">{playerName}</div>
-            {isGuest ? (
+            {isGuest.value ? (
               <button class="hud-auth-link" onClick={() => setShowAuthModal(true)}>
                 Войти
               </button>
@@ -708,7 +716,7 @@ export function MainScreen({ onArena }: MainScreenProps) {
               </div>
             )}
           </div>
-          {isGuest ? null : (
+          {isGuest.value ? null : (
             <div class="xp-track">
               <div class="xp-fill" style={{ width: `${xpPercent}%` }} />
             </div>
@@ -769,7 +777,7 @@ export function MainScreen({ onArena }: MainScreenProps) {
           intent="login"
           onClose={() => {
             setShowAuthModal(false);
-            setIsGuest(authService.isAnonymous());
+            // isGuest пересчитывается автоматически через useComputed(currentUser)
           }}
         />
       )}
diff --git a/server/src/meta/routes/matchResults.ts b/server/src/meta/routes/matchResults.ts
index 3d22cd2..439487d 100644
--- a/server/src/meta/routes/matchResults.ts
+++ b/server/src/meta/routes/matchResults.ts
@@ -13,6 +13,7 @@ import {
 import { loadBalanceConfig } from '../../config/loadBalanceConfig';
 import { ratingService } from '../services/RatingService';
 import { authRateLimiter } from '../middleware/rateLimiter';
+import { generateRandomBasicSkin } from '../utils/skinGenerator';

 const router = express.Router();

@@ -365,7 +366,8 @@ router.post('/claim', authRateLimiter, async (req: Request, res: Response) => {
     const finalMass = playerData?.finalMass ?? 0;

     // Get skinId: for registered users fetch from profile, for guests use from request body
-    let skinId = 'slime_green';
+    // fix(slime-arena-vsn5): fallback на generateRandomBasicSkin() вместо hardcoded 'slime_green'
+    let skinId: string | undefined;
     if (isGuest) {
       // P0-1: Гости передают skinId из localStorage через request body
       if (req.body.skinId && typeof req.body.skinId === 'string') {
@@ -381,12 +383,22 @@ router.post('/claim', authRateLimiter, async (req: Request, res: Response) => {
       }
     }

+    // Fallback: если skinId не определён — генерируем случайный базовый скин
+    if (!skinId) {
+      try {
+        skinId = generateRandomBasicSkin();
+      } catch {
+        skinId = 'slime_green';
+      }
+    }
+
     // Generate claimToken
+    const resolvedSkinId: string = skinId || 'slime_green';
     const claimToken = generateClaimToken({
       matchId,
       subjectId,
       finalMass,
-      skinId,
+      skinId: resolvedSkinId,
     });

     const expiresAt = calculateExpiresAt(TOKEN_EXPIRATION.CLAIM_TOKEN);
diff --git a/server/src/meta/services/AuthService.ts b/server/src/meta/services/AuthService.ts
index 17cea04..54c5d50 100644
--- a/server/src/meta/services/AuthService.ts
+++ b/server/src/meta/services/AuthService.ts
@@ -443,7 +443,14 @@ export class AuthService {
       throw new Error('User not found');
     }

-    console.log(`[AuthService] Completed profile for user ${userId.slice(0, 8)}...`);
+    // fix(slime-arena-vsn5): Сохраняем skinId в profiles.selected_skin_id при complete_profile
+    // Ранее skinId записывался только в users.registration_skin_id, а profiles оставался с NULL
+    await db.query(
+      `UPDATE profiles SET selected_skin_id = $2, updated_at = NOW() WHERE user_id = $1`,
+      [userId, registrationSkinId]
+    );
+
+    console.log(`[AuthService] Completed profile for user ${userId.slice(0, 8)}..., skin: ${registrationSkinId}`);

     return this.mapUserRow(result.rows[0]);
   }
diff --git a/server/src/meta/utils/skinGenerator.ts b/server/src/meta/utils/skinGenerator.ts
new file mode 100644
index 0000000..6d02efc
--- /dev/null
+++ b/server/src/meta/utils/skinGenerator.ts
@@ -0,0 +1,29 @@
+/**
+ * Генератор случайных скинов для мета-сервера.
+ *
+ * Функции здесь используют Math.random() — это допустимо,
+ * поскольку они вызываются ТОЛЬКО из мета-слоя (routes/services),
+ * а НЕ из игровой симуляции.
+ *
+ * Детерминированные функции скинов остаются в utils/generators/skinGenerator.ts.
+ */
+
+import { getBasicSkins } from '../../utils/generators/skinGenerator.js';
+
+/**
+ * Генерирует случайный базовый скин для нового игрока.
+ * Использует Math.random(), поэтому НЕ детерминирован.
+ * ТОЛЬКО ДЛЯ МЕТАСЕРВЕРА - не использовать в игровой симуляции!
+ *
+ * @returns skinId случайного базового скина
+ */
+export function generateRandomBasicSkin(): string {
+  const basicSkins = getBasicSkins();
+
+  if (basicSkins.length === 0) {
+    throw new Error('No basic skins found in config/skins.json');
+  }
+
+  const randomIndex = Math.floor(Math.random() * basicSkins.length);
+  return basicSkins[randomIndex].id;
+}
diff --git a/server/src/rooms/systems/combatSystem.ts b/server/src/rooms/systems/combatSystem.ts
index f77f8d7..7ca9d06 100644
--- a/server/src/rooms/systems/combatSystem.ts
+++ b/server/src/rooms/systems/combatSystem.ts
@@ -50,29 +50,37 @@ export function processCombat(
     const defenderClassStats = room.getClassStats(defender);
     const minSlimeMass = room.balance.physics.minSlimeMass;

-    // PvP Bite Formula (из ТЗ):
-    // - Атакующий получает 10% СВОЕЙ массы за счёт жертвы
-    // - Жертва дополнительно теряет 10% СВОЕЙ массы в виде пузырей
+    // PvP Bite Formula (симметричная):
+    // Все модификаторы (damageBonusMult, damageTakenMult, totalResist) применяются
+    // к общей потере жертвы, затем она делится на attackerGain и scatterMass.
     // Инвариант: massLoss = attackerGain + scatterMass (масса не создаётся из воздуха)

-    // 1. Атакующий получает % от СВОЕЙ массы
-    const attackerMassBefore = attacker.mass;
+    const defenderMassBefore = defender.mass;
+
+    // Модификатор урона атакующего (Острые зубы, Агрессор, Rage, класс)
     let damageBonusMult = room.getDamageBonusMultiplier(attacker, true);
     if (attacker.mod_ambushDamage > 0 && (defenderZone === "side" || defenderZone === "tail")) {
         damageBonusMult = Math.max(0, damageBonusMult + attacker.mod_ambushDamage);
     }
-    const attackerGainBase = attackerMassBefore * room.balance.combat.pvpBiteAttackerGainPct;
-    let attackerGain = attackerGainBase * zoneMultiplier * classStats.damageMult * damageBonusMult;

-    // 2. Жертва теряет % СВОЕЙ массы как пузыри
-    const defenderMassBefore = defender.mass;
+    // Модификатор получаемого урона защитника (Стойкий, Агрессор)
     const damageTakenMult = room.getDamageTakenMultiplier(defender);
+
     // Защита от укусов: класс + талант (cap 50%)
     const totalResist = Math.min(0.5, defenderClassStats.biteResistPct + defender.biteResistPct);
-    const scatterBase = defenderMassBefore * room.balance.combat.pvpBiteScatterPct;
-    let scatterMass = scatterBase * zoneMultiplier * damageTakenMult * (1 - totalResist);

-    // 3. Общая потеря жертвы = attackerGain + scatterMass
+    // Проценты из конфига
+    const gainPct = room.balance.combat.pvpBiteAttackerGainPct;
+    const scatterPct = room.balance.combat.pvpBiteScatterPct;
+    const totalRewardPct = gainPct + scatterPct;
+
+    // Общая потеря жертвы: все модификаторы применяются симметрично
+    const baseLoss = defenderMassBefore * totalRewardPct;
+    const totalLoss = baseLoss * zoneMultiplier * classStats.damageMult * damageBonusMult * damageTakenMult * (1 - totalResist);
+
+    // Распределяем пропорционально gainPct / scatterPct
+    let attackerGain = totalLoss * (gainPct / totalRewardPct);
+    let scatterMass = totalLoss * (scatterPct / totalRewardPct);
     let massLoss = attackerGain + scatterMass;

     attacker.lastAttackTick = room.tick;
@@ -90,30 +98,24 @@ export function processCombat(
         return;
     }

-    // Vampire talents: перенаправляют часть scatter в attackerGain
-    if (attacker.mod_vampireSideGainPct > 0 && defenderZone === "side") {
-        const baseGainPct = room.balance.combat.pvpBiteAttackerGainPct;
-        const vampirePct = attacker.mod_vampireSideGainPct;
-        const bonusPct = vampirePct - baseGainPct;
-        if (bonusPct > 0 && scatterMass > 0) {
-            const transferred = scatterMass * Math.min(1, bonusPct / room.balance.combat.pvpBiteScatterPct);
-            attackerGain += transferred;
-            scatterMass -= transferred;
+    // Vampire talents: увеличивают долю attackerGain за счёт scatter.
+    // GDD: "Вампир: бок 10% -> 20%, хвост 15% -> 25%"
+    // vampirePct — абсолютная целевая доля массы жертвы (до zone/mod).
+    // vampireGainFraction = vampirePct / (totalRewardPct * zoneMultiplier) от totalLoss.
+    {
+        let vampirePct = 0;
+        if (attacker.mod_vampireSideGainPct > 0 && defenderZone === "side") {
+            vampirePct = attacker.mod_vampireSideGainPct;
+        } else if (attacker.mod_vampireTailGainPct > 0 && defenderZone === "tail") {
+            vampirePct = attacker.mod_vampireTailGainPct;
         }
-    } else if (attacker.mod_vampireTailGainPct > 0 && defenderZone === "tail") {
-        const baseGainPct = room.balance.combat.pvpBiteAttackerGainPct;
-        const vampirePct = attacker.mod_vampireTailGainPct;
-        const bonusPct = vampirePct - baseGainPct;
-        if (bonusPct > 0 && scatterMass > 0) {
-            const transferred = scatterMass * Math.min(1, bonusPct / room.balance.combat.pvpBiteScatterPct);
-            attackerGain += transferred;
-            scatterMass -= transferred;
+        if (vampirePct > 0) {
+            const vampireGainFraction = Math.min(1, vampirePct / (totalRewardPct * zoneMultiplier));
+            attackerGain = massLoss * vampireGainFraction;
+            scatterMass = massLoss - attackerGain;
         }
     }

-    // Пересчитываем massLoss после vampire talents
-    massLoss = attackerGain + scatterMass;
-
     // Проверка Last Breath: если масса упадёт ниже минимума
     const newDefenderMass = defender.mass - massLoss;
     const triggersLastBreath =
diff --git a/server/src/utils/generators/nicknameValidator.ts b/server/src/utils/generators/nicknameValidator.ts
index e26ef7e..d02c3a0 100644
--- a/server/src/utils/generators/nicknameValidator.ts
+++ b/server/src/utils/generators/nicknameValidator.ts
@@ -147,29 +147,30 @@ export function validateNicknameDetailed(nickname: string): ValidationResult {

 /**
  * Нормализует никнейм: удаляет лишние пробелы, приводит к trim.
+ * При null/undefined возвращает пустую строку (для безопасности вызывающего кода).
+ *
+ * fix(slime-arena-n17m): ранний return пустой строки для null/undefined
+ * предотвращает строку 'null'/'undefined' проходящую валидацию.
  *
  * @param nickname - никнейм для нормализации
- * @returns нормализованный никнейм
- * @throws Error если nickname равен null, undefined или не является строкой
+ * @returns нормализованный никнейм, пустая строка для null/undefined
  */
-export function normalizeNickname(nickname: string): string {
-  if (nickname === null || nickname === undefined || typeof nickname !== 'string') {
-    throw new Error('Nickname must be a non-empty string');
-  }
-  return nickname
+export function normalizeNickname(nickname: string | null | undefined): string {
+  if (nickname == null) return '';
+  return String(nickname)
     .trim()
     .replace(/\s+/g, ' '); // Заменяем множественные пробелы на один
 }

 /**
  * Проверяет никнейм и возвращает нормализованную версию.
- * Выбрасывает ошибку если никнейм невалиден.
+ * Выбрасывает ошибку если никнейм невалиден (включая null/undefined).
  *
  * @param nickname - никнейм для проверки
  * @returns нормализованный никнейм
  * @throws Error если никнейм невалиден
  */
-export function validateAndNormalize(nickname: string): string {
+export function validateAndNormalize(nickname: string | null | undefined): string {
   const normalized = normalizeNickname(nickname);
   const result = validateNicknameDetailed(normalized);

diff --git a/server/src/utils/generators/skinGenerator.ts b/server/src/utils/generators/skinGenerator.ts
index 0c7a3a7..377aa99 100644
--- a/server/src/utils/generators/skinGenerator.ts
+++ b/server/src/utils/generators/skinGenerator.ts
@@ -65,23 +65,9 @@ export function getBasicSkins(): Skin[] {
 }

 /**
- * Генерирует случайный базовый скин для нового игрока.
- * Использует Math.random(), поэтому НЕ детерминирован.
- * ТОЛЬКО ДЛЯ МЕТАСЕРВЕРА - не использовать в игровой симуляции!
- *
- * @returns skinId случайного базового скина
+ * generateRandomBasicSkin() перенесена в server/src/meta/utils/skinGenerator.ts
+ * (использует Math.random() — допустимо только в мета-слое).
  */
-export function generateRandomBasicSkin(): string {
-  // META-SERVER ONLY: Math.random() допустим, не используется в симуляции
-  const basicSkins = getBasicSkins();
-
-  if (basicSkins.length === 0) {
-    throw new Error('No basic skins found in config/skins.json');
-  }
-
-  const randomIndex = Math.floor(Math.random() * basicSkins.length);
-  return basicSkins[randomIndex].id;
-}

 /**
  * Генерирует детерминированный базовый скин на основе seed.
diff --git a/server/tests/skin-generator.test.js b/server/tests/skin-generator.test.js
index 35f7d00..948d2ca 100644
--- a/server/tests/skin-generator.test.js
+++ b/server/tests/skin-generator.test.js
@@ -10,13 +10,16 @@ const projectRoot = path.resolve(__dirname, '..', '..');
 process.chdir(projectRoot);

 const {
-  generateRandomBasicSkin,
   generateBasicSkin,
   getBasicSkins,
   skinExists,
   getSkinById
 } = require(path.resolve(__dirname, '../dist/server/src/utils/generators/skinGenerator.js'));

+const {
+  generateRandomBasicSkin,
+} = require(path.resolve(__dirname, '../dist/server/src/meta/utils/skinGenerator.js'));
+
 // Простой тестовый фреймворк
 let passedTests = 0;
 let failedTests = 0;
```

## Критерии ревью

Проанализируй каждый изменённый файл и ответь по следующим пунктам:

### 1. Корректность
- Решает ли каждый фикс заявленную проблему?
- Нет ли регрессий или edge cases, которые не покрыты?
- Правильно ли работает формула PvP-укуса (combatSystem.ts) — сохраняется ли инвариант `massLoss = attackerGain + scatterMass`?
- Корректна ли формула Вампира: `vampireGainFraction = vampirePct / (totalRewardPct * zoneMultiplier)`? Не может ли она выдать значение > 1?

### 2. Детерминизм
- Нет ли нарушений правила: `Math.random()` / `Date.now()` / `performance.now()` запрещены в `server/src/rooms/` (симуляция)?
- Код в `server/src/meta/` — мета-слой, `Math.random()` там допустим.
- Затрагивают ли изменения в `combatSystem.ts` детерминизм? (Они должны — это баланс, но формулы должны быть детерминированы.)

### 3. Race conditions (клиент)
- `connectingTimeoutId` — модульная переменная. Возможна ли гонка при двойном быстром нажатии «Играть ещё»?
- `room.onLeave()` проверяет `gamePhase.value !== "connecting"`. Может ли фаза измениться между проверкой и `setPhase`?
- Очищается ли `visibilitychange` listener во всех путях выхода?

### 4. Утечки ресурсов
- `resultsTimerInterval` — очищается ли при всех сценариях? (onLeave, ошибка, повторное подключение)
- `connectingTimeoutId` — очищается ли при ошибке, таймауте, успешном подключении?
- `visibilitychange` listener — не накапливается ли при повторных матчах?

### 5. Типы и TypeScript
- `skinId: string | undefined` → `resolvedSkinId: string` — нет ли лишнего fallback? (двойная проверка `!skinId` + `skinId || 'slime_green'`)
- `useComputed` из `@preact/signals` — корректно ли используется в Preact-компоненте? Подписка автоматическая?
- `normalizeNickname(string | null | undefined)` — не ломает ли расширение сигнатуры вызывающий код?

### 6. Безопасность
- `req.body.skinId` в matchResults.ts — достаточно ли валидации `typeof === 'string'`? Нет ли injection-рисков?
- SQL-запрос с параметрами (`$1, $2`) — безопасен?

### 7. Стиль и поддерживаемость
- Не перегружены ли комментарии? Достаточно ли понятен код без них?
- CSS в `ConnectingScreen.tsx` — через `injectStyles()`. Соответствует ли паттерну проекта?
- Осталось ли мёртвое JSDoc-описание в `skinGenerator.ts` (комментарий о перемещении функции)?

## Формат ответа

Для каждого найденного замечания укажи:
- **Файл и строку** (или диапазон строк в diff)
- **Серьёзность**: `critical` / `warning` / `nit`
- **Описание проблемы**
- **Предложение исправления** (если применимо)

В конце — общая оценка: `APPROVE`, `REQUEST_CHANGES`, или `APPROVE_WITH_COMMENTS`.
