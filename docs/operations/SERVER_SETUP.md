# Slime Arena — Server Setup

Документация по настройке production-сервера.

## VPS Information

| Параметр | Значение |
|----------|----------|
| Провайдер | Timeweb Cloud |
| Локация | Москва |
| IP | 147.45.147.175 |
| Домен | slime-arena.overmobile.space |
| OS | Ubuntu 20.04+ |

## SSH Access

```bash
# Подключение
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175

# Генерация ключа (если нет)
ssh-keygen -t ed25519 -C "your@email.com"

# Копирование публичного ключа на сервер
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@147.45.147.175
```

## Архитектура (v0.8.5) — Split: db + app

Production использует **два контейнера**, управляемых docker-compose:

- `slime-arena-db` — PostgreSQL 16 + Redis
- `slime-arena-app` — MetaServer + MatchServer + Client + Admin Dashboard

```
/root/slime-arena/
├── docker-compose.yml   ← конфигурация контейнеров
├── .env                 ← секреты (НЕ коммитится в git)
```

### Docker Images

```bash
# App (обновляется часто)
ghcr.io/komleff/slime-arena-app:0.8.5

# DB (обновляется редко)
ghcr.io/komleff/slime-arena-db:0.8.5
```

### Первоначальная установка

#### 1. Подготовка сервера

```bash
# Проверить docker compose
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker compose version'
# Если нет: apt-get update && apt-get install -y docker-compose-plugin

# Создать рабочую директорию
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'mkdir -p /root/slime-arena /root/backups'

# Скопировать compose-файл
scp -i ~/.ssh/id_ed25519 docker/docker-compose.app-db.yml root@147.45.147.175:/root/slime-arena/docker-compose.yml
```

#### 2. Создать .env на сервере

Оператор создаёт `/root/slime-arena/.env`:

```env
# Database
POSTGRES_USER=slime
POSTGRES_PASSWORD=<сгенерировать: openssl rand -base64 24>
POSTGRES_DB=slime_arena

# Auth
JWT_SECRET=<сгенерировать: openssl rand -base64 48>
MATCH_SERVER_TOKEN=<сгенерировать: openssl rand -base64 48>
CLAIM_TOKEN_TTL_MINUTES=60

# Admin Dashboard (ОБЯЗАТЕЛЬНО)
ADMIN_ENCRYPTION_KEY=<сгенерировать: openssl rand -base64 32>

# OAuth — Yandex
YANDEX_CLIENT_ID=<из Yandex OAuth>
YANDEX_CLIENT_SECRET=<из Yandex OAuth>
OAUTH_YANDEX_ENABLED=true
```

#### 3. Запуск

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
cd /root/slime-arena
docker compose pull
docker compose up -d db

# Дождаться инициализации БД
sleep 20
docker inspect slime-arena-db --format="{{.State.Health.Status}}"

# Запустить app
docker compose up -d app
sleep 10

# Миграции
docker exec slime-arena-app npm run db:migrate --workspace=server

# Проверка
docker compose ps
EOF
```

### Обновление app (повседневное)

```bash
cd /root/slime-arena
docker compose pull app
docker compose up -d app
# Если есть новые миграции:
docker exec slime-arena-app npm run db:migrate --workspace=server
```

### Обновление db (редкое, с бэкапом)

```bash
cd /root/slime-arena
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-update-$(date +%F-%H%M).sql.gz
docker compose pull db
docker compose up -d db
```

## Volumes (персистентные данные)

```
slime-arena-pgdata    # PostgreSQL data (пользователи, профили, лидерборд)
slime-arena-redisdata # Redis data (сессии, кеш)
```

**ВАЖНО:** Никогда не удалять эти volumes! Они содержат все данные пользователей.

## Ports

| Порт | Сервис | Описание |
|------|--------|----------|
| 3000 | MetaServer | REST API (auth, profile, leaderboard, admin) |
| 2567 | Colyseus | WebSocket game server |
| 5173 | Client | Static client files |
| 5175 | Admin | Admin Dashboard (/admin/) |

## Nginx Configuration

Файл: `/etc/nginx/sites-available/slime-arena.overmobile.space`

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

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Legacy auth endpoints
    location /auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Other MetaServer endpoints
    location ~ ^/(join-token|submit|claim|leaderboard|health|config|profile|wallets|match-results) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Colyseus matchmake
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

    # Colyseus WebSocket rooms: /{processId}/{roomId}
    location ~ ^/[a-zA-Z0-9]+/[a-zA-Z0-9]+$ {
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

    # Admin Dashboard
    location /admin/ {
        proxy_pass http://127.0.0.1:5175/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Colyseus discovery
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

    # Client (fallback)
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

### Nginx Commands

```bash
# Проверка конфигурации
nginx -t

# Перезагрузка
systemctl reload nginx

# Логи
tail -f /var/log/nginx/slime-arena.access.log
tail -f /var/log/nginx/slime-arena.error.log
```

## SSL Certificate (acme.sh)

```bash
# Установка acme.sh
curl https://get.acme.sh | sh

# Выпуск сертификата
acme.sh --issue -d slime-arena.overmobile.space -w /var/www/acme --keylength ec-256

# Автопродление настроено автоматически через cron
# Сертификаты в: /root/.acme.sh/slime-arena.overmobile.space_ecc/
```

## Useful Commands

### Container Management (docker-compose)

```bash
# Статус контейнеров
cd /root/slime-arena && docker compose ps

# Логи
docker logs --tail 100 slime-arena-app
docker logs --tail 100 slime-arena-db
docker compose logs --tail 100

# Перезапуск app
docker compose restart app

# Перезапуск всего
docker compose restart
```

### Database (PostgreSQL)

```bash
# Подключение к PostgreSQL
docker exec -it slime-arena-db psql -U slime -d slime_arena

# SQL запросы
docker exec slime-arena-db psql -U slime -d slime_arena -c "SELECT COUNT(*) FROM users;"

# Backup
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/backup-$(date +%F-%H%M).sql.gz
```

### Redis

```bash
# Ping
docker exec slime-arena-db redis-cli ping

# Info
docker exec slime-arena-db redis-cli info

# Очистка (осторожно!)
docker exec slime-arena-db redis-cli FLUSHALL
```

### Health Checks

```bash
# API health
curl -s https://slime-arena.overmobile.space/health | jq .

# Guest auth
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .

# Leaderboard
curl -s "https://slime-arena.overmobile.space/api/v1/leaderboard?mode=total&limit=5" | jq .

# Matchmake (creates room)
curl -s -X POST https://slime-arena.overmobile.space/matchmake/joinOrCreate/arena \
  -H "Content-Type: application/json" -d '{}' | jq .
```

## Troubleshooting

### Redis RDB Permission Denied

```bash
# Симптом: Can't save in background: fork: Cannot allocate memory
# Решение:
sysctl vm.overcommit_memory=1
echo "vm.overcommit_memory=1" >> /etc/sysctl.conf
docker compose restart db
```

### Telemetry Logs Permission

```bash
# Симптом: EACCES /app/server/dist/server/logs
# Решение:
docker exec slime-arena-app chmod -R 777 /app/server/dist/server/logs
```

### WebSocket 405 Error

**Симптом:** `POST /matchmake/joinOrCreate/arena` возвращает 405

**Причина:** Nginx location не матчит путь

**Решение:** Использовать prefix location `/matchmake/` вместо regex

### WebSocket Connection Failed

**Симптом:** `WebSocket connection to 'wss://domain/{processId}/{roomId}' failed`

**Причина:** Colyseus WebSocket пути `/{processId}/{roomId}` попадают на fallback `/` (клиент)

**Решение:** Добавить location для WebSocket путей:

```nginx
location ~ ^/[a-zA-Z0-9]+/[a-zA-Z0-9]+$ {
    proxy_pass http://127.0.0.1:2567;
    # ... WebSocket headers
}
```

## Deployment Checklist

- [ ] Docker images pushed to ghcr.io (CI/CD автоматически)
- [ ] `/root/slime-arena/.env` создан с актуальными секретами
- [ ] `/root/slime-arena/docker-compose.yml` скопирован на сервер
- [ ] `docker compose up -d` — оба контейнера `Up (healthy)`
- [ ] Миграции БД применены
- [ ] Nginx config обновлён и `nginx -t` прошёл
- [ ] SSL certificate valid
- [ ] Health endpoint responding
- [ ] Guest auth working
- [ ] Matchmake working
- [ ] WebSocket connection working
- [ ] Admin Dashboard доступен по `/admin/`
- [ ] OAuth callback URL configured in Yandex
- [ ] Cron бэкап настроен (`crontab -l`)

## Contact

При проблемах с сервером: создать issue в репозитории с тегом `ops`.
