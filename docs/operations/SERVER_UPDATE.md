# Slime Arena — Обновление сервера

Процедуры обновления действующего production-сервера.

**Версия:** v0.8.5
**Обновлено:** 2026-02-07
**Установка с нуля:** [SERVER_SETUP.md](SERVER_SETUP.md)

---

## Содержание

1. [Обновление app (повседневное)](#обновление-app-повседневное)
2. [Обновление db (редкое)](#обновление-db-редкое)
3. [Обновление docker-compose.yml](#обновление-docker-composeyml)
4. [Обновление Nginx](#обновление-nginx)
5. [Откат (Rollback)](#откат-rollback)
6. [Полезные команды](#полезные-команды)
7. [Troubleshooting](#troubleshooting)

---

## Переменные

```bash
SSH="ssh -i ~/.ssh/deploy_key root@147.45.147.175"
```

---

## Обновление app (повседневное)

Обновляется только app-контейнер. БД, Redis, Nginx, SSL, Watchdog — **не затрагиваются**.

**Даунтайм:** ~5-10 секунд.

```bash
# 1. Бэкап БД (P0 — обязательно перед любым обновлением)
$SSH 'mkdir -p /root/backups && docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-update-$(date +%F-%H%M).sql.gz && ls -lh /root/backups/ | tail -3'

# 2. Pull + restart
$SSH << 'EOF'
cd /root/slime-arena
docker compose pull app
docker compose up -d app
EOF

# 3. Миграции (если есть новые)
$SSH 'docker exec slime-arena-app npm run db:migrate --workspace=server'

# 4. Проверка
$SSH 'cd /root/slime-arena && docker compose ps'
curl -s https://slime-arena.overmobile.space/health | jq .
curl -s -o /dev/null -w "%{http_code}" https://slime-arena.overmobile.space/admin/
```

### Что НЕ затрагивается

| Компонент | Расположение | Затрагивается? |
| --------- | ------------ | -------------- |
| PostgreSQL данные | Volume `slime-arena-pgdata` | Нет |
| Redis данные | Volume `slime-arena-redisdata` | Нет |
| Секреты (.env) | `/root/slime-arena/.env` | Нет |
| docker-compose.yml | `/root/slime-arena/` | Нет |
| Nginx | `/etc/nginx/sites-available/` | Нет |
| SSL сертификаты | `/root/.acme.sh/` | Нет |
| Watchdog | `/opt/slime-arena/ops/watchdog/` | Нет |

### Checklist

- [ ] Бэкап БД создан
- [ ] `docker compose pull app`
- [ ] `docker compose up -d app`
- [ ] Миграции применены (если есть новые)
- [ ] `/health` → 200 OK
- [ ] `/admin/` → 200

---

## Обновление db (редкое)

**ОБЯЗАТЕЛЬНО:** Бэкап перед обновлением.

```bash
$SSH << 'EOF'
cd /root/slime-arena
docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-db-update-$(date +%F-%H%M).sql.gz
docker compose pull db
docker compose up -d db
EOF
```

---

## Обновление docker-compose.yml

Если изменился compose-файл (новые volumes, переменные, порты):

```bash
# Скопировать
scp -i ~/.ssh/deploy_key docker/docker-compose.app-db.yml root@147.45.147.175:/root/slime-arena/docker-compose.yml

# ВАЖНО: после копирования проверить/добавить кастомные изменения:
# - shared volume (если ещё не в образе)
# - любые дополнительные настройки

# Перезапуск
$SSH 'cd /root/slime-arena && docker compose up -d'
```

---

## Обновление Nginx

> **Внимание:** Nginx-конфиг содержит `$`-переменные (`$host`, `$remote_addr`). При передаче через SSH **нельзя** использовать `sed`, `echo`, или heredoc без кавычек — `$` будут заменены пустыми строками.

**Рекомендуемый способ — Python-скрипт на сервере:**

```bash
$SSH << 'REMOTEOF'
python3 << 'PYEOF'
import pathlib

config = r'''
server {
    listen 80;
    ... полный конфиг из SERVER_SETUP.md ...
}
'''

path = pathlib.Path('/etc/nginx/sites-available/slime-arena.overmobile.space')
# Бэкап
backup = path.with_suffix('.bak')
if path.exists():
    backup.write_text(path.read_text())
    print(f'Backup: {backup}')

path.write_text(config.strip() + '\n')
print(f'Written {len(config)} bytes to {path}')
PYEOF
nginx -t && systemctl reload nginx
REMOTEOF
```

**Проверка после обновления:**

```bash
$SSH 'nginx -t'
curl -s -o /dev/null -w "%{http_code}" https://slime-arena.overmobile.space/admin/
```

---

## Обновление Watchdog

```bash
# Скопировать новую версию
scp -i ~/.ssh/deploy_key ops/watchdog/watchdog.py root@147.45.147.175:/opt/slime-arena/ops/watchdog/

# Перезапустить
$SSH 'systemctl restart slime-arena-watchdog && systemctl status slime-arena-watchdog --no-pager'
```

---

## Откат (Rollback)

### Откат app на предыдущую версию

```bash
$SSH << 'EOF'
cd /root/slime-arena
VERSION=0.8.4 docker compose pull app
VERSION=0.8.4 docker compose up -d app
EOF
```

### Откат БД из бэкапа

```bash
$SSH << 'EOF'
cd /root/slime-arena
docker compose stop app
gunzip -c /root/backups/pre-update-<ДАТА>.sql.gz | docker exec -i slime-arena-db psql -U slime -d slime_arena
docker compose start app
EOF
```

### Полный откат к монолиту v0.7.8 (крайний случай)

```bash
$SSH << 'EOF'
cd /root/slime-arena
docker compose down
docker run -d --name slime-arena \
  --env-file /root/.env.production \
  -p 3000:3000 -p 2567:2567 -p 5173:5173 \
  ghcr.io/komleff/slime-arena-monolith-full:0.7.8
EOF
```

---

## Полезные команды

### Контейнеры

```bash
$SSH 'cd /root/slime-arena && docker compose ps'
$SSH 'docker logs --tail 100 slime-arena-app'
$SSH 'docker logs --tail 100 slime-arena-db'
$SSH 'docker logs -f slime-arena-app --tail 50'
$SSH 'cd /root/slime-arena && docker compose restart app'
```

### PostgreSQL

```bash
$SSH 'docker exec -it slime-arena-db psql -U slime -d slime_arena'
$SSH 'docker exec slime-arena-db psql -U slime -d slime_arena -c "SELECT COUNT(*) FROM users;"'
$SSH 'docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/backup-$(date +%F-%H%M).sql.gz'
```

### Redis

```bash
$SSH 'docker exec slime-arena-db redis-cli ping'
$SSH 'docker exec slime-arena-db redis-cli info memory'
```

### Health Checks

```bash
curl -s https://slime-arena.overmobile.space/health | jq .
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .
curl -s "https://slime-arena.overmobile.space/api/v1/leaderboard?mode=total&limit=5" | jq .
curl -s -o /dev/null -w "%{http_code}" https://slime-arena.overmobile.space/admin/
```

### Watchdog

```bash
$SSH 'systemctl status slime-arena-watchdog'
$SSH 'journalctl -u slime-arena-watchdog -f'
$SSH 'systemctl restart slime-arena-watchdog'
```

### Nginx

```bash
$SSH 'nginx -t'
$SSH 'systemctl reload nginx'
$SSH 'tail -20 /var/log/nginx/slime-arena.error.log'
```

---

## Troubleshooting

### Контейнер не поднимается

```bash
$SSH << 'EOF'
cd /root/slime-arena
docker compose ps -a
docker logs slime-arena-app 2>&1 | tail -50
docker inspect slime-arena-db --format="{{.State.Health.Status}}"
EOF
```

### Память или диск переполнен

```bash
$SSH 'df -h && free -h && du -sh /var/lib/docker/volumes/*/'
```

### Миграция не применяется

```bash
$SSH 'docker exec slime-arena-app npm run db:migrate --workspace=server 2>&1'
```

Если миграция падает — остановить app, показать ошибку оператору. **Не удалять** volumes.

---

## Ссылки

| Документ | Описание |
| -------- | -------- |
| [SERVER_SETUP.md](SERVER_SETUP.md) | Установка с нуля |
| [AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md) | Гайд для ИИ-агентов |
| [backup-restore.md](backup-restore.md) | Бэкап и восстановление |
