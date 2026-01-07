# Slime Arena

**Soft Launch Status: READY** (6/6 критериев выполнено)

Многопользовательская браузерная игра в реальном времени про боевых слаймов.
Проект ориентирован на высокую производительность, детерминированную симуляцию и отзывчивое управление.

### Результаты тестирования

| Метрика | Результат |
|---------|-----------|
| Stage D Integration Tests | 19/19 passed |
| Load Test (k6) | CCU 500, 87k requests, 0% errors |
| Backup/Restore | Verified (data integrity confirmed) |

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

## Запуск в Docker (Stable Release)

Для быстрого запуска всего окружения используйте Docker Compose:

```bash
# Из корня проекта
docker-compose -f docker/docker-compose.yml up -d
```

### Доступные сервисы v0.3.3:
- **Client**: [http://localhost:5174](http://localhost:5174) (Контейнер: `slime-arena-client`)
- **MetaServer**: [http://localhost:3000](http://localhost:3000) (Контейнер: `slime-arena-meta-server`)
- **MatchServer**: [ws://localhost:2567](ws://localhost:2567) (Контейнер: `slime-arena-match-server`)
- **PostgreSQL**: [localhost:5432](localhost:5432) (Контейнер: `slime-arena-postgres`)
- **Redis**: [localhost:6379](localhost:6379) (Контейнер: `slime-arena-redis`)

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

Актуальные образы v0.3.3 доступны в GitHub Container Registry:

### Монолит (рекомендуется для быстрого старта)

Один контейнер с MetaServer, MatchServer и Client:

```bash
# Запуск монолита с PostgreSQL и Redis
docker-compose -f docker/docker-compose.monolith.yml up -d

# Сервисы:
# - MetaServer: http://localhost:3000
# - MatchServer: ws://localhost:2567
# - Client: http://localhost:5174
```

Образ: `ghcr.io/komleff/slime-arena-monolith:v0.3.3`

### Удалённое развёртывание

Клиент автоматически определяет адрес сервера из URL страницы (`window.location.hostname`).
При развёртывании на удалённом сервере никаких дополнительных настроек не требуется:

```bash
# На удалённом сервере (например, 192.168.1.100)
docker-compose -f docker/docker-compose.monolith.yml up -d

# Доступ из браузера:
# - http://192.168.1.100:5174 (игра)
# - http://192.168.1.100:3000/health (API health check)
# - ws://192.168.1.100:2567 (WebSocket автоматически)
```

**Переменные окружения для production:**

| Переменная             | Описание                        | По умолчанию           |
| ---------------------- | ------------------------------- | ---------------------- |
| `POSTGRES_PASSWORD`    | Пароль PostgreSQL               | `slime_dev_password`   |
| `MATCH_SERVER_TOKEN`   | Токен для server-to-server auth | `dev-server-token`     |
| `VERSION`              | Версия образа                   | `v0.3.3`               |

```bash
# Пример с кастомными credentials
POSTGRES_PASSWORD=secure_password_123 \
MATCH_SERVER_TOKEN=prod-token-xyz \
docker-compose -f docker/docker-compose.monolith.yml up -d
```

### Отдельные образы

- `ghcr.io/komleff/slime-arena-server:v0.3.3`
- `ghcr.io/komleff/slime-arena-client:v0.3.3`

## Журнал изменений

Полная история изменений доступна в файле [CHANGELOG.md](CHANGELOG.md).

---
Подробная документация доступна в папке [docs/](docs/).
