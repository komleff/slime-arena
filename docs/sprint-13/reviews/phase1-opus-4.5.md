# Review by Claude Opus 4.5

**Дата:** 2026-01-25
**Ревьювер:** Claude Opus 4.5
**Фаза:** Sprint 13, Phase 1 (Database & Infrastructure)
**Коммиты:** aa03142, cf04c4d, 11e17d0, 919299c

## Чеклист

- [x] Сборка проходит
- [x] Тесты генераторов проходят (374/374 — nickname-validator: 80, skin-generator: 294)
- [x] Детерминизм сохранён (Math.random используется только в мета-сервере)
- [x] Архитектура в целом соответствует ТЗ
- [x] Найдены проблемы (см. ниже)

## Замечания

### [P1] Важные проблемы

1. **[P1]** `server/src/db/migrations/008_meta_gameplay_columns.sql` — **Не добавлено поле `auth_provider`**
   - ТЗ (раздел 1.2): указано, что `platform_type` переименовано в `auth_provider` (VARCHAR(20))
   - Текущее состояние: миграция 008 не содержит `auth_provider` в таблице `users`
   - Влияние: AuthService.ts использует `platform_type`, что соответствует текущей миграции, но не соответствует ТЗ
   - Решение: либо добавить поле и переименовать (`ALTER TABLE users RENAME COLUMN platform_type TO auth_provider`), либо согласовать с ТЗ что используется `platform_type`

2. **[P1]** `server/src/utils/generators/skinGenerator.ts:47-59` — **Неравномерное распределение скинов**
   - Проблема: тест показал, что 5 из 10 скинов никогда не выбираются при seeds 0-999
   - Распределение: slime_red (16.5%), slime_yellow (25.8%), slime_pink (25.9%), slime_purple (25.8%), slime_orange (6.0%)
   - Причина: LCG-генератор с малым диапазоном seeds даёт неравномерное распределение
   - Влияние: новые игроки получают только 5 из 10 базовых скинов
   - Решение: использовать seed из большего диапазона (timestamp, UUID hash) или улучшить алгоритм

### [P2] Желательные улучшения

3. **[P2]** `server/src/meta/services/AuthService.ts` — **Захардкоженная продолжительность сессии**
   - Строка: `SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000`
   - Рекомендация: вынести в `config/balance.json` или отдельный конфиг
   - Причина: соответствие принципу «Баланс = конфигурация» из AGENT_ROLES.md

4. **[P2]** `server/src/utils/generators/nicknameValidator.ts` — **BANNED_WORDS захардкожен**
   - Строки 26-33: базовый список запрещённых слов в коде
   - Комментарий говорит «В production должен загружаться из внешнего источника»
   - Рекомендация: создать `config/banned-words.json` или загружать из БД

5. **[P2]** `server/src/meta/models/Leaderboard.ts` — **Отсутствует LeaderboardEntry для API**
   - Тип `LeaderboardEntry` определён, но ТЗ также требует `LeaderboardResponse` с полями `mode`, `entries`, `myPosition`, `myValue`
   - Рекомендация: добавить интерфейс ответа API

6. **[P2]** SQL-миграции — **Нет миграции для отката (down)**
   - Миграции 007 и 008 не содержат скриптов отката
   - Рекомендация: добавить `007_meta_gameplay_tables_down.sql` и `008_meta_gameplay_columns_down.sql`

## Позитивные моменты

1. **Идемпотентность миграций** — все `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` корректно используют условия
2. **Foreign Keys** — правильно настроены `ON DELETE CASCADE` для зависимых таблиц и `ON DELETE SET NULL` для опциональных связей
3. **Индексы** — созданы для всех полей, по которым будет поиск (`total_mass DESC`, `best_mass DESC`, `guest_subject_id`, `oauth_links(user_id)`)
4. **UNIQUE constraints** — `rating_awards(user_id, match_id)` и `oauth_links(auth_provider, provider_user_id)` предотвращают дубликаты
5. **Детерминированный генератор скинов** — `generateBasicSkin(seed)` корректно использует класс `Rng`
6. **Валидатор никнеймов** — хорошее покрытие edge cases (null, undefined, Unicode, эмодзи, HTML-теги)
7. **Типизация** — все модели корректно типизированы, соответствие схеме БД (UUID → string, TIMESTAMP → Date)
8. **Триггеры** — `update_updated_at_column()` корректно применён к таблицам лидерборда
9. **Тесты** — 374 теста для генераторов с хорошим покрытием edge cases

## Вердикт

**CHANGES_REQUESTED** — требуется исправить P1 замечания.

### Критические замечания для исправления:
1. Согласовать поле `auth_provider` в миграции 008 с ТЗ
2. Исправить распределение скинов в `generateBasicSkin()`

## Рекомендации для PM

1. **P1 #1**: Уточнить с Architect, должен ли `platform_type` быть переименован в `auth_provider` или это две разные концепции (`platform_type` для старых пользователей, `auth_provider` для OAuth)
2. **P1 #2**: Создать задачу на улучшение seed-генерации для скинов (использовать timestamp или hash от userId)
3. **P2**: Можно перенести на следующую фазу или в технический долг
4. После исправления P1 — запросить повторное ревью перед мержем
