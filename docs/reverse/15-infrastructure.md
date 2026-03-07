# Reverse: Infrastructure
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

## 1. Обзор

Инфраструктура Slime Arena построена на стеке PostgreSQL + Redis + Node.js 20, упакованном в Docker-контейнеры с двумя архитектурными вариантами развёртывания:

1. **Split (app + db)** -- production-конфигурация: контейнер `slime-arena-app` (MetaServer + MatchServer + Client + Admin Dashboard) + контейнер `slime-arena-db` (PostgreSQL 16 + Redis 7).
2. **Monolith-full** -- всё в одном контейнере (PostgreSQL + Redis + все серверы + статика). Используется для dev/демо.

CI/CD: GitHub Actions -- `ci.yml` (сборка при PR), `publish-containers.yml` (публикация в GHCR при push в main / тегах).

Управление процессами внутри контейнеров: **supervisord** (monolith-full) или **concurrently** (app.Dockerfile).

---

## 2. Исходные файлы

| Файл | Назначение |
|------|-----------|
| `server/src/db/pool.ts` | Инициализация PostgreSQL pool и Redis client (singleton) |
| `server/src/db/redis.ts` | Ре-экспорт Redis из pool.ts |
| `server/src/db/migrate.ts` | Запуск SQL-миграций последовательно |
| `server/src/db/migrations/*.sql` | 6 файлов миграций (001, 002, 007-010) |
| `server/src/utils/rng.ts` | Детерминированный LCG-генератор |
| `server/src/config/loadBalanceConfig.ts` | Загрузка и валидация balance.json |
| `server/src/telemetry/TelemetryService.ts` | Локальная телеметрия в JSONL-файлы |
| `docker/app.Dockerfile` | Multi-stage сборка app-контейнера |
| `docker/db.Dockerfile` | Сборка db-контейнера (Alpine + PG16 + Redis) |
| `docker/monolith-full.Dockerfile` | All-in-one контейнер |
| `docker/docker-compose.app-db.yml` | Production compose (app + db) |
| `docker/docker-compose.yml` | Dev compose (отдельные postgres/redis/meta/match/client) |
| `docker/docker-compose.monolith-full.yml` | Monolith compose |
| `docker/docker-compose-db-only.yml` | Только БД (postgres + redis) |
| `docker/supervisord.conf` | Monolith-full: PG + Redis + Meta + Match + Client + Admin |
| `docker/supervisord-db.conf` | DB-контейнер: PG + Redis |
| `docker/entrypoint-db.sh` | Инициализация PG + seed + supervisord (db) |
| `docker/entrypoint-full.sh` | Инициализация PG + миграции + seed + supervisord (monolith) |
| `docker/seed-data.sql` | Начальные данные (3 пользователя, матчи, лидерборд) |
| `docker/build.sh` / `docker/build.ps1` | Скрипты сборки Docker-образов |
| `.github/workflows/ci.yml` | CI: build при PR |
| `.github/workflows/publish-containers.yml` | CD: build + push в GHCR |
| `.github/workflows/branch-protection.yml` | Проверка прямых пушей в main |
| `.github/workflows/make-packages-public.yml` | Вспомогательный: сделать пакеты публичными |
| `package.json` (корень) | npm workspaces root |
| `server/package.json` | @slime-arena/server |
| `client/package.json` | @slime-arena/client |
| `shared/package.json` | @slime-arena/shared |
| `admin-dashboard/package.json` | slime-arena-admin-dashboard |

---

## 3. База данных (PostgreSQL)

### 3.1 Pool configuration

Файл: `server/src/db/pool.ts`

```typescript
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://slime:slime_dev_password@localhost:5432/slime_arena',
    max: 20,                      // максимум соединений в пуле
    idleTimeoutMillis: 30000,     // 30 сек до закрытия idle-соединения
    connectionTimeoutMillis: 5000 // 5 сек таймаут подключения
});
```

Паттерн: singleton через модульное замыкание. `initializePostgres()` создаёт пул один раз, `getPostgresPool()` возвращает экземпляр или бросает ошибку если не инициализирован.

Redis и PostgreSQL клиенты живут в одном файле `pool.ts`. Файл `redis.ts` -- чистый ре-экспорт.

**Захардкоженные значения:**
- `max: 20` -- размер пула
- `idleTimeoutMillis: 30000`
- `connectionTimeoutMillis: 5000`
- Дефолтный `DATABASE_URL`: `postgresql://slime:slime_dev_password@localhost:5432/slime_arena`

### 3.2 Полная карта таблиц из миграций

Ниже -- полный перечень таблиц, столбцов, индексов и FK по состоянию на миграцию 010.

#### Таблица `users`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK, DEFAULT uuid_generate_v4() |
| `platform_type` | VARCHAR(50) | NOT NULL |
| `platform_id` | VARCHAR(255) | NOT NULL |
| `nickname` | VARCHAR(50) | NOT NULL |
| `avatar_url` | VARCHAR(500) | |
| `locale` | VARCHAR(10) | DEFAULT 'ru' |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |
| `last_login_at` | TIMESTAMP | |
| `is_banned` | BOOLEAN | DEFAULT FALSE |
| `ban_reason` | VARCHAR(255) | |
| `ban_until` | TIMESTAMP | |
| `is_anonymous` | BOOLEAN | NOT NULL DEFAULT false (008) |
| `registration_skin_id` | VARCHAR(50) | (008) |
| `registration_match_id` | UUID | FK -> match_results(match_id) (008) |
| `nickname_set_at` | TIMESTAMP | (008) |

- UNIQUE (`platform_type`, `platform_id`) -- constraint `unique_platform_user`
- INDEX `idx_users_platform` ON (platform_type, platform_id)
- TRIGGER `update_users_updated_at` -> `update_updated_at_column()`

#### Таблица `sessions`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `token_hash` | VARCHAR(255) | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `expires_at` | TIMESTAMP | NOT NULL |
| `revoked_at` | TIMESTAMP | |
| `ip` | VARCHAR(64) | |
| `user_agent` | VARCHAR(255) | |

- INDEX `idx_sessions_user_id` ON (user_id, created_at DESC)
- INDEX `idx_sessions_token_hash` ON (token_hash)

#### Таблица `profiles`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | PK, FK -> users(id) ON DELETE CASCADE |
| `level` | INT | DEFAULT 1 |
| `xp` | INT | DEFAULT 0 |
| `selected_skin_id` | VARCHAR(100) | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- TRIGGER `update_profiles_updated_at` -> `update_updated_at_column()`

#### Таблица `wallets`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | PK, FK -> users(id) ON DELETE CASCADE |
| `coins` | BIGINT | DEFAULT 0 |
| `gems` | BIGINT | DEFAULT 0 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- TRIGGER `update_wallets_updated_at` -> `update_updated_at_column()`

#### Таблица `unlocked_items`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `item_id` | VARCHAR(100) | NOT NULL |
| `item_type` | VARCHAR(50) | NOT NULL |
| `unlocked_at` | TIMESTAMP | DEFAULT NOW() |
| `source` | VARCHAR(50) | NOT NULL |
| `source_details` | JSONB | |

- UNIQUE (`user_id`, `item_id`) -- constraint `unique_user_item`
- INDEX `idx_unlocked_items_user` ON (user_id, item_type)

#### Таблица `transactions`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `operation_id` | VARCHAR(100) | NOT NULL |
| `type` | VARCHAR(50) | NOT NULL |
| `source` | VARCHAR(50) | NOT NULL |
| `payload` | JSONB | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

- UNIQUE (`user_id`, `operation_id`) -- constraint `unique_user_operation`
- INDEX `idx_transactions_user` ON (user_id, created_at DESC)

#### Таблица `player_ratings`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `mode` | VARCHAR(50) | NOT NULL |
| `season_id` | VARCHAR(50) | NOT NULL |
| `rating` | INT | DEFAULT 1500 |
| `rating_data` | JSONB | |
| `games_played` | INT | DEFAULT 0 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- PK (`user_id`, `mode`, `season_id`)
- INDEX `idx_ratings_leaderboard` ON (season_id, mode, rating DESC)

#### Таблица `match_results`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `match_id` | UUID | PK |
| `mode` | VARCHAR(50) | NOT NULL |
| `started_at` | TIMESTAMP | NOT NULL |
| `ended_at` | TIMESTAMP | NOT NULL |
| `config_version` | VARCHAR(50) | NOT NULL |
| `build_version` | VARCHAR(50) | NOT NULL |
| `summary` | JSONB | NOT NULL |
| `guest_subject_id` | VARCHAR(255) | (008) |
| `claim_consumed_at` | TIMESTAMP | (008) |

- INDEX `idx_match_results_time` ON (started_at DESC)
- INDEX `idx_match_results_guest_subject` ON (guest_subject_id) (008)

#### Таблица `battlepass_progress`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `season_id` | VARCHAR(50) | NOT NULL |
| `level` | INT | DEFAULT 0 |
| `xp` | INT | DEFAULT 0 |
| `premium` | BOOLEAN | DEFAULT FALSE |
| `state` | JSONB | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- PK (`user_id`, `season_id`)

#### Таблица `mission_progress`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `season_id` | VARCHAR(50) | NOT NULL |
| `mission_id` | VARCHAR(100) | NOT NULL |
| `progress` | INT | DEFAULT 0 |
| `state` | VARCHAR(20) | DEFAULT 'active' |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- PK (`user_id`, `season_id`, `mission_id`)

#### Таблица `achievements`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `achievement_id` | VARCHAR(100) | NOT NULL |
| `state` | VARCHAR(20) | DEFAULT 'locked' |
| `progress` | INT | DEFAULT 0 |
| `unlocked_at` | TIMESTAMP | |
| `claimed_at` | TIMESTAMP | |

- PK (`user_id`, `achievement_id`)

#### Таблица `daily_rewards`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | PK, FK -> users(id) ON DELETE CASCADE |
| `streak` | INT | DEFAULT 0 |
| `last_claimed_at` | TIMESTAMP | |
| `ads_watched_today` | INT | DEFAULT 0 |
| `ads_reset_at` | TIMESTAMP | |

#### Таблица `purchase_receipts` (модифицирована миграцией 002)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `receipt_id` | VARCHAR(100) | UNIQUE (constraint `unique_receipt_id`) |
| `offer_id` | VARCHAR(100) | |
| `price_amount` | INT | |
| `price_currency` | VARCHAR(10) | |
| `platform` | VARCHAR(50) | (переименовано из provider в 002) |
| `platform_transaction_id` | VARCHAR(255) | |
| `status` | VARCHAR(20) | NOT NULL |
| `completed_at` | TIMESTAMP | |
| `metadata` | JSONB | DEFAULT '{}' |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

- INDEX `idx_purchase_receipts_user` ON (user_id, created_at DESC) (001)
- INDEX `idx_purchase_receipts_status` ON (status, created_at DESC) (002)

> **Примечание:** Миграция 002 удалила столбцы `operation_id`, `receipt_payload`, `verified_at` из оригинальной схемы 001, и добавила новую структуру. Схема purchase_receipts в коде значительно расходится с документацией (см. раздел 12).

#### Таблица `social_invites`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `platform` | VARCHAR(50) | NOT NULL |
| `invite_code` | VARCHAR(50) | NOT NULL |
| `state` | VARCHAR(20) | DEFAULT 'created' |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

- UNIQUE (`platform`, `invite_code`) -- constraint `unique_platform_invite`
- INDEX `idx_social_invites_user` ON (user_id)

#### Таблица `ab_tests` (пересоздана в миграции 002)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `test_id` | VARCHAR(100) | PK |
| `name` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | |
| `variants` | JSONB | NOT NULL |
| `weights` | INT[] | NOT NULL |
| `state` | VARCHAR(20) | NOT NULL DEFAULT 'draft' |
| `start_date` | TIMESTAMP | |
| `end_date` | TIMESTAMP | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- INDEX `idx_ab_tests_state` ON (state)
- TRIGGER `update_ab_tests_updated_at`

> **Примечание:** Миграция 002 полностью пересоздала таблицу `ab_tests`. Оригинальная (001) имела PK (user_id, test_id) по документации. Новая структура -- справочник тестов с test_id как PK.

#### Таблица `ab_test_conversions` (новая в 002)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `test_id` | VARCHAR(100) | NOT NULL, FK -> ab_tests(test_id) ON DELETE CASCADE |
| `variant_id` | VARCHAR(100) | NOT NULL |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `event_type` | VARCHAR(100) | NOT NULL |
| `event_value` | NUMERIC | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

- INDEX `idx_ab_test_conversions_test` ON (test_id, variant_id)
- INDEX `idx_ab_test_conversions_user` ON (user_id, test_id)

#### Таблица `analytics_events` (новая в 002)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `event_id` | UUID | PK |
| `event_type` | VARCHAR(100) | NOT NULL |
| `user_id` | UUID | FK -> users(id) ON DELETE SET NULL |
| `session_id` | VARCHAR(100) | |
| `timestamp` | TIMESTAMP | NOT NULL DEFAULT NOW() |
| `properties` | JSONB | DEFAULT '{}' |
| `platform` | VARCHAR(50) | |
| `client_version` | VARCHAR(50) | |

- INDEX `idx_analytics_events_type` ON (event_type, timestamp DESC)
- INDEX `idx_analytics_events_user` ON (user_id, timestamp DESC)
- INDEX `idx_analytics_events_time` ON (timestamp DESC)

#### Таблица `leaderboard_total_mass` (новая в 007)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | PK, FK -> users(id) ON DELETE CASCADE |
| `total_mass` | INTEGER | NOT NULL DEFAULT 0 |
| `matches_played` | INTEGER | NOT NULL DEFAULT 0 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- INDEX `idx_leaderboard_total_mass_ranking` ON (total_mass DESC)
- TRIGGER `update_leaderboard_total_mass_updated_at`

#### Таблица `leaderboard_best_mass` (новая в 007)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | PK, FK -> users(id) ON DELETE CASCADE |
| `best_mass` | INTEGER | NOT NULL DEFAULT 0 |
| `best_match_id` | UUID | FK -> match_results(match_id) ON DELETE SET NULL |
| `players_in_match` | INTEGER | NOT NULL DEFAULT 0 |
| `achieved_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

- INDEX `idx_leaderboard_best_mass_ranking` ON (best_mass DESC)
- TRIGGER `update_leaderboard_best_mass_updated_at`

#### Таблица `rating_awards` (новая в 007)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `match_id` | UUID | NOT NULL, FK -> match_results(match_id) ON DELETE CASCADE |
| `awarded_at` | TIMESTAMP | DEFAULT NOW() |

- PK (`user_id`, `match_id`)
- INDEX `idx_rating_awards_user` ON (user_id, awarded_at DESC)
- INDEX `idx_rating_awards_match` ON (match_id)

#### Таблица `oauth_links` (новая в 007)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `auth_provider` | VARCHAR(20) | NOT NULL |
| `provider_user_id` | VARCHAR(255) | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

- UNIQUE (`auth_provider`, `provider_user_id`) -- constraint `unique_oauth_provider_user`
- INDEX `idx_oauth_links_user` ON (user_id)
- INDEX `idx_oauth_links_provider` ON (auth_provider, provider_user_id)

#### Таблица `admin_users` (новая в 009)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `totp_secret_encrypted` | VARCHAR(255) | |
| `totp_enabled` | BOOLEAN | DEFAULT false |
| `role` | VARCHAR(20) | DEFAULT 'admin' |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

#### Таблица `admin_sessions` (новая в 009)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL, FK -> admin_users(id) ON DELETE CASCADE |
| `refresh_token_hash` | VARCHAR(255) | NOT NULL |
| `ip` | VARCHAR(64) | |
| `user_agent` | VARCHAR(255) | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `expires_at` | TIMESTAMP | NOT NULL |

- INDEX `idx_admin_sessions_user_created` ON (user_id, created_at DESC)
- INDEX `idx_admin_sessions_expires` ON (expires_at)
- INDEX `idx_admin_sessions_refresh_token_hash` ON (refresh_token_hash)

#### Таблица `audit_log` (пересоздана в 009)
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `id` | BIGSERIAL | PK |
| `user_id` | UUID | FK -> admin_users(id) ON DELETE SET NULL |
| `action` | VARCHAR(50) | NOT NULL |
| `target` | VARCHAR(100) | |
| `ip` | VARCHAR(64) | |
| `timestamp` | TIMESTAMP | DEFAULT NOW() |
| `details_json` | JSONB | |

- INDEX `idx_audit_log_timestamp` ON (timestamp DESC)
- INDEX `idx_audit_log_user_timestamp` ON (user_id, timestamp DESC)
- INDEX `idx_audit_log_action` ON (action)

> **Примечание:** Миграция 009 полностью пересоздала audit_log. Оригинал (001) имел `actor_user_id` (FK -> users), `payload`, `created_at`. Новый -- `user_id` (FK -> admin_users), `details_json`, `timestamp`. Данные из старой таблицы мигрированы с user_id = NULL.

#### Таблица `configs`
| Столбец | Тип | Ограничения |
|---------|-----|-------------|
| `config_version` | VARCHAR(50) | PK |
| `state` | VARCHAR(20) | NOT NULL |
| `checksum` | VARCHAR(100) | NOT NULL |
| `payload` | JSONB | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `activated_at` | TIMESTAMP | |

Миграция 001 вставляет дефолтную конфигурацию v1.0.0 с `ON CONFLICT DO NOTHING`.

#### Вспомогательные объекты
- **Расширение:** `uuid-ossp` (для `uuid_generate_v4()`)
- **Функция:** `update_updated_at_column()` -- триггерная функция, автообновление `updated_at`
- **Триггеры:** на users, profiles, wallets, ab_tests, leaderboard_total_mass, leaderboard_best_mass

### 3.3 Миграции (последовательность, идемпотентность)

| # | Файл | Содержание |
|---|------|-----------|
| 001 | `001_initial_schema.sql` | Базовая схема: 16 таблиц, индексы, триггеры, seed config v1.0.0 |
| 002 | `002_stage_c_monetization.sql` | A/B тесты (пересоздание), analytics_events, рефакторинг purchase_receipts |
| 007 | `007_meta_gameplay_tables.sql` | Лидерборды (total_mass, best_mass), rating_awards, oauth_links |
| 008 | `008_meta_gameplay_columns.sql` | Колонки для анонимных пользователей (is_anonymous, registration_*, guest_subject_id) |
| 009 | `009_admin_tables.sql` | admin_users, admin_sessions, пересоздание audit_log |
| 010 | `010_fix_audit_log_schema.sql` | No-op (фикс интегрирован в 009) |

**Механизм миграций (migrate.ts):**
- Читает все `.sql` из директории `migrations/`, сортирует по имени, выполняет последовательно.
- **Нет таблицы миграций** (`schema_migrations` или аналога). Идемпотентность обеспечивается на уровне SQL: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `DO $$ ... END $$` блоки с проверками.
- **Пропуск миграций 003-006:** нумерация нарушена, миграции 003-006 отсутствуют. Вероятно удалены или никогда не существовали.
- При ошибке миграция бросает исключение (process.exit(1) при вызове как standalone).
- Может запускаться как модуль (`runMigrations()`) или как CLI (`node dist/server/src/db/migrate.js`).
- Скрипт в server/package.json: `"db:migrate": "node dist/server/src/db/migrate.js"`.

---

## 4. Redis

Файл: `server/src/db/pool.ts` (инициализация) + `server/src/db/redis.ts` (ре-экспорт).

```typescript
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
```

**Захардкоженные значения:**
- Дефолтный `REDIS_URL`: `redis://localhost:6379`
- Без параметров пула, без maxRetries, без reconnect strategy

**Использование в коде (по grep):**

| Сервис | Файл | Назначение |
|--------|------|-----------|
| `ABTestService` | `server/src/meta/services/ABTestService.ts` | Кеш вариантов A/B тестов |
| `auth routes` | `server/src/meta/routes/auth.ts` | Rate limiting (3+ вызова) |
| `AdsService` | `server/src/meta/services/AdsService.ts` | Rate limiting рекламных наград |
| `AnalyticsService` | `server/src/meta/services/AnalyticsService.ts` | Буфер/кеш аналитических событий |
| `MatchmakingService` | `server/src/meta/services/MatchmakingService.ts` | Очередь матчмейкинга |

**Назначение по факту:**
1. **Rate limiting** -- ограничение частоты запросов auth и ads.
2. **Кеш** -- A/B тест варианты, аналитика.
3. **Очередь** -- матчмейкинг.
4. **НЕ используется для:** сессий (хранятся в PostgreSQL), pub/sub (не обнаружено).

---

## 5. RNG (rng.ts)

Файл: `server/src/utils/rng.ts`

Реализация: **Linear Congruential Generator (LCG)** из Numerical Recipes.

```typescript
export class Rng {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;  // Приведение к unsigned 32-bit
    }

    next(): number {
        // LCG: state = (state * a + c) mod 2^32
        this.state = (this.state * 1664525 + 1013904223) >>> 0;
        return this.state / 0x100000000;  // Нормализация в [0, 1)
    }

    range(min: number, max: number): number {
        return min + (max - min) * this.next();
    }

    int(min: number, max: number): number {
        return Math.floor(this.range(min, max));
    }
}
```

**Константы LCG:**
| Параметр | Значение | Описание |
|----------|---------|----------|
| Multiplier `a` | 1664525 | Из Numerical Recipes |
| Increment `c` | 1013904223 | Из Numerical Recipes |
| Modulus `m` | 2^32 (через `>>> 0`) | 32-bit unsigned |

**Операции:**
- `next()` -- float в [0, 1)
- `range(min, max)` -- float в [min, max)
- `int(min, max)` -- integer в [min, max) (не включая max)

**Детерминизм:** гарантируется одинаковым seed на сервере. Seed задаётся при создании ArenaRoom. Используется для генерации арены, спавна орбов, позиций и всего, что требует воспроизводимости.

---

## 6. Config Loading

Файл: `server/src/config/loadBalanceConfig.ts`

**Алгоритм поиска `balance.json`:**

Перебирает 4 кандидата (paths) в порядке приоритета:

1. `__dirname/../../../config/balance.json` -- dev: от `server/src/config/` вверх на 3 уровня до корня проекта
2. `__dirname/../../../../../config/balance.json` -- prod: от `server/dist/server/src/config/` вверх на 5 уровней
3. `process.cwd()/config/balance.json` -- fallback на cwd
4. `process.cwd()/../config/balance.json` -- fallback на уровень выше cwd

Первый найденный файл используется. Если ни один не найден -- бросает Error с перечислением всех проверенных путей.

**Парсинг и валидация:**
```typescript
export function loadBalanceConfig(configPath = DEFAULT_CONFIG_PATH): ResolvedBalanceConfig {
    const raw = fs.readFileSync(configPath, "utf-8");
    const data = JSON.parse(raw);
    return resolveBalanceConfig(data);  // из @slime-arena/shared
}
```

Функция `resolveBalanceConfig()` определена в `shared/src/config.ts` (строка 1733). Она парсит raw JSON и применяет дефолтные значения.

**Захардкоженные значения:**
- Пути поиска (4 кандидата)
- Путь к файлу кешируется при инициализации модуля (`DEFAULT_CONFIG_PATH`)

---

## 7. Telemetry

Файл: `server/src/telemetry/TelemetryService.ts`

**Формат события:**
```typescript
type TelemetryEvent = {
    event: string;
    ts: number;        // timestamp
    tick: number;       // игровой тик
    matchId: string;
    roomId: string;
    phase?: string;     // фаза матча
    playerId?: string;
    data?: Record<string, unknown>;
};
```

**Куда записывается:** Локальные JSONL-файлы в `server/logs/telemetry-YYYY-MM-DD.jsonl`.

**Настройки:**
| Параметр | Дефолт | Описание |
|----------|--------|----------|
| `enabled` | true | Включена ли телеметрия |
| `logDir` | `../../logs` (от __dirname) | Директория логов |
| `flushEvery` | 20 | Количество событий до принудительного flush |
| `flushIntervalMs` | 2000 (мин. 250) | Интервал автоматического flush |

**Механизм:**
1. События накапливаются в очереди `queue[]`.
2. Flush при достижении `flushEvery` событий или по таймеру `flushIntervalMs`.
3. Запись через `fs.appendFileSync()` (синхронно!).
4. При ошибке записи телеметрия отключается навсегда.
5. Таймер `unref()` -- не мешает завершению процесса.

**Использование:** Создаётся в `ArenaRoom` (server/src/rooms/ArenaRoom.ts, строка 188).

**Захардкоженные значения:**
- `flushEvery: 20`
- `flushIntervalMs: 2000`
- Путь по умолчанию: `../../logs` от __dirname

---

## 8. Docker

### 8.1 app.Dockerfile (сборка, слои, entrypoint)

**Базовый образ:** `node:20-alpine`

**Stage 1: builder**
- Устанавливает build-зависимости: `python3 make g++` (для native modules типа bcrypt)
- Копирует package.json файлы для кеширования слоёв
- `npm ci` (все зависимости)
- Копирует source code
- Сборка: `sync-version.js` -> shared -> server -> client -> admin-dashboard
- Копирует SQL-миграции в dist (не компилируются tsc)

**Stage 2: runtime**
- `npm ci --omit=dev` (только production)
- Копирует built artifacts из builder
- Копирует config/ дважды: в корень и в `server/dist/config` (для loadBalanceConfig)
- Устанавливает `serve` и `concurrently` глобально
- Порты: 3000, 2567, 5173, 5175
- HEALTHCHECK: `wget -qO- http://localhost:3000/health` (30s interval, 10s timeout, 15s start-period)
- CMD: `concurrently` запускает 4 процесса: META, MATCH, CLIENT, ADMIN

**Entrypoint (CMD):**
```
concurrently --kill-others --success first:
  - node server/dist/server/src/meta/server.js      (MetaServer)
  - node server/dist/server/src/index.js              (MatchServer)
  - serve -s client/dist -l 5173                      (Client)
  - serve admin-dashboard/dist -c serve.json -l 5175  (Admin)
```

**OCI Labels:** version=0.8.7, vendor=komleff, source=github.com/komleff/slime-arena

### 8.2 db.Dockerfile

**Базовый образ:** `alpine:3.19` (не node!)

**Установка:**
- PostgreSQL 16 + contrib
- Redis
- supervisord
- su-exec

**Entrypoint:** `/entrypoint.sh` (entrypoint-db.sh)

Порядок инициализации:
1. Init PGDATA если нет `PG_VERSION`
2. Настройка `pg_hba.conf` (md5 для всех)
3. Временный запуск PG, создание user/database
4. Загрузка seed-data.sql (только для свежей БД)
5. Остановка PG
6. Запуск supervisord (PG + Redis)

**Volumes:** `/var/lib/postgresql/data`, `/var/lib/redis`

**Дефолтные credentials:**
- POSTGRES_USER=slime
- POSTGRES_PASSWORD=slime_dev_password
- POSTGRES_DB=slime_arena

### 8.3 docker-compose (сервисы, volumes, networking)

#### docker-compose.app-db.yml (PRODUCTION)

| Сервис | Image | Порты | Зависимости |
|--------|-------|-------|-------------|
| `db` | ghcr.io/komleff/slime-arena-db:${VERSION:-0.8.7} | (нет внешних) | - |
| `app` | ghcr.io/komleff/slime-arena-app:${VERSION:-0.8.7} | 3000, 2567, 5173, 5175 | db (service_healthy) |

Volumes: `slime-arena-pgdata`, `slime-arena-redisdata`

Env-переменные app:
- `DATABASE_URL`, `REDIS_URL` (указывают на `db`)
- `JWT_SECRET`, `MATCH_SERVER_TOKEN`, `CLAIM_TOKEN_TTL_MINUTES`
- `ADMIN_ENCRYPTION_KEY` (обязательный, без дефолта!)
- OAuth: YANDEX_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET, OAUTH_*_ENABLED

#### docker-compose.yml (DEV)

5 отдельных сервисов: postgres, redis, meta-server, match-server, client.
Использует monolith-full.Dockerfile для сборки серверов.
Dev-volumes монтируют source code.

#### docker-compose.monolith-full.yml

1 сервис `monolith` с тем же набором env и volumes что и app-db, но всё в одном контейнере.

#### docker-compose-db-only.yml

2 отдельных сервиса: postgres (16-alpine), redis (7-alpine). Seed-data монтируется через volume.

### 8.4 supervisord.conf (процессы внутри контейнера)

**supervisord.conf (monolith-full):**

| Program | Priority | Command | User | startsecs |
|---------|----------|---------|------|-----------|
| postgresql | 1 | `/usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data` | postgres | 5 |
| redis | 2 | `redis-server --daemonize no --bind 127.0.0.1 --save "" --stop-writes-on-bgsave-error no` | redis | 2 |
| meta | 10 | `node server/dist/server/src/meta/server.js` | node | 3 |
| match | 10 | `node server/dist/server/src/index.js` | node | 3 |
| client | 10 | `serve -s client/dist -l 5173 --no-clipboard` | node | 2 |
| admin | 10 | `serve -c admin-dashboard/serve.json -l 5175 --no-clipboard` | node | 2 |

Все с `autorestart=true`, логи на stdout/stderr.

Redis bind `127.0.0.1` -- только localhost (в monolith все процессы в одном контейнере).

**supervisord-db.conf:**

Только postgresql (priority 1) и redis (priority 2). Redis bind `0.0.0.0 --protected-mode no` -- доступен из app-контейнера.

**Разница bind в Redis:**
- monolith: `127.0.0.1` (внутренний)
- db-контейнер: `0.0.0.0 --protected-mode no` (открыт для app-контейнера)

**Захардкоженные credentials в supervisord.conf (monolith):**
- `DATABASE_URL="postgresql://slime:slime_dev_password@127.0.0.1:5432/slime_arena"`
- `REDIS_URL="redis://127.0.0.1:6379"`
- `CLAIM_TOKEN_TTL_MINUTES="30"`

---

## 9. CI/CD

### 9.1 ci.yml (build pipeline)

**Триггер:** Pull Request в `main`.

**Шаги:**
1. Checkout
2. Setup Node.js **18** (!)
3. `npm ci`
4. `npm run build`

**Нет:** тестов, линтинга, кеширования Docker layers, деплоя.

**Проблема:** CI использует Node 18, а Docker-образы используют Node 20. Расхождение версий.

### 9.2 publish-containers.yml (container publish)

**Триггер:** Push в `main`, теги `v*`, workflow_dispatch с опциональным version.

**Шаги:**
1. Checkout
2. QEMU + Buildx (для multi-platform)
3. Login в GHCR (`ghcr.io`)
4. Build + push app-образа (docker/app.Dockerfile)
5. Build + push db-образа (docker/db.Dockerfile)
6. Print summary

**Платформы:** `linux/amd64`, `linux/arm64`

**Кеш:** GitHub Actions cache (`type=gha, mode=max`)

**Тегирование:**
- По бранчу (ref/branch)
- По тегу (ref/tag, semver)
- `latest` для default branch
- Manual version при workflow_dispatch

**Registry:** `ghcr.io/komleff/slime-arena-app`, `ghcr.io/komleff/slime-arena-db`

### 9.3 branch-protection.yml

**Триггер:** Push в `main`.

Проверяет, что push пришёл через merged PR (commit message содержит "Merge pull request" или "(#NNN)"). При прямом push -- fail с предупреждением.

### 9.4 make-packages-public.yml

**Триггер:** Только workflow_dispatch (ручной).

Делает container packages публичными через GitHub API. Ссылается на устаревшие имена (`slime-arena-server`, `slime-arena-client`), а не актуальные (`slime-arena-app`, `slime-arena-db`).

---

## 10. npm Workspaces

**Корневой package.json:**
```json
{
  "name": "slime-arena",
  "version": "0.8.6",
  "workspaces": ["client", "server", "shared", "admin-dashboard"]
}
```

| Workspace | Name | Version | Зависит от |
|-----------|------|---------|-----------|
| shared | @slime-arena/shared | 0.8.7 | -- (только devDeps: typescript) |
| server | @slime-arena/server | 0.8.7 | @slime-arena/shared |
| client | @slime-arena/client | 0.8.7 | @slime-arena/shared, colyseus.js, preact, howler |
| admin-dashboard | slime-arena-admin-dashboard | 0.8.7 | preact, @preact/signals |

**Build order:** `shared` -> `server` -> `client` -> `admin-dashboard` (зафиксирован в root build script)

**Ключевые зависимости server:**
- colyseus ^0.15.0, express ^4.18.0
- pg ^8.11.0, redis ^4.6.0
- bcrypt ^5.1.1, jsonwebtoken ^9.0.3
- otpauth ^9.2.2, qrcode ^1.5.3 (для TOTP 2FA в admin)
- dotenv ^17.2.3

**Dev-скрипты:**
- `npm run dev` -- concurrently запускает meta, match, client
- `npm run build` -- последовательная сборка всех workspaces
- `npm run test` -- запускает тесты по всем workspaces (determinism, orb-bite, arena-generation)

---

## 11. Захардкоженные значения

| Значение | Файл | Описание |
|----------|------|----------|
| `postgresql://slime:slime_dev_password@localhost:5432/slime_arena` | pool.ts, migrate.ts | Дефолтный DATABASE_URL |
| `redis://localhost:6379` | pool.ts | Дефолтный REDIS_URL |
| `max: 20` | pool.ts | Размер пула PG-соединений |
| `idleTimeoutMillis: 30000` | pool.ts | Таймаут idle PG-соединения |
| `connectionTimeoutMillis: 5000` | pool.ts | Таймаут подключения PG |
| `1664525`, `1013904223` | rng.ts | Константы LCG из Numerical Recipes |
| `0x100000000` | rng.ts | Модуль LCG (2^32) |
| `flushEvery: 20` | TelemetryService.ts | Порог событий до flush |
| `flushIntervalMs: 2000` | TelemetryService.ts | Интервал auto-flush |
| `../../logs` | TelemetryService.ts | Дефолтная директория логов |
| `slime_dev_password` | supervisord.conf, entrypoint-full.sh | Пароль PG в monolith |
| `CLAIM_TOKEN_TTL_MINUTES="30"` | supervisord.conf | TTL claim-токенов |
| `dev-server-token` | docker-compose*.yml | Дефолтный MATCH_SERVER_TOKEN |
| `dev-jwt-secret-change-in-prod` | docker-compose*.yml | Дефолтный JWT_SECRET |
| Node 18 | ci.yml | Версия Node в CI (отличается от Docker) |
| Node 20 | Dockerfiles | Версия Node в production |
| `0.8.7` | Dockerfiles, compose | Дефолтная версия образов |

---

## 12. Расхождения с документацией

### Расхождения с Architecture-v4.2.5-Part4.md

| Аспект | Документация | Реальность | Критичность |
|--------|-------------|-----------|-------------|
| **ab_tests PK** | PK (user_id, test_id) -- назначение пользователя | PK (test_id) -- справочник тестов, отдельная таблица ab_test_conversions | Высокая -- полностью другая структура |
| **purchase_receipts** | Столбцы: operation_id, provider, receipt_payload, verified_at | Столбцы удалены в 002, добавлены: offer_id, price_amount, platform_transaction_id, metadata | Высокая -- схема не соответствует документации |
| **audit_log** | PK UUID, actor_user_id -> users, payload, created_at | PK BIGSERIAL, user_id -> admin_users, details_json, timestamp | Средняя -- пересоздана для admin dashboard |
| **analytics_events** | Не описана в Part4 | Существует (002) | Низкая -- доп. таблица |
| **ab_test_conversions** | Не описана | Существует (002) | Низкая -- доп. таблица |
| **leaderboard_*_mass** | Не описаны | Существуют (007) | Низкая -- новый функционал |
| **rating_awards** | Не описана | Существует (007) | Низкая -- идемпотентность |
| **oauth_links** | Не описана | Существует (007) | Низкая -- мультипровайдер |
| **admin_users, admin_sessions** | Не описаны | Существуют (009) | Низкая -- admin dashboard |
| **users** | Нет колонок is_anonymous, registration_* | Добавлены в 008 | Низкая -- расширение |
| **match_results** | Нет guest_subject_id, claim_consumed_at | Добавлены в 008 | Низкая -- расширение |
| **ORM** | techContext.md: "Prisma" | Нет Prisma в зависимостях, используется raw pg Pool | Средняя -- документация устарела |
| **Версии** | techContext.md ссылается на v0.5.2 для Docker | Реально v0.8.7 | Низкая -- устарело |
| **Монолит в CI** | make-packages-public.yml ссылается на slime-arena-server/client | Реальные образы: slime-arena-app/db | Средняя -- workflow не обновлён |

### Расхождения с .memory_bank/techContext.md

| Аспект | techContext.md | Реальность |
|--------|---------------|-----------|
| ORM | Prisma | Raw pg Pool (нет Prisma) |
| Redis | "опционально" | Обязателен (rate limiting, matchmaking, A/B cache) |
| Docker версия | v0.5.2 | v0.8.7 |
| Порт Admin | Не упомянут | 5175 |

---

## 13. Технический долг

1. **Нет таблицы миграций.** Идемпотентность миграций обеспечивается IF NOT EXISTS / IF EXISTS в SQL. Это хрупко: если миграция частично провалится, повторный запуск может дать непредсказуемый результат. Рекомендуется добавить `schema_migrations` таблицу.

2. **Пропущена нумерация миграций 003-006.** Неясно, были ли удалены или никогда не существовали. Создаёт путаницу.

3. **Захардкоженные credentials в supervisord.conf и entrypoint-full.sh.** Пароль `slime_dev_password` и user `slime` не параметризованы через env vars в monolith-конфигурации.

4. **Node 18 в CI vs Node 20 в Docker.** CI тестирует на другой версии Node, чем production. Может скрывать баги, связанные с различиями V8.

5. **make-packages-public.yml устарел.** Ссылается на `slime-arena-server` и `slime-arena-client`, а не на актуальные `slime-arena-app` и `slime-arena-db`.

6. **Телеметрия пишет синхронно** (`fs.appendFileSync`). При большом количестве событий может блокировать event loop. Рекомендуется `fs.appendFile` (async) или stream.

7. **Redis без reconnect strategy.** При разрыве соединения клиент не пытается переподключиться (дефолтное поведение `redis` v4 -- throw).

8. **PG Pool max=20 захардкожен.** Не настраивается через env. Для production может быть недостаточно или избыточно.

9. **Нет тестов в CI.** Workflow `ci.yml` делает только build, не запускает `npm run test`.

10. **purchase_receipts: деструктивная миграция.** Миграция 002 удаляет столбцы (`DROP COLUMN`), что делает невозможным откат без потери данных.

11. **Дублирование config/ в Dockerfile.** config/ копируется в два места (корень и server/dist/config). Лучше использовать symlink или единый путь.

12. **Версия в корневом package.json (0.8.6) отстаёт от workspaces (0.8.7).** Рассинхрон версий.

13. **Отсутствует health check для Redis.** В app-db compose проверяется только PG (`pg_isready`), Redis не проверяется в db-контейнере healthcheck.

---

## 14. Заметки для форка BonkRace

### Что переиспользуется целиком:
- **Docker-инфраструктура:** app.Dockerfile, db.Dockerfile, supervisord.conf -- структура идентична, rename образов.
- **Система миграций** (migrate.ts) -- механизм работы не зависит от содержания SQL.
- **RNG** (rng.ts) -- чистый LCG, не привязан к домену.
- **TelemetryService** -- универсальный, формат события абстрактный.
- **loadBalanceConfig** -- паттерн поиска конфига переиспользуется, но `resolveBalanceConfig` привязан к Slime Arena balance schema.
- **Pool/Redis инициализация** -- полностью generic.
- **CI/CD workflows** -- структура переиспользуется, rename repo/images.

### Что нужно адаптировать:
- **БД-схема:** Убрать slime-специфичные таблицы (leaderboard_*_mass, battlepass_progress, mission_progress). Добавить BonkRace-специфичные.
- **Миграции:** Написать новую 001_initial_schema.sql с нужными таблицами. Общие таблицы (users, sessions, profiles, wallets, transactions) можно взять за основу.
- **seed-data.sql:** Полностью заменить.
- **Docker images:** Rename:
  - `slime-arena-app` -> `bonkrace-app`
  - `slime-arena-db` -> `bonkrace-db`
  - Registry: `ghcr.io/komleff/bonkrace-*`
- **docker-compose:** Rename контейнеров, volumes (`bonkrace-pgdata`, `bonkrace-redisdata`).
- **CI/CD:** Rename в workflows, обновить IMAGE_NAME_APP/DB.
- **Env vars:** Те же (DATABASE_URL, REDIS_URL, JWT_SECRET и т.д.), но ADMIN_ENCRYPTION_KEY и MATCH_SERVER_TOKEN генерировать заново.
- **balance.json:** Полностью новый файл. `resolveBalanceConfig` из shared нужно переписать.
- **npm workspaces:** Rename пакетов (`@bonkrace/shared`, `@bonkrace/server`, `@bonkrace/client`).
