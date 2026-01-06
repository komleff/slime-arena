# Slime Arena

Многопользовательская браузерная игра в реальном времени про боевых слаймов.
Проект ориентирован на высокую производительность, детерминированную симуляцию и отзывчивое управление.

## Технологический стек

- **Frontend**: Preact, Signals (реактивное состояние), HTML5 Canvas (рендер игрового мира).
- **Backend**: Node.js, Colyseus (WebSocket фреймворк для синхронизации состояния).
- **Shared**: TypeScript (общие типы, константы и формулы).
- **Инфраструктура**: Docker, GitHub Actions (CI/CD), PostgreSQL (MetaServer).

## Ключевые концепции

### 1. Детерминированная симуляция
Сервер работает на фиксированной частоте **30 тиков в секунду**. Все вычисления (физика, столкновения, способности) происходят на сервере. Случайные события используют детерминированный RNG, что гарантирует идентичность симуляции для всех игроков.

### 2. Масса = Здоровье
В игре нет отдельного показателя HP. Ваша масса — это ваше здоровье и ваш размер.
- **Минимум:** 50 кг (гибель).
- **Старт:** 100 кг.
- **Механика:** Укусы врагов уменьшают вашу массу и увеличивают их.

### 3. U2-стиль сглаживания
Клиент использует продвинутый алгоритм предиктивного сглаживания (U2-style smoothing). Вместо классической интерполяции между старыми снапшотами, клиент визуализирует состояние «в настоящем», плавно корректируя визуальную позицию при получении обновлений от сервера. Это минимизирует задержку ввода.

### 4. Баланс через конфигурацию
Все игровые параметры (урон, скорость, кулдауны, веса пузырей) вынесены в единый файл [config/balance.json](config/balance.json). Это позволяет изменять геймплей без пересборки кода.

### 5. Мобильное управление
Игра поддерживает touch-устройства с адаптивным виртуальным джойстиком и системой Flight Assist:

- **Virtual Joystick**: Адаптивный джойстик, который следует за пальцем и автоматически корректирует позицию.
- **Flight Assist**: Серверная система стабилизации, которая интерпретирует направление ввода как желаемый курс и плавно поворачивает слайма.
- **Multitouch**: Поддержка одновременного движения и использования способностей разными пальцами.
- **A/B план тюнинга**: `docs/soft-launch/Sprint-Next-Mobile-Controls-Plan.md`.
- **A/B конфиг**: `config/experiments/mobile-controls-ab.json`.

## Структура проекта

- [client/](client/) — Веб-клиент (Vite + Preact).
- [server/](server/) — Игровой сервер (Colyseus).
- [shared/](shared/) — Общая логика и типы.
- [config/](config/) — Конфигурационные файлы баланса.
- [docs/](docs/) — Техническая документация (Архитектура v4.2.5, ТЗ Soft Launch).
- [.memory_bank/](.memory_bank/) — База знаний проекта для ИИ-ассистентов.

## Быстрый старт

### Установка

```bash
npm install
```

### Разработка

Рекомендуется запускать сервер и клиент в разных терминалах:
1. **Сервер:** `npm run dev:server` (ws://localhost:2567)
2. **Клиент:** `npm run dev:client` (http://localhost:5173)

### Сборка

Порядок сборки важен для разрешения зависимостей:

```bash
npm run build
```

*(Сначала собирается shared, затем server и client)*

### Тестирование

```bash
npm run test
```

Включает тесты детерминизма и генерации арены.

### Stage D Integration Tests

Полные интеграционные тесты полного игрового цикла (auth → config → matchmaking → match-results).
**Статус: ✅ 19/19 тестов пройдены** (Sprint 3 завершён).

```bash
# 1. Запустить PostgreSQL и Redis
docker-compose up postgres redis -d

# 2. Запустить MetaServer
npm run dev --workspace=server

# 3. В другом терминале — Stage D тесты (17 тестов)
npx tsx server/tests/meta-stage-d.test.ts

# Или все smoke тесты (Stage B + C + D)
.\tests\smoke\run-stage-d.ps1
```

### Load Tests (k6)

Нагрузочное тестирование для Soft Launch (CCU=500, p99 < 2000ms, errors < 1%):

```bash
# Установить k6: https://k6.io/docs/getting-started/installation/

# Smoke test (быстрая проверка)
k6 run --vus 10 --duration 30s tests/load/soft-launch.js

# Full load test (~11 минут)
k6 run tests/load/soft-launch.js
```

Подробная документация: [tests/load/README.md](tests/load/README.md)

### Backup & Restore

Резервное копирование и восстановление PostgreSQL:

```bash
# Windows
.\scripts\backup.ps1
.\scripts\restore.ps1 -BackupFile "backups\slime_arena_YYYYMMDD_HHMMSS.dump"

# Linux/macOS
./scripts/backup.sh
./scripts/restore.sh backups/slime_arena_YYYYMMDD_HHMMSS.dump
```

Подробная документация: [docs/operations/backup-restore.md](docs/operations/backup-restore.md)

## Docker

Актуальные образы v0.3.0 доступны в GitHub Container Registry:
- `ghcr.io/komleff/slime-arena-server:v0.3.0`
- `ghcr.io/komleff/slime-arena-client:v0.3.0`

## Журнал изменений

Полная история изменений доступна в файле [CHANGELOG.md](CHANGELOG.md).

---
Подробная документация доступна в папке [docs/](docs/).
