# Технический долг (Technical Debt)

Задачи, требующие уточнения дизайна или refactoring.

## Итог аудита (янв 2026)
Актуальные пункты технического долга:
- **Нереализованные таланты**: `sense` (Чутьё), `regeneration` (Регенерация) — эффекты не применяются.
- **Сложные таланты**: `momentum`, `berserk`, `symbiosisBubbles` — запланированы в отдельном спринте.
- **Типизация систем ArenaRoom.ts**: общий контекст для систем вместо `any`.
- **Оптимизация зон**: хранение активной зоны игрока на тик, чтобы уменьшить повторные проверки.
- **Тесты**: нет проверок для новых модулей (кроме генерации арены).
- **Дрифт механика**: низкий приоритет, не реализовано.

## Итог аудита логов (фев 2026)
Новые пункты по результатам анализа серверных логов:
- **UI: фаза 'connecting' не рендерится** (#126) — мелькает главный экран при "Играть еще"
- **Оптимизация tick=2700** (#127) — просадки до 118ms при завершении матча
- **"Не удалось разместить зон"** (#128) — 303 предупреждения за сессию, требует исследования
- **Docker: директория логов телеметрии** (#130) — EACCES при создании /app/server/dist/server/logs
- **Устаревшие API endpoints** (#129) — 404 на /api/room/join-token и /claim

## Приоритет: Высокий

### При регистрации скин слайма не сохраняется (#121)
**Задача:** При OAuth upgrade из гостя скин не переносится в профиль зарегистрированного пользователя.

**Контекст:**
- По ТЗ игрок должен сохранить скин, которым играл как гость.
- Скин гостя хранится в `localStorage.guest_skin_id` и передаётся в `claimToken.skinId`.
- При `upgradeGuestToRegistered()` скин не записывается в `profiles.selected_skin_id`.

**Решение:**
- В `/auth/upgrade` endpoint извлечь `skinId` из `claimToken` и передать в `createProfile()`.
- Либо после создания профиля обновить `selected_skin_id`.

**Файлы:**
- `server/src/meta/routes/auth.ts`
- `server/src/meta/services/AuthService.ts`

**Статус:** Открыто (Issue #121)

---

### Ревизия веток и консолидация изменений
**Задача:** Разобрать состояние локальных/удалённых веток и собрать единую рабочую версию на базе `main`.

**Контекст:**
- Несколько агентов работали в разных ветках, есть путаница и пересечения.
- Есть локальный коммит `77432b8` поверх `feat/gameplay-mvp-classes` с большим набором изменений и признаками мусора в `shared/src/config.ts`.
- За последние 2 суток смержены PR #8 и #9 (ветки `copilot/*`) в `main`.

**Решение:**
- Зафиксировать каноническую ветку (предлагается `main`).
- Отдельно просмотреть и выборочно перенести нужные правки из `feat/gameplay-mvp-classes`.
- Собрать и проверить рабочую версию после объединения.
- Обновить план дальнейших работ и Memory Bank.

**Файлы:**
- `server/src/rooms/ArenaRoom.ts`
- `shared/src/config.ts`
- `client/src/main.ts`
- `.memory_bank/*`

**Статус:** Закрыто (main принят, 77432b8 отброшен, build/test ok)

---

### Удаление устаревших каталогов (.u2, _ext/u2, legacy)
**Задача:** Убрать из репозитория следы старых проектов/песочниц, оставить только актуальный код и документацию.

**Контекст:**
- `.u2` и `_ext/u2` - копии внешнего репозитория, хранятся как gitlink без `.gitmodules`.
- `legacy/` содержит устаревший код, не используется в текущем пайплайне.

**Решение:**
- Удалить gitlink записи из индекса, добавить пути в `.gitignore`.
- При необходимости удалить локальные копии после проверки, что ничего не зависит.
- Отдельно решить судьбу `legacy/` (удаление или архив вне репозитория).

**Файлы:**
- `.gitignore`
- `.u2`
- `_ext/u2`
- `legacy/`

**Статус:** Закрыто (legacy удален, .u2/_ext/u2 в .gitignore)

---

### ~~PvP укус + Last Breath — «создание массы»~~
**Задача:** Пересчёт gain/scatter от реальной потери жертвы

**Контекст:**
- Текущая формула: `scatter = stealPercentOfDamage × damagePct` → вычисляется ДО клампа потери жертвы
- Если жертва уже на минимальной массе, охотник всё равно получает «виртуальный» прирост
- Last Breath + bite может «создать» массу из ничего

**Решение:**
```ts
const defenderMassBefore = defender.mass;
this.applyMassDelta(defender, -massLoss);
const actualLoss = defenderMassBefore - defender.mass;
const attackerGain = actualLoss * (attackerGainPct / totalRewardPct);
const scatterMass = actualLoss * (scatterPct / totalRewardPct);
// Invariant check
if (attackerGain + scatterMass > actualLoss + 0.001) {
    console.warn(`[processCombat] Invariant violation`);
}
```

**Файлы:**
- `server/src/rooms/ArenaRoom.ts` — `processCombat()`, строки 1698-1710

**Статус:** Закрыто (31 дек 2025) — добавлена проверка инварианта

---

### ~~Freeze при результатах не полный~~
**Задача:** `updateOrbsVisual()` продолжает менять состояние после победы/поражения

**Контекст:**
- При показе результатов игра должна быть полностью заморожена
- Но visual update орбов всё ещё работает и может вызывать побочные эффекты

**Решение:**
- Добавлен флаг `freezeVisualState` в client/src/main.ts
- При `phase === "Results"` флаг устанавливается в true
- В `getSmoothedRenderState` smoothStep для орбов и сундуков пропускается при freezeVisualState

**Файлы:**
- `client/src/main.ts` — переменная `freezeVisualState`, render loop

**Статус:** Закрыто (31 дек 2025) — орбы и сундуки замораживаются

---

### ~~Джойстик: режим "dynamic"~~
**Задача:** Решить вопрос о поддержке режима "dynamic" джойстика

**Контекст:**
- В `JoystickConfig.mode` был убран тип "dynamic" (остались только "fixed" | "adaptive")
- Это было сделано, потому что валидатор не поддерживал "dynamic" и молча заменял его на "adaptive"
- Возник вопрос: нужен ли "dynamic" режим в ближайших спринтах?

**Решение:**
- [x] **Нет:** Режим «dynamic» не нужен в MVP. Тип уже убран из JoystickConfig.mode.
- Документация и комментарии не содержат упоминаний (кроме шаблона Dynamic DOM в ui_extension).

**Файлы:**
- `client/src/input/joystick.ts` — тип `mode: "fixed" | "adaptive"` (dynamic убран)

**Статус:** Закрыто (31 дек 2025) — режим не нужен, код уже очищен

---

## Приоритет: Средний

### [P2] normalizeNickname() не защищает от null/undefined
**Задача:** Добавить проверку на null/undefined в функцию normalizeNickname()

**Источник:** PR#109 Code Review (Codex 5.2)

**Контекст:**
- В `server/src/utils/generators/nicknameValidator.ts` функция `normalizeNickname()` вызывает `String(nickname)`
- `String(null)` → `'null'`, `String(undefined)` → `'undefined'`
- После нормализации эти значения могут пройти валидацию
- Примечание: `validateNicknameDetailed()` уже проверяет на null/undefined, но `validateAndNormalize()` вызывает `normalizeNickname()` **до** этой проверки

**Решение:**
```typescript
export function normalizeNickname(nickname: string | null | undefined): string {
  if (nickname == null) return '';
  return String(nickname).trim().replace(/\s+/g, ' ');
}
```

Или альтернативно: проверять в `validateAndNormalize()` до вызова `normalizeNickname()`.

**Файлы:**
- `server/src/utils/generators/nicknameValidator.ts`

**Статус:** Открыто. Приоритет P2.

---

### [P2] generateRandomBasicSkin() использует Math.random() в серверном коде
**Задача:** Изолировать функцию с Math.random() в мета-слое или переместить файл

**Источник:** PR#109 Code Review (Codex 5.2)

**Контекст:**
- В `server/src/utils/generators/skinGenerator.ts:72` функция `generateRandomBasicSkin()` использует `Math.random()`
- По правилам проекта (CLAUDE.md) `Math.random()` запрещён в серверной симуляции
- Функция предназначена только для мета-сервера, но находится в общей папке `utils/`
- Уже добавлен JSDoc-комментарий "ТОЛЬКО ДЛЯ МЕТАСЕРВЕРА", но этого недостаточно

**Решение:**
1. Переместить `generateRandomBasicSkin()` в `server/src/meta/utils/skinGenerator.ts`
2. Или использовать ESLint правило для запрета импорта в `rooms/`

**Файлы:**
- `server/src/utils/generators/skinGenerator.ts`
- Новый путь: `server/src/meta/utils/skinGenerator.ts`

**Статус:** Открыто. Приоритет P2.

---

### [P2] oauth_links: добавить metadata JSONB для future-proofing
**Задача:** Добавить колонку metadata в таблицу oauth_links

**Источник:** PR#109 Code Review (Gemini 3 Pro)

**Контекст:**
- В `server/src/db/migrations/007_meta_gameplay_tables.sql` таблица `oauth_links` содержит только необходимые поля
- Рекомендуется добавить `metadata JSONB DEFAULT '{}'` для хранения дополнительных данных от провайдеров
- Примеры данных: `refresh_token`, `scope`, `email` для коммуникации

**Решение:**
Создать новую миграцию:
```sql
-- Migration: 009_oauth_links_metadata.sql
ALTER TABLE oauth_links ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

**Польза:**
- Сохранение дополнительных данных без изменения схемы БД
- Готовность к расширению OAuth провайдеров

**Файлы:**
- Новый файл: `server/src/db/migrations/009_oauth_links_metadata.sql`
- `server/src/meta/models/OAuth.ts` — добавить поле `metadata?: Record<string, unknown>`

**Статус:** Открыто. Приоритет P2.

---

### Orb bite threshold vs max-bite - нужны раздельные параметры
**Задача:** Разделить порог входа в bite-режим и максимальную массу для bite

**Контекст:**
- Сейчас один параметр управляет двумя разными вещами
- `orbBiteThreshold` используется и как минимум для начала bite, и как максимум для получения массы
- Это неинтуитивно и затрудняет тюнинг баланса

**Решение:**
- `orbBiteMinMass` — минимальная масса для входа в bite-режим
- `orbBiteMaxMass` — максимальная масса, при которой orb bite эффективен

**Файлы:**
- `config/balance.json`
- `server/src/rooms/ArenaRoom.ts` — orb collision logic

**Статус:** Закрыто (2 янв 2026) - параметры добавлены и используются

---

### Типизация систем ArenaRoom.ts
**Задача:** Ввести общий тип контекста для `server/src/rooms/systems/*` вместо `any`.

**Контекст:**
- Сейчас системы принимают `room: any`, теряется подсказка по полям и методам.
- Это усложняет поддержку и повышает риск ошибок при рефакторинге.
- Системы в `server/src/rooms/systems/` включают: abilitySystem, boostSystem, chestSystem, collisionSystem, deathSystem, effectSystems, hungerSystem, movementSystems, orbSystem, rebelSystem, safeZoneSystem, talentCardSystem.

**Решение:**
- Описать интерфейс `IArenaRoomContext` с используемыми полями/методами.
- Подключить интерфейс в модулях систем.
- Заменить `room: any` на `room: IArenaRoomContext` во всех системах.
- Обновить импорты и типы для совместимости с TypeScript.

**Польза:**
- Автодополнение и проверка типов в IDE
- Меньше ошибок при рефакторинге
- Документирование API комнаты

**Файлы:**
- `server/src/rooms/systems/*` (12 файлов)
- `server/src/rooms/ArenaRoom.ts`
- Новый файл: `server/src/rooms/IArenaRoomContext.ts`

**Оценка трудозатрат:** 2-3 часа

**Статус:** Открыто. Планируется в следующем спринте после завершения основного функционала.

---

### Оптимизация проверки активной зоны
**Задача:** Хранить активную зону игрока на тик, чтобы уменьшить повторные проверки.

**Контекст:**
- `getZoneForPlayer()` вызывается несколько раз в `movementSystems.ts` и `effectSystems.ts`.
- При росте числа игроков и количества систем число проверок растёт (в среднем) линейно от `players × вызовы_на_игрока_в_тик`.
- Зона игрока не меняется в течение тика, но проверяется многократно.
- Типичный игрок проверяет зону 2-3 раза за тик.

**Текущая реализация:**
- `effectSystems.ts`: проверка зоны для применения эффектов (урон от лавы, ускорение от турбо)
- `movementSystems.ts`: проверка зоны для модификаторов скорости (замедление на льду, слизи)

**Решение:**
- Добавить серверный кэш активной зоны (не часть Colyseus Schema, не синхронизируется клиентам).
- В начале тика запустить `zoneCalculationSystem()`, которая однократно считает зону для каждого игрока и сохраняет в кэш.
- Переписать системы для использования кэша вместо повторных вызовов `getZoneForPlayer()`.
- Опционально: кэшировать не только `zoneId`, но и ссылку на объект зоны.

**Польза:**
- Сокращение числа проверок с O(players × systems) до O(players).
- Улучшение производительности симуляции при 10+ игроках.
- Более предсказуемая нагрузка на каждый тик.

**Файлы:**
- `server/src/rooms/systems/movementSystems.ts`
- `server/src/rooms/systems/effectSystems.ts`
- `server/src/rooms/ArenaRoom.ts` (порядок систем)

**Оценка трудозатрат:** 1-2 часа

**Метрики для проверки:**
- Среднее время тика должно уменьшиться на 5-10% при 10+ игроках
- Количество вызовов `getZoneForPlayer()` за тик = количество игроков (вместо 2-3× больше)

**Статус:** Открыто. Низкий приоритет, не критично для MVP.

---

### Зоны и препятствия арены (GDD-Arena)
**Задача:** Реализовать зоны (Нектар, Лёд, Слизь, Лава, Турбо) и препятствия (узкие проходы, столбы, шипы).

**Контекст:**
- Реализованы зоны и препятствия, логика вынесена в генератор и системы.
- Визуальные маркеры добавлены на карте и в мире.

**Файлы:**
- `server/src/rooms/ArenaRoom.ts`
- `shared/src/config.ts`
- `config/balance.json`
- `client/src/main.ts`

**Статус:** Закрыто (2 янв 2026)

---

### Документация UI: HUD и Talent Modal
**Задача:** Обновить описания `hud.md` и `talent_modal.md` под текущие поля.

**Контекст:**
- Документация должна соответствовать текущим полям `GameState` и UI.

**Решение:**
- `hud.md` и `talent_modal.md` синхронизированы с актуальными полями.

**Файлы:**
- `.memory_bank/ui_extension/components/hud.md`
- `.memory_bank/ui_extension/components/talent_modal.md`

**Статус:** Закрыто

---

### ~~Документировать инвариант applyMassDelta() clamp~~
**Задача:** Добавить комментарий о том, что clamp применяется ПОСЛЕ delta

**Контекст:**
- `applyMassDelta()` сначала применяет delta, потом clamp до `[minSlimeMass, ∞)`
- Это важный инвариант, который должен быть задокументирован

**Решение:**
- Добавлен JSDoc с описанием инварианта в `applyMassDelta()`

**Файлы:**
- `server/src/rooms/ArenaRoom.ts` — `applyMassDelta()`, строки 3331-3340

**Статус:** Закрыто (31 дек 2025)

---

### ~~GCD устанавливается даже при неудачной активации способности~~
**Задача:** Не ставить GCD, если способность не активировалась

**Контекст:**
- Предполагалось, что GCD (`abilityGcdTick`) ставится до проверки успешности
- Проверка показала: GCD уже корректно ставится ПОСЛЕ `if (!activated) return`

**Решение:**
- Не требуется — код уже корректен в `activateAbility()` строка 510

**Файлы:**
- `server/src/rooms/ArenaRoom.ts` — `activateAbility()`

**Статус:** Закрыто (31 дек 2025)

---

### ~~Dash может выйти за границы мира~~
**Задача:** Добавить clamp позиции после dash

**Контекст:**
- `activateDash()` меняла позицию, но не проверяла границы мира
- Первая версия исправления использовала только `widthM`, игнорируя `worldShape` и `heightM`
- При круговой карте или прямоугольной с разной шириной/высотой цель рывка могла выйти за границы

**Решение:**
- Используется существующий метод `clampPointToWorld()`, который корректно обрабатывает:
  - `worldShape: "rectangle"` с учётом `widthM` и `heightM`
  - `worldShape: "circle"` с учётом `radiusM`

**Файлы:**
- `server/src/rooms/ArenaRoom.ts` — `activateDash()`, строки 641-644

**Статус:** Закрыто (31 дек 2025) — обновлено с clampPointToWorld

---

### Рефакторинг ArenaRoom.ts
**Задача:** Разделить огромный файл на отдельные системы (как планировалось в шаге 8)

**Контекст:**
- Системы вынесены в отдельные файлы `server/src/rooms/systems/*`.
- Навигация по логике упрощена, зависимости остались в `ArenaRoom.ts`.

**Результат:**
- `server/src/rooms/systems/*` содержит отдельные системы симуляции.

**Статус:** Закрыто (2 янв 2026)

---

### Отложенные эффекты талантов (GDD v3.3)
**Задача:** Реализовать сложные эффекты новых талантов

**Контекст:**
- При имплементации талантов по GDD v3.3 часть эффектов отложена из-за сложности
- Уже реализованы: thorns, ambush, parasite, magnet (простые модификаторы)

**Отложенные таланты:**
- `sense` (Чутьё) — отображение сундуков на мини-карте, требует UI работы
- `regeneration` (Регенерация) — восстановление массы вне боя, требует трекинг "вне боя"
- `momentum` (Разгон) — бонус скорости при движении, требует трекинг времени движения
- `berserk` (Берсерк) — бонус урона за потерянную массу, требует трекинг начальной массы
- `symbiosisBubbles` (Симбиоз) — усиленные пузыри при касании, требует систему пузырей

**Файлы:**
- `server/src/rooms/ArenaRoom.ts` — recalculateTalentModifiers(), новые системы
- `client/src/main.ts` — UI для sense

**Статус:** Планируется в отдельном спринте

---

### BoostSystem (GDD v3.3 8)
**Задача:** Реализовать систему усилений (Boosts)

**Контекст:**
- GDD-Chests.md описывает усиления как запасную награду при отсутствии доступных талантов.
- До реализации усилений сундуки могли выдавать только таланты.

**Решение:**
- Добавлена конфигурация `boosts` и выбор усиления по `chestType`.
- Реализованы `rage`, `haste`, `guard`, `greed` с таймером и стеками.
- Эффекты: урон, скорость, поглощение урона, бонус массы орбов.
- Усиления сбрасываются при смерти и перезапуске матча.

**Файлы:**
- `server/src/rooms/ArenaRoom.ts` - `boostSystem()`, выдача и применение усилений
- `server/src/rooms/schema/GameState.ts` - поля `boostType`, `boostEndTick`, `boostCharges`
- `config/balance.json` - секция `boosts`
- `shared/src/config.ts` - типы и парсинг `boosts`
- `client/src/main.ts` - HUD-строка активного усиления

**Статус:** Закрыто

---

## Приоритет: Низкий

### Талант sense (Чутьё) — эффект не реализован
**Задача:** Реализовать эффект `chestSense` для таланта sense

**Контекст:**
- Талант определён в `config/balance.json`:
  ```json
  "sense": { "name": "Чутьё", "maxLevel": 2, "values": [2, 5], "effect": "chestSense", "category": "gather" }
  ```
- Эффект `chestSense` **отсутствует** в `TalentModifierCalculator.ts`
- Талант можно выбрать в игре, но он **ничего не делает**

**Требуемые изменения:**
1. Добавить `mod_chestSenseRadius: number = 0` в `server/src/rooms/schema/GameState.ts`
2. Добавить case `chestSense` в `applyTalentEffect()` в `TalentModifierCalculator.ts`
3. Реализовать логику подсветки/индикации сундуков в радиусе на клиенте

**Альтернатива:** Удалить талант из `talentPool.common` в balance.json

**Файлы:**
- `config/balance.json`
- `server/src/rooms/systems/talent/TalentModifierCalculator.ts`
- `server/src/rooms/schema/GameState.ts`
- `client/src/main.ts` (UI)

**Статус:** Открыто. Низкий приоритет.

---

### Талант regeneration (Регенерация) — эффект не реализован
**Задача:** Реализовать эффект `outOfCombatRegen` для таланта regeneration

**Контекст:**
- Талант определён в `config/balance.json`:
  ```json
  "regeneration": { "name": "Регенерация", "maxLevel": 2, "values": [[0.01, 5], [0.01, 4]], "effect": "outOfCombatRegen", "category": "defense" }
  ```
- Эффект `outOfCombatRegen` **отсутствует** в `TalentModifierCalculator.ts`
- Талант можно выбрать в игре, но он **ничего не делает**

**Требуемые изменения:**
1. Добавить модификаторы в `GameState.ts`:
   - `mod_regenPctPerSec: number = 0` — % массы в секунду
   - `mod_regenOutOfCombatSec: number = 0` — задержка "вне боя"
2. Добавить case `outOfCombatRegen` в `applyTalentEffect()`
3. Создать систему регенерации в `ArenaRoom.ts`:
   - Отслеживать `lastDamagedAtTick` для каждого игрока
   - После N секунд без урона начать восстанавливать % массы в секунду

**Альтернатива:** Удалить талант из `talentPool.common` в balance.json

**Файлы:**
- `config/balance.json`
- `server/src/rooms/systems/talent/TalentModifierCalculator.ts`
- `server/src/rooms/schema/GameState.ts`
- `server/src/rooms/ArenaRoom.ts`

**Статус:** Открыто. Низкий приоритет.

---

### Unit тесты для новых модулей
**Задача:** Написать тесты для `nameGenerator.ts` и `mathUtils.ts`

**Статус:** Планируется в отдельном PR

---

### Дрифт механика (TASK-05)
**Задача:** Реализовать дрифт при развороте > 120°

**Статус:** Низкий приоритет, планируется после MVP

---

## Закрытые вопросы

### ✅ Cooldown UI: SVG progress и label не отображались
- ~~`abilityButton.textContent = icon` удаляло все дочерние элементы~~
- ✅ **Решено:** Создан отдельный `abilityButtonIcon` span для иконки

### ✅ Q key binding
- ~~Клавиша Q дублировала функционал клавиши 1~~
- ✅ **Решено:** Убрана, оставлена только клавиша 1

### ✅ Shield flag не очищался сразу при блоке
- ~~`FLAG_ABILITY_SHIELD` сбрасывался только в следующем тике~~
- ✅ **Решено:** Флаг очищается сразу + attacker.lastAttackTick ставится

### ✅ Дубликат position: fixed
- ~~`abilityButton.style.position = "fixed"` устанавливался дважды~~
- ✅ **Решено:** Удалён дубликат

### ✅ GDD не соответствовал balance.json
- ~~Рывок: 150м/0.2с в GDD vs 80м/0.3с в balance.json~~
- ✅ **Решено:** GDD обновлён до актуальных значений

### ✅ Клавиши 2/3 активировали slot 0
- ~~Клавиши 2 и 3 отправляли abilitySlot: 0 вместо 1 и 2~~
- ✅ **Решено:** Убраны клавиши 2/3, оставлена только 1 (slot 0)

### ✅ Баланс PvP кража массы
- ~~Жёстко привязана к наличию урона~~
- ✅ **Решено:** Привязана к `damagePct` — жертва теряет `50% × damagePct`, охотник получает `25% × damagePct`

### ✅ Снапшоты (буфер vs одиночный)
- ~~Дублирование: `snapshotBuffer` и `latestSnapshot`~~
- ✅ **Решено:** Полностью удалён `snapshotBuffer`, используется U2-стиль (один последний снапшот)

### ✅ LCG генератор имён
- ~~Дублирование логики LCG в `nameGenerator.ts`~~
- ✅ **Решено:** Реализован `createLcg()` helper, DRY принцип






---

## Приоритет: Низкий (P3)

### PM Orchestrator: sys.path хаки в tools/*.py
**Beads:** `slime-arena-b6s`

**Контекст:**
- В `tools/consensus.py:18` и `tools/test_orchestrator.py:17` меняется `sys.path` на уровне импорта
- Это даёт побочный эффект для любого кода, который просто импортирует модуль

**Решение:**
- Запускать точку входа как модуль (`python -m tools.pm_orchestrator`)
- Или настроить `PYTHONPATH` / пакетную установку

**Источник:** PR #110, ревьювер: Copilot

---

### PM Orchestrator: комментарий о дедупликации не соответствует коду
**Beads:** `slime-arena-dc8`

**Контекст:**
- В `tools/consensus.py:72` комментарий говорит «дедупликация по файлу и строке»
- Но ключ включает ещё `issue.problem[:50]`

**Решение:**
- Либо поправить комментарий
- Либо изменить логику дедупликации на строго `(file, line)`

**Источник:** PR #110, ревьювер: Copilot
