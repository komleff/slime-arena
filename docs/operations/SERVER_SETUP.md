# Slime Arena — Установка сервера

Процедура установки production-сервера с нуля.

**Версия:** v0.8.5 (split-архитектура db + app)
**Обновлено:** 2026-02-07
**Обновление существующего сервера:** [SERVER_UPDATE.md](SERVER_UPDATE.md)

---

## Общая информация

| Параметр | Значение |
| -------- | -------- |
| Провайдер | Timeweb Cloud |
| Локация | Москва |
| IP | 147.45.147.175 |
| Домен | slime-arena.overmobile.space |
| OS | Ubuntu 22.04+ |

### SSH

```bash
ssh -i ~/.ssh/deploy_key root@147.45.147.175
```

> SSH-ключ зависит от оператора. В этой документации — `deploy_key`.

### Порты

| Порт | Сервис | Описание |
| ---- | ------ | -------- |
| 3000 | MetaServer | REST API (auth, profile, leaderboard, admin) |
| 2567 | Colyseus | WebSocket game server |
| 5173 | Client | Static client files |
| 5175 | Admin | Admin Dashboard (`/admin/`) |

---

## Архитектура

Два контейнера, управляемых docker-compose:

- `slime-arena-db` — PostgreSQL 16 + Redis (supervisord)
- `slime-arena-app` — MetaServer + MatchServer + Client + Admin Dashboard (concurrently)

```text
/root/slime-arena/
├── docker-compose.yml   ← конфигурация контейнеров
├── .env                 ← секреты (НЕ коммитится)
```

### Docker Images

```text
ghcr.io/komleff/slime-arena-app:<VERSION>   # обновляется часто
ghcr.io/komleff/slime-arena-db:<VERSION>     # обновляется редко
```

### Volumes

| Volume | Содержимое | Удалять? |
| ------ | ---------- | -------- |
| `slime-arena-pgdata` | PostgreSQL (пользователи, профили, лидерборд) | **НИКОГДА** |
| `slime-arena-redisdata` | Redis (сессии, кеш) | Можно |
| `slime-arena-shared` | Outbox для watchdog (рестарт-запросы) | Можно |

---

## Предварительные требования

- VPS с Ubuntu 22.04+ и минимум 2 ГБ RAM
- Docker Engine + Docker Compose plugin
- Доменное имя с A-записью на IP сервера
- SSH-доступ с ключом

---

## Шаг 1: Подготовка сервера

```bash
SSH="ssh -i ~/.ssh/deploy_key root@<IP>"

# Docker compose
$SSH 'docker compose version'
# Если нет: apt-get update && apt-get install -y docker-compose-plugin

# Рабочие директории
$SSH 'mkdir -p /root/slime-arena /root/backups'

# Overcommit для Redis (без этого — Can't save in background)
$SSH 'sysctl vm.overcommit_memory=1 && echo "vm.overcommit_memory=1" >> /etc/sysctl.conf'
```

## Шаг 2: docker-compose.yml

```bash
scp -i ~/.ssh/deploy_key docker/docker-compose.app-db.yml root@<IP>:/root/slime-arena/docker-compose.yml
```

После копирования добавить shared volume для watchdog. Итоговая секция `app`:

```yaml
app:
  # ... существующие настройки ...
  volumes:
    - shared:/shared

volumes:
  pgdata:
    name: slime-arena-pgdata
  redisdata:
    name: slime-arena-redisdata
  shared:
    name: slime-arena-shared
```

## Шаг 3: .env

Оператор создаёт `/root/slime-arena/.env`:

```env
# Database
POSTGRES_USER=slime
POSTGRES_PASSWORD=<openssl rand -base64 24>
POSTGRES_DB=slime_arena

# Auth
JWT_SECRET=<openssl rand -base64 48>
MATCH_SERVER_TOKEN=<openssl rand -base64 48>
CLAIM_TOKEN_TTL_MINUTES=60

# Admin Dashboard (ОБЯЗАТЕЛЬНО)
ADMIN_ENCRYPTION_KEY=<openssl rand -base64 32>

# OAuth — Yandex
YANDEX_CLIENT_ID=<из Yandex OAuth>
YANDEX_CLIENT_SECRET=<из Yandex OAuth>
OAUTH_YANDEX_ENABLED=true
```

Быстрая генерация:

```bash
$SSH << 'SECRETS'
cd /root/slime-arena
cat > .env << 'EOF'
POSTGRES_USER=slime
POSTGRES_PASSWORD=REPLACE_ME
POSTGRES_DB=slime_arena
JWT_SECRET=REPLACE_ME
MATCH_SERVER_TOKEN=REPLACE_ME
CLAIM_TOKEN_TTL_MINUTES=60
ADMIN_ENCRYPTION_KEY=REPLACE_ME
YANDEX_CLIENT_ID=REPLACE_ME
YANDEX_CLIENT_SECRET=REPLACE_ME
OAUTH_YANDEX_ENABLED=true
EOF
sed -i "0,/REPLACE_ME/s//$(openssl rand -base64 24)/" .env
sed -i "0,/REPLACE_ME/s//$(openssl rand -base64 48)/" .env
sed -i "0,/REPLACE_ME/s//$(openssl rand -base64 48)/" .env
sed -i "0,/REPLACE_ME/s//$(openssl rand -base64 32)/" .env
echo "=== .env создан. Замените YANDEX_CLIENT_* вручную ==="
SECRETS
```

## Шаг 4: Запуск контейнеров

```bash
$SSH << 'EOF'
cd /root/slime-arena
docker compose pull
docker compose up -d db
echo "Ожидание БД..." && sleep 20
docker inspect slime-arena-db --format="{{.State.Health.Status}}"
docker compose up -d app
sleep 15
docker exec slime-arena-app npm run db:migrate --workspace=server
docker compose ps
EOF
```

## Шаг 5: Nginx + SSL

### 5.1 Nginx и acme.sh

```bash
$SSH << 'EOF'
apt-get update && apt-get install -y nginx
curl https://get.acme.sh | sh
mkdir -p /var/www/acme
/root/.acme.sh/acme.sh --issue -d slime-arena.overmobile.space -w /var/www/acme --keylength ec-256
EOF
```

### 5.2 Конфигурация

Файл: `/etc/nginx/sites-available/slime-arena.overmobile.space`

> **Критично:** В `proxy_pass` для `/admin/` обязателен **trailing slash** — он стрипает `/admin/` из пути.
> В regex WebSocket включены `_-` (`^/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$`).

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name slime-arena.overmobile.space;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/acme;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name slime-arena.overmobile.space;

    ssl_certificate     /root/.acme.sh/slime-arena.overmobile.space_ecc/fullchain.cer;
    ssl_certificate_key /root/.acme.sh/slime-arena.overmobile.space_ecc/slime-arena.overmobile.space.key;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;

    access_log /var/log/nginx/slime-arena.access.log;
    error_log  /var/log/nginx/slime-arena.error.log;

    # --- API ---

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/(join-token|submit|claim|leaderboard|health|config|profile|wallets|match-results) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- Colyseus (WebSocket) ---

    location /matchmake/ {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    # /{processId}/{roomId} — ВАЖНО: _ и - в regex
    location ~ ^/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$ {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    location /.well-known/colyseus {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    # --- Admin Dashboard ---
    # Trailing slash стрипает /admin/, без него serve получит /admin/index.html → 404

    location = /admin {
        return 301 /admin/;
    }

    location ^~ /admin/ {
        proxy_pass http://127.0.0.1:5175/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- Client (fallback) ---

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
```

### 5.3 Активация

```bash
$SSH << 'EOF'
ln -sf /etc/nginx/sites-available/slime-arena.overmobile.space /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
EOF
```

> **Обновление Nginx через SSH:** конфиг содержит `$host`, `$remote_addr` и другие `$`-переменные. При передаче через SSH используйте Python-скрипт — `sed` и heredoc без кавычек съедают `$`. Подробнее: [SERVER_UPDATE.md](SERVER_UPDATE.md#обновление-nginx).

## Шаг 6: Watchdog

Watchdog — сервис на хосте (systemd). Принимает запросы на перезапуск из Admin Dashboard, мониторит health.

```bash
# Зависимости
$SSH 'apt-get install -y python3-dotenv python3-requests'

# Директория и файлы
$SSH 'mkdir -p /opt/slime-arena/ops/watchdog'
scp -i ~/.ssh/deploy_key ops/watchdog/watchdog.py root@<IP>:/opt/slime-arena/ops/watchdog/
scp -i ~/.ssh/deploy_key ops/watchdog/slime-arena-watchdog.service root@<IP>:/opt/slime-arena/ops/watchdog/
```

`.env` для watchdog:

```bash
$SSH << 'EOF'
cat > /opt/slime-arena/ops/watchdog/.env << 'ENVEOF'
SHARED_DIR=/var/lib/docker/volumes/slime-arena-shared/_data
CONTAINER_NAME=slime-arena-app
HEALTH_URL=http://127.0.0.1:3000/health
OUTBOX_POLL_INTERVAL=5
CHECK_INTERVAL=30
HEALTH_TIMEOUT=5
FAILURE_THRESHOLD=3
COOLDOWN_AFTER_RESTART=60
# TELEGRAM_BOT_TOKEN=<bot_token>
# TELEGRAM_CHAT_ID=<chat_id>
ENVEOF
EOF
```

Запуск:

```bash
$SSH << 'EOF'
cp /opt/slime-arena/ops/watchdog/slime-arena-watchdog.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable slime-arena-watchdog
systemctl start slime-arena-watchdog
systemctl status slime-arena-watchdog
EOF
```

### Как работает рестарт из Admin Dashboard

```text
Admin Dashboard  →  MetaServer API  →  /shared/restart-requested
                                              ↓
Watchdog (хост)  →  читает файл  →  ждёт shutdownAt (обратный отсчёт)
                                              ↓
                 docker restart -t 30 slime-arena-app
                                              ↓
                 /shared/restart-result  →  Telegram
```

## Шаг 7: Автоматические бэкапы

```bash
$SSH << 'EOF'
(crontab -l 2>/dev/null; echo '0 */6 * * * docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/slime-arena-$(date +\%F-\%H\%M).sql.gz && find /root/backups/ -name "slime-arena-*.sql.gz" -mtime +7 -delete') | crontab -
EOF
```

## Шаг 8: Настройка администраторов

Стандартный admin: `admin` / `Admin123!@#` (создаётся миграцией 009).

**Установка пароля через node (внутри контейнера):**

```bash
$SSH << 'REMOTEOF'
docker exec slime-arena-app node -e "
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const hash = await bcrypt.hash('NewPassword123', 10);
  await pool.query('UPDATE admin_users SET password_hash = \$1 WHERE username = \$2', [hash, 'admin']);
  console.log('Password updated');
  await pool.end();
}
run();
"
REMOTEOF
```

> **Важно:** Не используйте SQL-команды с bcrypt-хешами напрямую через SSH. Символы `$` в хешах (`$2b$10$...`) интерпретируются shell как переменные. Генерируйте хеши через `node` внутри контейнера и обновляйте через параметризованные запросы.

## Шаг 9: Верификация

```bash
curl -s https://slime-arena.overmobile.space/health | jq .
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .
curl -s "https://slime-arena.overmobile.space/api/v1/leaderboard?mode=total&limit=5" | jq .
curl -s -o /dev/null -w "%{http_code}" https://slime-arena.overmobile.space/admin/
$SSH 'systemctl status slime-arena-watchdog --no-pager -l'
$SSH 'cd /root/slime-arena && docker compose ps'
```

**Ожидаемые результаты:**

- `/health` → 200, `{"status":"ok","database":"connected","redis":"connected"}`
- `/admin/` → 200 (HTML страница логина)
- Оба контейнера: `Up (healthy)`
- Watchdog: `active (running)`

---

## Checklist

- [ ] Docker Engine + Compose plugin установлены
- [ ] `docker-compose.yml` скопирован (+ shared volume)
- [ ] `.env` создан со всеми секретами
- [ ] `ADMIN_ENCRYPTION_KEY` задан
- [ ] `OAUTH_YANDEX_ENABLED=true` + credentials
- [ ] Оба контейнера `Up (healthy)`
- [ ] Миграции применены
- [ ] Nginx с trailing slash для `/admin/` и `_-` в WebSocket regex
- [ ] SSL сертификат выпущен
- [ ] `/health` → 200
- [ ] `/admin/` → 200
- [ ] Guest auth работает
- [ ] WebSocket подключение работает
- [ ] Watchdog запущен
- [ ] Cron бэкап настроен
- [ ] OAuth callback URL настроен в Yandex

---

## Troubleshooting

### Admin Dashboard не открывается (404)

1. **Nginx:** нет `^~` в `location ^~ /admin/` или нет trailing slash в `proxy_pass`

   ```nginx
   # ПРАВИЛЬНО
   location ^~ /admin/ {
       proxy_pass http://127.0.0.1:5175/;
   }
   ```

2. **serve.json:** поле `"public"` конфликтует с позиционным аргументом `serve dir`. Минимальный рабочий: `{"rewrites":[{"source":"**","destination":"/index.html"}]}`

3. **Порт 5175 не слушает:** `docker exec slime-arena-app ps aux | grep serve`

### Admin API — ERR_SSL_PROTOCOL_ERROR

`API_BASE` в клиенте содержит `hostname:3000` (HTTP), браузер шлёт HTTPS.
**Решение:** `API_BASE` = `/api/v1/admin` (относительный). Файл: `admin-dashboard/src/api/client.ts`.

### bcrypt-хеши ломаются через SSH

`$2b$10$...` → shell съедает `$2b`, `$10`. Генерируйте хеши **внутри контейнера** через `node` (см. Шаг 8).

### Redis RDB Permission Denied

```bash
$SSH 'sysctl vm.overcommit_memory=1 && echo "vm.overcommit_memory=1" >> /etc/sysctl.conf'
```

### WebSocket 405 / Connection Failed

Nginx regex не включает `_-`. Должно быть: `^/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$`

---

## Ссылки

| Документ | Описание |
| -------- | -------- |
| [SERVER_UPDATE.md](SERVER_UPDATE.md) | Обновление действующего сервера |
| [AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md) | Гайд для ИИ-агентов |
| [backup-restore.md](backup-restore.md) | Бэкап и восстановление |
| [docker-compose.app-db.yml](../../docker/docker-compose.app-db.yml) | Исходный Compose-файл |
| [watchdog.py](../../ops/watchdog/watchdog.py) | Исходный код watchdog |
