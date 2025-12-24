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
- **Snapshot Interpolation**: Клиент использует буфер снапшотов для плавного отображения состояний, полученных от сервера.

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
