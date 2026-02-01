# Sprint 18: Tech Debt Reduction

**PM:** Claude Opus 4.5
**Дата:** 2026-02-01
**Версия:** 0.7.4 → 0.7.5

---

## Ревизия Beads

### Статистика
- **Всего задач:** 171
- **Открытых:** 78
- **Заблокированных:** 4
- **Готовых к работе:** 74

### Обнаруженные дубликаты (требуют консолидации)

| Группа | Задачи | Действие |
|--------|--------|----------|
| REWARDS_CONFIG | `slime-arena-v7x8`, `slime-arena-07o`, `slime-arena-0v2` | Оставить `slime-arena-0v2`, закрыть остальные |
| place in personalStats | `slime-arena-8e3`, `slime-arena-isf` | Оставить `slime-arena-8e3`, закрыть `slime-arena-isf` |

---

## План Sprint 18: Tech Debt + Stability

### Цели спринта
1. **Стабильность:** исправить критичные баги UX
2. **Консолидация:** закрыть дубликаты, привести в порядок Beads
3. **Безопасность:** закрыть хотя бы 2 P1 задачи по OAuth
4. **Рефакторинг:** мелкие улучшения кодовой базы

### Приоритет 1: Баги (влияют на UX)

| ID | Приоритет | Описание | Оценка |
|----|-----------|----------|--------|
| `slime-arena-zmf` | P1 | Адаптивный джойстик смещает базу | 1-2ч |
| `slime-arena-k8w` | P2 | Скин не сохраняется после OAuth | 1ч |
| `slime-arena-hp5` | P2 | Play Again нестабилен при Results | 2ч |

### Приоритет 2: OAuth безопасность (P1)

| ID | Описание | Оценка |
|----|----------|--------|
| `slime-arena-3ed` | Rate limiting на /auth/* endpoints | 2-3ч |
| `slime-arena-2q0` | Nickname validation в /auth/upgrade | 1ч |

### Приоритет 3: Tech Debt консолидация

| ID | Описание | Оценка |
|----|----------|--------|
| `slime-arena-0v2` | Move REWARDS_CONFIG to balance.json | 1ч |
| `slime-arena-yij` | Кэшировать auth-данные в signals | 1-2ч |
| `slime-arena-xta` | Разделить ошибку клейма и таймер в Results | 1ч |

### Задачи на закрытие (дубликаты/неактуальные)

```bash
# Закрыть дубликаты REWARDS_CONFIG
bd close slime-arena-v7x8 slime-arena-07o --reason="Дубликат slime-arena-0v2"

# Закрыть дубликат place
bd close slime-arena-isf --reason="Дубликат slime-arena-8e3"
```

---

## Scope спринта

**Включено (8 задач):**
1. `slime-arena-zmf` — Фикс джойстика (P1 bug)
2. `slime-arena-k8w` — Сохранение скина после OAuth (P2 bug)
3. `slime-arena-hp5` — Стабилизация Play Again (P2)
4. `slime-arena-3ed` — Rate limiting /auth/* (P1 security)
5. `slime-arena-2q0` — Nickname validation (P1 security)
6. `slime-arena-0v2` — REWARDS_CONFIG → balance.json (P2)
7. `slime-arena-yij` — Auth кэширование в signals (P2)
8. `slime-arena-xta` — Разделение UI в Results (P2)

**Исключено из спринта:**
- Баги баланса (`slime-arena-mtw`, `slime-arena-4xh`) — требуют комплексного пересмотра талантов
- OAuth верификация JWT (`slime-arena-2j6`, `slime-arena-u1r`) — требуют платных SDK/ключей
- PKCE валидация (`slime-arena-b1b`) — требует тестирования на реальных устройствах
- UI экраны (ShopScreen, ProfileScreen и др.) — отдельный спринт

---

## Порядок выполнения

```
Фаза 1: Консолидация Beads (PM)
├── Закрыть 3 дубликата
└── Обновить Memory Bank

Фаза 2: Баги UX (Developer)
├── slime-arena-zmf (джойстик)
├── slime-arena-k8w (скин)
└── slime-arena-hp5 (Play Again)

Фаза 3: OAuth безопасность (Developer)
├── slime-arena-3ed (rate limiting)
└── slime-arena-2q0 (nickname validation)

Фаза 4: Tech Debt (Developer)
├── slime-arena-0v2 (REWARDS_CONFIG)
├── slime-arena-yij (auth signals)
└── slime-arena-xta (Results UI)
```

---

## Верификация

### Тесты
```bash
npm run build
npm run test
```

### Ручная проверка
- [ ] Джойстик не уплывает при удержании (mobile)
- [ ] Скин сохраняется после OAuth upgrade
- [ ] Play Again работает корректно из Results
- [ ] /auth/* отвечает 429 при спаме
- [ ] Невалидные никнеймы отклоняются

---

## Ключевые файлы

| Файл | Изменения |
|------|-----------|
| [joystick.ts](client/src/input/joystick.ts) | Фикс adaptive режима |
| [authService.ts](client/src/services/authService.ts) | Сохранение скина |
| [main.ts](client/src/main.ts) | Play Again стабилизация |
| [authRoutes.ts](server/src/meta/routes/authRoutes.ts) | Rate limiting |
| [balance.json](config/balance.json) | REWARDS_CONFIG |
| [gameState.ts](client/src/ui/signals/gameState.ts) | Auth кэширование |

---

## Оценка трудозатрат

| Фаза | Задачи | Оценка |
|------|--------|--------|
| Консолидация | 3 | 15 мин |
| Баги UX | 3 | 4-5ч |
| OAuth | 2 | 3-4ч |
| Tech Debt | 3 | 3-4ч |
| **Итого** | **11** | **~12ч** |

---

## Решения

1. **Rate limiting:** самописный middleware (~30 строк)
   - Лимит: 10 запросов/минуту на `/auth/*`
   - 0 зависимостей, полный контроль
   - Файл: `server/src/meta/middleware/rateLimiter.ts`

2. **REWARDS_CONFIG:** полный перенос в balance.json

3. **Дубликаты:** закрыть 3 задачи (`slime-arena-v7x8`, `slime-arena-07o`, `slime-arena-isf`)

---

**Статус:** Утверждён
