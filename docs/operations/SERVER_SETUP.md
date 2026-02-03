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

## Docker Container

```bash
# Текущий образ
ghcr.io/komleff/slime-arena-monolith-full:0.7.8

# Запуск контейнера
docker run -d \
  --name slime-arena \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 2567:2567 \
  -p 5173:5173 \
  -v slime-arena-pgdata:/var/lib/postgresql/data \
  -v slime-arena-redisdata:/var/lib/redis \
  -e JWT_SECRET="your-secret-here" \
  -e YANDEX_CLIENT_ID="bfd4855a924f4bc7a16ccfc367f3a067" \
  -e YANDEX_CLIENT_SECRET="your-secret-here" \
  -e YANDEX_REDIRECT_URI="https://slime-arena.overmobile.space/oauth/yandex/callback" \
  ghcr.io/komleff/slime-arena-monolith-full:0.7.8

# Volumes (персистентные данные)
slime-arena-pgdata    # PostgreSQL data
slime-arena-redisdata # Redis data
```

## Ports

| Порт | Сервис | Описание |
|------|--------|----------|
| 3000 | MetaServer | REST API (auth, profile, leaderboard) |
| 2567 | Colyseus | WebSocket game server |
| 5173 | Vite | Static client files |

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

    # API endpoints (^~ stops regex search)
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Legacy auth endpoints
    location ^~ /auth/ {
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
    location ^~ /matchmake/ {
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

    # Static assets - all directories from client/dist (^~ stops regex search)
    location ^~ /assets/ {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    location ^~ /backgrounds/ {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    location ^~ /hud/ {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    location ^~ /icons/ {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    location ^~ /skins/ {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    location ^~ /sprites/ {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Colyseus WebSocket rooms: /{processId}/{roomId}?sessionId=...
    # No $ anchor - allows query strings
    location ~ ^/[a-zA-Z0-9]+/[a-zA-Z0-9]+ {
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

### Важные особенности конфигурации

| Модификатор | Значение | Где используется |
|-------------|----------|------------------|
| `^~` | Prefix match, останавливает поиск regex | `/api/`, `/assets/`, `/matchmake/` |
| `~` | Case-sensitive regex | WebSocket rooms, MetaServer endpoints |
| без модификатора | Prefix match, проверяет regex | `/` (fallback) |

**Критично**: Regex `^/[a-zA-Z0-9]+/[a-zA-Z0-9]+` без `$` на конце — иначе не пропускает query string `?sessionId=...`.

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

### Container Management

```bash
# Статус контейнера
docker ps
docker inspect slime-arena --format='{{.State.Health.Status}}'

# Логи
docker logs --tail 100 slime-arena
docker logs -f slime-arena  # follow

# Перезапуск
docker restart slime-arena

# Вход в контейнер
docker exec -it slime-arena bash
```

### Database (PostgreSQL)

```bash
# Подключение к PostgreSQL
docker exec -it slime-arena psql -U slime -d slime_arena

# SQL запросы
docker exec slime-arena psql -U slime -d slime_arena -c "SELECT COUNT(*) FROM users;"

# Backup
docker exec slime-arena pg_dump -U slime slime_arena > backup.sql
```

### Redis

```bash
# Ping
docker exec slime-arena redis-cli ping

# Info
docker exec slime-arena redis-cli info

# Очистка (осторожно!)
docker exec slime-arena redis-cli FLUSHALL
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
docker restart slime-arena
```

### Telemetry Logs Permission

```bash
# Симптом: EACCES /app/server/dist/server/logs
# Решение:
docker exec slime-arena chmod -R 777 /app/server/dist/server/logs
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

- [ ] Docker image pushed to ghcr.io
- [ ] Container running with correct env vars
- [ ] PostgreSQL data volume mounted
- [ ] Redis data volume mounted
- [ ] Nginx config updated and reloaded
- [ ] SSL certificate valid
- [ ] Health endpoint responding
- [ ] Guest auth working
- [ ] Matchmake working
- [ ] WebSocket connection working
- [ ] OAuth callback URL configured in Yandex

## Contact

При проблемах с сервером: создать issue в репозитории с тегом `ops`.
