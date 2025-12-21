# U2 REVERSE ENGINEERING TZ (CODEX)

## Назначение
Документ фиксирует архитектуру и логику работы модулей управления кораблем, полета и сглаживания движения на основе анализа репозитория komleff/u2.

## Источники
- `src/shared/physics.json`
- `src/shared/Config/SharedPhysics.cs`
- `src/shared/Ships/ShipConfig.cs`
- `src/shared/ECS/EntityFactory.cs`
- `src/shared/ECS/GameWorld.cs`
- `src/shared/ECS/Systems/PhysicsSystem.cs`
- `src/shared/ECS/Systems/FlightAssistSystem.cs`
- `src/shared/Physics/PhysicsGateway.cs`
- `src/shared/Physics/RelativisticMath.cs`
- `src/clients/testbed/chatgpt-vite/client/input/InputManager.ts`
- `src/clients/testbed/chatgpt-vite/client/input/SingleJoystickManager.ts`
- `src/clients/testbed/chatgpt-vite/client/input/DirectControlMode/InputTranslator.ts`
- `src/clients/testbed/chatgpt-vite/client/input/DirectControlMode/modes/FreeFlightMode.ts`
- `src/clients/testbed/chatgpt-vite/client/input/DirectControlMode/modes/CombatLockMode.ts`
- `src/clients/testbed/chatgpt-vite/client/world/SnapshotStore.ts`
- `src/clients/testbed/chatgpt-vite/client/world/EntitySmoother.ts`
- `src/clients/testbed/chatgpt-vite/network/HermiteSpline.ts`

## Термины
- `ShipConfig` — структура ТТХ корабля.
- `FlightAssistSystem` — логика ассистента управления.
- `PhysicsSystem` — интеграция физики и обновление состояния.
- `SingleJoystickManager` — одиночный сенсорный джойстик.
- `InputTranslator` — преобразование ввода в команды корабля.
- `SnapshotStore` и `EntitySmoother` — буфер и сглаживание состояния мира.

## 1. Физика полета
### Назначение
Обеспечить расчет движения корабля в физическом мире с учетом релятивистских ограничений и управляющих команд.

### Входные данные
- `ControlStateComponent` от клиента.
- `ShipConfig` с параметрами массы, геометрии и тяги.
- `LocationConfig` с `CPrime_mps`, размерами мира и режимом тора.

### Выходные данные
- Обновленные `Transform2D`, `Velocity`, `Momentum` сущности корабля.

### Логика
- `GameWorld` формирует цепочку систем, где `FlightAssistSystem` исполняется до `PhysicsSystem`.
- `PhysicsGateway` ограничивает команды управления диапазоном [-1, 1] и вычисляет силу и момент в мировых координатах.
- `PhysicsSystem` интегрирует импульс и скорость, пересчитывает движение на основе `RelativisticMath`.
- Скорость ограничивается значением `0.99 * CPrime_mps`, при превышении пересчитывается импульс.
- Позиция обновляется по скорости, поворот — по угловой скорости.

### Ограничения
- Модель учитывает релятивистское ограничение скорости.
- При нулевых значениях импульса и ненулевой скорости выполняется синхронизация импульса.

### Связи
- Коллизии и урон обрабатываются в `CollisionSystem` после физики.

## 2. ТТХ кораблей и параметры default ship
### Назначение
Единый источник параметров корабля для сервера и клиента.

### Источник
- Базовые значения загружаются из `src/shared/physics.json` через `SharedPhysics.ToShipConfig`.

### Структура `ShipConfig`
- `Meta`, `Geometry`, `Hull`, `Propulsion`, `FlightAssist`, `Media`.
- `Propulsion` хранит тягу в меганьютонах и угловые ускорения.
- `FlightAssist` хранит лимиты скорости, перегрузки и параметры комфортного торможения.

### Параметры default ship
- `meta.id = default_fighter`
- `meta.name = Default Fighter`
- `meta.manufacturer = Generic`
- `meta.version = 0.8.6`
- `geometry.length_m = 11.5`
- `geometry.width_m = 11.0`
- `geometry.height_m = 3.5`
- `hull.dry_mass_t = 10.0`
- `hull.hull_hp = 1000.0`
- `physics.forward_accel_mps2 = 90.0`
- `physics.reverse_accel_mps2 = 67.5`
- `physics.strafe_accel_mps2 = 85.0`
- `physics.yaw_accel_dps2 = 200.0`
- `physics.pitch_accel_dps2 = 180.0`
- `physics.roll_accel_dps2 = 220.0`
- `physics.c_prime_default_mps = 5000`
- `limits.crew_g_limit = 11.0`
- `limits.linear_speed_max_mps.forward = 260.0`
- `limits.linear_speed_max_mps.reverse = 180.0`
- `limits.linear_speed_max_mps.lateral = 220.0`
- `limits.linear_speed_max_mps.vertical = 220.0`
- `limits.angular_speed_max_dps.yaw = 80.0`
- `limits.angular_speed_max_dps.pitch = 95.0`
- `limits.angular_speed_max_dps.roll = 130.0`
- `flight_assist.comfortable_braking_time_s = 3.5`
- `flight_assist.comfortable_angular_stop_time_s = 1.0`

## 3. Принцип управления кораблем
### Назначение
Преобразовать ввод игрока в команды управления кораблем для отправки на сервер.

### Каналы ввода
- Клавиатура и мышь: `InputManager`.
- Сенсорный экран: `SingleJoystickManager` и `InputTranslator`.

### Логика
- `InputManager` собирает команды `thrust`, `strafeX`, `strafeY`, `yaw`, `brake`, `flightAssist`.
- `GameClient` работает в фиксированном шаге 30 Гц и отправляет по одному `CommandFrame` на тик.
- Переключение режима `coupled/decoupled` управляет состоянием `flightAssist`.

### Ограничения
- Значения команд нормализованы в диапазоне [-1, 1].
- При потере фокуса окна ввод сбрасывается.

## 4. Flight Assist и режимы полета
### Назначение
Обеспечить стабилизацию полета и ограничения по скорости и перегрузке.

### Режимы
- FA:ON — включен `FlightAssistSystem`, применяется комфортное торможение и лимиты.
- FA:OFF — команды проходят с минимальным ограничением на диапазон, без стабилизации.

### Логика FA:ON
- Преобразование желаемых скоростей в команды тяги и бокового ускорения.
- Применение лимитов скорости и перегрузки.
- При торможении (`brake`) используется усиленное снижение скорости.
- Ограничение угловой скорости через `AngularSpeedLimits_dps`.

### Логика FA:OFF
- Команды напрямую передаются в `PhysicsSystem` после ограничения диапазона.

## 5. Логика ассистента управления в мобильном режиме
### Назначение
Дать единый сенсорный ввод, преобразуемый в команды полета.

### Логика `SingleJoystickManager`
- Виртуальный джойстик с динамическим размещением по размеру экрана.
- Преобразование касаний в вектор направления в мировых координатах.
- Мертвая зона и нормализация длины вектора.
- Кнопка `BRAKE` формирует аварийное торможение.

### Логика `InputTranslator`
- Определение режима `DirectControlMode` на основе наличия цели.
- `FreeFlightMode`: нос корабля направляется по вектору джойстика, включается компенсация сноса и авто‑торможение.
- `CombatLockMode`: нос всегда на цели, джойстик управляет сближением и орбитальным движением.
- Переход между режимами сглаживается через `ModeTransition`.

### Ограничения
- При FA:OFF ввод дополнительно демпфируется при устойчивом удержании джойстика.

## 6. Алгоритм прогнозного сглаживания
### Назначение
Снизить рывки движения удаленных сущностей при сетевых задержках.

### Входные данные
- Снимки мира из сети в `SnapshotStore`.
- Время сервера и смещение клиентских часов.

### Выходные данные
- Сглаженные `EntityState` для отрисовки.

### Логика
- `SnapshotStore` сохраняет последний снимок и вычисляет смещение `serverTimeOffsetMs`.
- `EntitySmoother` строит прогноз цели на момент `serverNow + lookAheadMs`.
- Для позиции и вращения строится кривая Эрмита между текущим визуальным состоянием и прогнозной целью.
- Продвижение по кривой ускоряется при большом рассогласовании, но ограничивается `maxCatchUpFactor`.
- При превышении `maxDeviation` происходит немедленное выравнивание, чтобы избежать длинного хвоста.
- При отсутствии новых снимков включается ограниченная экстраполяция до `maxExtrapolationMs` с плавным затуханием.

### Дополнительно
- В проекте есть вспомогательные функции Эрмита в `network/HermiteSpline.ts`, используемые для вычислений сглаживания в сетевом слое.

