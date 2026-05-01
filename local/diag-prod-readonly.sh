#!/bin/bash
# Read-only диагностика production-сервера slime-arena.
# Запускается под пользователем slime-ro по SSH (или локально).
# Все привилегированные команды идут через sudo (ограничен sudoers-allowlist на чтение).

set -u
OUT="/tmp/slime-diag-$(date -u +%Y%m%dT%H%M%SZ).txt"
exec > >(tee "$OUT") 2>&1

section() { echo; echo "===== $* ====="; }

section "Дата (UTC) и хост"
date -u
hostname
uname -a

section "uptime / load"
uptime

section "df -h"
sudo df -h

section "df -i (inodes)"
sudo df -i

section "free -h"
sudo free -h

section "docker ps -a"
sudo docker ps -a

section "docker stats (snapshot)"
sudo docker stats --no-stream

section "docker compose ps"
sudo docker compose ps 2>/dev/null || true

section "docker inspect health"
sudo docker inspect slime-arena-app --format='app: {{.State.Health.Status}} (started {{.State.StartedAt}}, restartCount={{.RestartCount}})' 2>/dev/null
sudo docker inspect slime-arena-db  --format='db:  {{.State.Health.Status}} (started {{.State.StartedAt}}, restartCount={{.RestartCount}})' 2>/dev/null

section "FD контейнеров (через /proc, без docker exec)"
for c in slime-arena-app slime-arena-db; do
  pid=$(sudo docker inspect -f '{{.State.Pid}}' "$c" 2>/dev/null)
  if [ -n "${pid:-}" ] && [ "$pid" != "0" ]; then
    soft=$(sudo cat "/proc/$pid/limits" 2>/dev/null | awk '/^Max open files/ {print $4}')
    hard=$(sudo cat "/proc/$pid/limits" 2>/dev/null | awk '/^Max open files/ {print $5}')
    echo "$c (pid=$pid) limits: soft=$soft hard=$hard"
  fi
done

section "journalctl: cron за 7 дней (последние 60 строк)"
sudo journalctl -u cron --since '7 days ago' --no-pager 2>/dev/null | tail -60
sudo journalctl -u crond --since '7 days ago' --no-pager 2>/dev/null | tail -60

section "journalctl: watchdog за 7 дней (последние 80 строк)"
sudo journalctl -u slime-arena-watchdog --since '7 days ago' --no-pager 2>/dev/null | tail -80

section "journalctl: kernel/system errors за 24h (фильтр priority<=warn)"
sudo journalctl --priority=warning --since '24 hours ago' --no-pager 2>/dev/null | tail -80

section "Логи app (последние 200 строк)"
sudo docker logs --tail 200 slime-arena-app 2>&1 | tail -200

section "Логи db (последние 100 строк)"
sudo docker logs --tail 100 slime-arena-db 2>&1 | tail -100

echo
echo "===== ГОТОВО ====="
echo "Файл: $OUT ($(wc -l < "$OUT") строк, $(du -h "$OUT" | cut -f1))"
