# System Patterns
Архитектурные решения и паттерны проектирования.

## Границы подсистем
- **Runtime (Server)**: `server/src/index.ts` (точка входа), `server/src/rooms/` (игровая логика).
- **Runtime (Client)**: `client/src/main.ts` (точка входа), `client/src/rendering/` (визуализация), `client/src/input/` (управление).
- **Shared Logic**: `shared/src/` (типы, формулы, парсинг конфигов).
- **Infrastructure**: `.github/workflows/` (CI/CD), `docker/` (контейнеризация).
- **Public Assets**: `client/public/` и корневая папка `assets/`.

## Архитектура
- **Authoritative Server**: Сервер является единственным источником истины. Клиент отправляет только команды ввода.
- **Fixed Timestep**: Игровой цикл работает с фиксированным шагом (30 FPS) для обеспечения детерминизма.
- **U2-style Predictive Smoothing**: Клиент использует visual state system с velocity integration для плавного отображения.

## U2-стиль сглаживания (v1.0)
- **Visual State System**: Визуальное состояние (`visualPlayers`, `visualOrbs`) отделено от серверного.
- **Velocity Integration**: `VELOCITY_WEIGHT = 0.7` — движение по скорости из снапшота.
- **Catch-up коррекция**: `CATCH_UP_SPEED = 10.0` — плавное догоняние целевой позиции.
- **Предиктивная экстраполяция**: `targetPos = server_pos + velocity * lookAheadMs`.
- **Единственный параметр в конфиге**: `lookAheadMs = 150` (остальные захардкожены).
- **Документация**: `.memory_bank/modules/U2-smoothing.md`

## Пайплайны и гарантии доставки
- **CI (Continuous Integration)**:
    - Любой PR в `main` запускает проверку сборки. Это гарантирует, что изменения не ломают компиляцию проекта.
    - В будущем планируется добавление автоматического запуска тестов детерминизма (`npm run test`) в пайплайн.
- **Branch Protection**:
    - Реализована программная проверка в `branch-protection.yml`, которая предупреждает о прямых пушах в `main`.
    - Основной рабочий процесс: `feature-branch -> Pull Request -> CI Check -> Merge to main`.

## Ключевые паттерны
- **State Synchronization**: Использование Colyseus Schema для автоматической синхронизации состояния комнаты.
- **Command Pattern**: Ввод пользователя инкапсулируется в `InputCommand` и передается на сервер.
- **Helper Modules**: Вынос сложной математики и логики мира в отдельные утилиты (`mathUtils.ts`, `worldUtils.ts`) для разгрузки классов комнат.
