# Talent Modal Component

Окно выбора улучшений.

## Назначение
Предоставление игроку выбора из трех случайных талантов при повышении уровня.

## Точки конфигурации
- `pendingTalentCard`: Данные активной карточки (option0/1/2, rarity0/1/2, expiresAtTick).

## Параметры
- `pendingTalentCard`: Текущая карточка талантов (null, если не активна).
- `pendingTalentCount`: Количество карточек в очереди.

## Зависимости
- DOM API, CSS Transitions.

## Где вызывается
- `client/src/main.ts`: Функции `updateTalentCardUI()` и `refreshTalentModal()`.
