# ТЗ: Server Monitoring Dashboard — Ops

**Версия:** 1.6 | **Часть:** Ops (хост, деплой)
**Читает:** Coder A (Backend + Ops)
**Зависимости:** Core (API-контракты), Backend (outbox запись)

---

## 1. Watchdog (systemd-сервис на хосте)

Работает **за пределами Docker**. Контейнер не перезапускает сам себя — Docker socket не монтируется (осознанное ограничение безопасности).

### 1.1 Роль 1 — Outbox-приёмник

1. Каждые 5 секунд проверяет наличие файла `/opt/slime-arena/shared/restart-requested`.
2. Если файл существует — читает JSON: `{ auditId, requestedBy, timestamp }`.
3. Проверяет `auditId`: если совпадает с последним выполненным — пропускает (идемпотентность).
4. Удаляет файл → выполняет `docker restart slime-arena`.
5. Атомарно записывает результат в `/opt/slime-arena/shared/restart-result` (tmp → rename).
   Формат: `{ auditId, status: "ok" | "error", timestamp, error: string | null }`.
6. [MUST] после выполнения restart (любым способом — outbox или авто) делает паузу `COOLDOWN_AFTER_RESTART` секунд перед возобновлением health-проверок и опроса outbox. Это предотвращает ложные срабатывания health monitor на не успевший подняться сервер.
7. [MUST] логировать каждый restart: `auditId`, время, статус, ошибка. Логировать в journald (через stdout). Формат строки: `[watchdog] <ISO timestamp> <event> <details>` — для удобства фильтрации через `journalctl -u slime-arena-watchdog`.

### 1.2 Роль 2 — Health monitor

1. Каждые 30 секунд: `GET http://127.0.0.1:3000/health`.
2. При 3 последовательных неудачах (1.5 минуты) → авто-restart контейнера.
3. Отправляет Telegram-оповещение через Bot API (`https://api.telegram.org/bot<TOKEN>/sendMessage`).
4. После restart: пауза `COOLDOWN_AFTER_RESTART` (общая с outbox-рестартом, см. 1.1.6).

**Telegram:** Bot API, не webhook. Watchdog — отправитель, не получатель.

### 1.3 Конфигурация (переменные окружения)

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `HEALTH_URL` | `http://127.0.0.1:3000/health` | Адрес проверки |
| `CHECK_INTERVAL` | 30 | Секунды между health check |
| `FAILURE_THRESHOLD` | 3 | Неудач для авто-рестарта |
| `COOLDOWN_AFTER_RESTART` | 60 | Пауза после рестарта (секунды) |
| `OUTBOX_PATH` | `/opt/slime-arena/shared/` | Путь к shared volume на хосте |
| `OUTBOX_POLL_INTERVAL` | 5 | Секунды между проверками outbox |
| `TELEGRAM_BOT_TOKEN` | (обязательный) | Токен бота |
| `TELEGRAM_CHAT_ID` | (обязательный) | Чат для оповещений |
| `CONTAINER_NAME` | `slime-arena` | Имя контейнера |

### 1.5 Правила реализации outbox (обязательны)

1. **[MUST] Атомарная запись.** Результат restart (`restart-result`) [MUST] записываться через tmp → rename. Это гарантирует, что MetaServer (или другой потребитель) не прочитает частично записанный файл.

2. **[MUST] Идемпотентность.** Watchdog [MUST] запоминать `auditId` последнего выполненного restart (в переменной в памяти, при перезапуске watchdog теряется — это допустимо). Если файл содержит уже выполненный `auditId` — пропускать.

3. **[MUST] Права доступа на shared volume.**
   - Каталог `/opt/slime-arena/shared/`: владелец root, права 1777 (sticky bit).
   - Контейнер [MUST] создавать/удалять файлы в `/shared/`.
   - Watchdog (root на хосте) [MUST] читать/удалять файлы.

---

## 2. Shared Volume

**Хост:** `/opt/slime-arena/shared/`
**Контейнер:** `/shared/`

[MUST] указать в Docker Compose (или docker run) как bind mount.

**[MUST] Доступность MetaServer с хоста:** Watchdog обращается к `http://127.0.0.1:3000/health` с хоста. Порт 3000 контейнера [MUST] быть опубликован на хост (`ports: "127.0.0.1:3000:3000"` в Docker Compose или эквивалент через существующую схему с Nginx). Без этого watchdog не сможет проверять здоровье сервера.

Файлы в shared volume:

| Файл | Кто создаёт | Кто читает/удаляет | Формат |
|------|------------|-------------------|--------|
| `restart-requested` | MetaServer (контейнер) | Watchdog (хост) | JSON: auditId, requestedBy, timestamp |
| `restart-result` | Watchdog (хост) | MetaServer (контейнер, опционально) | JSON: auditId, status, timestamp, error |

---

## 3. systemd

Файл: `/etc/systemd/system/slime-arena-watchdog.service`

Параметры:
- `Type=simple`
- `Restart=always`
- `RestartSec=5`
- `EnvironmentFile=/opt/slime-arena/watchdog/.env`

[MUST] запускаться от root (для `docker restart`).

---

## 4. Nginx

Добавить в существующую конфигурацию:

| Location | Назначение | Настройка |
|----------|-----------|-----------|
| `/admin/` | Статика Preact-приложения | Файлы из `/var/www/admin/`, `try_files $uri /admin/index.html` (SPA) |
| `/api/v1/admin/ws` | WebSocket (Phase 2) | Proxy к `127.0.0.1:3000`, заголовки Upgrade/Connection |

Admin API endpoints (`/api/v1/admin/*`) [MUST] проксироваться через **существующий** location `/api/` (уже направлен на порт 3000). Отдельный location не нужен.

---

## 5. Деплой Phase 1

Порядок:
1. Создать каталог `/opt/slime-arena/shared/` с правами 1777.
2. Обновить Docker Compose / docker run: добавить bind mount `-v /opt/slime-arena/shared/:/shared/`.
3. Применить миграции PostgreSQL (admin-таблицы).
4. Развернуть обновлённый MetaServer (с admin routes).
5. Установить watchdog: скрипт + `.env` + systemd unit → `systemctl enable --now`.
6. Собрать статику Preact → скопировать в `/var/www/admin/`.
7. Обновить Nginx → `nginx -t && nginx -s reload`.
8. Создать первого администратора (seed-скрипт или ручная вставка в БД).

---

## 6. Критические файлы

| Файл | Действие |
|------|----------|
| `ops/watchdog/watchdog.sh` (или .py) | СОЗДАТЬ — основной скрипт |
| `ops/watchdog/.env.example` | СОЗДАТЬ — шаблон конфигурации |
| `ops/watchdog/slime-arena-watchdog.service` | СОЗДАТЬ — systemd unit |
| `docker-compose.yml` | ИЗМЕНИТЬ — добавить bind mount `/shared/` |
| `nginx/admin.conf` | СОЗДАТЬ — location `/admin/` |

---

## 7. Критерии приёмки (Ops)

| ID | Проверка | Результат |
|----|----------|-----------|
| ACC-MON-013 | Restart → сервер восстанавливается | Health отвечает в течение 60 сек |
| ACC-MON-016 | Health fail 3 раза подряд | Авто-restart + Telegram-оповещение |
| ACC-OPS-001 | Watchdog restart=always | При падении watchdog — systemd перезапускает |
| ACC-OPS-002 | Shared volume права | Контейнер создаёт файл, watchdog читает/удаляет |
| ACC-OPS-003 | Nginx `/admin/` | Статика раздаётся, SPA routing работает |
| ACC-OPS-004 | Idempotency | Два файла с одинаковым auditId → один restart |
