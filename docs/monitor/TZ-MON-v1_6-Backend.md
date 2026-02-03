# ТЗ: Server Monitoring Dashboard — Backend

**Версия:** 1.6 | **Часть:** Backend
**Читает:** Coder A (Backend + Ops)
**Зависимости:** Core (API-контракты, правила статусов)

---

## 1. Модель данных (PostgreSQL)

Новые таблицы в существующей БД. Миграции через Prisma.

### Таблица `admin_users`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Логин |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `totp_secret_encrypted` | VARCHAR(255) | | AES-256-GCM (формат см. 3.3) |
| `totp_enabled` | BOOLEAN | DEFAULT false | Включена ли 2FA |
| `role` | VARCHAR(20) | DEFAULT 'admin' | Резерв для расширения |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |

### Таблица `admin_sessions`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → admin_users.id, NOT NULL | Администратор |
| `refresh_token_hash` | VARCHAR(255) | NOT NULL | SHA256 hash refresh-токена |
| `ip` | VARCHAR(64) | | IP-адрес |
| `user_agent` | VARCHAR(255) | | User-Agent |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |
| `expires_at` | TIMESTAMP | NOT NULL | 7 дней от создания |

Индексы: INDEX (`user_id`, `created_at` DESC).

### Таблица `audit_log`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → admin_users.id | Администратор |
| `action` | VARCHAR(50) | NOT NULL | login, restart, room_close и др. |
| `target` | VARCHAR(100) | | Цель (container name, room id) |
| `ip` | VARCHAR(64) | | IP-адрес |
| `timestamp` | TIMESTAMP | DEFAULT NOW() | Время |
| `details_json` | JSONB | | Дополнительные данные |

Индексы: INDEX (`timestamp` DESC), INDEX (`user_id`, `timestamp` DESC).

### Таблица `metrics_history` (Phase 2)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL PK | Идентификатор |
| `metric_type` | VARCHAR(50) NOT NULL | cpu, ram, tick_avg, tick_max, rooms, players |
| `value` | REAL NOT NULL | Числовое значение |
| `timestamp` | TIMESTAMP DEFAULT NOW() | Время |

Политика хранения: сырые данные — 24ч, 5-минутные агрегаты — 7 дней, часовые — 30 дней. Очистка через setInterval в MetaServer (каждый час).

---

## 2. Источники данных

| Источник | Метод | Данные |
|----------|-------|--------|
| MetaServer `/health` | Существующий endpoint | DB status, Redis status, uptime |
| `/proc/`, `/sys/fs/cgroup/` | Чтение системных файлов из контейнера (cgroup v1 или v2) | CPU %, RAM |
| MatchServer | Colyseus API (matchMaker.query() или @colyseus/monitor) | Rooms, players |
| ArenaRoom | Кольцевой буфер в памяти (см. 2.2) | Tick metrics |
| Логи | Кольцевой буфер в памяти MetaServer (см. 2.3) | Логи с маскированием |

### 2.1 Список комнат

[MUST] использовать один из вариантов:
- `matchMaker.query()` через внутренний вызов (MetaServer и MatchServer в одном процессе).
- `@colyseus/monitor` API.

Конкретный способ [MUST] зафиксировать в комментариях к задаче.

### 2.2 Tick latency

[MUST] создать в ArenaRoom кольцевой буфер: последние 1800 значений (60 сек × 30 тиков/сек). При каждом тике записывать длительность. Endpoint/метод [MUST] возвращать:
- `avgTickMs` — среднее за буфер.
- `maxTickMs` — максимум за буфер.
- `currentTickMs` — последний тик.

Если нет активных комнат — возвращать `null`.

### 2.3 Кольцевой буфер логов

[MUST] перехватить `console.log` / `console.warn` / `console.error` в MetaServer. Сохранять в буфер последние 1000 записей. Формат записи: `{ timestamp, level, source, message }`.

Source: `meta` (из MetaServer), `match` (из MatchServer, если один процесс), `system` (ошибки запуска, OOM и т.д.).

[MUST] маскировать чувствительные данные **перед** записью в буфер.

Обязательные паттерны маскирования [MUST]:

| Паттерн | Замена | Пример |
|---------|--------|--------|
| `Authorization: Bearer <token>` | `Authorization: Bearer ***` | Заголовки запросов |
| JWT-подобные строки (`eyJ...`) | `eyJ***` | Токены в любом контексте |
| `password=<value>` | `password=***` | Query-параметры, тела запросов |
| `refresh_token=<value>` | `refresh_token=***` | Cookie, тела запросов |
| `X-2FA-Code: <value>` | `X-2FA-Code: ***` | Заголовок TOTP |
| `secret=<value>` | `secret=***` | TOTP-секреты, любые секреты |

[SHOULD] поддерживать расширение списка паттернов без изменения кода (массив regex в конфигурации).

### 2.4 Outbox (серверная сторона)

MetaServer отвечает за **запись** outbox-файла. Watchdog отвечает за **чтение** (см. Ops).

**Restart:**
1. Проверить, что файл `/shared/restart-requested` НЕ существует. Если существует — вернуть 409 CONFLICT.
2. Записать в `audit_log`.
3. Атомарно создать файл: записать в `/shared/restart-requested.tmp` с флагом эксклюзивного создания (аналог `O_EXCL` — ошибка если файл уже есть), затем `rename` в `/shared/restart-requested`. Если эксклюзивное создание `.tmp` вернуло ошибку (параллельный запрос) — вернуть 409 CONFLICT. JSON: `{ auditId, requestedBy, timestamp }`.
4. Вернуть 202.

Путь `/shared/` внутри контейнера соответствует `/opt/slime-arena/shared/` на хосте (bind mount, см. Ops).

---

## 3. Безопасность

### 3.1 Поток аутентификации

1. **Login:** username + password → bcrypt verify → JWT access (15 мин) + refresh cookie HttpOnly Secure (7 дней).

   [MUST] атрибуты refresh cookie: `refresh_token=<value>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/admin; Max-Age=604800`.
2. **Request:** Bearer token → verify signature + expiry → allow/deny.
3. **Refresh:** cookie `refresh_token` → verify SHA256 hash в БД → new access token.
4. **Admin action:** access token + X-2FA-Code → TOTP verify → execute + audit log.

### 3.2 Хранение секретов

| Секрет | Хранение |
|--------|----------|
| `JWT_SECRET` | ENV variable (существующий) |
| `ADMIN_ENCRYPTION_KEY` | ENV variable (новый, 32 байта, строго base64). Пример генерации: `openssl rand -base64 32` |
| Passwords | bcrypt hash в PostgreSQL |
| TOTP secrets | AES-256-GCM в PostgreSQL (формат см. 3.3) |
| Refresh tokens | SHA256 hash в PostgreSQL |

### 3.3 Формат хранения TOTP-секрета (AES-256-GCM)

Поле `totp_secret_encrypted` [MUST] хранить строку в формате:

`base64(iv || ciphertext || authTag)`

Где:
- `iv` — 12 байт (initialization vector, генерировать случайно при каждом шифровании).
- `ciphertext` — зашифрованный TOTP-секрет.
- `authTag` — 16 байт (authentication tag).
- Ключ: `ADMIN_ENCRYPTION_KEY` из ENV (32 байта).

При чтении: декодировать base64 → извлечь iv (первые 12 байт), authTag (последние 16 байт), ciphertext (остаток) → расшифровать.

### 3.4 Rate Limiting

Переиспользовать существующий `rateLimiter.ts`. Пути ниже — полные (внутри admin router префикс `/api/v1/admin` уже применён):

| Endpoint | Лимит |
|----------|-------|
| POST /api/v1/admin/login | 5 req/min per IP |
| POST /api/v1/admin/restart | 3 req/min per user |
| POST /api/v1/admin/* | 10 req/min per user |
| GET /api/v1/admin/* | 60 req/min per user |

---

## 4. Технологический стек

| Компонент | Выбор | Обоснование |
|-----------|-------|-------------|
| Runtime | Node.js 20 | Существующий |
| Framework | Express | Существующий |
| Auth | jsonwebtoken + bcrypt | Существующий |
| 2FA | otpauth (~8 kB) | Активная поддержка (speakeasy устарел, 2017) |
| DB | PostgreSQL (Prisma) | Существующий |
| WebSocket | ws | Phase 2, существующий |

Новая зависимость Phase 1: только `otpauth` (~8 kB).

---

## 5. Критические файлы

| Файл | Действие |
|------|----------|
| `server/src/meta/routes/admin.ts` | СОЗДАТЬ — все admin endpoints |
| `server/src/meta/middleware/adminAuth.ts` | СОЗДАТЬ — requireAdmin, require2FA |
| `server/src/meta/services/auditService.ts` | СОЗДАТЬ — audit logging |
| `server/src/meta/services/systemMetrics.ts` | СОЗДАТЬ — CPU/RAM из /proc/ |
| `server/src/meta/services/logBuffer.ts` | СОЗДАТЬ — кольцевой буфер + маскирование |
| `server/src/meta/server.ts` | ИЗМЕНИТЬ — подключить admin routes |
| `server/src/rooms/ArenaRoom.ts` | ИЗМЕНИТЬ — кольцевой буфер tick latency |
| `server/prisma/schema.prisma` | ИЗМЕНИТЬ — admin таблицы |

---

## 6. Критерии приёмки (Backend)

| ID | Проверка | Результат |
|----|----------|-----------|
| ACC-MON-001 | Login с валидными credentials | 200, accessToken + Set-Cookie refresh |
| ACC-MON-002 | Login с неверным паролем | 401 |
| ACC-MON-003 | Login 6 раз за минуту | 429 на 6-й |
| ACC-MON-004 | Запрос к /admin/* без токена | 401 |
| ACC-MON-005 | Запрос с истёкшим токеном | 401 |
| ACC-MON-006 | Refresh с валидным cookie | Новый accessToken |
| ACC-MON-007 | 2FA setup | otpauth:// URI возвращён |
| ACC-MON-008 | 2FA verify с правильным кодом | 200, totp_enabled = true |
| ACC-MON-011 | Restart без TOTP | 403 |
| ACC-MON-012 | Restart с TOTP | 202, audit_log, outbox-файл |
| ACC-MON-012a | Повторный Restart (файл существует) | 409 CONFLICT |
| ACC-MON-014 | Audit log содержит все действия | login, restart с IP и timestamp |
| ACC-MON-017 | Логи не содержат JWT/пароли | Маскирование работает |
