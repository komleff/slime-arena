# План: Реверс-инжиниринг кодовой базы Slime Arena

## Context

Проект Slime Arena — 43K строк кода (171 файл) и 50K+ строк документации. Цели:
1. Создать реверс-документацию по фактическому коду (в `docs/reverse/`)
2. Сравнить с существующей документацией → найти расхождения
3. Обновить документацию / записать отклонения в TECH_DEBT
4. Подготовить архитектурное понимание для форка BonkRace (гоночная игра на базе движка Slime Arena)

---

## Декомпозиция на 16 модулей

Каждый модуль обрабатывается отдельным субагентом. Бюджет: ~3000-5000 строк кода на агента.

| # | Модуль | Строк кода | Ключевые файлы | Сравнить с |
|---|--------|-----------|----------------|------------|
| 01 | Shared Foundation | ~3700 | shared/src/*.ts, config/balance.json | GDD-Glossary, GDD-Core, Architecture Part4 |
| 02 | Game State Schema | ~500 | rooms/schema/GameState.ts | Architecture Part1, systemPatterns.md |
| 03 | ArenaRoom Lifecycle | ~2800 | rooms/ArenaRoom.ts, index.ts | Architecture Part1, systemPatterns.md, GDD-Core |
| 04 | Physics & Movement | ~1100 | systems/movementSystems.ts, collisionSystem.ts, helpers/ | GDD-Core, GDD-Arena |
| 05 | Combat System | ~700 | systems/combatSystem.ts, deathSystem.ts, hungerSystem.ts, boostSystem.ts | GDD-Combat, mass-combat.md |
| 06 | Abilities & Talents | ~2200 | systems/abilityActivation*.ts, talent/*.ts, effectSystems.ts | GDD-Abilities, GDD-Talents |
| 07 | Chests & Arena Zones | ~700 | systems/chestSystem.ts, arenaGenerator.ts, playerStateManager.ts | GDD-Chests, GDD-Arena |
| 08 | MetaServer Auth | ~3800 | meta/routes/auth.ts, meta/services/AuthService.ts, meta/platform/*.ts | Architecture Part2, Part4 |
| 09 | MetaServer Economy | ~3500 | meta/routes/matchResults,matchmaking,payment,shop,wallet,leaderboard + services | Architecture Part4 |
| 10 | MetaServer Admin | ~3300 | meta/routes/admin,abtest,analytics,config + services | Architecture Part3, Part4 |
| 11 | Client Game Loop | ~5300 | main.ts, rendering/, input/, game/, effects/ | U2-smoothing.md, Architecture Part1 |
| 12 | Client Services | ~3700 | services/*.ts, oauth/*.ts, api/metaServerClient.ts, platform/PlatformManager.ts | Architecture Part1, Part2 |
| 13 | Client UI | ~4900 | ui/**/*.tsx, ui/signals/gameState.ts | GDD-UI, UI-TZ-v1.6.1, ScreenMap |
| 14 | Client Platforms | ~1700 | platform/*Adapter.ts, platform/*AdsProvider.ts | Architecture Part2 |
| 15 | Infrastructure | ~2500 | db/*.ts, db/migrations/*.sql, docker/, .github/workflows/, rng.ts | Architecture Part4, techContext.md |
| 16 | Admin Dashboard | ~2800 | admin-dashboard/src/**/* | Architecture Part4 |

---

## Режим выполнения: все сразу

Все 16 модулей запускаются максимально параллельно. После завершения всех модулей — сводный агент собирает расхождения (99) и кросс-модульные потоки (98).

---

## Шаблон реверс-документации

Каждый модуль → файл `docs/reverse/NN-module-name.md`:

```markdown
# Reverse: [Module Name]
**Версия:** v0.8.7 | **Дата:** YYYY-MM-DD

## 1. Обзор (2-5 предложений)
## 2. Исходные файлы (таблица: файл, строк, роль)
## 3. Архитектура
  3.1 Диаграмма зависимостей
  3.2 Ключевые классы/функции (файл:строка, назначение, входы, выходы, вызовы)
## 4. Потоки данных (нумерованные шаги)
## 5. Конфигурация (параметры из balance.json/.env)
## 6. Захардкоженные значения (magic numbers не в конфиге)
## 7. Расхождения с документацией (таблица: документ, раздел, описание, приоритет P0-P2)
## 8. Технический долг (новый, не в TECH_DEBT.md)
## 9. Заметки для форка BonkRace (гоночная игра)
  - Что переиспользовать (сеть, auth, платформы, инфра)
  - Что удалить (боевая система, таланты, укусы)
  - Что заменить (арена→трасса, масса→скорость, фазы→круги)
```

---

## Методология сравнения

Три оси сравнения для каждого модуля:

| Ось | Вопрос | Результат |
|-----|--------|-----------|
| **Полнота** | Есть в коде, нет в доке? Есть в доке, нет в коде? | Списки |
| **Корректность** | Совпадают числа, формулы, названия, потоки? | Таблица расхождений |
| **Актуальность** | Deprecated фичи в доке? Новые фичи без доки? | Список |

---

## Выходные файлы

```
docs/reverse/
  00-index.md                  — Индекс, git hash, карта модулей
  01-shared-foundation.md      — Shared типы, конфиги, формулы
  02-game-state-schema.md      — Colyseus Schema, entity model
  03-arena-room-lifecycle.md   — ArenaRoom, тик, фазы
  04-physics-movement.md       — Физика, коллизии, генерация арены
  05-combat-system.md          — Бой, смерть, голод, бусты
  06-abilities-talents.md      — Способности, таланты, эффекты
  07-chests-arena-zones.md     — Сундуки, зоны, уровни
  08-meta-auth-identity.md     — Аутентификация, OAuth, JWT
  09-meta-economy.md           — Экономика, платежи, лидерборды
  10-meta-admin-analytics.md   — Админка, A/B, аналитика, конфиг
  11-client-gameloop.md        — Game loop, рендеринг, ввод
  12-client-services.md        — Клиентские сервисы, OAuth, API
  13-client-ui.md              — UI компоненты, state management
  14-client-platforms.md       — Платформенные адаптеры
  15-infrastructure.md         — БД, Docker, CI/CD, RNG
  16-admin-dashboard.md        — Admin Dashboard
  98-cross-module-flows.md     — Интеграционные потоки
  99-discrepancies.md          — Сводка всех расхождений
```

---

## Верификация

1. После каждой волны — проверить что все секции шаблона заполнены
2. После Волны 5 — собрать все расхождения (секция 7) в `99-discrepancies.md`
3. Обновить `TECH_DEBT.md` новыми находками
4. Создать `CLAUDE-platforms.md` (обнаружено: файл упомянут в CLAUDE.md, но не существует)
5. Финальный `git diff --stat` для обзора масштаба изменений

---

## Важные находки из исследования

- `CLAUDE-platforms.md` — упомянут в CLAUDE.md но **не существует**
- `shared/src/config.ts` (3138 строк) — монолитный файл типов конфигурации, потенциальный tech debt
- `client/src/main.ts` (3985 строк) — God Object клиента
- 14 common + 10 rare + 5 epic талантов в конфиге, но в TECH_DEBT.md отмечены нереализованные (`sense`, `regeneration`, `momentum`, `berserk`, `symbiosisBubbles`)
