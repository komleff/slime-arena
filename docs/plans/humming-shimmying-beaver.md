# Sprint 21: Багфиксы и технический долг (v0.8.6)

## Контекст

Production v0.8.5 работает стабильно с 7 февраля. Оператор вернулся из отпуска. Накопилось 89 открытых задач, 2 P1-бага и несколько P2-багов, влияющих на удержание мобильных игроков. Спринт фокусируется на стабилизации: исправление багов + закрытие точечного тех долга. Новых фич нет.

**Ветка:** `sprint-21/bugfix-tech-debt`
**Целевая версия:** v0.8.6

---

## Состав спринта (9 задач)

| # | Beads ID | Приоритет | Сложность | Название |
|---|----------|-----------|-----------|----------|
| 1 | slime-arena-b7z6 | P1 | L | Зависание экрана выбора класса при рестарте матча |
| 2 | slime-arena-hfww | P2 | M | Таймер до следующего боя зависает (Chrome mobile) |
| 3 | *новая* | P2 | S | Фаза 'connecting' мелькает главным экраном (#126) |
| 4 | slime-arena-vsn5 | P1 | S | Скин не сохраняется при OAuth upgrade |
| 5 | slime-arena-n17m | P2 | S | normalizeNickname() падает на null/undefined |
| 6 | slime-arena-mtw | P2 | M | Модификаторы укуса применяются несимметрично |
| 7 | slime-arena-4xh | P2 | M | Талант Вампир не даёт долю массы по GDD |
| 8 | slime-arena-y2z2 | P2 | S | Гость видит PLAYER вместо "Гость" после матча |
| 9 | *новая* | P2 | S | Изолировать generateRandomBasicSkin() от симуляции |

**Исключены** (не вошли в спринт):
- slime-arena-bfce (admin N+1) — оптимизация, не критична при текущей нагрузке
- slime-arena-zwe2 (oauth_links JSONB) — расширение, не баг
- slime-arena-cec, 7f2, bjp (P3 рефакторинг) — косметика, не влияет на игроков

---

## Фаза 1: Клиентские баги (таймеры и переходы)

Задачи 1, 2, 3 — связаны общей областью: переходы между фазами и таймеры в `client/src/main.ts`.

### 1.1 slime-arena-b7z6 (P1, L) — Зависание экрана выбора класса

**Проблема:** При "Играть ещё" экран выбора класса зависает, таймер не обновляется.

**Корневая причина:** В `onPlayAgain` (main.ts:~3783) — гонка между `roomToLeave.leave()` и `connectToServer()`. Клиент может получить состояние от старой комнаты и не переключиться на новую.

**Файлы:**
- [main.ts](client/src/main.ts) — `onPlayAgain` (~3783-3813), `onPlay` (~3768-3772)
- [gameState.ts](client/src/ui/signals/gameState.ts) — сигналы фаз

**Решение:**
1. Установить `activeRoom = null` **до** `setPhase("connecting")`
2. При получении `phase === "Spawn"` от сервера — переключать UI на экран выбора класса
3. Таймаут безопасности: если "connecting" > 10 сек → сбросить в "menu"

### 1.2 slime-arena-hfww (P2, M) — Таймер зависает после боя

**Проблема:** Таймер обратного отсчёта до следующего боя замерзает на Chrome mobile.

**Корневая причина:** `setInterval` с декрементом (main.ts:~2419-2427). Chrome mobile замораживает `setInterval` при переходе вкладки в background. `resultsTimerInterval` не очищается в `leaveRoomFromUI`.

**Файлы:**
- [main.ts](client/src/main.ts) — `resultsTimerInterval` (~2409-2427)

**Решение:**
1. Заменить `setInterval` с декрементом на вычисление от `Date.now()`: сохранить `resultsEndTime`, на каждом тике считать `Math.ceil((resultsEndTime - Date.now()) / 1000)`
2. Обработчик `visibilitychange` для пересчёта при возврате вкладки
3. Очищать `resultsTimerInterval` в `leaveRoomFromUI()`

### 1.3 *новая задача* (P2, S) — Фаза 'connecting' не рендерится (#126)

**Проблема:** При "Играть ещё" мелькает главный экран перед подключением.

**Файлы:**
- [MainScreen.tsx](client/src/ui/components/MainScreen.tsx) или аналогичный компонент меню

**Решение:** Добавить обработку `gamePhase.value === "connecting"` — показывать спиннер "Подключение..."

**Критерии приёмки Фазы 1:**
- [ ] 10 последовательных "Играть ещё" без зависаний
- [ ] Таймер корректен после background/foreground вкладки
- [ ] При "Играть ещё" показывается индикатор подключения
- [ ] `npm run build` проходит

---

## Фаза 2: Серверные баги (auth и валидация)

Задачи 4, 5 — мета-сервер, не затрагивают детерминизм симуляции.

### 2.1 slime-arena-vsn5 (P1, S) — Скин не сохраняется при OAuth upgrade

**Проблема:** При OAuth upgrade гостя skinId не передаётся → скин сбрасывается на дефолтный.

**Файлы:**
- [matchResults.ts](server/src/meta/routes/matchResults.ts) — формирование skinId в claimToken (~367-372)
- [auth.ts](server/src/meta/routes/auth.ts) — извлечение skinId (~744)
- [jwtUtils.ts](server/src/meta/utils/jwtUtils.ts) — ClaimPayload.skinId (~53)

**Решение:**
1. Проследить путь skinId: `localStorage.guest_skin_id` → `/match-results` → `claimToken` → `/auth/upgrade`
2. Убедиться, что `req.body.skinId` считывается для гостей в `matchResults.ts`
3. Fallback: если skinId пуст → `generateRandomBasicSkin()`
4. Добавить лог `[Auth] Upgrade skinId: ${skinId}`

### 2.2 slime-arena-n17m (P2, S) — normalizeNickname() и null

**Проблема:** `normalizeNickname(null)` → `'null'` может пройти валидацию.

**Файлы:**
- [nicknameValidator.ts](server/src/utils/generators/nicknameValidator.ts) — `normalizeNickname()`, `validateAndNormalize()`

**Решение:**
```typescript
export function normalizeNickname(nickname: string | null | undefined): string {
  if (nickname == null) return '';
  return String(nickname).trim().replace(/\s+/g, ' ');
}
```

**Критерии приёмки Фазы 2:**
- [ ] OAuth upgrade гостя сохраняет скин в `profiles.selected_skin_id`
- [ ] `validateAndNormalize(null)` не создаёт никнейм "null"
- [ ] `npm run test` проходит

---

## Фаза 3: Баланс PvP (геймплей)

Задачи 6, 7 — строго последовательные, обе в `combatSystem.ts`. Затрагивают детерминизм.

### 3.1 slime-arena-mtw (P2, M) — Несимметричные модификаторы укуса

**Проблема:** `damageBonusMult` применяется только к `attackerGain`, `damageTakenMult` — только к `scatterMass`. Таланты работают не по спецификации.

**Файлы:**
- [combatSystem.ts](server/src/rooms/systems/combatSystem.ts) — `processCombat()` (~58-73)
- [balance.json](config/balance.json) — секция pvp/combat

**Решение:**
1. Рассчитать общую потерю: `totalDamage = baseDamage * zoneMultiplier * damageBonusMult * damageTakenMult * (1 - totalResist)`
2. Разделить на `attackerGain` и `scatterMass` по процентам
3. Сохранить инвариант: `massLoss = attackerGain + scatterMass`

### 3.2 slime-arena-4xh (P2, M) — Талант Вампир

**Проблема:** Вампир перенаправляет scatter в attackerGain, но формула не соответствует GDD ("бок 10% → 20%").

**Зависимость:** Выполнять **после** 3.1 (mtw).

**Файлы:**
- [combatSystem.ts](server/src/rooms/systems/combatSystem.ts) — vampire логика (~93-112)
- [TalentModifierCalculator.ts](server/src/rooms/systems/talent/TalentModifierCalculator.ts) — `mod_vampireSideGainPct`

**Решение:**
1. После фикса mtw пересчитать формулу Вампира
2. `attackerGain = defenderMass * vampireSideGainPct * modifiers` (20% при укусе в бок)
3. Разница (20% - 10%) берётся за счёт scatter, масса не создаётся

**Критерии приёмки Фазы 3:**
- [ ] Талант "Стойкий" уменьшает и scatter, и attackerGain
- [ ] Талант "Острые зубы" увеличивает и scatter, и attackerGain
- [ ] Вампир при укусе в бок даёт 20% массы жертвы (по GDD)
- [ ] Инвариант: `actualLoss >= attackerGain + scatterMass`
- [ ] `npm run test` проходит (детерминизм!)

---

## Фаза 4: UI баг + тех долг

Задачи 8, 9 — независимые, минимальный риск.

### 4.1 slime-arena-y2z2 (P2, S) — Гость видит PLAYER после матча

**Проблема:** `useState(authService.isAnonymous())` инициализируется один раз при маунте. После возврата из матча `isGuest` не пересчитывается → показывается "PLAYER" и медали вместо "Войти".

**Файлы:**
- [MainScreen.tsx](client/src/ui/components/MainScreen.tsx) — `isGuest` state (~648-649)

**Решение:** Заменить `useState` на вычисляемое значение из сигнала `currentUser`, чтобы реактивно обновлялось при каждом рендере.

### 4.2 *новая задача* (P2, S) — Изолировать generateRandomBasicSkin()

**Проблема:** `Math.random()` в `server/src/utils/generators/skinGenerator.ts` — нарушение правила детерминизма (формально в мета-слое, но физически в utils).

**Файлы:**
- [skinGenerator.ts](server/src/utils/generators/skinGenerator.ts) — `generateRandomBasicSkin()` (~74)

**Решение:**
1. Переместить `generateRandomBasicSkin()` в `server/src/meta/utils/skinGenerator.ts`
2. В оригинальном файле оставить детерминированные функции
3. Обновить импорты в `server/src/meta/routes/` и `server/src/meta/services/`

**Критерии приёмки Фазы 4:**
- [ ] Гость видит "Гость" и "Войти" после возврата из матча
- [ ] `generateRandomBasicSkin()` импортируется из `server/src/meta/utils/`
- [ ] `npm run build` и `npm run test` проходят

---

## Зависимости

```
Фаза 1: [b7z6] → [hfww] → [#126]     (общая область: таймеры/фазы клиента)
Фаза 2: [vsn5] | [n17m]               (независимы)
Фаза 3: [mtw] → [4xh]                 (строго последовательно)
Фаза 4: [y2z2] | [skinGen]            (независимы)

Фазы 1-4 параллелизуемы (разные области кода).
```

---

## Оценка

| Сложность | Кол-во | Оценка времени |
|-----------|--------|----------------|
| L (Large) | 1 | ~4-5 ч |
| M (Medium) | 3 | ~6-9 ч |
| S (Small) | 5 | ~5 ч |
| **Итого** | **9** | **~15-19 ч** |

Реалистично: **2-3 рабочих дня** с учётом тестирования и ревью.

---

## Верификация

1. `npm run build` — сборка shared → server → client
2. `npm run test` — детерминизм, orb-bite, arena-generation
3. Ручное тестирование на Chrome mobile (Android):
   - 10× "Играть ещё" без зависаний
   - Таймер после background/foreground
   - OAuth upgrade гостя → проверить скин
   - Гостевой UI после возврата из матча

---

## Подготовительные действия PM

```bash
# 1. Создать ветку спринта
git checkout main && git pull
git checkout -b sprint-21/bugfix-tech-debt

# 2. Создать недостающие задачи в Beads
bd create --title="UI: фаза connecting мелькает главным экраном (#126)" --type=bug --priority=2
bd create --title="Изолировать generateRandomBasicSkin() в meta/utils" --type=task --priority=2

# 3. Установить зависимости
bd dep add <4xh> <mtw>          # Вампир зависит от симметричных модификаторов
bd dep add <#126> <b7z6>        # Connecting зависит от фикса фаз

# 4. Обновить activeContext.md
```
