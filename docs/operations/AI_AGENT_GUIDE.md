# AI Agent Deployment Guide — Production Server Management

**Это руководство для ИИ-деплоеров (Claude, Copilot и подобные)**, которые помогают управлять production сервером Slime Arena.

> **Архитектура v0.8.5:** Split-архитектура (db + app), управляемая docker-compose.
> Монолитный контейнер (`monolith-full`) **deprecated** — НЕ использовать для production.

---

## Архитектура

```
/root/slime-arena/              ← на production-сервере
├── docker-compose.yml          ← конфигурация контейнеров (ПОСТОЯННЫЙ файл)
├── .env                        ← ВСЕ секреты (ПОСТОЯННЫЙ файл)
```

**Контейнеры:**
- `slime-arena-db` — PostgreSQL 16 + Redis (обновляется РЕДКО)
- `slime-arena-app` — MetaServer + MatchServer + Client + Admin Dashboard (обновляется ЧАСТО)

**Volumes:**
- `slime-arena-pgdata` — данные PostgreSQL (пользователи, профили, лидерборд)
- `slime-arena-redisdata` — данные Redis (сессии, кеш)

---

## ЗАПРЕТЫ (P0)

```
❌ НИКОГДА: docker volume rm slime-arena-pgdata
❌ НИКОГДА: docker volume rm slime-arena-redisdata
❌ НИКОГДА: docker compose down --volumes
❌ НИКОГДА: docker run -e ... (использовать ТОЛЬКО docker compose)
❌ НИКОГДА: удалять или перезаписывать /root/slime-arena/.env
❌ НИКОГДА: выводить содержимое .env или docker inspect --format='{{json .Config.Env}}'
❌ НИКОГДА: удалять /root/slime-arena/docker-compose.yml
```

---

## Security

**НИКОГДА не запрашивайте и не выводите в открытом виде:**
- `JWT_SECRET`, `MATCH_SERVER_TOKEN`, `ADMIN_ENCRYPTION_KEY`
- `YANDEX_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`
- Другие токены и ключи из `.env`

Если нужны эти значения — **попросите оператора**.

---

## Информация о сервере

- **IP:** 147.45.147.175
- **Домен:** slime-arena.overmobile.space
- **ОС:** Ubuntu 20.04+
- **SSH:** `ssh -i ~/.ssh/id_ed25519 root@147.45.147.175`
- **Docker Compose:** `/root/slime-arena/docker-compose.yml`
- **Secrets:** `/root/slime-arena/.env`
- **Порты:** 3000 (Meta), 2567 (Game), 5173 (Client), 5175 (Admin)

---

## Первый деплой v0.8.4 — чеклист

При первом деплое v0.8.4 (split-архитектура) убедиться:

1. **`.env` содержит обязательные переменные:**
   - `ADMIN_ENCRYPTION_KEY` — **критично**, без неё Admin Dashboard не работает
   - `OAUTH_YANDEX_ENABLED=true` — по умолчанию `false` в compose, нужно явно включить
   - `YANDEX_CLIENT_ID` и `YANDEX_CLIENT_SECRET` — для Yandex OAuth
   - `JWT_SECRET`, `MATCH_SERVER_TOKEN` — стандартные секреты

2. **После `docker compose up -d app` — обязательно запустить миграции:**

   ```bash
   docker exec slime-arena-app npm run db:migrate --workspace=server
   ```

3. **Проверить admin-пользователя** (создаётся миграцией 009):
   - Логин: `admin`
   - Пароль по умолчанию: задаётся при первой настройке или через seed
   - 2FA: настраивается через Admin Dashboard → Settings

4. **(Опционально) Restart через Admin Dashboard** — требует:
   - Volume для outbox-файлов в compose:

     ```yaml
     app:
       volumes:
         - /root/slime-arena/shared:/shared
       environment:
         - SHARED_DIR=/shared
     ```

   - Watchdog-скрипт на хосте, следящий за `/root/slime-arena/shared/restart-requested`
   - Без этого рестарт можно делать вручную: `docker compose restart app`

---

## Обновление app (частое — каждый релиз)

Это основная операция. Обновляется только app-контейнер, всё остальное не затрагивается.

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
cd /root/slime-arena
docker compose pull app
docker compose up -d app
EOF
```

Если есть новые миграции БД:

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'docker exec slime-arena-app npm run db:migrate --workspace=server'
```

**Проверка после обновления:**

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'cd /root/slime-arena && docker compose ps'
curl -s https://slime-arena.overmobile.space/health | jq .
```

**Время простоя:** ~5 секунд. БД, Redis, .env, Nginx — не затрагиваются.

### Что НЕ затрагивается при обновлении app

| Компонент | Расположение | Затрагивается? |
|-----------|-------------|----------------|
| PostgreSQL данные | Volume `slime-arena-pgdata` | Нет |
| Redis данные | Volume `slime-arena-redisdata` | Нет |
| Секреты (.env) | `/root/slime-arena/.env` | Нет |
| docker-compose.yml | `/root/slime-arena/` | Нет |
| Nginx | `/etc/nginx/sites-available/` | Нет |
| SSL сертификаты | `/root/.acme.sh/` | Нет |

---

## Обновление db (редкое)

**ОБЯЗАТЕЛЬНО:** Бэкап перед обновлением.

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
cd /root/slime-arena
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-db-update-$(date +%F-%H%M).sql.gz
docker compose pull db
docker compose up -d db
EOF
```

---

## Бэкап

### Перед любым обновлением (P0)

```bash
# Бэкап на сервере
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'mkdir -p /root/backups && docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-update-$(date +%F-%H%M).sql.gz && ls -lh /root/backups/'

# Скачать дамп локально (рекомендуется)
scp -i ~/.ssh/id_ed25519 root@147.45.147.175:/root/backups/pre-update-*.sql.gz ./backups/
```

### Автоматический бэкап (cron на сервере)

```
0 */6 * * * docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/slime-arena-$(date +\%F-\%H\%M).sql.gz && find /root/backups/ -name "slime-arena-*.sql.gz" -mtime +7 -delete
```

---

## Откат app на предыдущую версию

Если app сломался после обновления:

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
cd /root/slime-arena
# Вариант 1: указать конкретную версию через переменную
VERSION=0.8.4 docker compose pull app
VERSION=0.8.4 docker compose up -d app

# Вариант 2: отредактировать docker-compose.yml
# image: ghcr.io/komleff/slime-arena-app:<ПРЕДЫДУЩАЯ_ВЕРСИЯ>
# docker compose up -d app
EOF
```

---

## Полная проверка здоровья

```bash
# Статус контейнеров
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'cd /root/slime-arena && docker compose ps'

# Health endpoint
curl -s https://slime-arena.overmobile.space/health | jq .

# Guest auth
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .

# Leaderboard
curl -s "https://slime-arena.overmobile.space/api/v1/leaderboard?mode=total&limit=5" | jq .

# WebSocket (matchmake)
curl -s -X POST https://slime-arena.overmobile.space/matchmake/joinOrCreate/arena \
  -H "Content-Type: application/json" -d '{}' | jq .

# Admin Dashboard — открыть в браузере:
# https://slime-arena.overmobile.space/admin/
```

---

## Проверка Admin Dashboard (v0.8.4+)

Admin Dashboard доступен по адресу `https://slime-arena.overmobile.space/admin/`.

**Проверка после деплоя:**

1. Открыть `/admin/` в браузере
2. Войти с учётными данными admin-пользователя
3. Если 2FA не настроена — настроить в Settings (QR-код → TOTP-приложение → подтверждение)
4. Проверить доступность страниц: Users, Matches, Settings
5. (Опционально) Проверить рестарт — требует настроенный SHARED_DIR и watchdog

**Частые проблемы:**

- Ошибка логина → проверить что миграция 009 выполнена (`admin_users` таблица существует)
- `ADMIN_ENCRYPTION_KEY not set` → добавить в `.env`, перезапустить app
- 2FA код не принимается → проверить синхронизацию времени на сервере (`timedatectl`)
- Restart возвращает 500 → `SHARED_DIR` не настроен или каталог не существует

---

## Просмотр логов

```bash
# Все контейнеры
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'cd /root/slime-arena && docker compose logs --tail 100'

# Только app
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker logs slime-arena-app --tail 100'

# Только db
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker logs slime-arena-db --tail 100'

# Follow
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker logs -f slime-arena-app --tail 50'
```

**Red flags:**

- `Cannot allocate memory` — переполнение памяти
- `Connection refused` — сервис не слушает порт
- `EACCES` — проблема с правами доступа
- `ECONNREFUSED db:5432` — БД не доступна для app
- `ADMIN_ENCRYPTION_KEY not set` — **критично**, Admin Dashboard не будет работать
- `ENOENT: restart-requested` — `SHARED_DIR` не настроен или каталог не создан
- `OAUTH_YANDEX_ENABLED` отсутствует в логах провайдеров — добавить `OAUTH_YANDEX_ENABLED=true` в `.env`

---

## Когда просить помощь оператора

| Ситуация | Действие |
|----------|----------|
| Нужно добавить новую env var | Попросить оператора добавить в `.env` |
| db-контейнер не стартует | Показать логи, НЕ удалять volumes |
| Миграция БД провалилась | Остановить app, показать ошибку, ждать оператора |
| Нужно изменить Nginx | Попросить оператора, не трогать самостоятельно |
| SSL сертификат истёк | Попросить оператора обновить через acme.sh |
| Нужны значения секретов | Попросить оператора, НИКОГДА не извлекать из .env |

---

## Диагностика проблем

### Контейнер не поднимается

```bash
# Проверить статус
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'cd /root/slime-arena && docker compose ps -a'

# Логи конкретного контейнера
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker logs slime-arena-app 2>&1 | tail -50'

# Попробовать перезапустить
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'cd /root/slime-arena && docker compose restart app'
```

### Память/диск переполнен

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
df -h
free -h
du -sh /var/lib/docker/volumes/*/
EOF
```

### БД недоступна для app

```bash
# Проверить health БД
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker inspect slime-arena-db --format="{{.State.Health.Status}}"'

# Попробовать подключиться напрямую
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker exec slime-arena-db pg_isready -U slime -h localhost'
```

---

## Ссылки

- [SERVER_SETUP.md](SERVER_SETUP.md) — Полная инструкция по настройке сервера
- [.env.production.example](../../.env.production.example) — Шаблон переменных
- [docker-compose.app-db.yml](../../docker/docker-compose.app-db.yml) — Compose файл (источник)
- [app.Dockerfile](../../docker/app.Dockerfile) — Сборка app-образа
- [db.Dockerfile](../../docker/db.Dockerfile) — Сборка db-образа

---

**Последнее обновление:** 2026-02-07
**Версия сервера:** 0.8.5 (split-архитектура db + app)
**Контактная информация:** GitHub Issues с тегом `ops`
