# Slime Arena — Пример реализации базы данных (Сезонный альбом)

**Назначение:** техническая документация с примерами SQL для реализации системы хранения данных альбома.

---

## Структура таблиц

### Таблица сезонов (album_seasons)

```sql
CREATE TABLE album_seasons (
  season_id VARCHAR(50) PRIMARY KEY,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false
);
```

**Назначение:** хранить конфигурацию каждого сезона.

**Поля:**
- `season_id`: уникальный идентификатор сезона (например, "season_2025_winter")
- `start_date`: дата и время начала сезона
- `end_date`: дата и время завершения сезона
- `config`: полная конфигурация в формате JSON (распределение редкости, биомы, pity-параметры)
- `is_active`: флаг активного сезона

---

### Таблица карт (album_cards)

```sql
CREATE TABLE album_cards (
  card_id VARCHAR(50) PRIMARY KEY,
  season_id VARCHAR(50) NOT NULL REFERENCES album_seasons(season_id),
  page_index SMALLINT NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  asset_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Назначение:** хранить определения всех карт в альбоме.

**Поля:**
- `card_id`: уникальный идентификатор карты (например, "season_winter_card_001")
- `season_id`: идентификатор сезона, к которому относится карта
- `page_index`: номер страницы альбома (0-49)
- `rarity`: редкость (common, rare, epic, legendary)
- `asset_id`: идентификатор графического ассета
- `created_at`: дата создания записи

**Индекс:**
```sql
CREATE INDEX idx_album_cards_season ON album_cards(season_id);
```

---

### Таблица состояния альбома игрока (player_album_state)

```sql
CREATE TABLE player_album_state (
  player_id UUID NOT NULL,
  season_id VARCHAR(50) NOT NULL,
  collected_cards JSONB DEFAULT '[]',
  glue_balance INT DEFAULT 0,
  pity_new_card INT DEFAULT 0,
  pity_epic INT DEFAULT 0,
  pity_legendary INT DEFAULT 0,
  arena_chest_mass INT DEFAULT 0,
  arena_chest_claimed_today SMALLINT DEFAULT 0,
  arena_chest_reset_date DATE,
  packs_opened INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_id, season_id),
  FOREIGN KEY (season_id) REFERENCES album_seasons(season_id)
);
```

**Назначение:** хранить текущий прогресс игрока в активном сезоне.

**Поля:**
- `player_id`: уникальный идентификатор игрока
- `season_id`: идентификатор сезона
- `collected_cards`: JSON-массив ID собранных карт
- `glue_balance`: текущий баланс слайм-клея
- `pity_new_card`, `pity_epic`, `pity_legendary`: счётчики pity по категориям
- `arena_chest_mass`: накопленная масса в матчах для сундука арены
- `arena_chest_claimed_today`: количество паков из сундука, забранных сегодня
- `arena_chest_reset_date`: дата последнего сброса суточного счётчика
- `packs_opened`: всего открыто паков (для статистики)
- `updated_at`: дата последнего обновления

**Индекс:**
```sql
CREATE INDEX idx_album_state_season ON player_album_state(season_id);
```

---

### Таблица истории альбома (player_album_history)

```sql
CREATE TABLE player_album_history (
  player_id UUID NOT NULL,
  season_id VARCHAR(50) NOT NULL,
  final_progress DECIMAL(5,4),
  cards_collected SMALLINT,
  badge_awarded BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  PRIMARY KEY (player_id, season_id),
  FOREIGN KEY (season_id) REFERENCES album_seasons(season_id)
);
```

**Назначение:** архивировать состояние альбома при завершении сезона.

**Поля:**
- `player_id`: уникальный идентификатор игрока
- `season_id`: идентификатор завершённого сезона
- `final_progress`: финальный прогресс (от 0.0 до 1.0)
- `cards_collected`: количество собранных карт
- `badge_awarded`: получил ли игрок бейдж за 100%
- `completed_at`: дата завершения альбома (NULL если не завершён)

---

## Примеры запросов

### Получить текущее состояние альбома игрока

```sql
SELECT * FROM player_album_state 
WHERE player_id = $1 AND season_id = $2;
```

### Получить все карты активного сезона

```sql
SELECT * FROM album_cards 
WHERE season_id = (SELECT season_id FROM album_seasons WHERE is_active = true)
ORDER BY page_index, rarity;
```

### Обновить баланс клея и счётчик pity

```sql
UPDATE player_album_state 
SET glue_balance = glue_balance + $1,
    pity_new_card = pity_new_card + 1,
    updated_at = NOW()
WHERE player_id = $2 AND season_id = $3;
```

### Получить историю прогресса игрока

```sql
SELECT season_id, final_progress, cards_collected, badge_awarded, completed_at 
FROM player_album_history 
WHERE player_id = $1
ORDER BY season_id DESC;
```

### Получить всех игроков с 100% альбома в сезоне

```sql
SELECT COUNT(*) as completed_players
FROM player_album_state 
WHERE season_id = $1 AND json_array_length(collected_cards) = 50;
```

---

## Оптимизация производительности

**Индексы:**
- На `season_id` в `player_album_state` для поиска всех игроков в рамках сезона
- На `season_id` в `album_cards` для быстрого получения карт сезона
- На `player_id` в `player_album_history` для отчётов об активности

**Кеширование:**
- `album_cards` для сезона кешировать на весь сезон (статичные данные)
- `player_album_state` обновлять в кеше после каждого действия
- Конфигурация сезона кешировать в памяти сервера

**Batch-операции:**
- При переводе сезона: архивирование всех `player_album_state` в `player_album_history`
- Использовать bulk-insert для выдачи наград всем игрокам

---

## Миграция между сезонами

При старте нового сезона:

1. Завершить старый сезон (`is_active = false`)
2. Для каждого игрока:
   - Скопировать `player_album_state` в `player_album_history`
   - Конвертировать оставшийся `glue_balance` в капли игровой валюты
   - Начислить награды за незабранные страницы
   - Создать новую запись `player_album_state` с нулевыми счётчиками
3. Создать конфиг нового сезона в `album_seasons`
4. Загрузить все карты нового сезона в `album_cards`
