# Реорганизация документации + коммит незалитых файлов

**Дата:** 2026-02-07
**Контекст:** После Sprint 20 накопились: незалитые в git изменения (memory bank, TECH_DEBT, архив планов), устаревшие документы в docs/, дублирование ролей и папок.

---

## Часть 1: Незалитые файлы (коммит в main)

Текущий `git status` показывает:

**Staged:**
- `.memory_bank/activeContext.md` — обновлён для Sprint 20
- `.memory_bank/progress.md` — обновлён для Sprint 20
- `docs/plans/polymorphic-pondering-valley.md` → `archive/sprint-19/pm-orchestration-plan.md`
- `docs/plans/silly-chasing-russell.md` → `archive/sprint-mon/review-tz-monitoring-dashboard.md`

**Unstaged:**
- `TECH_DEBT.md` — добавлена секция «Отложенные задачи Sprint 20»
- `docs/sprint-13/review-prompts.md` — удалён (ревью Sprint 13)

**Untracked (добавить в коммит):**
- `docs/plans/archive/sprint-20/release-v084-split-architecture.md` — план деплоя v0.8.4

**Удалить (не коммитить):**

- `tmp/login.json` — временный файл
- `docs/operations/Защита данных v0.8.3.md` — временный документ

---

## Часть 2: Реорганизация docs/

### 2.1 Объединить папки презентаций

`docs/presentation/` → `docs/presentations/` (сохраняем `presentations/`)

| Действие | Файл | Назначение |
|----------|------|------------|
| git mv | `presentation/PLAN.md` | `presentations/AI-Driven-Development-Plan.md` |
| git mv | `presentation/REPORT.md` | `presentations/AI-Driven-Development-Report.md` |
| git mv | `presentation/AGENT_ROLES_QUICKSTART.md` | `archive/AGENT_ROLES_QUICKSTART.md` |

Удалить пустую `docs/presentation/`.

### 2.2 Sprint-13 → архив

| Действие | Файл | Назначение |
|----------|------|------------|
| git mv | `sprint-13/` (вся папка) | `archive/sprint-13-reviews/` |

Sprint 13 давно завершён, все файлы — результаты ревью.

### 2.3 Testing → releases + архив

| Действие | Файл | Назначение |
|----------|------|------------|
| git mv | `testing/v0.8.1-test-report.md` | `releases/v0.8.1-test-report.md` |
| git mv | `testing/v0.8.1-test-plan.md` | `archive/v0.8.1-test-plan.md` |

Удалить пустую `docs/testing/`.

### 2.4 Удалить дубли ролей

| Действие | Файл | Причина |
|----------|------|---------|
| git mv | `docs/PM-ROLE.md` | → `docs/archive/PM-ROLE.md` (дубль `.beads/PM_ROLE.md`) |
| delete | `.beads/Арт-директор_role.md` | Дубль `.beads/ART_DIRECTOR_ROLE.md` (58 vs 193 строк) |

### 2.5 Одиночные папки и файлы

| Действие | Файл | Назначение |
|----------|------|------------|
| git mv | `docs/agents/PM-ORCHESTRATION-PLAN.md` | `docs/archive/PM-ORCHESTRATION-PLAN.md` |
| git mv | `docs/TECHNICAL_SNAPSHOT_v0.7.0.md` | `docs/archive/TECHNICAL_SNAPSHOT_v0.7.0.md` |

Удалить пустую `docs/agents/`.

### 2.6 Обновить ссылки

В `.memory_bank/activeContext.md`: заменить `docs/testing/v0.8.1-test-report.md` → `docs/releases/v0.8.1-test-report.md`.

---

## Целевая структура docs/

```
docs/
├── gdd/                    # [НЕ ТРОГАТЬ] GDD v3.3.2
├── soft-launch/            # [НЕ ТРОГАТЬ] ТЗ, архитектура v4.2.5
├── operations/             # [НЕ ТРОГАТЬ] AI_AGENT_GUIDE, SERVER_SETUP, backup
├── meta-min/               # [НЕ ТРОГАТЬ] ТЗ мета-геймплея v1.9
├── monitor/                # [НЕ ТРОГАТЬ] ТЗ мониторинга v1.6
├── plans/                  # Планы (+ archive/sprint-19,20,mon)
├── architecture/           # data-flow.md (актуальный)
├── presentations/          # [ОБЪЕДИНЕНО] Все презентации
├── releases/               # Release notes + test reports
├── archive/                # [ЕДИНЫЙ АРХИВ] Всё устаревшее
├── ASSETS_MAP_FULL.md      # Актуальная карта ассетов
└── .obsidian/              # Служебная
```

**Удалённые папки:** `presentation/`, `sprint-13/`, `testing/`, `agents/`
**Удалённые файлы:** `.beads/Арт-директор_role.md`, `tmp/login.json`

---

## Порядок выполнения

1. Удалить `tmp/` (временные файлы)
2. Выполнить все `git mv` операции (реорганизация)
3. Удалить `.beads/Арт-директор_role.md`
4. Обновить ссылку в activeContext.md
5. `git add` все изменения
6. Один коммит: `docs: reorganize documentation + commit Sprint 20 updates`
7. `git push origin main`

## Проверка

- `git status` — чисто
- `git log --oneline -1` — коммит на месте
- Ссылки в CLAUDE.md не изменились (`.beads/AGENT_ROLES.md`, `docs/soft-launch/`, `docs/operations/`)
- Все актуальные папки на месте
