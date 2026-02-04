# Sprint 19: Admin Dashboard Phase 2

**Версия:** 1.0
**Дата:** 2026-02-05
**PM:** Claude Opus 4.5
**Ветка:** `sprint-19/admin-dashboard-phase2`

---

## Цель спринта

Завершить Admin Dashboard (Phase 2): метрики сервера, список комнат, аудит-лог, рестарт через watchdog. Рефакторинг React → Preact.

---

## Исходное состояние

| Параметр | Значение |
|----------|----------|
| Production | v0.7.8 |
| Локальный тест | v0.8.0 (Phase 1) |
| GDD | v3.3.2 |
| TZ | TZ-MON-v1.6 |

### Phase 1 (v0.8.0) — что уже работает

- ✅ Admin auth (JWT + refresh cookies)
- ✅ 2FA TOTP (AES-256-GCM)
- ✅ Audit log service
- ✅ Rate limiting
- ⚠️ Frontend на React (требуется Preact)
- ⚠️ Метрики CPU/RAM — placeholder
- ⚠️ Список комнат — placeholder
- ⚠️ Рестарт — не реализован

### Выявленные проблемы Phase 1

| Проблема | Приоритет | Решение |
|----------|-----------|---------|
| audit_log schema (actor_user_id vs user_id) | P2 | Добавить миграцию |
| Миграция 009 не в образе 0.8.0 | P2 | Включить в Sprint 19 |
| Admin frontend на React | P2 | Рефакторинг → Preact |

---

## Beads-задачи (bd ready)

| ID | Приоритет | Тип | Название |
|----|-----------|-----|----------|
| `slime-arena-mon1` | P2 | bug | React → Preact рефакторинг |
| `slime-arena-mon2` | P2 | feature | Server Metrics (CPU/RAM) |
| `slime-arena-mon3` | P2 | feature | Active Rooms List |
| `slime-arena-mon4` | P2 | feature | Audit Log UI |

---

## План работ

### Фаза 0: Подготовка (Day 1, утро)

**PM (человек или агент):**

1. Создать ветку:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b sprint-19/admin-dashboard-phase2
   git push -u origin sprint-19/admin-dashboard-phase2
   ```

2. Обновить версию:
   ```bash
   echo '{"version": "0.9.0"}' > version.json
   npm run sync-version
   ```

3. Взять задачи в работу:
   ```bash
   bd update slime-arena-mon1 --status=in_progress
   ```

---

### Фаза 1: React → Preact рефакторинг (Day 1-2)

**Задача:** `slime-arena-mon1`
**Coder:** Frontend

**Критические файлы:**
- `admin-dashboard/package.json` — заменить react → preact
- `admin-dashboard/vite.config.ts` — alias preact/compat
- `admin-dashboard/src/**/*.tsx` — импорты

**Шаги:**

1. Обновить зависимости:
   ```json
   {
     "preact": "^10.x",
     "@preact/signals": "^1.x"
   }
   ```
   Удалить: `react`, `react-dom`, `@types/react`

2. Добавить alias в vite.config.ts:
   ```typescript
   resolve: {
     alias: {
       'react': 'preact/compat',
       'react-dom': 'preact/compat'
     }
   }
   ```

3. Заменить useState/useEffect на signals (где целесообразно)

4. Проверить сборку: `npm run build`

**Критерии приёмки:**
- [ ] Сборка проходит без ошибок
- [ ] Login работает
- [ ] Settings (2FA) работает
- [ ] Bundle size ≤ 80 kB gzip

---

### Фаза 2: Backend — мониторинг endpoints (Day 2-3)

**Задачи:** `slime-arena-mon2`, `slime-arena-mon3`
**Coder:** Backend

**Критические файлы:**
- `server/src/meta/routes/admin.ts` — новые endpoints
- `server/src/meta/services/systemMetrics.ts` — СОЗДАТЬ
- `server/src/meta/services/logBuffer.ts` — СОЗДАТЬ
- `server/src/rooms/ArenaRoom.ts` — tick latency буфер

**API endpoints (из TZ-MON-v1.6-Core):**

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/admin/health/detailed` | GET | Детальный статус |
| `/api/v1/admin/stats` | GET | CPU, RAM, rooms, players, tick |
| `/api/v1/admin/rooms` | GET | Список комнат |
| `/api/v1/admin/logs` | GET | Логи (маскированные) |

**Шаги:**

1. **systemMetrics.ts** — CPU/RAM из `/proc/`, `/sys/fs/cgroup/`:
   - `getCpuUsage()` → number (0-100)
   - `getRamUsage()` → { used, total, percent }

2. **logBuffer.ts** — кольцевой буфер 1000 записей:
   - Перехват console.log/warn/error
   - Маскирование по паттернам (Authorization, JWT, password, secret)

3. **ArenaRoom.ts** — буфер tick latency:
   - Кольцевой буфер 1800 значений (60 сек × 30 FPS)
   - Методы: `getAvgTickMs()`, `getMaxTickMs()`

4. **admin.ts** — реализовать endpoints

**Критерии приёмки (из TZ-MON-v1.6-Backend):**
- [ ] ACC-MON-009: Dashboard показывает CPU, RAM, Rooms, Players
- [ ] ACC-MON-017: Логи не содержат JWT/пароли

---

### Фаза 3: Frontend — Dashboard, Rooms, Audit (Day 3-4)

**Задачи:** `slime-arena-mon2`, `slime-arena-mon3`, `slime-arena-mon4`
**Coder:** Frontend

**Критические файлы:**
- `admin-dashboard/src/pages/DashboardPage.tsx` — метрики
- `admin-dashboard/src/pages/RoomsPage.tsx` — список комнат
- `admin-dashboard/src/pages/AuditPage.tsx` — аудит-лог
- `admin-dashboard/src/components/StatusCard.tsx`
- `admin-dashboard/src/components/MetricCard.tsx`
- `admin-dashboard/src/components/RoomCard.tsx`

**UI требования (из TZ-MON-v1.6-Frontend):**

| Экран | Компоненты |
|-------|------------|
| Dashboard | StatusCard, MetricCard × 5 (CPU, RAM, Rooms, Players, Tick) |
| Rooms | RoomCard[] (название, игроки, фаза, tick) |
| Audit | AuditEntry[] с пагинацией |

**Цвета статусов:**
- Online: #22C55E
- Degraded: #F59E0B
- Offline: #EF4444
- Unknown: #6B7280

**Шаги:**

1. DashboardPage:
   - Polling `/health/detailed` + `/stats` каждые 5 сек
   - StatusCard с цветом по статусу
   - MetricCard для каждой метрики

2. RoomsPage:
   - Polling `/rooms` каждые 5 сек
   - RoomCard: roomId, players/maxPlayers, phase, tick

3. AuditPage:
   - GET `/audit?limit=50&offset=N`
   - Пагинация (Load more)

**Критерии приёмки:**
- [ ] ACC-MON-010: Статус корректен по правилам
- [ ] ACC-MON-015: Mobile layout (320px) — всё видимо

---

### Фаза 4: Ops — Watchdog + Restart (Day 4-5)

**Coder:** Backend/Ops

**Критические файлы:**
- `server/src/meta/routes/admin.ts` — POST /restart
- `ops/watchdog/watchdog.py` — СОЗДАТЬ (Python для надёжности)
- `ops/watchdog/.env.example` — СОЗДАТЬ
- `ops/watchdog/slime-arena-watchdog.service` — СОЗДАТЬ
- `docker-compose.yml` — bind mount /shared/

**Backend — POST /restart:**

1. Проверить 2FA (X-2FA-Code header)
2. Проверить `/shared/restart-requested` И `/shared/restart-processing` не существуют → 409 если есть
3. Записать audit log
4. Атомарно создать outbox-файл (O_EXCL → tmp → rename)
5. Вернуть 202 Accepted

**Watchdog (systemd на хосте) — ПОЛНЫЙ FLOW С RENAME:**

```
Файлы в /opt/slime-arena/shared/:
┌─────────────────────────────────────────────────────────────┐
│ restart-requested   → создаёт MetaServer                    │
│ restart-processing  → rename из restart-requested           │
│ restart-result      → результат выполнения                  │
│ .watchdog-state     → lastAuditId для идемпотентности       │
└─────────────────────────────────────────────────────────────┘
```

**1. При старте watchdog (recovery):**
```python
if exists("restart-processing"):
    # Watchdog упал во время restart — довыполнить
    audit_id = read_json("restart-processing")["auditId"]
    docker_restart()
    write_result(audit_id, "ok")
    delete("restart-processing")
    save_state(audit_id)
```

**2. Outbox-приёмник (каждые 5 сек):**
```python
if exists("restart-requested"):
    data = read_json("restart-requested")
    audit_id = data["auditId"]

    # Идемпотентность
    if audit_id == load_state().get("lastAuditId"):
        delete("restart-requested")
        return

    # Атомарный переход в processing
    rename("restart-requested", "restart-processing")

    # Выполнить restart
    docker_restart()

    # Записать результат
    write_result(audit_id, "ok")
    delete("restart-processing")
    save_state(audit_id)
```

**3. Health monitor (каждые 30 сек):**
- GET http://127.0.0.1:3000/health
- 3 fail → авто-restart + Telegram
- После авто-restart: записать в `.watchdog-state` (без auditId)

**Frontend — RestartDialog:**

1. Modal с TOTP input
2. POST /restart с X-2FA-Code
3. 202 → режим ожидания (polling /health)
4. 409 → "Перезапуск уже выполняется"

**Критерии приёмки:**

- [ ] ACC-MON-011: Restart без TOTP → 403
- [ ] ACC-MON-012: Restart с TOTP → 202, audit, outbox
- [ ] ACC-MON-012a: Повторный restart (файл существует) → 409
- [ ] ACC-MON-012b: Restart во время processing → 409
- [ ] ACC-MON-013: Сервер восстанавливается ≤60 сек
- [ ] ACC-MON-016: 3 health fail → авто-restart + Telegram
- [ ] ACC-OPS-004: Идемпотентность (тот же auditId → пропуск)
- [ ] ACC-OPS-005: Recovery (restart-processing при старте → довыполнить)

---

### Фаза 5: Интеграция + Review (Day 5-6)

1. **Интеграционное тестирование:**
   - Login → Dashboard → метрики обновляются
   - Rooms → список актуален
   - Audit → действия логируются
   - Restart → outbox → watchdog → recovery

2. **Mobile тестирование:**
   - Chrome DevTools (320px, 480px)
   - Реальное устройство

3. **PR + Review:**
   ```bash
   gh pr create --base=main --title="Sprint 19: Admin Dashboard Phase 2"
   ```

4. **Запуск ревью-агентов:**
   - Security Agent
   - Code Quality Agent
   - Architecture Agent

---

## Файлы к изменению/созданию

| Файл | Действие | Фаза |
|------|----------|------|
| `admin-dashboard/package.json` | ИЗМЕНИТЬ | 1 |
| `admin-dashboard/vite.config.ts` | ИЗМЕНИТЬ | 1 |
| `admin-dashboard/src/**/*.tsx` | ИЗМЕНИТЬ | 1 |
| `server/src/meta/services/systemMetrics.ts` | СОЗДАТЬ | 2 |
| `server/src/meta/services/logBuffer.ts` | СОЗДАТЬ | 2 |
| `server/src/meta/routes/admin.ts` | ИЗМЕНИТЬ | 2, 4 |
| `server/src/rooms/ArenaRoom.ts` | ИЗМЕНИТЬ | 2 |
| `admin-dashboard/src/pages/DashboardPage.tsx` | ИЗМЕНИТЬ | 3 |
| `admin-dashboard/src/pages/RoomsPage.tsx` | ИЗМЕНИТЬ | 3 |
| `admin-dashboard/src/pages/AuditPage.tsx` | ИЗМЕНИТЬ | 3 |
| `ops/watchdog/watchdog.sh` | СОЗДАТЬ | 4 |
| `ops/watchdog/.env.example` | СОЗДАТЬ | 4 |
| `ops/watchdog/slime-arena-watchdog.service` | СОЗДАТЬ | 4 |
| `docker-compose.yml` | ИЗМЕНИТЬ | 4 |

---

## Верификация

### Локальное тестирование

```bash
# 1. Сборка
npm run build

# 2. Тесты
npm run test

# 3. Dev-сервер
npm run dev:server  # терминал 1
npm run dev:client  # терминал 2

# 4. Проверка админки
# http://localhost:5174/admin/
# Login → Dashboard → Rooms → Audit → Settings
```

### Production deploy (после merge)

```bash
# 1. Миграции
docker exec slime-arena npx prisma migrate deploy

# 2. Обновить образ
docker pull ghcr.io/komleff/slime-arena-monolith-full:0.9.0
docker stop slime-arena && docker rm slime-arena
# docker run ... (с bind mount /shared/)

# 3. Watchdog
sudo cp ops/watchdog/slime-arena-watchdog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now slime-arena-watchdog

# 4. Nginx
sudo cp ops/nginx/admin.conf /etc/nginx/sites-available/
sudo nginx -t && sudo nginx -s reload
```

---

## Tech Debt — решаем в Sprint 19

| ID | Статус | Описание |
|----|--------|----------|
| DEBT-MON-001 | ✅ Включён | Атомарность outbox через rename |
| DEBT-MON-003 | ✅ Включён | State persistence (.watchdog-state) |
| DEBT-MON-002 | ⏳ Phase 2 | WS token в cookie (WebSocket не в этом спринте) |

---

## Риски

| Риск | Митигация |
|------|-----------|
| Preact несовместимость | Использовать preact/compat |
| CPU/RAM недоступны в cgroup | Fallback на /proc/stat |
| Watchdog не стартует | systemd restart=always |
| Telegram rate limit | Кеширование оповещений |
| Watchdog падает между rename и restart | Recovery при старте (читает restart-processing) |

---

## Зависимости между фазами

```
Фаза 0 (Подготовка)
    ↓
Фаза 1 (React → Preact) ←── независима
    ↓
Фаза 2 (Backend endpoints) ←── независима от Фазы 1
    ↓
Фаза 3 (Frontend UI) ←── зависит от Фазы 1 + Фазы 2
    ↓
Фаза 4 (Watchdog + Restart) ←── зависит от Фазы 2
    ↓
Фаза 5 (Интеграция + Review)
```

**Параллельная работа:**
- Фаза 1 и Фаза 2 могут выполняться параллельно
- Фаза 3 начинается после завершения Фаз 1 и 2
- Фаза 4 может начаться параллельно с Фазой 3

---

## Первые шаги после одобрения

1. **PM:** Создать ветку `sprint-19/admin-dashboard-phase2`
2. **Developer:** Взять `slime-arena-mon1` (React → Preact)
3. **Developer (параллельно):** Взять `slime-arena-mon2` (Backend metrics)
