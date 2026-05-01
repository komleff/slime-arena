# Beads-задачи (драфты) по результатам диагностики 2026-05-01

> Не получилось завести через `bd create`: Dolt-сервер на порту 58363 запущен, но не находит БД `beads` (`Error 1049: database not found: beads`). Beads был сломан ещё до старта сессии (`.beads/dolt-server.lock` присутствовал в untracked при старте). Драфты ниже готовы к копированию в `bd create` после починки Beads (`bd doctor --fix`, либо ручное восстановление БД из Dolt-remote).

---

## 1. [P1 / bug] Cron-бэкап PostgreSQL не настроен на prod (последний бэкап 2026-04-23)

```
bd create --title="Cron-бэкап PostgreSQL не настроен на prod (последний бэкап 2026-04-23)" \
  --type=bug --priority=1
```

**Местоположение:**

- VPS prod 147.45.147.175 (slime-arena.overmobile.space)
- crontab root, `/etc/cron.d/` — нет ни одной записи про pg_dump
- `docs/operations/SERVER_SETUP.md:411` (рекомендованная cron-строка)

**Требование из документации:**

SERVER_SETUP.md шаг 7:

```cron
0 */6 * * * docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/slime-arena-$(date +%F-%H%M).sql.gz && find /root/backups/ -name "slime-arena-*.sql.gz" -mtime +7 -delete
```

**Проблема:**

Диагностика 2026-05-01 (slime-ro@prod): за 8 недель (2026-03-06 → 2026-05-01) журнал cron не содержит ни одного запуска `pg_dump` / `docker exec slime-arena-db`. Распределение CMD за период:

- 325 × `run-parts /etc/cron.hourly`
- 14 × `run-parts /etc/cron.daily`
- 14 × `acme.sh --cron` (из user crontab root — значит crontab жив)
- 12 × `e2scrub_all`
- **0 × pg_dump / docker exec / backup**

User crontab у root существует и работает (acme.sh запускается), но строка с pg_dump отсутствует. Бэкап от 2026-04-23, на который ссылается оператор, был сделан вручную.

**Последствия:**

- Игровые данные с 2026-04-23 (9+ дней) не покрыты бэкапом: новые матчи, OAuth-привязки, профили, leaderboard
- При краше/коррупции БД восстановление невозможно
- Soft Launch требование RPO ≤ 6h не выполняется

**Решение:**

1. На prod (через root в web-console — slime-ro этого не может) восстановить cron-строку. Предпочтительно вынести в `/etc/cron.d/slime-arena-backup` (прозрачнее чем user crontab — видно в репо ops-конфигов).
2. Проверить что `/root/backups/` существует и writable: `ls -ld /root/backups/`.
3. Подтвердить через 6 часов: `ls -lah /root/backups/ | tail -3` показывает свежий файл, в `journalctl -u cron --since '6 hours ago'` есть строка `(root) CMD (docker exec ...)`.
4. Smoke-восстановление: восстановить копию БД в отдельный контейнер, убедиться что pg_dump корректный.

**Связано:** `docs/operations/SERVER_SETUP.md` (Шаг 7), `/root/backups/` на prod, crontab root / `/etc/cron.d/`

---

## 2. [P2 / bug] Watchdog mort: systemd-юнит slime-arena-watchdog не запущен на prod

```
bd create --title="Watchdog mort: systemd-юнит slime-arena-watchdog не запущен на prod" \
  --type=bug --priority=2
```

**Местоположение:**

- VPS prod 147.45.147.175
- `/opt/slime-arena/ops/watchdog/watchdog.py`
- `/etc/systemd/system/slime-arena-watchdog.service`
- `ops/watchdog/` (репо)

**Требование из документации:**

SERVER_SETUP.md Шаг 6: watchdog обеспечивает auto-restart по health-check, обработку рестартов из Admin Dashboard и Telegram-алерты.

**Проблема:**

Диагностика 2026-05-01 (slime-ro@prod): `journalctl _SYSTEMD_UNIT=slime-arena-watchdog.service` — `-- No entries --` за всё доступное время. Имя юнита всплывает в systemd-кэшах (значит .service файл когда-то существовал), но `enable`/`start` не делался — или был отключён.

**Последствия:**

- Auto-restart по health-check НЕ работает — если контейнер деградирует, никто не подхватит
- Кнопка «Перезапустить сервер» в Admin Dashboard пишет в `/shared/restart-requested`, но никто не читает → рестарт не происходит
- Telegram-алерты по health НЕ приходят
- При инциденте деградации сервиса оператор узнает только из жалоб игроков

**Решение:**

1. На prod (через root в web-console) проверить:
   - `ls -la /etc/systemd/system/slime-arena-watchdog.service`
   - `ls -la /opt/slime-arena/ops/watchdog/`
   - `systemctl status slime-arena-watchdog`
2. Если файл .service отсутствует — выполнить Шаг 6 из SERVER_SETUP.md.
3. Если есть — `systemctl daemon-reload && systemctl enable --now slime-arena-watchdog`.
4. Подтвердить: `journalctl -u slime-arena-watchdog --since '5 min ago'` содержит строки запуска.
5. Smoke-test: остановить контейнер app (`docker stop slime-arena-app`), убедиться что watchdog поднимает обратно через ≤ COOLDOWN_AFTER_RESTART.

**Связано:** `docs/operations/SERVER_SETUP.md` (Шаг 6), `ops/watchdog/`, admin-dashboard (через outbox `/shared/restart-requested`)

---

## 3. [P3 / chore] DB-контейнер: FD soft limit 1024 → поднять до 65536

```
bd create --title="DB-контейнер: FD soft limit 1024 → поднять до 65536" \
  --type=chore --priority=3
```

**Местоположение:**

- `docker/docker-compose.app-db.yml` (секция `services.db`, нет `ulimits`)
- `/proc/<db-pid>/limits` на prod показывает: `Max open files soft=1024 hard=524288`

**Проблема:**

Контейнер `slime-arena-db` (PostgreSQL + Redis под supervisord) запущен с дефолтным soft limit 1024 на open files. Hard limit щедрый (524288), но soft ограничивает реальное число FD. При росте числа подключений (OAuth burst, конкурентные матчи) + WAL-файлы Postgres + Redis open files можно упереться в лимит — отказ обслуживания новых соединений.

**Последствия (потенциальные):**

- При попадании в лимит: `too many open files` в Postgres, `Cannot accept connection` в Redis
- Health-check 503 → nginx 502 → пользователи не могут залогиниться (см. инцидент Redis MISCONF 2026-02-08)

**Сейчас не критично:** на текущей нагрузке Soft Launch FD usage низкий, инцидента нет.

**Решение:**

1. В `docker/docker-compose.app-db.yml` добавить для сервиса db:

   ```yaml
   db:
     ulimits:
       nofile:
         soft: 65536
         hard: 65536
   ```

2. Применить на prod: `docker compose up -d db` (приведёт к рестарту db-контейнера, ~30 сек downtime).
3. Подтвердить: `cat /proc/<new-pid>/limits | grep -i 'open files'` показывает `65536 / 65536`.
4. Аналогично для app-контейнера проверить (там soft=524288, ОК — не трогать).

**Связано:** `docker/docker-compose.app-db.yml`, `docker/db.Dockerfile` (если ulimit задаётся в supervisord)

---

## 4. [P3 / chore] VPS prod: swap=0 на 4 GB RAM, добавить 2 GB swap-файл

```
bd create --title="VPS prod: swap=0 на 4 GB RAM, добавить 2 GB swap-файл" \
  --type=chore --priority=3
```

**Местоположение:**

- VPS prod 147.45.147.175 (Timeweb)
- `/etc/fstab`, `/swapfile` (создать)

**Проблема:**

Диагностика 2026-05-01: `free -h` показал `Swap: 0B 0B 0B` на машине с 3.8 GiB total RAM. У ядра нет резерва на временные всплески аллокации.

**Последствия (потенциальные):**

- При всплеске памяти (миграция БД с большим dataset, OAuth burst, parallel matches, npm install в контейнере, malloc-fragmentation) OOM Killer убьёт процесс — скорее всего slime-arena-app (самый «жирный»: 154 MiB сейчас, но потенциал роста).
- Нет признаков OOM сейчас (RestartCount=0, OOMKilled=false 2 месяца), но защиты нет.

**Решение:**

1. Создать swap-файл 2 GB:

   ```bash
   fallocate -l 2G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   ```

2. Persistent через `/etc/fstab`: `echo '/swapfile none swap sw 0 0' >> /etc/fstab`
3. Подкрутить swappiness=10 (серверная нагрузка, swap только при необходимости):

   ```bash
   echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
   sysctl --system
   ```

4. Проверить: `free -h` показывает `Swap: 2.0Gi 0 2.0Gi`, `cat /proc/sys/vm/swappiness` = 10.

**Связано:** `docs/operations/SERVER_SETUP.md` (предусловия, добавить в шаг 1)

---

## 5. [P3 / task] Расследовать жалобу на тормоза игры — backend в норме, причина на клиенте/сети

```
bd create --title="Расследовать жалобу на тормоза игры — backend в норме, причина на клиенте/сети" \
  --type=task --priority=3
```

**Местоположение:**

- `client/src/main.ts` (~4000 строк)
- `server/src/rooms/ArenaRoom.ts` (state schema)
- WebSocket Colyseus (`ws://slime-arena.overmobile.space`)

**Контекст:**

Оператор сообщил 2026-05-01: «тормозит игра». Диагностика prod-сервера показала, что backend в норме:

- CPU app 0%, db 1.7%
- MEM app 154 MiB / 3.82 GiB (3.95%), db 56 MiB
- MATCH tick: dt_avg=0.03ms, dt_max=1.0ms (бюджет 33ms на 30Hz — занято 0.1%)
- HTTP /health: 1-10ms
- RestartCount: 0 за 2 месяца, OOMKilled: false
- Disk 14% used, RAM 3.0Gi available

**Подозрительные сигналы (из app-логов):**

- `POST /oauth/prepare-upgrade` 409 за **681 ms** — медленный, но это error-path при конфликте Yandex-аккаунта, не ходовой сценарий

**Гипотезы (от вероятной к менее):**

1. Сеть пользователя: ping до Москвы 218 ms из локального ping — на 3G/4G у мобильного игрока ещё больше latency и jitter
2. WebSocket payload size: если state-update сообщение Colyseus > 5 KB — на 3G критично
3. Клиентский рендер: Canvas 2D на слабом мобильном устройстве (плотность игроков, число orbs/chests)
4. Asset preloading: при первой загрузке доставка sprites/HUD-иконок забивает канал

**Решение (что нужно собрать от оператора или симптоматичного игрока):**

1. **DevTools Network tab** на момент тормозов: latency запросов, размер WS-сообщений (frames panel), 304 vs 200 на assets
2. **DevTools Performance tab**: FPS, long tasks, JS heap, GC pauses
3. **Конкретный сценарий**: в каком экране/моменте тормозит (логин, главное меню, матч, OAuth)
4. **Параметры устройства**: ОС, браузер, тип сети (Wi-Fi/3G/4G), регион
5. Воспроизвести через Chrome DevTools network throttling (Slow 3G) — повторяемо ли

После сбора — определить root cause:

- Если payload > 5 KB → оптимизировать state-update в `shared/src/types.ts`
- Если client render — профилирование Canvas 2D, snapshot перерисовок
- Если сеть/география — Cloudflare/CDN frontend, или подсказка игрокам про ускоренное VPN

**Связано:** `client/src/main.ts`, `client/src/services/wsClient.ts` (Colyseus integration), `server/src/rooms/schema/GameState.ts`, `shared/src/types.ts`

---

## Сводка

| # | Приоритет | Тип | Задача |
|---|-----------|-----|--------|
| 1 | **P1** | bug | Cron-бэкап PostgreSQL не настроен (RPO ≤ 6h не выполняется) |
| 2 | **P2** | bug | Watchdog не запущен (auto-restart + admin-кнопка не работают) |
| 3 | P3 | chore | DB FD soft 1024 → 65536 |
| 4 | P3 | chore | swap 0 → 2 GB |
| 5 | P3 | task | Расследовать тормоза на клиенте (backend в норме) |
