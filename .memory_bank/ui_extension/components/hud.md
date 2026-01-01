# HUD Component

Информационная панель игрока.

## Назначение
Отображение текущих показателей игрока: масса, время до конца матча, уровень, количество убийств, очередь карточек талантов.

## Точки конфигурации
- Стилизация через CSS в `main.ts`.

## Параметры
- `player.mass`: Текущая масса.
- `state.timeRemaining`: Оставшееся время.
- `player.level`: Текущий уровень.
- `player.killCount`: Количество убийств.
- `player.pendingTalentCount`: Размер очереди карточек талантов.
- `player.boostType`: Тип активного усиления (`rage`, `haste`, `guard`, `greed`).
- `player.boostEndTick`: Тик окончания усиления.
- `player.boostCharges`: Заряды усиления (`guard`, `greed`).
- `state.serverTick`: Текущий тик сервера (для расчёта времени).

## Зависимости
- DOM API.

## Где вызывается
- `client/src/main.ts`: Функция `updateHud()`.
