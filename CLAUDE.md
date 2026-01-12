# Slime Arena — инструкции для Claude

## Главное правило

**Работай по задачам Beads.** Перед началом работы выполни `bd ready` и выбери задачу. Следуй правилам из `.beads/AGENT_ROLES.md`.

> ⛔ **Пуш в main запрещён.** Создавай ветку `sprint-X/task-name`, работай в ней, создавай PR. Merge — только человек-оператор.

## Коммуникация

| Аспект | Правило |
|--------|---------|
| **Язык** | Только русский. Без жаргона и англицизмов. |
| **Термины** | Идентификаторы кода (переменные, классы, методы, файлы) — на английском. |
| **Стиль** | Кратко, по делу. Без вводных фраз. |
| **Факты** | Утверждения подкрепляй ссылками на файлы и строки. |

## Архитектура проекта

- **Монорепозиторий:** `client/`, `server/`, `shared/` (npm workspaces)
- **Сервер (Colyseus)** — источник истины: клиент отправляет только `InputCommand`
- **Симуляция:** 30 тиков/с, детерминизм через `Rng` из `server/src/utils/rng.ts`

## Критичные правила

### Детерминизм (P0)

- ✅ Используй только `Rng` класс для случайности
- ❌ Никогда `Math.random()`, `Date.now()`, `performance.now()` в симуляции
- Проверка: `npm run test`

### Баланс (P1)

- ✅ Все числа в `config/balance.json`
- ❌ Никаких hardcoded констант в коде
- Типы: `shared/src/config.ts`

### Порядок систем

- Порядок вызовов в `ArenaRoom.onTick()` фиксирован
- Изменение порядка ломает детерминизм

### Mobile-First (P1)

> 90%+ аудитории — мобильные устройства (Telegram, Яндекс.Игры, соцсети)

- ❌ **Никаких CSS-градиентов в анимации** (`radial-gradient`, `linear-gradient` в `requestAnimationFrame`)
- ❌ Никаких сложных `filter`, `backdrop-filter`, `box-shadow` на больших областях
- ❌ Никаких процедурных текстур через CSS — только запечённые PNG/WebP
- ✅ Для движения фона: `transform: translate3d()` (GPU-ускорение)
- ✅ Текстуры: бесшовные тайлы 512x512 или 256x256
- Документ: `docs/soft-launch/SlimeArena-GDD-Art-Architecture.md`

## Команды

```bash
# Разработка
npm run dev:server      # ws://localhost:2567
npm run dev:client      # http://localhost:5174

# Сборка и тесты
npm run build           # shared → server → client
npm run test            # determinism + orb-bite + arena-generation
```

## Beads (управление задачами)

```bash
bd prime               # Загрузить контекст
bd ready               # Доступные задачи
bd show <issue-id>     # Детали задачи
bd update <id> --status=in_progress
bd close <id> --reason="..."
```

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `config/balance.json` | Параметры баланса |
| `server/src/rooms/ArenaRoom.ts` | Игровая логика (4000+ строк) |
| `server/src/utils/rng.ts` | Детерминированный генератор |
| `client/src/main.ts` | Клиентский код (5000+ строк) |
| `shared/src/formulas.ts` | Игровые формулы |
| `.beads/AGENT_ROLES.md` | Роли агентов |
| `.memory_bank/activeContext.md` | Текущее состояние проекта |

## Дополнительный контекст

- **Архитектура:** `docs/soft-launch/SlimeArena-Architecture-v4.2.5-Part1.md` (и Part2-4)
- **Технический план:** `docs/soft-launch/TZ-SoftLaunch-v1.4.7.md`
- **GDD:** `docs/gdd/` (версия 3.3.2)
- **Memory Bank:** `.memory_bank/`
- **Роли агентов:** `.beads/AGENT_ROLES.md`
