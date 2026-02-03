# План Sprint-15: Production Readiness + Platform Adapters

**Дата:** 29 января 2026
**PM:** Claude Opus 4.5
**Ветка:** `sprint-15/production-readiness`
**Цель:** Production deployment + расширение платформенной абстракции
**Worktree:** `d:\slime-arena-meta`
**Предыдущий:** Sprint 14 (v0.7.0) — MERGED

---

## Резюме состояния

### Фаза 1 — ЗАВЕРШЕНА

| Компонент | Статус | Коммит |
|-----------|--------|--------|
| YandexAdapter | ✅ | 8da0a17 |
| PokiAdapter | ✅ | 8da0a17 |
| PlatformManager integration | ✅ | 8da0a17 |
| PR#112 создан | ✅ | — |

**Beads закрыты:** slime-arena-laj, slime-arena-9o2, slime-arena-caf

### Фаза 2 — В РАБОТЕ

**Новое ТЗ:** CrazyGames и GameDistribution адаптеры
- Источник: `docs/meta-min/TZ-PlatformAdapters-CrazyGames-GameDistribution-v1.0.md`
- План: `docs/plans/Sprint-15-Platform-Adapters-Plan.md`

---

## Цели спринта (обновлённые)

| # | Цель | Приоритет | Статус |
|---|------|-----------|--------|
| 1 | YandexAdapter + PokiAdapter | P1 | ✅ |
| 2 | CrazyGamesAdapter | P1 | ⏳ НОВОЕ |
| 3 | GameDistributionAdapter | P1 | ⏳ НОВОЕ |
| 4 | E2E Testing | P1 | ⏳ |
| 5 | Bug Fixes (джойстик) | P1 | ⏳ |
| 6 | Deployment Prep | P2 | ⏳ |

---

## Блок 1: CrazyGames Integration (P1)

**Источник:** TZ-PlatformAdapters-v1.0, секция 4

### 1.1 CrazyGamesAdapter

**Beads:** создать `slime-arena-crazygames-adapter`
**Файлы:**

- `client/src/platform/CrazyGamesAdapter.ts` — СОЗДАТЬ
- `client/src/platform/PlatformManager.ts` — обновить
- `client/src/platform/index.ts` — экспорт

**Scope:**

- Реализовать IAuthAdapter
- `isAvailable()`: `window.CrazyGames?.SDK`
- `getCredentials()`: `SDK.user.getUserToken()` → JWT
- `requestAuth()`: `SDK.user.showAuthPrompt()`
- Гостевой режим если `getUser()` === null

### 1.2 CrazyGamesAdsProvider

**Beads:** часть 1.1
**Файлы:**

- `client/src/platform/CrazyGamesAdsProvider.ts` — СОЗДАТЬ

**Scope:**

- `showRewarded()`: `SDK.ad.requestAd('rewarded', callbacks)`
- `showInterstitial()`: `SDK.ad.requestAd('midgame', callbacks)`
- Callbacks: `adStarted`, `adFinished`, `adError`

### 1.3 MetaServer JWT Verification

**Beads:** создать `slime-arena-crazygames-jwt`
**Файлы:**

- `server/src/services/AuthService.ts` — добавить обработку `platformType='crazygames'`

**Scope:**

- Публичный ключ: `https://sdk.crazygames.com/publicKey.json`
- Кэширование ключа: 1 час
- Извлечение: `userId`, `username`, `profilePictureUrl`

### 1.4 События жизненного цикла

| Событие | Метод SDK | Когда |
|---------|-----------|-------|
| Начало геймплея | `game.gameplayStart()` | Старт матча |
| Конец геймплея | `game.gameplayStop()` | Конец матча, пауза |
| Победа | `game.happyTime()` | Победа, рекорд |

---

## Блок 2: GameDistribution Integration (P1)

**Источник:** TZ-PlatformAdapters-v1.0, секция 5

### 2.1 GameDistributionAdapter

**Beads:** создать `slime-arena-gamedistribution-adapter`
**Файлы:**

- `client/src/platform/GameDistributionAdapter.ts` — СОЗДАТЬ
- `client/src/platform/PlatformManager.ts` — обновить

**Scope:**

- Реализовать IAuthAdapter
- `isAvailable()`: `window.gdsdk` или `window.GD_OPTIONS`
- **Только гостевой режим** — GameDistribution не поддерживает авторизацию
- `requestAuth()`: return false

### 2.2 GameDistributionAdsProvider

**Beads:** часть 2.1
**Файлы:**

- `client/src/platform/GameDistributionAdsProvider.ts` — СОЗДАТЬ

**Scope:**

- `showRewarded()`: `gdsdk.showAd(AdType.Rewarded)`
- `showInterstitial()`: `gdsdk.showAd(AdType.Interstitial)`
- События: `SDK_GAME_PAUSE`, `SDK_GAME_START`, `SDK_REWARDED_WATCH_COMPLETE`

### 2.3 SDK Configuration

```javascript
window.GD_OPTIONS = {
  gameId: '<GAMEDISTRIBUTION_GAME_ID>',
  onEvent: (event) => { GameDistributionAdapter.handleEvent(event); }
};
```

---

## Блок 3: PlatformManager Update (P1)

**Beads:** часть блоков 1-2

### 3.1 Обновлённый приоритет определения

```
1. Telegram.WebApp.initData → TelegramAdapter
2. CrazyGames.SDK           → CrazyGamesAdapter      ← NEW
3. gdsdk / GD_OPTIONS       → GameDistributionAdapter ← NEW
4. YaGames                  → YandexAdapter          ✅ DONE
5. PokiSDK                  → PokiAdapter            ✅ DONE
6. else                     → StandaloneAdapter
```

### 3.2 Новые хелперы

- `isCrazyGames(): boolean`
- `isGameDistribution(): boolean`
- `getCrazyGamesAdapter(): CrazyGamesAdapter | null`
- `getGameDistributionAdapter(): GameDistributionAdapter | null`

---

## Блок 4: E2E Testing (P1)

**Beads:** slime-arena-e2e-smoke (создать)

### 4.1 Сценарии тестирования

| Платформа | Сценарий | Верификация |
|-----------|----------|-------------|
| CrazyGames | SDK init → Auth → Rewarded Ad | QA Tool Preview |
| GameDistribution | SDK init → Guest → Interstitial | iframe Upload |
| Yandex | SDK init → Player → Rewarded | yandex.games |
| Poki | SDK init → gameLoadingFinished | poki.com |

### 4.2 Метрики успеха

| Метрика | Целевое значение |
|---------|------------------|
| Время загрузки SDK | < 500ms |
| Успешность показа рекламы | > 95% |
| Ошибки SDK | < 0.1% сессий |

---

## Блок 5: Bug Fixes (P1)

### 5.1 Джойстик смещение

**Beads:** slime-arena-zmf
**Scope:** Фикс смещения базы при повторных касаниях

---

## Блок 6: Deployment Prep (P2)

### 6.1 Environment Documentation

**Beads:** slime-arena-env-docs (создать)
**Файл:** `docs/deployment/PRODUCTION_ENV.md`

### 6.2 CI/CD Enhancement

**Beads:** slime-arena-ci-tests (создать)
**Файл:** `.github/workflows/ci.yml`

---

## Сводка задач

| # | Блок | Beads | Приоритет | Статус |
|---|------|-------|-----------|--------|
| 1 | YandexAdapter | slime-arena-laj | P1 | ✅ |
| 2 | PokiAdapter | slime-arena-9o2 | P1 | ✅ |
| 3 | @types/uuid | slime-arena-caf | P1 | ✅ |
| 4 | CrazyGamesAdapter | slime-arena-8gk | P1 | 🔄 |
| 5 | CrazyGames JWT | часть slime-arena-8gk | P1 | ⏳ |
| 6 | GameDistributionAdapter | slime-arena-e0p | P1 | 🔄 |
| 7 | PlatformManager v2 | часть 4-6 | P1 | ⏳ |
| 8 | E2E Smoke Tests | СОЗДАТЬ | P1 | ⏳ |
| 9 | Джойстик | slime-arena-zmf | P1 | ⏳ |
| 10 | Env Docs | СОЗДАТЬ | P2 | ⏳ |
| 11 | CI/CD Tests | СОЗДАТЬ | P2 | ⏳ |

**Итого:** 11 задач — 3 выполнено, 8 в работе

---

## Зависимости

```
PR#112 (YandexAdapter, PokiAdapter) ─> merge
                                        │
                                        ▼
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
CrazyGamesAdapter               GameDistributionAdapter          slime-arena-zmf
        │                               │                          (независимый)
        └───────────────┬───────────────┘
                        ▼
              PlatformManager v2
                        │
                        ▼
               E2E Smoke Tests
```

---

## Критические файлы

| Файл | Назначение |
|------|------------|
| `client/src/platform/IAuthAdapter.ts` | Интерфейс адаптеров |
| `client/src/platform/PlatformManager.ts` | Менеджер платформ |
| `client/src/platform/CrazyGamesAdapter.ts` | СОЗДАТЬ |
| `client/src/platform/GameDistributionAdapter.ts` | СОЗДАТЬ |
| `client/src/platform/CrazyGamesAdsProvider.ts` | СОЗДАТЬ |
| `client/src/platform/GameDistributionAdsProvider.ts` | СОЗДАТЬ |
| `server/src/services/AuthService.ts` | JWT верификация |

---

## Верификация

### Автоматическая

```bash
npm run build          # Сборка без ошибок
npm run test           # Unit-тесты
```

### Ручная (по платформам)

- [ ] CrazyGames: QA Tool → SDK init → Auth → Rewarded
- [ ] GameDistribution: iframe → SDK init → Guest → Interstitial
- [ ] Yandex: yandex.games → SDK определяется
- [ ] Poki: poki.com → SDK определяется

---

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| SDK API изменился | Средняя | Проверить документацию |
| Публичный ключ CG недоступен | Низкая | Кэшировать на 1 час |
| GameDistribution блокирует без рекламы | Средняя | Интегрировать рекламу обязательно |
| Конфликт SDK | Низкая | Загружать только нужный SDK |

---

## Следующие шаги

1. ✅ ~~Merge PR#112~~ (ожидание внешнего ревью)
2. Создать Beads для CrazyGames задач
3. Начать с CrazyGamesAdapter (паттерн из YandexAdapter)
4. Параллельно — slime-arena-zmf (джойстик)

---

## Критерии завершения Sprint 15

**MUST:**

- [x] YandexAdapter и PokiAdapter реализованы
- [x] Build error исправлен
- [ ] CrazyGamesAdapter реализован
- [ ] GameDistributionAdapter реализован
- [ ] E2E smoke tests проходят

**SHOULD:**

- [ ] CrazyGames JWT верификация на MetaServer
- [ ] CI включает тесты
- [ ] Джойстик баг исправлен

---

## Ссылки на документацию

- [TZ-PlatformAdapters-v1.0](../docs/meta-min/TZ-PlatformAdapters-CrazyGames-GameDistribution-v1.0.md)
- [Sprint-15-Platform-Adapters-Plan](../docs/plans/Sprint-15-Platform-Adapters-Plan.md)
- [sprint-15-production-readiness](../docs/plans/sprint-15-production-readiness.md)
