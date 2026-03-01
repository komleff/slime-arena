# Slime Arena

> **🧪 AI-Native Development Experiment**
>
> Этот проект интересен прежде всего своим **новаторским методом разработки**. Slime Arena создаётся **полностью силами ИИ** под управлением человека-оператора, который не пишет код вручную.
>
> **Цель:** Отладить работу ИИ-агентов в оркестре и создать процесс полного цикла разработки малого и среднего масштаба (обычно требующих 5–15 человек и 1–3 года) силами одного оператора.
>
> **ИИ полностью отвечает за:**
> - 📊 Аналитику и Гейм-дизайн
> - 🏗️ Проектирование и Планирование
> - 💻 Кодирование и Баг-фиксинг
> - 🔍 Ревью и Тестирование
> - 🚀 Деплой и DevOps
>
> **Методология и инструменты:**
> - **Beads:** AI-native трекер задач для управления потоком работы.
> - **Memory Bank:** Структурированная документация для сохранения контекста.
> - **Agent Roles:** Строгое разделение ответственности (PM, Architect, Developer, Reviewer). Документ: [`.agents/AGENT_ROLES.md`](.agents/AGENT_ROLES.md).
> - **Zero Trust:** Оператор не валидирует код технически, полагаясь на тесты и кросс-ревью агентов.

**Soft Launch Status: READY** (6/6 критериев выполнено)

Многопользовательская браузерная игра в реальном времени про боевых слаймов.
Проект ориентирован на высокую производительность, детерминированную симуляцию и отзывчивое управление.

### Результаты тестирования

| Метрика | Результат |
|---------|----------|
| Stage D Integration Tests | 19/19 passed |
| Load Test (k6) | CCU 500, 87k requests, 0% errors |
| Backup/Restore | Verified (data integrity confirmed) |
| joinToken Security | ✅ JWT validation в ArenaRoom.onAuth() |

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

### Конфигурация (опционально)

#### MetaServer

По умолчанию игра работает без MetaServer в offline режиме. Для подключения к MetaServer:

1. Скопируйте шаблон конфигурации:

   ```bash
   cp .env.local.example .env.local
   ```

2. Раскомментируйте и настройте `VITE_META_SERVER_URL` в `.env.local`:

   ```bash
   VITE_META_SERVER_URL=http://localhost:3000
   ```

3. Запустите MetaServer (см. документацию).

4. Перезапустите dev-сервер клиента.

**Без MetaServer:**

- Игра полностью играбельна
- Подключение напрямую к Colyseus серверу (ws://localhost:2567)
- Монетизация (платежи, реклама) недоступна
- Авторизация недоступна (имя задаётся локально)

**С MetaServer:**

- Авторизация через платформы (YaGames, Telegram, VK)
- RuntimeConfig с удалённым управлением фичами
- Matchmaking через очередь
- Реклама с наградой

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

## Доступ с мобильных устройств (локальная сеть)

Для тестирования на мобильных устройствах в локальной сети:

1. **Узнайте IP-адрес компьютера** (например, `192.168.1.100`).
2. **Настройте HMR** через переменные окружения в `.env.local`:

```bash
# client/.env.local
VITE_HMR_HOST=192.168.1.100
VITE_HMR_PROTOCOL=ws
```

3. **Запустите клиент** — HMR будет работать через указанный хост.
4. **Откройте игру на мобильном устройстве:** `http://192.168.1.100:5173`

| Переменная | Описание | По умолчанию |
|------------|----------|---------------|
| `VITE_HMR_HOST` | IP-адрес для WebSocket HMR | (не задан — HMR на localhost) |
| `VITE_HMR_PROTOCOL` | Протокол HMR (`ws` или `wss`) | `ws` |

**Примечание:** Если переменные не заданы, HMR работает в стандартном режиме (localhost).

## Запуск в Docker (Stable Release)

Для быстрого запуска всего окружения используйте Docker Compose:

```bash
# Из корня проекта
docker-compose -f docker/docker-compose.yml up -d
```

### Доступные сервисы v0.4.0:
- **Client**: [http://localhost:5173](http://localhost:5173) (Контейнер: `slime-arena-client`)
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

Актуальные образы v0.4.0 доступны в GitHub Container Registry:

### Монолит (рекомендуется для быстрого старта)

Один контейнер с MetaServer, MatchServer и Client:

```bash
# Запуск монолита с PostgreSQL и Redis
docker-compose -f docker/docker-compose.monolith.yml up -d

# Сервисы:
# - MetaServer: http://localhost:3000
# - MatchServer: ws://localhost:2567
# - Client: http://localhost:5173
```

Образ: `ghcr.io/komleff/slime-arena-monolith:v0.4.0`

### Удалённое развёртывание

Клиент автоматически определяет адрес сервера из URL страницы (`window.location.hostname`).
При развёртывании на удалённом сервере никаких дополнительных настроек не требуется:

```bash
# На удалённом сервере (например, 192.168.1.100)
docker-compose -f docker/docker-compose.monolith.yml up -d

# Доступ из браузера:
# - http://192.168.1.100:5173 (игра)
# - http://192.168.1.100:3000/health (API health check)
# - ws://192.168.1.100:2567 (WebSocket автоматически)
```

**Переменные окружения для production:**

| Переменная             | Описание                        | По умолчанию           |
| ---------------------- | ------------------------------- | ---------------------- |
| `POSTGRES_PASSWORD`    | Пароль PostgreSQL               | `slime_dev_password`   |
| `MATCH_SERVER_TOKEN`   | Токен для server-to-server auth | `dev-server-token`     |
| `META_HOST`            | Адрес привязки MetaServer       | `0.0.0.0`              |
| `HOST`                 | Адрес привязки MatchServer      | `0.0.0.0`              |
| `VERSION`              | Версия образа                   | `v0.4.0`               |

```bash
# Пример с кастомными credentials
POSTGRES_PASSWORD=secure_password_123 \
MATCH_SERVER_TOKEN=prod-token-xyz \
docker-compose -f docker/docker-compose.monolith.yml up -d
```

### Образы v0.4.0

| Образ | Описание |
|-------|----------|
| `ghcr.io/komleff/slime-arena-app` | MetaServer + MatchServer + Client |
| `ghcr.io/komleff/slime-arena-db` | PostgreSQL + Redis |
| `ghcr.io/komleff/slime-arena-monolith-full` | Всё в одном (для тестов) |

### Apple Silicon (M1/M2/M3/M4)

Docker-образы поддерживают обе архитектуры:

- `linux/amd64` (Intel, AMD, cloud servers)
- `linux/arm64` (Apple Silicon, AWS Graviton)

Образы автоматически выбирают правильную архитектуру:

```bash
docker pull ghcr.io/komleff/slime-arena-monolith-full:latest
docker-compose -f docker/docker-compose.monolith-full.yml up -d
```

Для явного указания архитектуры:

```bash
# ARM64 (Apple Silicon — нативная скорость)
docker pull --platform linux/arm64 ghcr.io/komleff/slime-arena-monolith-full:latest

# AMD64 (Intel/AMD, эмуляция на M1-M4 через Rosetta 2)
docker pull --platform linux/amd64 ghcr.io/komleff/slime-arena-monolith-full:latest
```

## Production Deployment

### Live Demo

**Production URL:** <https://slime-arena.overmobile.space>

Игра автоматически подключается к production серверу:

- **Client**: <https://slime-arena.overmobile.space> (HTTPS)
- **MatchServer**: `wss://slime-arena-server.overmobile.space` (WSS)

### Domain Configuration

Для работы с кастомным доменом:

**1. Vite Dev Server** (уже настроено):

```typescript
// client/vite.config.ts
server: {
  allowedHosts: ['*.overmobile.space']
}
```

**2. WebSocket Auto-detection** (уже настроено):

```typescript
// client/src/main.ts
if (isHttps && window.location.hostname.includes("overmobile.space")) {
    defaultWsUrl = `wss://slime-arena-server.overmobile.space`;
}
```

## Журнал изменений

Полная история изменений доступна в файле [CHANGELOG.md](CHANGELOG.md).

---
Подробная документация доступна в папке [docs/](docs/).
