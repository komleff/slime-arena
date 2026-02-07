# Релиз v0.8.3 — Миграция на split-архитектуру (db + app)

**Дата:** 2026-02-07

---

## Часть 1: Анализ проблемы

### Почему монолит убивает настройки при обновлении

Монолит хранит ВСЁ в одном контейнере: PostgreSQL + Redis + MetaServer + MatchServer + Client + Admin. При обновлении:

```
docker stop slime-arena
docker rm slime-arena          ← контейнер удалён, env vars потеряны
docker run -d \
  -e JWT_SECRET="..." \        ← нужно ввести 12 переменных заново
  -e MATCH_SERVER_TOKEN="..." \
  ...                          ← забыл одну — сервер сломан
```

**Корневая причина:** Env vars живут только в команде `docker run`. Нет файла конфигурации.

### Что сохраняется, а что теряется

| Данные | Где хранится | Переживает обновление? |
|--------|-------------|----------------------|
| PostgreSQL данные | Volume `slime-arena-pgdata` | Да |
| Redis данные | Volume `slime-arena-redisdata` | Да |
| **Env vars (секреты)** | **Команда `docker run -e`** | **НЕТ** |
| Nginx конфиг | Хост `/etc/nginx/` | Да (вне Docker) |
| SSL сертификаты | Хост `/root/.acme.sh/` | Да (вне Docker) |

**Вывод:** Данные БД не теряются — теряются env vars и настройки запуска.

### Решение: docker-compose + .env

```
/root/slime-arena/          ← на сервере
├── docker-compose.yml      ← порты, volumes, зависимости (постоянный файл)
├── .env                    ← ВСЕ секреты (постоянный файл)
```

**Обновление app (частое) — 3 команды:**

```bash
cd /root/slime-arena
docker compose pull app
docker compose up -d app
```

`.env` не трогается. БД не трогается. Nginx не трогается. Простой ~5 секунд.

**Обновление db (редкое) — 4 команды:**

```bash
cd /root/slime-arena
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-update.sql.gz
docker compose pull db
docker compose up -d db
```

---

## Часть 2: Первоначальная установка v0.8.3

Эту процедуру нужно выполнить **один раз** — при миграции с монолита на split.

### Шаг 0: CI/CD и образы

```bash
# Проверить что CI собрал образы после merge PR #139
gh run list --workflow=publish-containers.yml --limit=3

# Создать тег — CI соберёт образы с версией 0.8.3
git tag v0.8.3
git push origin v0.8.3
```

Дождаться завершения (~5-10 минут). Результат:
- `ghcr.io/komleff/slime-arena-app:0.8.3`
- `ghcr.io/komleff/slime-arena-db:0.8.3`

### Шаг 1: Бэкап (P0)

```bash
# Дамп БД (3-4 пользователя)
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'mkdir -p /root/backups && docker exec slime-arena pg_dump -U slime slime_arena | gzip > /root/backups/pre-v083-$(date +%F-%H%M).sql.gz && ls -lh /root/backups/'

# Скачать локально
mkdir -p backups
scp -i ~/.ssh/id_ed25519 root@147.45.147.175:/root/backups/pre-v083-*.sql.gz ./backups/
scp -i ~/.ssh/id_ed25519 root@147.45.147.175:/root/.env.production ./backups/.env.production.backup
```

### Шаг 2: Подготовка сервера

```bash
# Проверить docker compose
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'docker compose version'
# Если нет: apt-get update && apt-get install -y docker-compose-plugin

# Создать рабочую директорию
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'mkdir -p /root/slime-arena'

# Скопировать compose-файл
scp -i ~/.ssh/id_ed25519 docker/docker-compose.app-db.yml root@147.45.147.175:/root/slime-arena/docker-compose.yml
```

### Шаг 3: Создать .env

Оператор создаёт `/root/slime-arena/.env` на сервере:

```env
# Database
POSTGRES_USER=slime
POSTGRES_PASSWORD=<openssl rand -base64 24>
POSTGRES_DB=slime_arena

# Auth (из /root/.env.production)
JWT_SECRET=<ИЗ .env.production>
MATCH_SERVER_TOKEN=<ИЗ .env.production>
CLAIM_TOKEN_TTL_MINUTES=60

# Admin (НОВОЕ — сгенерировать)
ADMIN_ENCRYPTION_KEY=<openssl rand -base64 32>

# OAuth — Yandex (из /root/.env.production)
YANDEX_CLIENT_ID=<ИЗ .env.production>
YANDEX_CLIENT_SECRET=<ИЗ .env.production>
OAUTH_YANDEX_ENABLED=true
```

> `ADMIN_ENCRYPTION_KEY` — новая обязательная переменная. Compose не запустится без неё.

### Шаг 4: Остановка монолита и чистый старт

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
# Остановить монолит
docker stop slime-arena && docker rm slime-arena

# Удалить старые volumes (данные в бэкапе)
docker volume rm slime-arena-pgdata slime-arena-redisdata

# Запустить split-архитектуру
cd /root/slime-arena
docker compose pull
docker compose up -d db

# Дождаться инициализации БД
sleep 20
docker inspect slime-arena-db --format="{{.State.Health.Status}}"

# Запустить app
docker compose up -d app
sleep 10

# Миграции (app-контейнер не запускает их автоматически)
docker exec slime-arena-app npm run db:migrate --workspace=server
EOF
```

> `entrypoint-db.sh` при чистом старте автоматически настроит:
> - `listen_addresses = '*'` и `host all all 0.0.0.0/0 md5`
> - Пользователя `slime` с паролем из `POSTGRES_PASSWORD`
> - Базу `slime_arena`

### Шаг 5: Восстановление пользователей

```bash
# Загрузить дамп на сервер
scp -i ~/.ssh/id_ed25519 ./backups/pre-v083-*.sql.gz root@147.45.147.175:/root/backups/

# Восстановить (ошибки "already exists" для таблиц — нормально)
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'gunzip -c /root/backups/pre-v083-*.sql.gz | docker exec -i slime-arena-db psql -U slime slime_arena'

# Проверить
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'docker exec slime-arena-db psql -U slime slime_arena -c "SELECT id, nickname, is_anonymous FROM users;"'
```

### Шаг 6: Верификация

```bash
# Контейнеры
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'cd /root/slime-arena && docker compose ps'

# Health
curl -s https://slime-arena.overmobile.space/health | jq .

# Guest auth
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .

# Leaderboard
curl -s "https://slime-arena.overmobile.space/api/v1/leaderboard?mode=total&limit=5" | jq .

# WebSocket
curl -s -X POST https://slime-arena.overmobile.space/matchmake/joinOrCreate/arena \
  -H "Content-Type: application/json" -d '{}' | jq .

# Admin Dashboard — открыть в браузере
# https://slime-arena.overmobile.space/admin/
```

---

## Часть 3: Повседневное обновление (после первоначальной установки)

### Обновление app (частое — каждый релиз)

```bash
cd /root/slime-arena
docker compose pull app
docker compose up -d app
# Если есть новые миграции:
docker exec slime-arena-app npm run db:migrate --workspace=server
```

**Что сохраняется:** БД, Redis, .env, Nginx, SSL — всё.
**Что меняется:** Только app-контейнер.
**Простой:** ~5 секунд.

### Обновление db (редкое)

```bash
cd /root/slime-arena
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-update.sql.gz
docker compose pull db
docker compose up -d db
```

### Откат app (если сломалось)

```bash
cd /root/slime-arena
# Указать предыдущую версию в docker-compose.yml или:
VERSION=0.8.3 docker compose up -d app
```

---

## Часть 4: Откат на монолит (крайний случай)

```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
cd /root/slime-arena && docker compose down --volumes

source /root/.env.production
docker run -d \
  --name slime-arena \
  --restart unless-stopped \
  -p 3000:3000 -p 2567:2567 -p 5173:5173 -p 5175:5175 \
  -v slime-arena-pgdata:/var/lib/postgresql/data \
  -v slime-arena-redisdata:/var/lib/redis \
  -e JWT_SECRET="$JWT_SECRET" \
  -e MATCH_SERVER_TOKEN="$MATCH_SERVER_TOKEN" \
  -e YANDEX_CLIENT_ID="$YANDEX_CLIENT_ID" \
  -e YANDEX_CLIENT_SECRET="$YANDEX_CLIENT_SECRET" \
  -e OAUTH_YANDEX_ENABLED=true \
  ghcr.io/komleff/slime-arena-monolith-full:0.7.8

sleep 15
gunzip -c /root/backups/pre-v083-*.sql.gz | docker exec -i slime-arena psql -U slime slime_arena
EOF
```

---

## Часть 5: Инструкция для ИИ-деплоеров (войдёт в AI_AGENT_GUIDE.md)

Ниже — готовый текст секции, которая **заменит** текущий протокол обновления в `docs/operations/AI_AGENT_GUIDE.md`.

---

### ПРОТОКОЛ ОБНОВЛЕНИЯ — Split-архитектура (db + app)

**Архитектура:** Два контейнера, управляемых docker-compose.

```
/root/slime-arena/
├── docker-compose.yml   ← конфигурация (НИКОГДА не удалять)
├── .env                 ← секреты (НИКОГДА не удалять, не выводить)
```

Контейнеры:
- `slime-arena-db` — PostgreSQL 16 + Redis (обновляется РЕДКО)
- `slime-arena-app` — MetaServer + MatchServer + Client + Admin (обновляется ЧАСТО)

---

#### ЗАПРЕТЫ (P0)

```
❌ НИКОГДА: docker volume rm slime-arena-pgdata
❌ НИКОГДА: docker volume rm slime-arena-redisdata
❌ НИКОГДА: docker compose down --volumes
❌ НИКОГДА: docker run -e ... (использовать ТОЛЬКО docker compose)
❌ НИКОГДА: удалять или перезаписывать /root/slime-arena/.env
❌ НИКОГДА: выводить содержимое .env или docker inspect --format='{{json .Config.Env}}'
```

---

#### Обновление app (частое — каждый релиз)

```bash
cd /root/slime-arena
docker compose pull app
docker compose up -d app
```

Если есть новые миграции БД:

```bash
docker exec slime-arena-app npm run db:migrate --workspace=server
```

**Проверка:**

```bash
docker compose ps
curl -s https://slime-arena.overmobile.space/health | jq .
```

**Время простоя:** ~5 секунд. БД, Redis, .env, Nginx — не затрагиваются.

---

#### Обновление db (редкое)

**ОБЯЗАТЕЛЬНО:** Бэкап перед обновлением.

```bash
cd /root/slime-arena
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-update-$(date +%F-%H%M).sql.gz
docker compose pull db
docker compose up -d db
```

---

#### Откат app на предыдущую версию

Если app сломался после обновления:

```bash
cd /root/slime-arena
# Отредактировать docker-compose.yml: image: ghcr.io/komleff/slime-arena-app:<ПРЕДЫДУЩАЯ_ВЕРСИЯ>
docker compose up -d app
```

Или через переменную:

```bash
VERSION=0.8.3 docker compose up -d app
```

---

#### Полная проверка здоровья

```bash
# Статус контейнеров
cd /root/slime-arena && docker compose ps

# API
curl -s https://slime-arena.overmobile.space/health | jq .

# Авторизация
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .

# Лидерборд
curl -s "https://slime-arena.overmobile.space/api/v1/leaderboard?mode=total&limit=5" | jq .

# WebSocket
curl -s -X POST https://slime-arena.overmobile.space/matchmake/joinOrCreate/arena \
  -H "Content-Type: application/json" -d '{}' | jq .
```

---

#### Что НЕ затрагивается при обновлении app

| Компонент | Расположение | Затрагивается? |
|-----------|-------------|----------------|
| PostgreSQL данные | Volume `slime-arena-pgdata` | Нет |
| Redis данные | Volume `slime-arena-redisdata` | Нет |
| Секреты (.env) | `/root/slime-arena/.env` | Нет |
| Nginx | `/etc/nginx/sites-available/` | Нет |
| SSL сертификаты | `/root/.acme.sh/` | Нет |
| docker-compose.yml | `/root/slime-arena/` | Нет |

---

#### Когда просить помощь оператора

| Ситуация | Действие |
|----------|----------|
| Нужно добавить новую env var | Попросить оператора добавить в `.env` |
| db-контейнер не стартует | Показать логи, НЕ удалять volumes |
| Миграция БД провалилась | Остановить app, показать ошибку, ждать оператора |
| Нужно изменить Nginx | Попросить оператора, не трогать самостоятельно |

---

## Обновление документации (после успешного деплоя)

| Файл | Действие |
|------|----------|
| `docs/operations/AI_AGENT_GUIDE.md` | Заменить секции 3-5 (обновление/откат/проверка) на текст из Части 5 выше |
| `docs/operations/SERVER_SETUP.md` | Добавить секцию docker-compose, убрать `docker run` как основной метод |

---

## Контрольные точки

1. Бэкап скачан локально
2. `.env` создан на сервере с `ADMIN_ENCRYPTION_KEY`
3. Оба контейнера `Up` + `healthy`
4. Миграции применены
5. Пользователи восстановлены
6. Health / auth / leaderboard / websocket / admin — работают
7. `AI_AGENT_GUIDE.md` обновлён с новым протоколом
