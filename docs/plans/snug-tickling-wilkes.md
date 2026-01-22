# План реализации мета-геймплея — Спринт 13

**Дата создания:** 23 января 2026
**Project Manager:** Claude Sonnet 4.5
**Статус:** В ожидании утверждения

---

## Метаданные плана

**Спринт:** 13 (27.01-02.02)
**Длительность:** 1 неделя (7 дней)
**Базовая ветка:** `sprint-13/meta-gameplay`
**Worktree:** `d:/slime-arena-meta/`
**ТЗ:** `docs/meta-min/TZ-MetaGameplay-v1.9` (Index, Core, Backend, Client)
**Текущая версия:** v0.6.0 → **Целевая версия:** v0.7.0

---

## Роль Project Manager (PM)

### Миссия
Организовать и координировать работу ИИ-агентов (кодеров и ревьюверов) для реализации мета-геймплея в срок и с высоким качеством.

### Обязанности

1. **Планирование:**
   - Разбить ТЗ на спринты и задачи в Beads
   - Определить зависимости между задачами
   - Учесть риски и критические пути

2. **Управление исполнением:**
   - Создать задачи в Beads для каждой фазы
   - Запускать Developer агентов с четкими промптами
   - Следить за прогрессом и дедлайнами

3. **Организация ревью:**
   - После завершения кодирования: создать PR
   - Запустить 3 ревьювера параллельно (Opus 4.5, Codex, Gemini)
   - GitHub Copilot запускается автоматически
   - Собрать все отчеты ревьюверов

4. **Координация доработок:**
   - Проанализировать замечания от всех ревьюверов
   - Создать промпт для Developer с конкретными исправлениями
   - Запустить цикл ревью заново до получения APPROVED от всех

5. **Финализация:**
   - Когда все ревьюверы одобрили: подготовить ветку к мержу
   - Написать итоговый отчет о спринте
   - Передать PR оператору-человеку для ручного мержа

### Ограничения

- ❌ НЕ мержит PR самостоятельно (это делает оператор-человек)
- ❌ НЕ пишет код напрямую (делегирует Developer)
- ❌ НЕ ревьювит код самостоятельно (запускает ревьюверов)
- ✅ Только координация, планирование, отчетность

### Промпт-шаблоны для Developer

**Структура делегирования задачи:**

```markdown
Промпт для Developer:

## Контекст
- Спринт: 13 (мета-геймплей)
- Фаза: [1/2/3]
- Beads ID: [beads-xxx]
- Зависимости: [список завершённых задач]

## Задача: [краткое название]
[Детальное описание из плана — скопировать раздел "Что нужно сделать"]

## Критерии приёмки
[Список из плана]

## Критические файлы
[Список файлов из плана]

## Ограничения
- Детерминизм: использовать только Rng из server/src/utils/rng.ts
- Баланс: все числа в config/balance.json
- Mobile-First: никаких CSS-градиентов в анимации
- Код-стиль: следовать CLAUDE.md и .beads/AGENT_ROLES.md

## Верификация
[Команды из плана для проверки]

ВАЖНО: После завершения запусти верификацию и обнови статус задачи в Beads (`bd close <id>`).
```

**Пример делегирования:**
```typescript
// PM запускает Developer через Task tool:
Task({
  subagent_type: "general-purpose",
  description: "Implement DB migration 007",
  prompt: `[Промпт выше с заполненными значениями для Задачи 1.1]`
})
```

### Синтез отзывов ревьюверов

**Приоритизация отзывов:**

1. **Если хотя бы один ревьювер выдал CHANGES_REQUESTED:**
   - Собрать ВСЕ замечания P0 и P1 от всех ревьюверов
   - Удалить дубликаты (одинаковые замечания от разных ревьюверов)
   - Сгруппировать по файлам

2. **Конфликт-резолюция:**
   - Если Opus и Codex противоречат друг другу → приоритет у Codex (более тщательный)
   - Если Gemini противоречит Opus/Codex → игнорировать Gemini (оптимист, может ошибаться)
   - Если все 3 модели противоречат → эскалировать оператору-человеку

3. **Формат сводного отчёта для Developer:**

```markdown
## Сводный отчёт ревью (Sprint 13, Фаза X)

### Статус
- Opus 4.5: CHANGES_REQUESTED (2 P0, 1 P1)
- Codex 5.2: CHANGES_REQUESTED (1 P0, 3 P1)
- Gemini 3 Pro: APPROVED ✅
- GitHub Copilot: CHANGES_REQUESTED (5 P2)

### Критические проблемы (P0) — ОБЯЗАТЕЛЬНО ИСПРАВИТЬ
1. `server/src/meta/routes/authRoutes.ts:142` — [Opus + Codex]
   - SQL-инъекция в query для oauth_links
   - Решение: использовать параметризованные запросы

2. `server/src/meta/utils/jwtUtils.ts:56` — [Codex]
   - JWT secret захардкожен в коде
   - Решение: читать из process.env.JWT_SECRET

### Важные проблемы (P1) — ЖЕЛАТЕЛЬНО ИСПРАВИТЬ
[аналогично]

### Желательные улучшения (P2) — ПО ВРЕМЕНИ
[аналогично]

### Действия для Developer
1. Исправить P0 замечания
2. Исправить P1 замечания
3. Commit + push
4. PM запустит ревью заново
```

### Прогресс-трекинг

**Ежедневный чек-лист PM:**

```bash
# Утро (начало рабочего дня)
bd list --status=in_progress  # Проверить активные задачи
bd blocked                    # Проверить заблокированные задачи
bd stats                      # Общая статистика

# В процессе работы
bd show <issue-id>            # Детали задачи Developer
bd update <id> --notes="Status update from Developer" # Обновить заметки

# Вечер (конец рабочего дня)
bd list --status=completed --since=today  # Что завершено сегодня
# Написать дневной отчёт (см. ниже)
```

**Критерии завершённости задачи:**

Задача считается завершённой когда:
- [ ] Код написан и прошёл верификацию (команды из плана)
- [ ] `npm run build` проходит без ошибок
- [ ] Unit/Integration тесты проходят (если требуются)
- [ ] Детерминизм сохранён (для server-side кода)
- [ ] Developer закрыл задачу в Beads (`bd close <id>`)
- [ ] Код запушен в ветку спринта

**Метрики спринта:**

```
Фаза 1 (БД):        [▓▓▓▓░] 4/4 задач (100%)
Фаза 2 (API):       [▓▓░░░] 2/9 задач (22%)
Фаза 3 (Client):    [░░░░░] 0/9 задач (0%)
────────────────────────────────────────
Всего:              [▓▓░░░] 6/25 задач (24%)
Заблокировано:      2 задачи (зависят от Фазы 1)
Время до дедлайна:  5 дней
```

### Эскалация

**Процедуры обработки проблем:**

**1. Developer заблокирован (не может решить задачу):**
   - Проверить зависимости: `bd show <id>` → все ли зависимости завершены?
   - Если зависимости готовы, но Developer застрял:
     - Запустить второго Developer с тем же промптом (параллельная попытка)
     - Сравнить результаты
     - Выбрать лучший или объединить подходы
   - Если оба застряли:
     - Эскалировать оператору-человеку через AskUserQuestion

**2. Ревьюверы выдают противоречивые замечания:**
   - Приоритет: Codex > Opus > Gemini > Copilot (по надёжности)
   - Если Codex и Opus противоречат:
     - Создать промпт для Developer с обоими вариантами
     - Developer выбирает на основе контекста проекта
     - PM проверяет соответствие GDD и архитектуре
   - Если не может разрешить:
     - Эскалировать оператору-человеку

**3. Все ревьюверы выдали CHANGES_REQUESTED после 3+ итераций:**
   - Проверить, не системная ли проблема (например, ошибка в плане)
   - Пересмотреть подход к задаче
   - При необходимости: переформулировать задачу, обновить план
   - Эскалировать оператору-человеку если проблема не решается

**4. Дедлайн под угрозой:**
   - Если прогресс < 30% на половине спринта:
     - Пересмотреть scope (можно ли вырезать P1/P2 задачи?)
     - Запускать Developer агентов параллельно (если задачи независимы)
     - Эскалировать оператору-человеку

### Коммуникация и отчётность

**Формат дневного отчёта (в `.memory_bank/progress.md`):**

```markdown
## Sprint 13 Progress — [дата]

### Завершено сегодня
- [x] beads-xxx: Задача 1.1 — Миграция БД (новые таблицы)
- [x] beads-yyy: Задача 1.2 — Миграция БД (изменения колонок)

### В работе
- [ ] beads-zzz: Задача 1.3 — Модели данных (Developer: 60% готово)

### Заблокировано
- [ ] beads-aaa: Задача 2.1 — JWT utils (ждёт завершения 1.3)

### Проблемы
- Нет

### Следующий шаг
- Завершить Задачу 1.3
- Начать Задачу 1.4 и 2.1 параллельно
```

**Формат финального отчёта спринта:**

```markdown
## Sprint 13 Final Report

### Результаты
- **Статус:** ✅ COMPLETED / ⚠️ PARTIAL / ❌ FAILED
- **Scope выполнен:** 25/25 задач (100%)
- **Все P0 задачи из ТЗ:** ✅ реализованы
- **Ревью:** APPROVED от всех 4 ревьюверов
- **Тесты:** ✅ проходят
- **Детерминизм:** ✅ сохранён

### Метрики
- Длительность: 7 дней (27.01-02.02)
- Задач создано: 25
- Задач завершено: 25
- PR: 1 (или 3 если по фазам)
- Итераций ревью: 2 (среднее)
- Строк кода: ~3500 (backend) + ~2000 (client)

### Критические файлы изменены
[Список из плана]

### Документация обновлена
- [x] SlimeArena-Architecture-v4.2.5-Part4.md
- [x] SlimeArena-UI-TZ-v1.6.2.md
- [x] SlimeArena-ScreenMap-v1.6.1.md
- [x] .memory_bank/activeContext.md

### Верификация end-to-end
- [x] Гостевой режим: работает
- [x] Telegram silent auth: работает
- [x] OAuth вход: работает
- [x] claimToken: работает
- [x] Завершение профиля: работает (оба режима)
- [x] Рейтинги: начисляются корректно
- [x] LeaderboardScreen: работает (обе вкладки)

### Риски реализованные
- OAuth интеграция — успешно (использованы SDK)
- Миграции БД — без конфликтов (worktree изоляция)
- Размер бандла — 142 kB gzip (в пределах нормы)

### Рекомендации для оператора
- PR готов к ревью и мержу
- После мержа: запустить миграции на продакшене
- Провести smoke-тестирование всех флоу
```

### Работа с Beads

**Создание задач из плана:**

```bash
# Фаза 1 (4 задачи)
bd create --title="DB migration: new tables" --type=task --priority=0 --description="Create leaderboard and oauth tables"
bd create --title="DB migration: alter existing tables" --type=task --priority=0 --description="Add is_anonymous, claim_consumed_at fields"
bd create --title="Data models for new tables" --type=task --priority=0 --description="TypeScript interfaces for Leaderboard, Rating, OAuth"
bd create --title="Random generators (reuse existing)" --type=task --priority=0 --description="Reuse nameGenerator.ts, create skinGenerator and validator"

# Записать ID задач:
# beads-xxx = Migration 007
# beads-yyy = Migration 008
# beads-zzz = Models
# beads-aaa = Generators

# Установить зависимости:
bd dep add beads-zzz beads-xxx  # Models зависит от Migration 007
bd dep add beads-zzz beads-yyy  # Models зависит от Migration 008

# Фаза 2 (9 задач) — аналогично
# Фаза 3 (9 задач) — аналогично

# Проверить готовые к работе:
bd ready

# Начать работу над задачей:
bd update beads-xxx --status=in_progress

# Завершить задачу:
bd close beads-xxx --reason="Migration created, tested on clean DB and v0.6.0 data"

# Проверить заблокированные:
bd blocked
```

**Синхронизация с git:**

```bash
# Beads daemon автоматически синхронизирует изменения
# Проверить статус:
bd sync --status

# Если нужно вручную синхронизировать:
git add .beads/
git commit -m "PM: update sprint 13 task statuses"
git push
```

---

## Команда ревьюверов

### Состав команды

| Ревьювер | Запуск | Скорость | Специализация |
|----------|--------|----------|---------------|
| **Claude Opus 4.5** | PM (автоматически) | Быстрый | Архитектура, детерминизм, GDD соответствие |
| **ChatGPT Codex 5.2** | PM (вручную) | Медленный | Тщательный анализ, security, edge cases |
| **Gemini 3 Pro** | PM (вручную) | Быстрый | Оптимистичные находки, UX, производительность |
| **GitHub Copilot** | Автоматически при PR | Средний | Code style, best practices, типизация |

### Workflow ревью

```
Developer → commit + push → PR created
  ↓
PM запускает ревью (параллельно):
  ├─ Opus 4.5      → отчет в PR (комментарий)
  ├─ Codex 5.2     → отчет в PR (комментарий)
  ├─ Gemini 3 Pro  → отчет в PR (комментарий)
  └─ Copilot       → автоматический отчет
  ↓
PM собирает все отчеты
  ↓
Если есть замечания P0/P1:
  → PM создает промпт для Developer с исправлениями
  → Developer исправляет → commit + push
  → PM запускает ревью заново
  ↓
Когда ВСЕ ревьюверы выдали APPROVED:
  → PM готовит PR к мержу
  → PM пишет итоговый отчет
  → Оператор-человек мержит PR вручную
```

### Формат отчета ревьювера

```markdown
## Review by [Название модели]

### Чеклист
- [x] Сборка проходит
- [x] Тесты проходят
- [x] Детерминизм сохранён
- [ ] Замечание: ...

### Замечания
1. **[P0]** `file.ts:123` — описание критической проблемы
2. **[P1]** `file.ts:456` — описание важной проблемы
3. **[P2]** `file.ts:789` — описание желательного улучшения

### Вердикт
**APPROVED** ✅
или
**CHANGES_REQUESTED** — требуется исправить P0/P1 замечания.
```

---

## Контекст проекта

### Текущее состояние
- v0.6.0 готов, завтра (23.01) Code Freeze для MVP
- 24.01 презентация MVP
- 41 открытая задача в Beads (не конфликтуют с мета-геймплеем)
- Main стабилен, все тесты проходят

### Новая задача
- ТЗ: docs/meta-min/TZ-MetaGameplay-v1.9 (4 файла: Index, Core, Backend, Client)
- **Scope:** P0 (гостевой режим + Telegram auth + рейтинги) + изменение никнейма при создании
- **Сроки:** Спринт 13 (27.01-02.02) — 1 неделя
- **Worktree:** Отдельный, изолированный от main

### Существующая архитектура (из исследования)

**Аутентификация:**
- Сервер: AuthService + AuthProviderFactory (Telegram, Dev)
- Клиент: authService.ts + PlatformManager + адаптеры
- Токены: localStorage через metaServerClient
- Эндпоинты: POST /api/v1/auth/verify, /api/v1/auth/logout

**База данных:**
- **Существует:** users, sessions, profiles, wallets, match_results
- **Нужно создать:** leaderboard_total_mass, leaderboard_best_mass, rating_awards, oauth_links
- **Нужно добавить поля:** users (is_anonymous, registration_skin_id, etc.), match_results (guest_subject_id, claim_consumed_at)

**Клиент:**
- ScreenManager (stack-based навигация)
- Экраны: MainScreen, MainMenu (Lobby), ResultsScreen
- Модали: TalentModal
- Сигналы: authToken, currentUser, currentProfile, isAuthenticated

---

## P0 задачи из ТЗ (Index.md строки 40-50)

1. ✅ PlatformManager + адаптеры — уже есть
2. ⏳ Гостевой режим (auth/guest, localStorage) — нужно реализовать
3. ⏳ Telegram silent auth (auth/telegram, is_anonymous = true) — частично есть
4. ⏳ OAuth вход (auth/oauth — только существующие аккаунты) — нужно реализовать
5. ⏳ claimToken (match-results/claim) — нужно реализовать
6. ⏳ Завершение профиля (auth/upgrade — оба режима) — нужно реализовать
7. ⏳ Накопительный рейтинг (leaderboard_total_mass) — нужно реализовать
8. ⏳ Рекордный рейтинг (leaderboard_best_mass) — нужно реализовать
9. ⏳ LeaderboardScreen с двумя вкладками — нужно реализовать

**Дополнительно (из ответа пользователя):**
- ⏳ Изменение никнейма при создании аккаунта (NicknameEditModal)

---

## Структура плана

План разбит на **3 фазы** с четким разделением ответственности:

1. **Фаза 1: База данных и инфраструктура** (2 дня) — Backend
2. **Фаза 2: API и серверная логика** (2 дня) — Backend + Client интеграция
3. **Фаза 3: Клиентская интеграция и UI** (3 дня) — Frontend + полировка

---

## Фаза 1: База данных и инфраструктура (27-28 января, 2 дня)

### Цель фазы
Подготовить базу данных и серверную инфраструктуру для поддержки гостевого режима, анонимной авторизации и рейтинговой системы.

### Задачи для Developer

#### Задача 1.1: Миграция базы данных — новые таблицы
**Приоритет:** P0
**Beads ID:** TBD (создать при старте)
**Файл:** `server/src/db/migrations/007_meta_gameplay_tables.sql`

**Описание:**
Создать миграцию для новых таблиц рейтинговой системы и идемпотентности.

**Что нужно сделать:**
1. Создать таблицу `leaderboard_total_mass`:
   - `user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
   - `total_mass INTEGER NOT NULL DEFAULT 0`
   - `matches_played INTEGER NOT NULL DEFAULT 0`
   - `updated_at TIMESTAMP DEFAULT NOW()`

2. Создать таблицу `leaderboard_best_mass`:
   - `user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
   - `best_mass INTEGER NOT NULL DEFAULT 0`
   - `best_match_id UUID REFERENCES match_results(match_id)`
   - `players_in_match INTEGER NOT NULL DEFAULT 0`
   - `achieved_at TIMESTAMP DEFAULT NOW()`
   - `updated_at TIMESTAMP DEFAULT NOW()`

3. Создать таблицу `rating_awards`:
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `match_id UUID NOT NULL REFERENCES match_results(match_id) ON DELETE CASCADE`
   - `awarded_at TIMESTAMP DEFAULT NOW()`
   - `PRIMARY KEY (user_id, match_id)`

4. Создать таблицу `oauth_links`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `auth_provider VARCHAR(20) NOT NULL` (telegram, google, yandex)
   - `provider_user_id VARCHAR(255) NOT NULL`
   - `created_at TIMESTAMP DEFAULT NOW()`
   - `UNIQUE (auth_provider, provider_user_id)`
   - `INDEX (user_id)`

**Критерий приёмки:**
- [ ] Миграция выполняется без ошибок
- [ ] Все foreign key constraints корректны
- [ ] UNIQUE constraints на `oauth_links` работают

**Зависимости:** Нет

---

#### Задача 1.2: Миграция базы данных — изменение существующих таблиц
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/db/migrations/008_meta_gameplay_columns.sql`

**Описание:**
Добавить новые поля в существующие таблицы для поддержки анонимных пользователей и claimToken.

**Что нужно сделать:**
1. Изменить таблицу `users`:
   - Добавить `is_anonymous BOOLEAN NOT NULL DEFAULT false`
   - Добавить `registration_skin_id VARCHAR(50)`
   - Добавить `registration_match_id UUID REFERENCES match_results(match_id)`
   - Добавить `nickname_set_at TIMESTAMP`

2. Изменить таблицу `match_results`:
   - Добавить `guest_subject_id VARCHAR(255)` (для гостевых матчей)
   - Добавить `claim_consumed_at TIMESTAMP` (для идемпотентности claimToken)
   - Добавить `INDEX (guest_subject_id)` для быстрого поиска

**Критерий приёмки:**
- [ ] Миграция выполняется без ошибок
- [ ] Существующие данные не теряются (DEFAULT значения для новых полей)
- [ ] Индексы созданы корректно

**Зависимости:** Нет

---

#### Задача 1.3: Модели данных для новых таблиц
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/models/` (новая директория)

**Описание:**
Создать TypeScript интерфейсы и типы для работы с новыми таблицами.

**Что нужно сделать:**
1. Создать `server/src/meta/models/Leaderboard.ts`:
   - Интерфейс `LeaderboardTotalMass`
   - Интерфейс `LeaderboardBestMass`
   - Интерфейс `LeaderboardEntry` (для возврата клиенту)

2. Создать `server/src/meta/models/Rating.ts`:
   - Интерфейс `RatingAward`

3. Создать `server/src/meta/models/OAuth.ts`:
   - Интерфейс `OAuthLink`
   - Тип `AuthProvider` = `'telegram' | 'google' | 'yandex'`

4. Обновить `server/src/meta/services/AuthService.ts`:
   - Добавить поле `isAnonymous: boolean` в интерфейс `User`
   - Добавить поля из ТЗ (registration_skin_id, etc.)

**Критерий приёмки:**
- [ ] TypeScript компилируется без ошибок
- [ ] Все поля соответствуют схеме БД из ТЗ
- [ ] Экспортированы все необходимые типы

**Зависимости:** Задачи 1.1, 1.2

---

#### Задача 1.4: Генераторы случайных данных (частично готово)
**Приоритет:** P0
**Beads ID:** TBD
**Файлы:**
- `shared/src/nameGenerator.ts` ✅ **УЖЕ СУЩЕСТВУЕТ**
- `server/src/utils/generators/skinGenerator.ts`
- `server/src/utils/generators/nicknameValidator.ts`

**Описание:**
Использовать существующий генератор имен и добавить недостающие компоненты.

**Что уже есть:**
- ✅ `shared/src/nameGenerator.ts` — генератор русских имен (формат: `{Прилагательное} {Существительное}`)
- ✅ Функция `generateRandomName()` для клиента
- ✅ Функция `generateName(seed)` детерминированная для сервера
- ✅ Функция `generateUniqueName()` с проверкой на дубликаты
- ✅ ~1600 комбинаций (40 прилагательных × 40 существительных)

**Что нужно сделать:**

1. **[ОПЦИОНАЛЬНО] Добавить локализацию имен:**
   - Создать `shared/src/nameGenerator.en.ts` с английскими словами
   - Обновить `generateRandomName()` и `generateName()` с параметром `locale?: string`
   - Выбор словаря: `ru` (русские) или `en` (английские) по умолчанию
   - Пример английских имен: `Happy Slime`, `Brave Blob`, `Green Cookie`
   - **Если времени не хватит:** оставить только русские имена (текущая реализация)

2. Создать `server/src/utils/generators/skinGenerator.ts`:
   - Функция `generateRandomBasicSkin(): string`
   - Читать список скинов из `config/skins.json` (tier: basic)
   - Возвращать случайный `skinId`

3. Создать `server/src/utils/generators/nicknameValidator.ts`:
   - Функция `validateNickname(nickname: string): boolean`
   - Длина 2-20 символов
   - Разрешены: `A-Z`, `a-z`, `А-Я`, `а-я`, `0-9`, пробел, `-`, `_`
   - Запрещены: эмодзи, HTML-теги, спецсимволы

**Критерий приёмки:**
- [ ] Существующий генератор `nameGenerator.ts` используется на сервере и клиенте
- [ ] Генерация скина работает с существующим `config/skins.json`
- [ ] Валидация никнейма корректно отклоняет запрещенные символы
- [ ] Unit-тесты для `validateNickname` покрывают все случаи
- [ ] [ОПЦИОНАЛЬНО] Локализация имен работает (en/ru)

**Зависимости:** Нет

---

### Критерии приёмки Фазы 1

**Обязательные проверки:**
- [ ] `npm run build` проходит без ошибок
- [ ] Миграции применяются на чистую БД без ошибок
- [ ] Миграции применяются на БД с существующими данными (v0.6.0) без потерь
- [ ] TypeScript компилируется без ошибок
- [ ] Unit-тесты для генераторов и валидации проходят

**Документация:**
- [ ] `docs/soft-launch/SlimeArena-Architecture-v4.2.5-Part4.md` обновлен (Приложение B: новые таблицы и поля)

**Верификация:**
```bash
# Запустить миграции
npm run migrate

# Проверить структуру БД
psql -d slime_arena -c "\d users"
psql -d slime_arena -c "\d leaderboard_total_mass"
psql -d slime_arena -c "\d leaderboard_best_mass"
psql -d slime_arena -c "\d rating_awards"
psql -d slime_arena -c "\d oauth_links"

# Запустить unit-тесты
npm test -- --grep "nickname|skin"
```

---

## Фаза 2: API и серверная логика (29-30 января, 2 дня)

### Цель фазы
Реализовать HTTP API эндпоинты для гостевого режима, авторизации, claimToken и рейтингов.

### Задачи для Developer

#### Задача 2.1: JWT utilities и токены
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/utils/jwtUtils.ts`

**Описание:**
Реализовать генерацию и валидацию JWT токенов для всех типов (accessToken, guestToken, claimToken).

**Что нужно сделать:**
1. Создать функции для JWT:
   - `generateAccessToken(userId: string, isAnonymous: boolean, expiresIn: string): string`
   - `generateGuestToken(guestSubjectId: string, expiresIn: string): string`
   - `generateClaimToken(payload: ClaimTokenPayload, expiresIn: string): string`
   - `verifyToken(token: string): JwtPayload | null`

2. Интерфейс `ClaimTokenPayload`:
   ```typescript
   interface ClaimTokenPayload {
     matchId: string;
     subjectId: string; // userId или guestSubjectId
     finalMass: number;
     skinId: string;
     exp: number;
   }
   ```

3. Использовать `jsonwebtoken` библиотеку
4. Secret key из переменной окружения `JWT_SECRET`

**Критерий приёмки:**
- [ ] Все типы токенов генерируются корректно
- [ ] Валидация токенов проверяет подпись и expiration
- [ ] Unit-тесты покрывают генерацию и валидацию всех типов токенов

**Зависимости:** Нет

---

#### Задача 2.2: POST /api/v1/auth/guest
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Описание:**
Реализовать эндпоинт для получения гостевого токена.

**Что нужно сделать:**
1. Добавить маршрут `POST /api/v1/auth/guest`:
   - Тело запроса пустое
   - Генерировать UUID для `guestSubjectId`
   - Создать JWT `guestToken` со сроком жизни 7 дней
   - Вернуть:
     ```json
     {
       "guestToken": "...",
       "guestSubjectId": "...",
       "expiresAt": "2026-02-03T..."
     }
     ```

2. **Не создавать запись в БД** (гость существует только на клиенте)

**Критерий приёмки:**
- [ ] Эндпоинт возвращает валидный JWT токен
- [ ] `guestSubjectId` — валидный UUID v4
- [ ] Токен можно верифицировать через `jwtUtils.verifyToken`
- [ ] Integration test проверяет весь флоу

**Зависимости:** Задача 2.1

---

#### Задача 2.3: POST /api/v1/auth/telegram (обновление)
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Описание:**
Обновить существующий эндпоинт для создания анонимных пользователей Telegram.

**Что нужно сделать:**
1. Обновить логику `POST /api/v1/auth/telegram`:
   - Валидировать `initData` (уже есть)
   - Искать пользователя в `oauth_links` по `(telegram, telegram_id)`
   - Если не найден:
     - Создать запись в `users` с `is_anonymous = true`
     - Создать запись в `oauth_links`
     - Создать `profiles` и `wallets` (уже есть)
     - Установить `isNewUser = true`
   - Создать `accessToken` с полем `is_anonymous: true` в payload
   - Вернуть:
     ```json
     {
       "accessToken": "...",
       "userId": "...",
       "profile": { "nickname": "...", "locale": "..." },
       "isNewUser": true,
       "isAnonymous": true
     }
     ```

2. Генерировать никнейм через `nicknameGenerator` если Telegram не предоставил

**Критерий приёмки:**
- [ ] При первом входе создается пользователь с `is_anonymous = true`
- [ ] При повторном входе возвращается существующий пользователь
- [ ] `accessToken` содержит `is_anonymous: true` в payload
- [ ] Integration test покрывает оба сценария

**Зависимости:** Задачи 1.3, 1.4, 2.1

---

#### Задача 2.4: POST /api/v1/auth/oauth
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Описание:**
Реализовать эндпоинт для входа в существующий аккаунт через OAuth (Standalone платформа).

**Что нужно сделать:**
1. Добавить маршрут `POST /api/v1/auth/oauth`:
   - Тело запроса:
     ```json
     {
       "provider": "google" | "yandex",
       "code": "oauth_code",
       "redirectUri": "https://..."
     }
     ```
   - Обменять `code` на токены у провайдера (использовать OAuth SDK)
   - Получить `provider_user_id` от провайдера
   - Искать в `oauth_links` по `(provider, provider_user_id)`
   - **Если не найден → вернуть 404** (создание запрещено)
   - Если найден:
     - Загрузить профиль пользователя
     - Создать `accessToken`
     - Вернуть аналогично `/auth/telegram`

2. Реализовать OAuth провайдеры:
   - `GoogleOAuthProvider` (использовать Google Identity API)
   - `YandexOAuthProvider` (использовать Yandex OAuth API)

**Критерий приёмки:**
- [ ] Для существующего аккаунта возвращается `accessToken`
- [ ] Для несуществующего аккаунта возвращается `404` с сообщением "Account not found"
- [ ] OAuth-флоу корректно обрабатывает код авторизации
- [ ] Integration test покрывает оба сценария (mock OAuth providers)

**Зависимости:** Задачи 1.3, 2.1

---

#### Задача 2.5: POST /api/v1/match-results/claim
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/routes/matchResultsRoutes.ts`

**Описание:**
Реализовать эндпоинт для получения `claimToken` после матча.

**Что нужно сделать:**
1. Добавить маршрут `POST /api/v1/match-results/claim`:
   - Требует авторизации: `Authorization: Bearer <accessToken или guestToken>`
   - Тело запроса:
     ```json
     {
       "matchId": "uuid"
     }
     ```
   - Логика:
     1. Проверить существование `matchId` в `match_results`
     2. Проверить принадлежность:
        - Для `accessToken`: `match_results.user_id = userId`
        - Для `guestToken`: `match_results.guest_subject_id = guestSubjectId`
     3. Проверить `claim_consumed_at IS NULL`
     4. Получить `finalMass` и `skinId` из `match_results.summary` (JSONB)
     5. Генерировать `claimToken` (JWT) со сроком жизни 60 мин (из конфига)
   - Вернуть:
     ```json
     {
       "claimToken": "...",
       "expiresAt": "2026-01-27T..."
     }
     ```

2. **Не изменять `claim_consumed_at`** — это делается при upgrade

**Критерий приёмки:**
- [ ] Эндпоинт возвращает валидный `claimToken`
- [ ] Проверка принадлежности матча работает корректно
- [ ] Повторный запрос с тем же `matchId` возвращает новый токен (пока `claim_consumed_at IS NULL`)
- [ ] Если матч уже claimed (`claim_consumed_at IS NOT NULL`), возвращается ошибка
- [ ] Integration test покрывает все сценарии

**Зависимости:** Задачи 1.2, 2.1

---

#### Задача 2.6: POST /api/v1/auth/upgrade
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Описание:**
Реализовать эндпоинт для завершения профиля (оба режима: `convert_guest` и `complete_profile`).

**Что нужно сделать:**
1. Добавить маршрут `POST /api/v1/auth/upgrade`:
   - Тело запроса:
     ```json
     {
       "mode": "convert_guest" | "complete_profile",
       "provider": "google" | "yandex",  // только для convert_guest
       "authPayload": "oauth_code",       // только для convert_guest
       "claimToken": "jwt",
       "nickname": "string"
     }
     ```

2. **Режим `convert_guest`:**
   - Требует: `Authorization: Bearer <guestToken>`
   - Валидировать `authPayload` у провайдера → получить `provider_user_id`
   - Проверить, что `oauth_links` **не содержит** `(provider, provider_user_id)` → иначе 409 Conflict
   - Валидировать `claimToken` (подпись, expiration, subjectId, claim_consumed_at)
   - Создать `users` с `is_anonymous = false`
   - Создать `oauth_links`, `profiles`, `wallets`
   - Записать `registration_skin_id`, `registration_match_id`, `nickname_set_at`
   - Инициализировать рейтинги (см. Задача 2.8)
   - Установить `match_results.claim_consumed_at = NOW()`
   - Создать `accessToken`

3. **Режим `complete_profile`:**
   - Требует: `Authorization: Bearer <accessToken>` (Telegram-аноним)
   - Проверить, что `users.is_anonymous = true`
   - Валидировать `claimToken` (аналогично)
   - Обновить `users`: `is_anonymous = false`, `nickname_set_at = NOW()`
   - Записать `registration_skin_id`, `registration_match_id`
   - Инициализировать рейтинги
   - Установить `claim_consumed_at = NOW()`
   - Вернуть тот же `accessToken` (или новый с обновлённым `is_anonymous`)

4. Вернуть:
   ```json
   {
     "accessToken": "...",
     "userId": "...",
     "profile": { "nickname": "...", "level": 1, "xp": 0, ... }
   }
   ```

**Критерий приёмки:**
- [ ] Оба режима работают корректно
- [ ] `claimToken` можно использовать только один раз
- [ ] Повторное использование `claimToken` возвращает ошибку
- [ ] Попытка создать аккаунт с уже существующим OAuth-провайдером возвращает 409
- [ ] Рейтинги инициализируются из `finalMass` claimToken
- [ ] Integration тесты покрывают оба режима и все edge cases

**Зависимости:** Задачи 1.3, 1.4, 2.1, 2.4, 2.5

---

#### Задача 2.7: Сервис рейтингов — начисление после матча
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/services/RatingService.ts`

**Описание:**
Реализовать логику начисления рейтингов после каждого матча зарегистрированного пользователя.

**Что нужно сделать:**
1. Создать `RatingService` с методом `awardRating(userId: string, matchId: string, finalMass: number, playersInMatch: number)`:
   - Проверить идемпотентность: `rating_awards(user_id, match_id)` — если есть, прекратить
   - Проверить `users.is_anonymous = false` — иначе не начислять
   - Обновить `leaderboard_total_mass`: `total_mass += finalMass`, `matches_played += 1`, UPSERT
   - Если `finalMass > best_mass` (или записи нет):
     - Обновить `leaderboard_best_mass` (new record)
   - Создать запись в `rating_awards`

2. Интегрировать в существующий флоу завершения матча

**Критерий приёмки:**
- [ ] Рейтинг начисляется только для `is_anonymous = false`
- [ ] Повторное начисление за один матч невозможно (идемпотентность)
- [ ] `total_mass` корректно накапливается
- [ ] `best_mass` обновляется только при новом рекорде
- [ ] Unit-тесты покрывают все сценарии

**Зависимости:** Задачи 1.1, 1.3

---

#### Задача 2.8: Сервис рейтингов — инициализация при регистрации
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/services/RatingService.ts`

**Описание:**
Реализовать логику инициализации рейтингов при завершении профиля.

**Что нужно сделать:**
1. Добавить метод `RatingService.initializeRating(userId: string, claimToken: ClaimTokenPayload, playersInMatch: number)`:
   - Создать запись в `leaderboard_total_mass`: `total_mass = claimToken.finalMass`, `matches_played = 1`
   - Создать запись в `leaderboard_best_mass`: `best_mass = claimToken.finalMass`, `best_match_id = claimToken.matchId`, etc.
   - Создать запись в `rating_awards` (идемпотентность для первого матча)

2. Вызывать из `POST /api/v1/auth/upgrade` после создания пользователя

**Критерий приёмки:**
- [ ] Рейтинги инициализируются корректными значениями из `claimToken`
- [ ] `matches_played = 1` после первого матча
- [ ] Unit-тесты проверяют корректность инициализации

**Зависимости:** Задачи 1.1, 1.3, 2.6

---

#### Задача 2.9: GET /api/v1/leaderboard
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `server/src/meta/routes/leaderboardRoutes.ts`

**Описание:**
Реализовать эндпоинт для получения таблицы лидеров.

**Что нужно сделать:**
1. Добавить маршрут `GET /api/v1/leaderboard`:
   - Query параметры:
     - `mode`: `total` или `best` (обязательный)
     - `limit`: integer (по умолчанию 100, максимум 100)
     - `offset`: integer (по умолчанию 0)
   - Логика:
     1. Выбрать из `leaderboard_total_mass` или `leaderboard_best_mass`
     2. JOIN с `users` для `nickname`
     3. JOIN с `profiles` для `selected_skin_id`
     4. Сортировать по массе DESC
     5. Применить `limit` и `offset`
     6. Если есть `Authorization` и `is_anonymous = false`:
        - Вычислить позицию текущего игрока
        - Вычислить значение текущего игрока
   - Вернуть:
     ```json
     {
       "mode": "total",
       "entries": [
         {
           "position": 1,
           "userId": "...",
           "nickname": "...",
           "skinId": "...",
           "value": 123456
         }
       ],
       "myPosition": 42,
       "myValue": 5000
     }
     ```

**Критерий приёмки:**
- [ ] Возвращаются топ-100 игроков
- [ ] Сортировка по массе DESC корректна
- [ ] Для авторизованного пользователя возвращается его позиция
- [ ] Для гостя или анонима `myPosition` и `myValue` отсутствуют
- [ ] Integration test проверяет оба режима и авторизацию

**Зависимости:** Задачи 1.1, 1.3

---

### Критерии приёмки Фазы 2

**Обязательные проверки:**
- [ ] `npm run build` проходит без ошибок
- [ ] Все эндпоинты возвращают корректные HTTP статусы
- [ ] Integration тесты для всех эндпоинтов проходят
- [ ] Postman/Insomnia коллекция с примерами запросов создана

**Документация:**
- [ ] `docs/soft-launch/SlimeArena-Architecture-v4.2.5-Part4.md` обновлен (Приложение C: новые API эндпоинты)

**Верификация:**
```bash
# Запустить сервер
npm run dev:server

# Тестовые запросы через curl
curl -X POST http://localhost:2567/api/v1/auth/guest
curl -X GET http://localhost:2567/api/v1/leaderboard?mode=total

# Integration тесты
npm test -- --grep "auth|leaderboard|rating"
```

---

## Фаза 3: Клиентская интеграция и UI (31 января - 2 февраля, 3 дня)

### Цель фазы
Интегрировать новые API в клиент, реализовать UI экранов и модальных окон, завершить полный флоу мета-геймплея.

### Задачи для Developer

#### Задача 3.1: Обновление PlatformManager и адаптеров
**Приоритет:** P0
**Beads ID:** TBD
**Файлы:**
- `client/src/platform/PlatformManager.ts`
- `client/src/platform/StandaloneAdapter.ts`
- `client/src/platform/TelegramAdapter.ts`

**Описание:**
Обновить PlatformManager для поддержки гостевого режима и разделения `runtimePlatform` / `authProvider`.

**Что нужно сделать:**
1. Обновить `PlatformManager`:
   - Метод `getRuntimePlatform()`: возвращает `telegram` или `standalone`
   - Метод `getAuthProvider()`: возвращает текущий провайдер аутентификации

2. Обновить `StandaloneAdapter`:
   - Метод `getOrCreateGuestToken()`: вызывает `POST /api/v1/auth/guest`
   - Метод `startOAuthLogin(provider: 'google' | 'yandex')`: запускает OAuth-флоу
   - Хранение `guestToken` в `localStorage.guest_token`
   - Хранение `guest_nickname` и `guest_skin_id` в localStorage

3. Обновить `TelegramAdapter`:
   - Метод `trySilentAuth()`: вызывает `POST /api/v1/auth/telegram`
   - Обрабатывает `isAnonymous = true` в ответе

**Критерий приёмки:**
- [ ] Standalone адаптер корректно получает гостевой токен
- [ ] Telegram адаптер корректно создает анонимного пользователя
- [ ] Токены сохраняются в localStorage
- [ ] Unit-тесты покрывают оба адаптера

**Зависимости:** Задачи 2.2, 2.3

---

#### Задача 3.2: Обновление authService
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/services/authService.ts`

**Описание:**
Обновить authService для поддержки гостевого режима и новых методов авторизации.

**Что нужно сделать:**
1. Добавить метод `initializeGuest()`:
   - Вызывает `adapter.getOrCreateGuestToken()`
   - Генерирует случайный никнейм и скин (на клиенте)
   - Сохраняет в localStorage
   - Обновляет signals: `setAuthState` с флагом `isGuest: true`

2. Обновить метод `initialize()`:
   - Добавить логику определения типа пользователя
   - Для Telegram: автоматически вызывать `trySilentAuth()`
   - Для Standalone: проверить `access_token` → если нет, вызвать `initializeGuest()`

3. Добавить методы:
   - `upgradeAccount(provider: string, nickname: string)`: для convert_guest
   - `completeProfile(nickname: string)`: для complete_profile

**Критерий приёмки:**
- [ ] Гостевой режим инициализируется автоматически для Standalone
- [ ] Telegram silent auth работает корректно
- [ ] `upgradeAccount` успешно конвертирует гостя
- [ ] `completeProfile` успешно завершает профиль Telegram-анонима
- [ ] Все изменения отражаются в signals

**Зависимости:** Задачи 2.3, 2.6, 3.1

---

#### Задача 3.3: LeaderboardScreen
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/ui/screens/LeaderboardScreen.tsx`

**Описание:**
Создать экран таблицы лидеров с двумя вкладками.

**Что нужно сделать:**
1. Создать компонент `LeaderboardScreen`:
   - Две вкладки: «Накопительный» и «Рекордный»
   - Список топ-100 игроков (виртуализированный)
   - Каждая запись: позиция, аватар (скин), никнейм, значение (кг)
   - Строка текущего игрока выделена и закреплена внизу (если авторизован)
   - Кнопка «Закрыть»

2. Логика загрузки данных:
   - При открытии: запрос `GET /api/v1/leaderboard?mode=total`
   - При переключении вкладки: запрос с соответствующим `mode`
   - Индикатор загрузки
   - Обработка ошибок: показывать Toast

**Критерий приёмки:**
- [ ] Обе вкладки работают корректно
- [ ] Переключение вкладок загружает новые данные
- [ ] Строка текущего игрока отображается и выделена
- [ ] Для гостя/анонима строка игрока не показывается
- [ ] Виртуализация списка работает плавно

**Зависимости:** Задача 2.9

---

#### Задача 3.4: ResultsScreen — claimToken и предложение регистрации
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/ui/screens/ResultsScreen.tsx`

**Описание:**
Обновить экран результатов для поддержки claimToken и показа модального окна регистрации.

**Что нужно сделать:**
1. После завершения матча:
   - Запросить `POST /api/v1/match-results/claim` с `matchId`
   - Сохранить `claimToken` в `localStorage.registration_claim_token`

2. Проверить условие показа `RegistrationPromptModal`:
   - Пользователь гость **или** Telegram-аноним
   - `finalMass >= registrationPromptMinMass` (из `config/balance.json`)

3. Если условие выполнено:
   - Показать `RegistrationPromptModal`

4. Для зарегистрированных:
   - Показать текущий рейтинг (`total_mass`)
   - Показать прирост: `+{finalMass} кг`

**Критерий приёмки:**
- [ ] `claimToken` запрашивается после каждого матча
- [ ] Модальное окно показывается только при выполнении условий
- [ ] Для зарегистрированных показывается рейтинг
- [ ] `claimToken` сохраняется в localStorage

**Зависимости:** Задачи 2.5, 3.5

---

#### Задача 3.5: RegistrationPromptModal
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/ui/modals/RegistrationPromptModal.tsx`

**Описание:**
Создать модальное окно предложения сохранить прогресс.

**Что нужно сделать:**
1. Структура:
   - Заголовок: «Отличный результат!»
   - Текст: «Сохрани прогресс, чтобы не потерять достижения»
   - Иконка: скин игрока
   - Кнопка «Сохранить прогресс» (основная)
   - Кнопка «Сыграть ещё» (вторичная)

2. Поведение:
   - «Сохранить прогресс»:
     - Standalone-гость: открыть `OAuthModal`
     - Telegram-аноним: открыть `NicknameEditModal`
   - «Сыграть ещё»:
     - Закрыть модальное окно
     - Перейти на `MatchmakingScreen`

3. Аналитика:
   - `registration_prompt_shown`
   - `registration_prompt_accepted`
   - `registration_prompt_declined`

**Критерий приёмки:**
- [ ] Модальное окно отображается корректно
- [ ] Обе кнопки работают согласно логике
- [ ] События аналитики отправляются
- [ ] UI адаптируется под мобильные устройства

**Зависимости:** Задачи 3.6, 3.7

---

#### Задача 3.6: OAuthModal
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/ui/modals/OAuthModal.tsx`

**Описание:**
Создать модальное окно выбора способа входа для Standalone платформы.

**Что нужно сделать:**
1. Структура:
   - Заголовок: «Войти» или «Сохранить прогресс»
   - Кнопка «Войти через Google»
   - Кнопка «Войти через Яндекс»
   - Кнопка «Отмена»

2. Логика OAuth-флоу:
   - При нажатии на провайдера:
     - Запустить OAuth-флоу через `adapter.startOAuthLogin(provider)`
     - После получения `code`: открыть `NicknameEditModal`
     - После ввода никнейма: вызвать `authService.upgradeAccount(provider, nickname)`

3. Для входа в существующий аккаунт (из LobbyScreen):
   - После получения `code`: вызвать `POST /api/v1/auth/oauth`
   - Если 404: показать ошибку «Аккаунт не найден»
   - Если успех: обновить состояние и закрыть окно

**Критерий приёмки:**
- [ ] Обе кнопки OAuth работают корректно
- [ ] OAuth-флоу запускается и обрабатывается
- [ ] Для convert_guest открывается NicknameEditModal
- [ ] Для существующего аккаунта происходит вход
- [ ] Ошибки обрабатываются

**Зависимости:** Задачи 2.4, 2.6, 3.2, 3.7

---

#### Задача 3.7: NicknameEditModal
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/ui/modals/NicknameEditModal.tsx`

**Описание:**
Создать модальное окно редактирования никнейма при создании аккаунта.

**Что нужно сделать:**
1. Структура:
   - Заголовок: «Выбери имя»
   - Поле ввода (предзаполнено текущим никнеймом)
   - Счётчик символов: «X/20»
   - Кнопка «Сохранить» (активна только если никнейм валиден)
   - Кнопка «Отмена»

2. Валидация в реальном времени:
   - Длина 2-20 символов
   - Разрешены: буквы, цифры, пробел, дефис, подчёркивание
   - Запрещены: эмодзи, спецсимволы
   - Показывать ошибку под полем ввода

3. Поведение кнопки «Сохранить»:
   - Если часть `convert_guest`: вызвать `authService.upgradeAccount(provider, nickname)`
   - Если часть `complete_profile`: вызвать `authService.completeProfile(nickname)`
   - Индикатор загрузки (кнопка disabled + spinner)
   - При успехе: закрыть окно, обновить UI
   - При ошибке: показать Toast

**Критерий приёмки:**
- [ ] Валидация работает в реальном времени
- [ ] Кнопка «Сохранить» активна только для валидного никнейма
- [ ] Счётчик символов работает корректно
- [ ] Оба флоу (convert_guest и complete_profile) работают
- [ ] Ошибки обрабатываются

**Зависимости:** Задачи 2.6, 3.2

---

#### Задача 3.8: LobbyScreen — кнопка «Войти» и кнопка «Рейтинги»
**Приоритет:** P0
**Beads ID:** TBD
**Файл:** `client/src/ui/screens/LobbyScreen.tsx`

**Описание:**
Обновить главный экран для поддержки входа и навигации в рейтинги.

**Что нужно сделать:**
1. Добавить кнопку «Войти» (верхний правый угол):
   - Показывать только для Standalone-гостя
   - При нажатии: открыть `OAuthModal`
   - После успешного входа: скрыть кнопку, показать аватар + никнейм

2. Добавить кнопку «Рейтинги» (центральная область):
   - Показывать всегда
   - При нажатии: переход на `LeaderboardScreen`

3. Обновить отображение профиля:
   - Для гостя: показать кнопку «Войти»
   - Для зарегистрированного и Telegram-анонима: показать аватар + никнейм

**Критерий приёмки:**
- [ ] Кнопка «Войти» показывается только для гостей
- [ ] Кнопка «Рейтинги» работает корректно
- [ ] После входа UI обновляется автоматически (через signals)

**Зависимости:** Задачи 3.3, 3.6

---

#### Задача 3.9: Генерация никнейма и скина на клиенте
**Приоритет:** P0
**Beads ID:** TBD
**Файлы:**
- `client/src/utils/generators/nicknameGenerator.ts`
- `client/src/utils/generators/skinGenerator.ts`

**Описание:**
Реализовать генерацию случайных никнеймов и скинов на клиенте для гостей.

**Что нужно сделать:**
1. Создать `client/src/utils/generators/nicknameGenerator.ts`:
   - Функция `generateRandomNickname(): string`
   - Формат: `{Adjective}{Noun}{Number1-99}`
   - Загружать списки из `config/nicknames.json`

2. Создать `client/src/utils/generators/skinGenerator.ts`:
   - Функция `generateRandomBasicSkin(): string`
   - Загружать список базовых скинов из `config/skins.json`

3. Использовать в `authService.initializeGuest()`:
   - Генерировать никнейм и скин при первом запуске
   - Сохранять в localStorage

**Критерий приёмки:**
- [ ] Генерация никнейма совпадает с серверной логикой
- [ ] Генерация скина использует только базовые скины
- [ ] Unit-тесты покрывают обе функции

**Зависимости:** Задача 3.2

---

### Критерии приёмки Фазы 3

**Обязательные проверки:**
- [ ] `npm run build` проходит без ошибок
- [ ] Размер бандла (gzip) не превышает 150 kB
- [ ] Все экраны и модальные окна адаптируются под мобильные устройства
- [ ] Навигация между экранами работает плавно
- [ ] Все signals обновляются корректно

**Интеграционное тестирование:**
- [ ] Гостевой режим: новый игрок → матч → результаты → предложение регистрации
- [ ] Конвертация гостя: OAuth → никнейм → регистрация → рейтинг начислен
- [ ] Telegram-аноним: первый вход → матч → завершение профиля → рейтинг начислен
- [ ] Telegram-зарегистрированный: вход → матч → рейтинг обновлен
- [ ] Таблица лидеров: обе вкладки → позиция игрока

**Документация:**
- [ ] `docs/soft-launch/SlimeArena-UI-TZ-v1.6.2.md` обновлен
- [ ] `docs/soft-launch/SlimeArena-ScreenMap-v1.6.1.md` обновлен
- [ ] `.memory_bank/activeContext.md` обновлен

**Верификация:**
```bash
# Запустить полный стек
npm run dev:server
npm run dev:client

# Проверить размер бандла
npm run build
# Убедиться что dist/index.js gzip < 150 kB
```

---

## Критические файлы для реализации

### Backend (Фаза 1-2)
1. `server/src/db/migrations/007_meta_gameplay_tables.sql` — новые таблицы
2. `server/src/db/migrations/008_meta_gameplay_columns.sql` — изменения существующих таблиц
3. `server/src/meta/services/RatingService.ts` — логика рейтингов
4. `server/src/meta/routes/authRoutes.ts` — эндпоинты авторизации
5. `server/src/meta/utils/jwtUtils.ts` — генерация токенов

### Frontend (Фаза 3)
1. `client/src/services/authService.ts` — центральный сервис авторизации
2. `client/src/platform/PlatformManager.ts` — определение платформы
3. `client/src/ui/screens/LeaderboardScreen.tsx` — новый экран
4. `client/src/ui/modals/RegistrationPromptModal.tsx` — модальное окно конверсии
5. `client/src/ui/screens/ResultsScreen.tsx` — интеграция claimToken

---

## Зависимости между задачами

```
Фаза 1 → Фаза 2 → Фаза 3
  ↓         ↓         ↓
 БД      API      UI

1.1-1.4 → 2.1-2.9 → 3.1-3.9

Критические пути:
- 1.1,1.2 → 1.3 → 2.1 → все остальные задачи Фазы 2
- Фаза 2 полностью → Фаза 3
- 3.1,3.2 → все остальные задачи Фазы 3
```

---

## Риски и митигация

### Риск 1: OAuth интеграция может занять больше времени
**Вероятность:** Средняя | **Воздействие:** Высокое

**Митигация:**
- Использовать готовые SDK
- Подготовить mock-провайдеры
- Если не успеваем — временно отключить Google/Яндекс

### Риск 2: Миграции могут конфликтовать с текущими PR
**Вероятность:** Низкая | **Воздействие:** Среднее

**Митигация:**
- Работать в изолированном worktree
- Регулярно синхронизироваться с main
- Аккуратно разрешать конфликты при мерже

### Риск 3: Размер бандла может превысить лимит
**Вероятность:** Низкая | **Воздействие:** Среднее

**Митигация:**
- Динамический импорт для LeaderboardScreen
- Проверять размер после каждой задачи Фазы 3
- При превышении — оптимизировать

---

## Финальный чеклист перед завершением Спринта 13

### Код и тесты
- [ ] Все задачи Фазы 1 завершены и протестированы
- [ ] Все задачи Фазы 2 завершены и протестированы
- [ ] Все задачи Фазы 3 завершены и протестированы
- [ ] `npm run build` проходит без ошибок
- [ ] `npm run test` проходит без ошибок
- [ ] Детерминизм сохранён

### Документация
- [ ] Architecture v4.2.5 Part4 обновлён (Приложения B и C)
- [ ] UI-TZ v1.6.2 обновлён
- [ ] ScreenMap v1.6.1 обновлён
- [ ] activeContext.md обновлён

### Интеграция
- [ ] Все 9 P0 задач из ТЗ реализованы
- [ ] Гостевой режим работает end-to-end
- [ ] Telegram silent auth работает
- [ ] OAuth вход работает
- [ ] claimToken механизм работает
- [ ] Завершение профиля работает (оба режима)
- [ ] Рейтинги начисляются корректно
- [ ] LeaderboardScreen работает (обе вкладки)

### Производительность
- [ ] Размер бандла < 150 kB (gzip)
- [ ] Навигация плавная (нет задержек > 300ms)
- [ ] Mobile-First правила соблюдены

### Ревью
- [ ] PR создан в main
- [ ] Все 4 ревьювера проверили код
- [ ] Замечания P0 и P1 исправлены
- [ ] Approve получен от всех ревьюверов

---

## Примечания

1. **Worktree изоляция:** Все работы ведутся в `d:/slime-arena-meta/` с базовой веткой `sprint-13/meta-gameplay`.

2. **PR стратегия:** Можно создать один большой PR для всего спринта или 3 отдельных PR для каждой фазы.

3. **Приоритеты из ТЗ:** Все 9 P0 задач из ТЗ покрыты в этом плане.

4. **Дополнительное требование:** NicknameEditModal для изменения никнейма при создании интегрирован в Задачи 3.6 и 3.7.

---

**Итого:** 3 фазы, 25 задач (P0), 1 неделя работы. План покрывает весь scope мета-геймплея из ТЗ v1.9 с детальными критериями приёмки и планом верификации.
