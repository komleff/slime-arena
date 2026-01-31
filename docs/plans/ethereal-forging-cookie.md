# План реализации LeaderboardScreen v1.6

**Дата:** 2026-02-01
**Спринт:** 17 (LeaderboardScreen)
**ТЗ:** [TZ-LeaderboardScreen-v1.6.md](../meta-min/TZ-LeaderboardScreen-v1.6.md)
**Приоритет:** P0

---

## Текущее состояние

**Уже реализовано:**
- `client/src/ui/components/LeaderboardScreen.tsx` — базовый экран с переключателем total/best
- `client/src/services/leaderboardService.ts` — сервис с кэшированием
- `server/src/meta/routes/leaderboard.ts` — API с myPosition/myValue
- Таблицы БД: `leaderboard_total_mass`, `leaderboard_best_mass`
- Выделение топ-3 (золото/серебро/бронза)
- Подсветка текущего пользователя (is-user)

---

## GAP-анализ

### P0 — Критичные недостающие функции

| # | Требование ТЗ | Текущее состояние |
|---|---------------|-------------------|
| 1 | Кнопка «Лидеры» на LobbyScreen | **Заглушка** — `handleLeaderboard()` пустая (MainScreen.tsx:627) |
| 2 | Плашка игрока: гибридная модель (sticky top/bottom) | **Только снизу** — нет отслеживания видимости |
| 3 | Плашка гостя Standalone (claimToken/localStorage) | **Отсутствует** |
| 4 | Плашка Telegram-анонима | **Отсутствует** |
| 5 | Кнопка «Сохранить прогресс» в плашке | **Отсутствует** |

### P1 — Важные доработки

| # | Требование ТЗ | Текущее состояние |
|---|---------------|-------------------|
| 6 | Кнопка «Лидеры» на MatchmakingScreen | **Отсутствует** — нужно добавить в MainMenu |
| 7 | matchesPlayed в entries API | **Отсутствует** — SQL не выбирает |
| 8 | myMatchesPlayed в ответе API | **Отсутствует** |
| 9 | Миниатюра скина в строке | **Отсутствует** — skinId приходит, но не отображается |
| 10 | Столбец matchesPlayed только в mode=total | **Частично** — gamesPlayed показан, но данных нет |
| 11 | Автозакрытие при нахождении матча | **Отсутствует** |
| 12 | Вторичная сортировка по updated_at | **Отсутствует** |

### P2 — Косметика

| # | Требование ТЗ | Текущее состояние |
|---|---------------|-------------------|
| 13 | Названия вкладок «Накопительный»/«Рекордный» | Используются «Всего очков»/«Лучший матч» |
| 14 | Резервный никнейм «Игрок» + 4 символа ID | **Отсутствует** |
| 15 | События аналитики | **Отсутствует** |

---

## Декомпозиция на задачи Beads

### Фаза 1: Точки входа (P0)

```
LB-001: Интеграция LeaderboardScreen в UIBridge
  Файлы: client/src/ui/UIBridge.tsx, client/src/ui/signals/gameState.ts
  Описание: Добавить состояние showLeaderboard + рендеринг LeaderboardScreen

LB-002: Активация кнопки «Лидеры» в MainScreen
  Файлы: client/src/ui/components/MainScreen.tsx
  Описание: Реализовать handleLeaderboard() → setShowLeaderboard(true)
  Зависит от: LB-001

LB-003: Кнопка «Лидеры» в MainMenu (MatchmakingScreen)
  Файлы: client/src/ui/components/MainMenu.tsx
  Описание: Добавить иконку лидеров рядом с кнопкой «Назад»
  Зависит от: LB-001
```

### Фаза 2: Backend API (P0-P1)

```
LB-004: matchesPlayed и skinId в entries
  Файлы: server/src/meta/routes/leaderboard.ts
  Описание: Добавить matches_played из leaderboard_total_mass в SQL,
            включить skinId в ответ (уже выбирается, нужно вернуть)

LB-005: myMatchesPlayed в ответе API
  Файлы: server/src/meta/routes/leaderboard.ts
  Описание: Добавить myMatchesPlayed при mode=total
  Зависит от: LB-004

LB-006: Вторичная сортировка по updated_at
  Файлы: server/src/meta/routes/leaderboard.ts
  Описание: ORDER BY mass DESC, updated_at DESC

LB-007: Обновить типы в leaderboardService
  Файлы: client/src/services/leaderboardService.ts
  Описание: Добавить matchesPlayed, skinId в типы
  Зависит от: LB-004
```

### Фаза 3: Плашка игрока — критичная (P0)

```
LB-008: Рефакторинг плашки — гибридная модель
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание:
    - Добавить IntersectionObserver для строки игрока
    - Плашка sticky top когда строка выше видимой области
    - Плашка sticky bottom когда строка ниже или игрок вне топ-100
    - Скрыть плашку когда строка видна в списке

LB-009: Плашка гостя Standalone
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание:
    - Читать claimToken из localStorage
    - Показывать guest_skin_id, guest_nickname, finalMass
    - Fallback на last_match_mass если claimToken истёк

LB-010: Плашка Telegram-анонима
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: Показывать данные из Telegram профиля + is_anonymous
  Зависит от: LB-009

LB-011: Кнопка «Сохранить прогресс»
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание:
    - Для гостя Standalone → открыть OAuthProviderSelector
    - Для Telegram-анонима → открыть NicknameEditModal
  Зависит от: LB-009, LB-010

LB-012: Перезагрузка после завершения профиля
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: После успешного upgrade → refresh leaderboard
  Зависит от: LB-011
```

### Фаза 4: UI улучшения (P1)

```
LB-013: Миниатюра скина в строке
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание:
    - Создать маппинг skinId → путь к спрайту
    - Отобразить 32x32 миниатюру перед никнеймом
  Зависит от: LB-007

LB-014: Условный столбец matchesPlayed
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: Показывать только в mode=total
  Зависит от: LB-007

LB-015: Автозакрытие при нахождении матча
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: useEffect подписка на matchmakingStatus → onClose()
  Зависит от: LB-001
```

### Фаза 5: Косметика (P2)

```
LB-016: Названия вкладок по ТЗ
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: «Накопительный» / «Рекордный»

LB-017: Резервный никнейм
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: nickname || 'Игрок' + userId.slice(-4)

LB-018: События аналитики
  Файлы: client/src/ui/components/LeaderboardScreen.tsx
  Описание: leaderboard_viewed, tab_switched, save_progress_clicked
```

---

## Критические файлы

| Файл | Изменения |
|------|-----------|
| `client/src/ui/components/LeaderboardScreen.tsx` | Основные изменения: плашка, скины, matchesPlayed |
| `client/src/ui/UIBridge.tsx` | Интеграция: добавить рендеринг LeaderboardScreen |
| `client/src/ui/components/MainScreen.tsx` | Активировать handleLeaderboard() |
| `client/src/ui/components/MainMenu.tsx` | Добавить кнопку «Лидеры» |
| `server/src/meta/routes/leaderboard.ts` | API: matchesPlayed, myMatchesPlayed, сортировка |
| `client/src/services/leaderboardService.ts` | Типы: matchesPlayed, skinId |

---

## Порядок реализации

**Batch 1 (P0 — блокеры):**
1. LB-001 → LB-002 → LB-003 (точки входа)
2. LB-004 → LB-005 → LB-007 (API данные)

**Batch 2 (P0 — плашка):**
3. LB-008 (гибридная модель)
4. LB-009 → LB-010 → LB-011 → LB-012 (типы пользователей)

**Batch 3 (P1 — улучшения):**
5. LB-006 (сортировка)
6. LB-013 → LB-014 (UI строки)
7. LB-015 (автозакрытие)

**Batch 4 (P2 — полировка):**
8. LB-016, LB-017, LB-018

---

## Верификация

### Тест 1: Точки входа
1. Открыть MainScreen → нажать кнопку «Лидеры» → экран открывается
2. Открыть MainMenu → нажать кнопку «Лидеры» → экран открывается
3. Во время поиска матча → матч найден → экран автоматически закрывается

### Тест 2: Плашка зарегистрированного
1. Авторизованный игрок в топ-100
2. Прокрутить список вверх/вниз
3. Плашка появляется сверху/снизу когда строка не видна
4. Плашка скрывается когда строка видна

### Тест 3: Плашка гостя Standalone
1. Сыграть матч как гость
2. Открыть LeaderboardScreen
3. Плашка показывает данные из claimToken
4. Нажать «Сохранить прогресс» → открывается OAuthProviderSelector

### Тест 4: Плашка Telegram-анонима
1. Войти через Telegram (is_anonymous = true)
2. Открыть LeaderboardScreen
3. Плашка показывает никнейм из Telegram
4. Нажать «Сохранить прогресс» → открывается NicknameEditModal

### Тест 5: API данные
1. GET /api/v1/leaderboard?mode=total
2. Проверить: entries содержат matchesPlayed, skinId
3. Проверить: ответ содержит myMatchesPlayed (если авторизован)

---

## Оценка объёма

| Фаза | Задачи | Часы |
|------|--------|------|
| Точки входа | 3 | 4ч |
| Backend API | 4 | 4ч |
| Плашка игрока | 5 | 12ч |
| UI улучшения | 3 | 4ч |
| Косметика | 3 | 2ч |
| **Итого** | **18** | **~26ч** |

С тестированием и code review: **~35-40 часов** (4-5 рабочих дней).
