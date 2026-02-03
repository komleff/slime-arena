# ТЗ: Server Monitoring Dashboard — Core

**Версия:** 1.6 | **Часть:** Core (общий контекст)
**Читают:** Coder A (Backend + Ops), Coder B (Frontend)

---

## 1. Обзор

### 1.1 Цель

Мобильное веб-приложение для оперативного мониторинга и администрирования production-сервера Slime Arena. Основной сценарий — быстрая проверка состояния и экстренные действия с телефона.

### 1.2 Позиционирование

**Оперативная панель, а не система наблюдаемости.** История метрик, p95/p99, тренды, агрегация логов — за пределами этого ТЗ (Prometheus/Grafana позже).

### 1.3 Область охвата MVP

| Параметр | Значение |
|----------|----------|
| Хосты | 1 (Timeweb Cloud, Москва) |
| Docker-образ | `ghcr.io/komleff/slime-arena-monolith-full:*` |
| Имя контейнера | `slime-arena` |
| Состав контейнера | MetaServer + MatchServer + PostgreSQL + Redis |
| Порты | 3000 (MetaServer), 2567 (MatchServer), 5173 (игровой Client) |
| Администраторы | 1-3 человека |
| Основное устройство | Мобильный телефон |

### 1.5 Целевая аудитория документа

AI-кодеры (LLM-агенты) под контролем человека-супервайзера. Формулировки [MUST] быть однозначными, без допущений «разработчик поймёт из контекста».

### 1.5 Архитектурный принцип

Расширяем MetaServer новыми admin-endpoints (единая БД, единый деплой). Аутентификация администраторов [MUST] быть изолирована от игровой auth-системы: отдельная таблица `admin_users`, отдельные JWT (`role: "admin"`), отдельный middleware `requireAdmin`.

### 1.6 Компоненты

```
┌─────────────────────────────────────────┐
│         ADMIN DASHBOARD (Preact)         │
│    Статика через Nginx (/admin/)         │
└────────────────┬────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────┐
│     MetaServer (+ admin routes)          │
│  /api/v1/admin/*                         │
│  PostgreSQL │ Redis │ /proc/ /sys/       │
└────────────────┬────────────────────────┘
                 │ localhost
                 ▼
┌─────────────────────────────────────────┐
│     MatchServer :2567 (Colyseus)         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│     HOST WATCHDOG (systemd)              │
│  Outbox (shared volume) + Health check   │
└─────────────────────────────────────────┘
```

---

## 2. Функциональные требования

### 2.1 Дашборд (главная)

| ID | Требование | Приоритет |
|----|------------|-----------|
| REQ-MON-001 | Статус сервера (Online / Degraded / Offline / Unknown) по правилам 3.1 | P0 |
| REQ-MON-002 | Показатели: DB status, Redis status, uptime | P0 |
| REQ-MON-003 | Ресурсы: CPU %, RAM usage (из `/proc/`, `/sys/`) | P0 |
| REQ-MON-004 | Активные комнаты и игроки (количество) | P0 |
| REQ-MON-005 | Лента последних событий (20 записей) | P1 |
| REQ-MON-006 | Автообновление: опрос каждые 5 сек (Phase 1), WebSocket (Phase 2) | P0 |

### 2.2 Детальный мониторинг

| ID | Требование | Приоритет |
|----|------------|-----------|
| REQ-MON-010 | Графики tick latency (Phase 2) | P1 |
| REQ-MON-011 | История метрик (Phase 3) | P2 |
| REQ-MON-012 | Список комнат с деталями | P1 |
| REQ-MON-013 | Логи сервера с фильтрацией (Phase 2) | P1 |

### 2.3 Административные действия

| ID | Требование | Приоритет |
|----|------------|-----------|
| REQ-MON-020 | Restart контейнера через outbox + 2FA (см. Backend 4.3, Ops 1) | P0 |
| REQ-MON-021 | Аудит-лог всех действий | P0 |
| REQ-MON-022 | Завершение комнаты (Phase 3) | P2 |

### 2.4 Безопасность

| ID | Требование | Приоритет |
|----|------------|-----------|
| REQ-MON-040 | [MUST] HTTPS | P0 |
| REQ-MON-041 | [MUST] Отдельная auth для администраторов (`admin_users`) | P0 |
| REQ-MON-042 | [MUST] 2FA (TOTP) для admin-действий (restart) | P0 |
| REQ-MON-043 | [MUST] Rate limiting | P0 |
| REQ-MON-044 | [MUST] JWT access 15 мин + refresh cookie 7 дней | P0 |
| REQ-MON-045 | [MUST] Audit log с IP и timestamp | P0 |
| REQ-MON-046 | [SHOULD] Маскирование токенов/паролей в логах | P1 |

### 2.5 Доступность и производительность

| ID | Требование | Приоритет |
|----|------------|-----------|
| REQ-MON-050 | [MUST] Mobile-first (минимум 320px) | P0 |
| REQ-MON-060 | [MUST] First Contentful Paint < 2 сек | P1 |
| REQ-MON-061 | [MUST] Не нагружать production сервер существенно | P0 |

---

## 3. Формальные правила статусов

Статус определяется по проверкам в порядке приоритета:

| # | Проверка | Online | Degraded | Offline |
|---|----------|--------|----------|---------|
| 1 | Health endpoint | 200 за <3 сек | 200 за >3 сек | Нет ответа / не-200 |
| 2 | PostgreSQL | `connected` | — | Не `connected` |
| 3 | Redis | `connected` | `reconnecting` | `disconnected` |
| 4 | Tick latency | < 20 мс | 20-33 мс | > 33 мс |
| 5 | RAM usage | < 80% | 80-95% | > 95% |

**Агрегация:**
- **Online** — все проверки Online.
- **Degraded** — хотя бы одна Degraded, ни одна Offline.
- **Offline** — хотя бы одна Offline. [MUST] после 2 последовательных неудач (10 сек).
- **Unknown** — нет данных (первый запуск или сетевая ошибка). Одиночный таймаут = Unknown, не Offline.

**Цвета:** Online #22C55E, Degraded #F59E0B, Offline #EF4444, Unknown #6B7280.

---

## 4. API-контракты

Базовый путь: `/api/v1/admin/`

### 4.1 Аутентификация

**POST /login**

Запрос: `{ username: string, password: string }`

Ответ 200: `{ accessToken: string, totpRequired: boolean }` + заголовок `Set-Cookie: refresh_token=<value>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/admin; Max-Age=604800`

Ошибки: 401 (неверные credentials), 429 (rate limit).

**POST /refresh**

Запрос: пустое тело. Refresh-токен читается из cookie `refresh_token`.

Ответ 200: `{ accessToken: string }`

Ошибки: 401.

**POST /logout**

Заголовки: `Authorization: Bearer <accessToken>`

Ответ: 200. Действие: инвалидация refresh-токена в БД, очистка cookie.

### 4.2 2FA

**POST /totp/setup** — `Authorization: Bearer`

Ответ 200: `{ secret: string, qrCodeUrl: string }`

**POST /totp/verify** — `Authorization: Bearer`

Запрос: `{ code: string }` (6-значный TOTP)

Ответ: 200 (успех, `totp_enabled = true`), 401 (неверный код).

### 4.3 Мониторинг

Все endpoints [MUST] требовать `Authorization: Bearer <accessToken>`.

**GET /health/detailed**

| Поле | Тип | Описание |
|------|-----|----------|
| `status` | string | online / degraded / offline / unknown |
| `db` | string | connected / disconnected |
| `redis` | string | connected / reconnecting / disconnected |
| `uptime` | number | Секунды |
| `version` | string | Из package.json |
| `timestamp` | string | ISO 8601 |

**GET /stats**

| Поле | Тип | Описание |
|------|-----|----------|
| `cpu` | number | 0-100 |
| `ramUsed` | number | Байты |
| `ramTotal` | number | Байты |
| `ramPercent` | number | 0-100 |
| `rooms` | number | Количество |
| `players` | number | Количество |
| `avgTickMs` | number / null | Среднее за 60 сек. null если нет комнат |
| `maxTickMs` | number / null | Максимум за 60 сек |
| `timestamp` | string | ISO 8601 |

**GET /rooms**

Массив: `{ roomId, name, players, maxPlayers, phase, tick, createdAt, avgTickMs }`

Phase: Growth / Hunt / Final / Results.

**GET /logs**

Параметры: `lines` (default 100, max 500), `level` (info/warn/error/all), `source` (meta/match/system/all).

Массив: `{ timestamp, level, source, message }`. Чувствительные данные замаскированы.

**GET /audit**

Параметры: `limit` (default 50, max 100), `offset`, `userId`, `action`.

Ответ: `{ items: [...], total: number }`. Каждый item: `{ id, userId, username, action, target, ip, timestamp, details }`.

### 4.4 Административные действия

[MUST] требовать `Authorization: Bearer` + `X-2FA-Code: <6-digit TOTP>`.

**POST /restart**

Запрос: пустое тело.

Ответ 202: `{ message: "Restart initiated", auditId: number }`

Ошибки: 401, 403 (TOTP), 409 (restart уже запрошен — outbox-файл существует), 429, 500.

### 4.5 Стандартный формат ошибок

Все endpoints: `{ error: string, message: string }`

Коды: UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, CONFLICT, INTERNAL_ERROR.

### 4.6 WebSocket (Phase 2)

**WS /ws** — `token=<accessToken>` в query.

События: `health` (5 сек), `stats` (5 сек), `log` (при появлении), `alert` (при срабатывании).

---

## 5. Решения по открытым вопросам

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Restart контейнера | Outbox-файл в shared volume | Без Docker socket, без сетевой связи контейнер→хост |
| Хостинг фронтенда | Статика через Nginx `/admin/` | Без отдельного порта |
| Frontend framework | Preact 10.x | Консистентность с игровым клиентом |
| Mobile или desktop first | Mobile-first | Основной сценарий — телефон |
| Дашборд = Grafana? | Нет, оперативная панель | Scope control |
| 2FA в MVP? | Да (P0) | Для restart, IP whitelist убран |
| Admin = игрок? | Нет, отдельная таблица | Изоляция auth-систем |
| Метрики CPU/RAM | `/proc/` и `/sys/fs/cgroup/` | Без Docker socket |
| Логи | Кольцевой буфер в памяти | Без Docker socket, с маскированием |

---

## 6. Риски

| Риск | Митигация |
|------|-----------|
| Мониторинг нагружает production | Rate limiting, кеш, опрос ≤ 5 сек |
| Утечка credentials | HTTPS, короткий TTL, 2FA, bcrypt, AES-256-GCM |
| Watchdog не работает | systemd restart=always, Telegram, SSH fallback |
| MetaServer завис | Watchdog авто-рестарт через 1.5 мин |
| Неавторизованный restart | 2FA + audit log |

---

## 7. Глоссарий

| Термин | Определение |
|--------|-------------|
| **MetaServer** | REST API сервер: auth, profile, leaderboard (порт 3000) |
| **MatchServer** | Colyseus WebSocket сервер: игровые комнаты (порт 2567) |
| **Tick** | Единица игрового времени (33.3ms при 30 FPS) |
| **Tick Latency** | Время выполнения одного тика |
| **Room** | Игровая комната Colyseus (матч) |
| **Phase** | Фаза матча: Growth → Hunt → Final → Results |
| **Health Check** | Проверка доступности и состояния сервиса |
| **2FA / TOTP** | Двухфакторная аутентификация / Time-based One-Time Password |
| **Audit Log** | Журнал административных действий |
| **Watchdog** | Хост-скрипт (systemd): мониторинг здоровья, авто-рестарт, обработка outbox |
| **Outbox** | Файл-команда в shared volume: MetaServer создаёт, watchdog выполняет |
| **Shared Volume** | Bind mount: `/opt/slime-arena/shared/` (хост) ↔ `/shared/` (контейнер) |
| **Ring Buffer** | Кольцевой буфер фиксированного размера, старые записи вытесняются |
| **Preact** | Легковесная альтернатива React (3 kB) |
| **otpauth** | Библиотека TOTP (~8 kB) |
| **uPlot** | Библиотека графиков (~30 kB, Phase 2) |
| **cgroup** | Механизм Linux для учёта ресурсов контейнера |
