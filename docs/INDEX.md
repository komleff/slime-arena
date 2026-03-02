# Навигация по документации Slime Arena

> Актуально на: 2026-02-08 | Версия: v0.8.5

---

## 🤖 Для ИИ-агентов (живая инфраструктура)

Эти файлы — рабочий инструментарий. Читайте их перед началом работы.

| Что | Где | Назначение |
|-----|-----|------------|
| **Роли агентов** | [.agents/AGENT_ROLES.md](../.agents/AGENT_ROLES.md) | Каноничный документ: PM, Architect, Developer, Reviewer (v2.0) |
| **Роль PM** | [.agents/PM_ROLE.md](../.agents/PM_ROLE.md) | Оркестрация, эскалация, цикл ревью |
| **Арт-директор** | [.agents/ART_DIRECTOR_ROLE.md](../.agents/ART_DIRECTOR_ROLE.md) | Визуальный стиль «Sticker Pack 3D» |
| **Шпаргалка ролей** | [.agents/HOW_TO_USE_AGENT_ROLES.md](../.agents/HOW_TO_USE_AGENT_ROLES.md) | Промпты для быстрой активации |
| **Beads CLI** | [.beads/README.md](../.beads/README.md) | `bd create`, `bd show`, `bd sync` |
| **Claude** | [CLAUDE.md](../CLAUDE.md) | Beads, архитектура, команды |
| **Memory Bank** | [AGENTS.md](../AGENTS.md) | Точка входа для AI-моделей, правила Memory Bank |
| **Агент** | [agent.md](../agent.md) | Режимы работы, обновление документации |
| **Copilot** | [.github/copilot-instructions.md](../.github/copilot-instructions.md) | Паттерны симуляции, конфигурация, спрайты |

### Memory Bank (`.memory_bank/`)

| Файл | Назначение |
|------|------------|
| [activeContext.md](../.memory_bank/activeContext.md) | Текущее состояние, последние изменения |
| [progress.md](../.memory_bank/progress.md) | Статус задач, контрольные точки |
| [systemPatterns.md](../.memory_bank/systemPatterns.md) | Архитектура, порядок систем |
| [techContext.md](../.memory_bank/techContext.md) | Стек, инфраструктура, ограничения |
| [productContext.md](../.memory_bank/productContext.md) | Бизнес-логика, UX |
| [projectbrief.md](../.memory_bank/projectbrief.md) | Суть проекта, цели |
| [modules/](../.memory_bank/modules/) | U2-визуализация, бой |
| [ui_extension/](../.memory_bank/ui_extension/) | UI-компоненты, страницы |

---

## 📋 Актуальная документация

### Дизайн игры (`docs/gdd/`)

| Файл | Содержание |
|------|------------|
| [GDD-Core.md](gdd/GDD-Core.md) | Ядро: слаймы, масса, арена |
| [GDD-Combat.md](gdd/GDD-Combat.md) | Боевая система |
| [GDD-Abilities.md](gdd/GDD-Abilities.md) | Способности |
| [GDD-Talents.md](gdd/GDD-Talents.md) | Таланты |
| [GDD-Arena.md](gdd/GDD-Arena.md) | Арена, зоны, объекты |
| [GDD-Chests.md](gdd/GDD-Chests.md) | Сундуки и лут |
| [GDD-UI.md](gdd/GDD-UI.md) | Интерфейс |
| [GDD-Glossary.md](gdd/GDD-Glossary.md) | Глоссарий терминов |

### Архитектура (`docs/architecture/`)

| Файл | Содержание |
|------|------------|
| [data-flow.md](architecture/data-flow.md) | Поток данных клиент ↔ сервер |

Полная архитектура v4.2.5 (4 части) → [docs/soft-launch/](soft-launch/)

### Эксплуатация (`docs/operations/`)

| Файл | Содержание |
|------|------------|
| [SERVER_SETUP.md](operations/SERVER_SETUP.md) | Настройка боевого сервера |
| [SERVER_UPDATE.md](operations/SERVER_UPDATE.md) | Обновление, откат, добавление домена |
| [backup-restore.md](operations/backup-restore.md) | Бэкапы и восстановление |
| [AI_AGENT_GUIDE.md](operations/AI_AGENT_GUIDE.md) | Гайд для агентов по ops |
| [AI-AGENTS-AUTOMATION.md](operations/AI-AGENTS-AUTOMATION.md) | Автоматизация через агентов |

### Технические задания (`docs/meta-min/`)

| Файл | Содержание |
|------|------------|
| [TZ-MetaGameplay-v1.9-Index.md](meta-min/TZ-MetaGameplay-v1.9-Index.md) | Мета-геймплей (индекс) |
| [TZ-MetaGameplay-v1.9-Core.md](meta-min/TZ-MetaGameplay-v1.9-Core.md) | Мета: ядро |
| [TZ-MetaGameplay-v1.9-Backend.md](meta-min/TZ-MetaGameplay-v1.9-Backend.md) | Мета: бэкенд |
| [TZ-MetaGameplay-v1.9-Client.md](meta-min/TZ-MetaGameplay-v1.9-Client.md) | Мета: клиент |
| [TZ-LeaderboardScreen-v1.6.md](meta-min/TZ-LeaderboardScreen-v1.6.md) | Таблица лидеров |
| [TZ-StandaloneAdapter-OAuth-v1.9.md](meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md) | OAuth-адаптер |
| [TZ-PlatformAdapters-*.md](meta-min/) | Платформенные адаптеры |

### Мониторинг (`docs/monitor/`)

| Файл | Содержание |
|------|------------|
| [TZ-MON-v1_6-Index.md](monitor/TZ-MON-v1_6-Index.md) | ТЗ мониторинга (индекс) |
| [TECH-DEBT-Monitoring-Dashboard.md](monitor/TECH-DEBT-Monitoring-Dashboard.md) | Техдолг дашборда |

### Релизы (`docs/releases/`)

| Файл | Содержание |
|------|------------|
| [v0.8.4-local-test-report.md](releases/v0.8.4-local-test-report.md) | Тест-отчёт v0.8.4 |
| [v0.8.1-test-report.md](releases/v0.8.1-test-report.md) | Тест-отчёт v0.8.1 |
| [v0.7.3-release-notes.md](releases/v0.7.3-release-notes.md) | Релиз v0.7.3 |
| [v0.7.0-release-notes.md](releases/v0.7.0-release-notes.md) | Релиз v0.7.0 |

### Soft Launch (`docs/soft-launch/`)

23 файла: архитектура v4.2.5, ТЗ мобильных контролов, A/B-тестирование, пуш-уведомления, UI-карты экранов. [Полный список →](soft-launch/)

### Презентации (`docs/presentations/`)

| Файл | Содержание |
|------|------------|
| [AI-Driven-Development-Report.md](presentations/AI-Driven-Development-Report.md) | Отчёт: 31 день, 83K строк |
| [AI-Driven-Development-Plan.md](presentations/AI-Driven-Development-Plan.md) | План доклада v2.0 |
| [AI-Native-Development-Report.md](presentations/AI-Native-Development-Report.md) | AI-Native отчёт |

### Автоматизация (Python) (`tools/`)

| Файл | Назначение |
|------|------------|
| [pm_orchestrator.py](../tools/pm_orchestrator.py) | Review-fix-review цикл |
| [consensus.py](../tools/consensus.py) | Консенсус 3+ APPROVED |
| [gemini_reviewer.py](../tools/gemini_reviewer.py) | Gemini 2.5 Flash ревью |

---

## 📦 Архив (`docs/backlog/`)

Устаревшие версии документов. Сохранены для истории, заменены актуальными.

| Подпапка | Содержание |
|----------|------------|
| [pm/](backlog/pm/) | Старые PM-ROLE, ORCHESTRATION-PLAN, AGENT_ROLES_QUICKSTART, sprint-13-pm |
| [reviews/](backlog/reviews/) | Артефакты ревью sprint-13 |
| [sprints/](backlog/sprints/) | Завершённые спринты 14–21, мониторинг |
| [versions/](backlog/versions/) | Технические снапшоты v0.6, v0.7, тест-планы |
| Корень | Старые GDD v2.3–2.5, Architecture v1.4–3.3, Plans v1.7–3.3, ТЗ |

---

## 📁 Корневые файлы

| Файл | Назначение |
|------|------------|
| [README.md](../README.md) | Главный README проекта |
| [CHANGELOG.md](../CHANGELOG.md) | История изменений |
| [TODO.md](../TODO.md) | Текущие задачи |
| [TECH_DEBT.md](../TECH_DEBT.md) | Технический долг |
| [config/balance.json](../config/balance.json) | Баланс (единственный источник) |
