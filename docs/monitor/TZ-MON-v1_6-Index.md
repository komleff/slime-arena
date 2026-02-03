# ТЗ: Server Monitoring Dashboard — Индекс

**Версия:** 1.6
**Дата:** 2026-02-03
**Автор:** Архитектор
**Статус:** Ready for Development
**Beads ID:** slime-arena-monitoring-dashboard (создать)

---

## История изменений

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-02-03 | Первоначальная версия |
| 1.1 | 2026-02-03 | Preact вместо React, PostgreSQL вместо SQLite, интеграция с MetaServer |
| 1.2 | 2026-02-03 | Консолидация ревью (Claude Opus, DeepSeek, ChatGPT). Mobile-first; 2FA → P0; restart через watchdog; API-контракты в таблицах; формальные правила статусов |
| 1.3 | 2026-02-03 | Outbox-файл вместо webhook. Разведены образ/контейнер. `unknown` в API. Правила outbox: атомарная запись, идемпотентность, права. Целевая аудитория — AI-кодеры |
| 1.5 | 2026-02-03 | Разделение на модули (Core, Backend, Frontend, Ops). План для 2 AI-кодеров. 409 CONFLICT при повторном restart. Формат AES-256-GCM. Ревью: DeepSeek, GPT-5.2 Thinking, Gemini. Правки по ревью: полные пути API, ADMIN_ENCRYPTION_KEY только base64, конкретные паттерны маскирования, критерий восстановления после restart, COOLDOWN после любого restart, структурированные логи watchdog |
| 1.6 | 2026-02-04 | Ревью: GPT-5.2, DeepSeek, Claude 3.5 Sonnet. ACC-MON-013: «любой успешный ответ» вместо «online». Cookie-атрибуты refresh-токена продублированы в Backend. O_EXCL при создании outbox-файла (защита от гонки). Явное требование доступности порта 3000 с хоста для watchdog |

---

## 1. Карта документов

| Файл | Содержание | Токены |
|------|-----------|--------|
| **TZ-MON-v1_6-Index.md** | Этот файл: карта, план, интеграция | ~600 |
| **TZ-MON-v1_6-Core.md** | Обзор, требования, статусы, API-контракты, глоссарий | ~1800 |
| **TZ-MON-v1_6-Backend.md** | Модель данных, безопасность, источники данных, outbox (запись), буферы | ~1600 |
| **TZ-MON-v1_6-Frontend.md** | UI/UX, экраны, responsive, auth на клиенте | ~800 |
| **TZ-MON-v1_6-Ops.md** | Watchdog, systemd, Nginx, Docker, shared volume | ~800 |

**Что читает каждый кодер:**

| Кодер | Файлы | Итого токенов |
|-------|-------|---------------|
| **Coder A (Backend + Ops)** | Core + Backend + Ops | ~4200 |
| **Coder B (Frontend)** | Core + Frontend | ~2600 |
| **Супервайзер** | Index (+ любой файл по необходимости) | ~600 |

---

## 2. План разработки: 2 AI-кодера

### 2.1 Распределение ролей

| | Coder A | Coder B |
|---|---------|---------|
| **Зона** | Backend + Ops | Frontend |
| **Читает** | Core + Backend + Ops | Core + Frontend |
| **Создаёт** | Серверные файлы, миграции, watchdog, Nginx | Preact-приложение |
| **Владеет** | API-контракты (реализация), БД, безопасность | UI/UX, мобильная вёрстка |

### 2.2 Спринт-план (Phase 1 MVP)

#### Спринт 1 — Фундамент (3 дня, параллельно)

**Coder A:**
1. Миграции PostgreSQL (`admin_users`, `admin_sessions`, `audit_log`)
2. Auth endpoints: `POST /login`, `POST /refresh`, `POST /logout`
3. 2FA endpoints: `POST /totp/setup`, `POST /totp/verify`
4. Middleware: `requireAdmin`, `require2FA`
5. Audit logging service

**Coder B:**
1. Preact app scaffold (Vite, структура каталогов, CSS Modules)
2. Экран Login (вёрстка + логика auth: access token в памяти, refresh через cookie)
3. Экран Settings (настройка 2FA: QR-код, подтверждение)
4. Навигация: нижний tab bar
5. Mobile layout foundation (320px, 1 колонка)

**Интеграция после Спринта 1:**
- Coder B подключает реальные auth endpoints вместо моков.
- Супервайзер проверяет: login → получение токена → refresh → 2FA setup → verify.

#### Спринт 2 — Мониторинг (3 дня, параллельно)

**Coder A:**
1. `GET /health/detailed` (расширение существующего `/health`)
2. `GET /stats` (CPU/RAM из `/proc/`, rooms/players из MatchServer)
3. `GET /rooms` (список комнат из Colyseus API)
4. Кольцевой буфер логов в MetaServer (1000 записей, маскирование)
5. Кольцевой буфер tick latency в ArenaRoom (1800 значений)
6. `GET /logs` (чтение из буфера)

**Coder B:**
1. Экран Dashboard: карточка статуса + метрики (CPU, RAM, Rooms, Players, Tick)
2. Экран Rooms: список комнат карточками
3. Экран Audit: список действий с пагинацией
4. Опрос API каждые 5 секунд (polling)
5. Цветовая индикация статусов (Online/Degraded/Offline/Unknown)

**Интеграция после Спринта 2:**
- Coder B подключает monitoring endpoints.
- Супервайзер проверяет: дашборд показывает реальные метрики, статус обновляется.

#### Спринт 3 — Restart + Ops (2-3 дня, последовательно)

**Coder A:**
1. `POST /restart` (outbox-файл, 409 при повторном запросе)
2. Watchdog-скрипт (outbox-приёмник + health check + Telegram)
3. systemd unit файл
4. Конфигурация shared volume (bind mount, права 1777)
5. Nginx: location `/admin/` для статики

**Coder B:**
1. Кнопка Restart с confirmation dialog + TOTP input
2. Обработка 202 Accepted → режим ожидания → опрос `/health`
3. Обработка 409 Conflict (restart уже запрошен)
4. Финальная полировка мобильной вёрстки

**Интеграция после Спринта 3:**
- Сквозной тест: login → dashboard → restart → ожидание → восстановление.
- Тест watchdog: остановить health → 3 fail → авто-restart → Telegram-алерт.
- Мобильное тестирование на реальном устройстве (320px).

#### Спринт 4 — Review + Deploy (1-2 дня)

**Оба кодера + супервайзер:**
1. Code review (безопасность: auth flow, TOTP, secrets, outbox)
2. Прогон всех критериев приёмки (ACC-MON-001 — ACC-MON-017)
3. Деплой на production (миграции → backend → watchdog → статика → Nginx)
4. Smoke-тест на production

### 2.3 Граф зависимостей

```
Спринт 1 (параллельно):
  A: Миграции → Auth → 2FA → Middleware → Audit
  B: Scaffold → Login → Settings → TabBar → Layout
                                                    ↘
Спринт 2 (параллельно):                     Интеграция Auth
  A: Health → Stats → Rooms → LogBuffer → TickBuffer → Logs
  B: Dashboard → Rooms → Audit → Polling → StatusColors
                                                    ↘
Спринт 3 (последовательно):                 Интеграция Monitoring
  A: Restart → Watchdog → Systemd → Volume → Nginx
  B: RestartUI → WaitMode → 409Handle → Polish
                                                    ↘
Спринт 4:                                   Интеграция Restart
  Review → ACC Tests → Deploy → Smoke
```

### 2.4 Контракт между кодерами

Coder A [MUST] реализовать API в точном соответствии с контрактами в Core (раздел 5). Coder B [MUST] потреблять API по тем же контрактам. При расхождении — приоритет у Core.

**Моки для Coder B (Спринт 1):** Coder B [SHOULD] создать локальные моки API на основе контрактов из Core, чтобы не блокироваться на Coder A. Формат моков: JSON-файлы с ожидаемыми ответами для каждого endpoint.

### 2.5 Точки проверки супервайзером

| Момент | Что проверять |
|--------|--------------|
| После Спринта 1 | Login работает, 2FA настраивается, токены выдаются корректно |
| После Спринта 2 | Дашборд показывает реальные метрики, статус корректен по правилам 4.4 |
| После Спринта 3 | Restart работает сквозной (UI → outbox → watchdog → restart → recovery) |
| После Спринта 4 | Все ACC-MON-* пройдены, production доступен |

---

## 3. Ссылки на исходники

- [docs/operations/SERVER_SETUP.md](../operations/SERVER_SETUP.md) — текущая настройка сервера
- [server/src/meta/routes/health.ts](../../server/src/meta/routes/health.ts) — существующий health endpoint
- [server/src/meta/middleware/rateLimiter.ts](../../server/src/meta/middleware/rateLimiter.ts) — rate limiting
- [server/src/rooms/ArenaRoom.ts](../../server/src/rooms/ArenaRoom.ts) — tick metrics
- [@colyseus/monitor](https://docs.colyseus.io/tools/monitor/) — встроенный мониторинг Colyseus (справочно)
