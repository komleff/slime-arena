# План Sprint-15: Production Readiness

**Дата:** 29 января 2026
**PM:** Claude Opus 4.5
**Ветка:** `sprint-15/production-readiness`
**Цель:** Подготовка к production deployment
**Worktree:** `d:\slime-arena-meta`
**Предыдущий:** Sprint 14 (v0.7.0) — ✅ MERGED

---

## Резюме состояния

### Выполнено (Фаза 1)

- ✅ YandexAdapter — `client/src/platform/YandexAdapter.ts` (коммит 8da0a17)
- ✅ PokiAdapter — `client/src/platform/PokiAdapter.ts` (коммит 8da0a17)
- ✅ PlatformManager integration — приоритет Telegram → Yandex → Poki → Standalone
- ✅ PR#112 создан, субагент-ревью пройдено (2 итерации)
- ✅ Beads закрыты: slime-arena-laj, slime-arena-9o2, slime-arena-caf

### В ожидании

- ⏳ Внешний код-ревью PR#112 (Copilot, Gemini, Codex)

### Требует работы

- slime-arena-zmf — джойстик смещение
- E2E Smoke Tests — расширение сценариев
- Load Test — k6 верификация
- Environment Docs — документация production

---

## Цели спринта

1. **Platform Adapters** — ✅ YandexAdapter и PokiAdapter реализованы
2. **E2E Testing** — верифицировать полный цикл игрока
3. **Bug Fixes** — исправить критические баги
4. **Deployment Prep** — подготовить production инфраструктуру

---

## Фаза 1: Platform Adapters (P1)

### 1.1 YandexAdapter
**Beads:** создать `slime-arena-yandex-adapter`
**Файлы:**
- [client/src/platform/YandexAdapter.ts](../../client/src/platform/YandexAdapter.ts) — СОЗДАТЬ
- [client/src/platform/PlatformManager.ts](../../client/src/platform/PlatformManager.ts) — обновить
- [client/src/platform/index.ts](../../client/src/platform/index.ts) — экспорт

**Scope:**
- Реализовать IAuthAdapter: `getPlatformType()`, `isAvailable()`, `getCredentials()`, `getNickname()`
- Интеграция с Yandex Games SDK (`ysdk.player.getIDPerGame()`, `ysdk.player.getName()`)
- Проверка: `window.ysdk !== undefined`

### 1.2 PokiAdapter
**Beads:** создать `slime-arena-poki-adapter`
**Файлы:**
- [client/src/platform/PokiAdapter.ts](../../client/src/platform/PokiAdapter.ts) — СОЗДАТЬ

**Scope:**
- Реализовать IAuthAdapter
- Интеграция с Poki SDK (`PokiSDK.gameLoadingFinished()`)
- Проверка: `window.PokiSDK !== undefined`

### 1.3 PlatformManager Integration
**Beads:** часть 1.1/1.2
**Scope:**
- Обновить `initialize()`: приоритет Telegram → Yandex → Poki → Standalone
- Интегрировать YandexAdsProvider и PokiAdsProvider (уже готовы)
- Добавить `isYandex()`, `isPoki()` хелперы

**Зависимости:** 1.1 + 1.2 → 1.3

---

## Фаза 2: E2E Testing (P1)

### 2.1 Smoke Tests Extension
**Beads:** создать `slime-arena-e2e-smoke`
**Файлы:**
- [tests/smoke/run-stage-d.ps1](../../tests/smoke/run-stage-d.ps1) — расширить
- [server/tests/meta-stage-d.test.ts](../../server/tests/meta-stage-d.test.ts) — расширить

**Сценарии:**
- Guest Auth → игра → claim → Results
- Telegram Auth → upgrade flow
- claimToken (success / expired / invalid)
- LeaderboardScreen API

### 2.2 Load Test Verification
**Beads:** slime-arena-7fg (существующий epic)
**Команда:**
```bash
k6 run tests/load/soft-launch.js
```
**Метрики:** CCU=500, p99<2000ms, errors<1%

---

## Фаза 3: Bug Fixes (P1)

### 3.1 Build Error
**Beads:** slime-arena-caf (существующий)
**Fix:** `npm i -D @types/uuid`

### 3.2 Джойстик смещение
**Beads:** slime-arena-zmf (существующий)
**Scope:** Фикс смещения базы при повторных касаниях

---

## Фаза 4: Deployment Prep (P2)

### 4.1 Environment Documentation
**Beads:** создать `slime-arena-env-docs`
**Файлы:**
- [docs/deployment/PRODUCTION_ENV.md](docs/deployment/PRODUCTION_ENV.md) — СОЗДАТЬ

**Содержание:**
- JOIN_TOKEN_SECRET
- MATCH_SERVER_TOKEN
- DATABASE_URL
- Checklist для операторов

### 4.2 CI/CD Enhancement
**Beads:** создать `slime-arena-ci-tests`
**Файлы:**
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — добавить `npm test`

---

## Сводка задач

| # | Фаза | Beads | Приоритет | Статус |
|---|------|-------|-----------|--------|
| 1 | YandexAdapter | slime-arena-laj | P1 | ✅ |
| 2 | PokiAdapter | slime-arena-9o2 | P1 | ✅ |
| 3 | @types/uuid | slime-arena-caf | P1 | ✅ |
| 4 | E2E Smoke Tests | СОЗДАТЬ | P1 | ⏳ |
| 5 | Load Test | slime-arena-7fg | P1 | ⏳ |
| 6 | Джойстик | slime-arena-zmf | P1 | ⏳ |
| 7 | Env Docs | СОЗДАТЬ | P2 | ⏳ |
| 8 | CI/CD Tests | СОЗДАТЬ | P2 | ⏳ |

**Итого:** 8 задач — 3 выполнено, 5 в работе

---

## Зависимости

```
1.1 YandexAdapter ─┬─> 1.3 PlatformManager ─> 2.1 E2E Tests ─> 2.2 Load Tests
1.2 PokiAdapter  ──┘

3.1 @types/uuid (независимый, блокирует build)
3.2 Джойстик (независимый)

4.1 Env Docs ─> 4.2 CI/CD
```

---

## Критические файлы

| Файл | Назначение |
|------|------------|
| [client/src/platform/IAuthAdapter.ts](../../client/src/platform/IAuthAdapter.ts) | Интерфейс для адаптеров |
| [client/src/platform/TelegramAdapter.ts](../../client/src/platform/TelegramAdapter.ts) | Паттерн реализации |
| [client/src/platform/PlatformManager.ts](../../client/src/platform/PlatformManager.ts) | Интеграция адаптеров |
| [client/src/platform/YandexAdsProvider.ts](../../client/src/platform/YandexAdsProvider.ts) | Готов, ждёт адаптер |
| [client/src/platform/PokiAdsProvider.ts](../../client/src/platform/PokiAdsProvider.ts) | Готов, ждёт адаптер |
| [server/tests/meta-stage-d.test.ts](../../server/tests/meta-stage-d.test.ts) | E2E тесты |
| [tests/load/soft-launch.js](../../tests/load/soft-launch.js) | k6 load tests |

---

## Верификация

### Автоматическая
```bash
npm run build          # Сборка без ошибок
npm run test           # Unit-тесты
npx tsx server/tests/meta-stage-d.test.ts  # E2E
k6 run tests/load/soft-launch.js           # Load
```

### Ручная
- [ ] Yandex SDK определяется на yandex.games
- [ ] Poki SDK определяется на poki.com
- [ ] Guest flow работает на всех платформах
- [ ] Реклама показывается (Yandex/Poki провайдеры)

---

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| SDK API изменился | Средняя | Проверить документацию перед началом |
| Load test не проходит | Средняя | Профилировать bottlenecks, снизить targetCCU |
| Недостаточно времени | Высокая | Фазы 1-3 обязательны, Фаза 4 опционально |

---

## Следующие шаги

1. ~~Создать ветку `sprint-15/production-readiness`~~ ✅
2. ~~YandexAdapter и PokiAdapter~~ ✅
3. ~~@types/uuid~~ ✅
4. Дождаться внешнего код-ревью PR#112
5. Исправить slime-arena-zmf (джойстик)
6. Создать и запустить E2E Smoke Tests
7. Запустить Load Test (k6)

---

## Критерии завершения Sprint 15

**MUST:**

- [x] YandexAdapter и PokiAdapter реализованы
- [x] Build error исправлен (@types/uuid)
- [ ] E2E smoke tests проходят
- [ ] Load test проходит метрики

**SHOULD:**

- [ ] CI включает тесты
- [ ] Production env задокументирован
- [ ] Джойстик баг исправлен
