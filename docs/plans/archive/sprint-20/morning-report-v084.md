## Утренний отчёт: Релиз v0.8.4

### Что сделано

**1. Исправлен CI/CD (PR [#140](https://github.com/komleff/slime-arena/pull/140))**

- CI падал после merge PR #139 — `app.Dockerfile` не копировал `scripts/` в builder stage
- Ошибка: `Cannot find module '/app/scripts/sync-version.js'`
- Фикс: добавлен `COPY scripts/ scripts/` в [app.Dockerfile:37](vscode-webview://1e3nr1lp7hf42qihbucnp9023nii8v5mh2v6ulmm07qo5agi5ivu/docker/app.Dockerfile#L37)

**2. Релиз v0.8.4 (PR [#141](https://github.com/komleff/slime-arena/pull/141))**

- Все версии обновлены до 0.8.4 (14 файлов)
- [AI_AGENT_GUIDE.md](vscode-webview://1e3nr1lp7hf42qihbucnp9023nii8v5mh2v6ulmm07qo5agi5ivu/docs/operations/AI_AGENT_GUIDE.md) — полностью переписан под split-архитектуру:
  - Запреты P0 (никогда не удалять volumes, никогда `docker run`)
  - Протокол обновления app: 3 команды, ~5 секунд простоя
  - Бэкап, откат, диагностика
- [SERVER_SETUP.md](vscode-webview://1e3nr1lp7hf42qihbucnp9023nii8v5mh2v6ulmm07qo5agi5ivu/docs/operations/SERVER_SETUP.md) — добавлена секция split-архитектуры с первоначальной установкой

**3. Docker-образы собраны и опубликованы**

- `ghcr.io/komleff/slime-arena-app:0.8.4` (linux/amd64 + linux/arm64)
- `ghcr.io/komleff/slime-arena-db:0.8.4` (linux/amd64 + linux/arm64)
- Git tag: `v0.8.4`

### Что осталось сделать тебе (оператору)

Полная инструкция в [плане](vscode-webview://1e3nr1lp7hf42qihbucnp9023nii8v5mh2v6ulmm07qo5agi5ivu/docs/plans/magical-knitting-flame.md), краткая версия:

**Шаг 1 — Бэкап текущего сервера:**



```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'mkdir -p /root/backups && docker exec slime-arena pg_dump -U slime slime_arena | gzip > /root/backups/pre-v084-$(date +%F-%H%M).sql.gz && ls -lh /root/backups/'
```

**Шаг 2 — Подготовить сервер:**



```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 'mkdir -p /root/slime-arena /root/backups'
scp -i ~/.ssh/id_ed25519 docker/docker-compose.app-db.yml root@147.45.147.175:/root/slime-arena/docker-compose.yml
```

**Шаг 3 — Создать `.env` на сервере** (`/root/slime-arena/.env`):

- Перенести секреты из `/root/.env.production`
- Добавить `ADMIN_ENCRYPTION_KEY` (обязательно): `openssl rand -base64 32`
- Шаблон: см. [SERVER_SETUP.md, секция 2](vscode-webview://1e3nr1lp7hf42qihbucnp9023nii8v5mh2v6ulmm07qo5agi5ivu/docs/operations/SERVER_SETUP.md#L67-L89)

**Шаг 4 — Остановить монолит и запустить split:**



```bash
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 << 'EOF'
docker stop slime-arena && docker rm slime-arena
docker volume rm slime-arena-pgdata slime-arena-redisdata
cd /root/slime-arena
docker compose pull
docker compose up -d db
sleep 20
docker compose up -d app
sleep 10
docker exec slime-arena-app npm run db:migrate --workspace=server
EOF
```

**Шаг 5 — Восстановить пользователей:**



```bash
scp -i ~/.ssh/id_ed25519 ./backups/pre-v084-*.sql.gz root@147.45.147.175:/root/backups/
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 \
  'gunzip -c /root/backups/pre-v084-*.sql.gz | docker exec -i slime-arena-db psql -U slime slime_arena'
```

**Шаг 6 — Проверить:**



```bash
curl -s https://slime-arena.overmobile.space/health | jq .
```

### Главное преимущество

После первоначальной установки обновление app — **3 команды без потери данных:**



```bash
cd /root/slime-arena
docker compose pull app
docker compose up -d app
```