# SlimeArena Flight — Implementation Plan

Назначение: план выполнения работ по реализации системы управления/полёта слаймов. Основан на ТЗ **“SlimeArena Flight TZ (Merged)”**.

Статус документа: рабочий. После завершения реализации может быть заархивирован или удалён.

---

## Этап 0 — Контракт данных и валидация конфигов
Цель: единые типы, единицы измерения, дефолты, конвертации, чтобы последующие модули были однозначны.

- Ввести базовые типы:
  - `Vec2`
  - `SlimeState` (pos/vel/angle/angVel/mass/radius)
  - `InputState` (inputSeq, moveX/moveY, derived mag/dir)
  - `AssistForces` (F_forward/F_right, τ, F_world)
- Реализовать структуры конфигов:
  - `SlimeConfig`
  - `WorldPhysicsConfig`
  - `ClientNetSmoothingConfig`
- Загрузка + валидация:
  - конвертация `Deg → Rad` при загрузке
  - проверка диапазонов
  - предупреждения при расхождении сил/ускорений (каноничны силы/момент)

Артефакты:
- типы/интерфейсы
- валидатор конфигов
- простые unit‑tests на конвертацию/валидацию

---

## Этап 1 — Сервер: pipeline ввода
Цель: детерминированная обработка ввода и единое понимание «ввода нет».

- Протокол ввода:
  - `inputSeq` монотонный
  - `moveX, moveY ∈ [-1..1]`
- Серверное состояние по игроку:
  - `lastAcceptedSeq`
  - `latestInput`
  - `lastInputServerTimeMs`
- Правила:
  - `inputSeq <= lastAcceptedSeq` → reject
  - если нет ввода дольше `inputTimeoutMs` → считать `mag=0`
- Deadzone:
  - на клиенте до отправки
  - на сервере повторно

Артефакты:
- модуль обработки ввода
- unit‑tests на seq/timeout/deadzone

---

## Этап 2 — Сервер: `SlimeFlightAssistSystem`
Цель: итоговые локальные силы `F_forward/F_right` и момент `τ` строго по разделу 9 ТЗ.

- `yawCmd` и антиосцилляции
- переключение 9.6/9.7 по `yawCmdEps`
- тяга игрока только вперёд
- drift‑brake (9.4)
- overspeed‑brake (9.5)
- angular damping (9.6)
- финальная обрезка по 9.3
- mass scaling по разделу 5
  - `turnTorqueNm exp=1.5` по умолчанию

Артефакты:
- `SlimeFlightAssistSystem`
- тест‑сценарии: устойчивость к осцилляциям yaw, корректные ограничения сил

---

## Этап 3 — Сервер: `SlimePhysicsSystem`
Цель: интеграция и сопротивление среды.

- Drag по 7.2:
  - `F_drag = -m * linearDragK * v`
  - `τ_drag = -I * angularDragK * angVel`
- Semi‑Implicit Euler по 10.2
- Правило 10.3: при мгновенной смене массы сохранять `vel/angVel`

Артефакты:
- `SlimePhysicsSystem`
- unit‑tests на корректную последовательность интеграции

---

## Этап 4 — Сервер: `CollisionSystem`
Цель: корректные коллизии без клэмпов скорости.

- Circle–circle:
  - позиционная коррекция (percent/slop)
  - лимит `maxPositionCorrectionM`
  - импульс с restitution
- Circle–bounds:
  - rectangle/circle
- Итерационный решатель:
  - `solverIterations = 4`

Артефакты:
- `CollisionSystem`
- тесты: penetration ≤ допуск, restitution работает

---

## Этап 5 — Сервер: тик‑пайплайн и снапшоты
Цель: закрепить порядок **Assist → Physics → Collision** и формат снапшота.

- фиксированный `dt=1/30`
- tick counter
- snapshot формат: `pos, vel, angle, angVel, mass, radius`

Артефакты:
- tick‑runner/loop
- сборка снапшота

---

## Этап 6 — Автотесты (smoke) по критериям приёмки ТЗ
Минимальный набор, который должен проходить стабильно:

1) Drift‑brake: при `mag=0` скорость падает до `|v| < 1 м/с` за `comfortableBrakingTimeS` (±20%).
2) Overspeed: после разгона выше лимита скорость возвращается к лимиту за 1–3 сек без резких скачков.
3) Hold limit: при удержании ввода стабилизация около `speedLimitForwardMps` (≤5% превышение).
4) Масса x10: ускорения падают согласно кривым (thrust exp=0.5, torque exp=1.5) без «скачков».
5) Коллизии: penetration ≤ допуск; корректная реакция по restitution.

Артефакты:
- smoke‑suite, который можно гонять в CI

---

## Этап 7 — Клиент: сглаживание (второй инкремент)
Цель: визуальная плавность без потери точности угла.

- `SnapshotStore`, `EntitySmoother`, Hermite
- `ClientNetSmoothingConfig`, включая `angleMaxDeviationRad`
- угол догонять быстрее позиции

Артефакты:
- клиентские модули сглаживания
- визуальные/инструментальные проверки (dev‑режим)

