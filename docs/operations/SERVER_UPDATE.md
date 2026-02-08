# Slime Arena — Server Update

Инструкции по обновлению production-сервера.

## Предварительные требования

- SSH-доступ: `ssh root@slime-arena.overmobile.space`
- Docker-образ загружен в `ghcr.io/komleff/slime-arena-*`
- Бэкап данных (см. раздел «Бэкап»)

## Порядок обновления

### 1. Бэкап базы данных

```bash
ssh root@slime-arena.overmobile.space

# PostgreSQL дамп
docker exec slime-arena-db pg_dump -U slime slime_arena > /root/backup-$(date +%Y%m%d).sql

# Проверить размер
ls -lh /root/backup-*.sql
```

### 2. Остановка и обновление контейнеров (app-db)

```bash
cd /root

# Остановить
docker compose -f docker-compose.app-db.yml down

# Загрузить новый образ
docker pull ghcr.io/komleff/slime-arena-app:NEW_VERSION
docker pull ghcr.io/komleff/slime-arena-db:NEW_VERSION

# Обновить версию в docker-compose.app-db.yml
# или задать через переменную окружения

# Запустить
docker compose -f docker-compose.app-db.yml up -d

# Проверить
docker ps
docker logs slime-arena-app --tail 20
```

### 3. Проверка после обновления

```bash
# Health-check
curl -s http://localhost:3000/health | python3 -m json.tool

# Redis
docker exec slime-arena-db redis-cli PING

# PostgreSQL
docker exec slime-arena-db psql -U slime -d slime_arena -c "SELECT COUNT(*) FROM users;"

# Клиент
curl -s -o /dev/null -w "%{http_code}" https://slime-arena.overmobile.space

# WebSocket (matchmake)
curl -s -X POST https://slime-arena.overmobile.space/matchmake/joinOrCreate/arena \
  -H "Content-Type: application/json" -d '{}' | head -c 100
```

### 4. Откат при проблемах

```bash
# Остановить
docker compose -f docker-compose.app-db.yml down

# Вернуть предыдущую версию
docker compose -f docker-compose.app-db.yml up -d  # с предыдущим тегом

# Восстановить БД (если нужно)
cat /root/backup-YYYYMMDD.sql | docker exec -i slime-arena-db psql -U slime slime_arena
```

## Добавление нового домена

### 1. DNS

Создать A-запись, указывающую на `147.45.147.175`.

### 2. Nginx конфиг (HTTP для ACME)

```bash
cat > /etc/nginx/sites-available/slime-arena-NEWDOMAIN <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name NEW.DOMAIN.COM;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/acme;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/slime-arena-NEWDOMAIN /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 3. SSL-сертификат

```bash
/root/.acme.sh/acme.sh --issue -d NEW.DOMAIN.COM -w /var/www/acme --keylength ec-256
```

### 4. Nginx конфиг (HTTPS)

Скопировать конфиг существующего домена, заменить:
- `server_name`
- пути к `ssl_certificate` и `ssl_certificate_key`
- путь к `access_log` и `error_log`

```bash
nginx -t && systemctl reload nginx
```

### 5. OAuth

Добавить `https://NEW.DOMAIN.COM` как разрешённый Redirect URI в:
- [Yandex OAuth Console](https://oauth.yandex.ru/client/) (Client ID: `bfd4855a924f4bc7a16ccfc367f3a067`)

## Чек-лист обновления

- [ ] Бэкап PostgreSQL
- [ ] Новые Docker-образы загружены
- [ ] Контейнеры обновлены и запущены
- [ ] Health-check OK (`/health`)
- [ ] Redis PING → PONG
- [ ] Клиент загружается (200)
- [ ] WebSocket подключается
- [ ] OAuth работает (если менялся)
- [ ] Оба домена доступны

## Контейнеры (app-db деплой)

| Контейнер | Образ | Порты |
|-----------|-------|-------|
| slime-arena-app | ghcr.io/komleff/slime-arena-app:TAG | 2567, 3000, 5173, 5175 |
| slime-arena-db | ghcr.io/komleff/slime-arena-db:TAG | 5432, 6379 (internal) |

## Volumes

| Volume | Описание | ⚠️ |
|--------|----------|------|
| pgdata | PostgreSQL (пользователи, профили) | Никогда не удалять! |
| redisdata | Redis (сессии, кеш) | Можно очистить |

## Конфигурация Redis

Redis запускается через supervisord с флагами:
```
--save "" --stop-writes-on-bgsave-error no
```

Это отключает RDB-снапшоты. Для игровых сессий/кеша персистентность Redis не критична — PostgreSQL является основным хранилищем.

## Известные проблемы

| Проблема | Решение |
|----------|---------|
| Redis MISCONF → 502 | `--save "" --stop-writes-on-bgsave-error no` (исправлено в v0.8.5-hotfix) |
| Memory overcommit | `sysctl vm.overcommit_memory=1` |
| Logs EACCES | `chmod -R 777 /app/server/dist/server/logs` |
