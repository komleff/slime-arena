# Talent Modal Component

Окно выбора улучшений.

## Назначение
Предоставление игроку выбора из трех случайных талантов при повышении уровня.

## Точки конфигурации
- `talentChoices`: Список доступных талантов (Mass Surge, Vital Burst, Guard Pulse).

## Параметры
- `talentsAvailable`: Флаг видимости окна.

## Зависимости
- DOM API, CSS Transitions.

## Где вызывается
- `client/src/main.ts`: Функция `refreshTalentModal()`.
