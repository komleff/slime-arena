# ТЗ: Управление и движение 2D‑слаймов (Slime Arena)

**Версия:** 1.0.1  
**Дата:** декабрь 2025  

Документ предназначен для ИИ‑кодеров. Основа: **SlimeArena_Flight_TZ-ChatGPT.md** + усиления из **SlimeArena_Flight_TZ-Opus.md** (порядок систем, таблицы, пресеты миров, таблица отличий).

---

## 0) Назначение и границы

### 0.0 Изменения версии 1.0.1
- **Раздел 13 переписан** — реализован U2-стиль сглаживания:
  - Visual State System вместо интерполяции между снапшотами
  - Velocity Integration с весом `VELOCITY_WEIGHT=0.7`
  - Упрощён `ClientNetSmoothingConfig` до единственного поля `lookAheadMs`
  - Константы сглаживания захардкожены в клиенте
- Добавлена документация: `.memory_bank/modules/U2-smoothing.md`

### 0.1 Цель
Максимально близко воспроизвести ощущения управления из **U2 (FA:Mobile / one joystick)**, но для **2D круглых слаймов** с **ньютоновской физикой**. Масса активно меняется, поэтому симуляция обязана использовать **силы/моменты**. Ускорения допускаются только как справочные величины для редактора.

### 0.2 Что входит
- Ввод: 1 адаптивный виртуальный джойстик (client) → серверная валидация.
- `SlimeFlightAssistSystem` (server): поворот к целевому курсу, компенсация дрейфа, мягкое гашение перескорости, демпфирование угловой скорости.
- `SlimePhysicsSystem` (server): интеграция сил/моментов + сопротивление среды (зависит от мира).
- `CollisionSystem` (server): столкновения круг‑круг, круг‑граница, с реституцией и позиционной коррекцией.
- Конфиги `SlimeConfig`, `WorldPhysicsConfig`, `ClientNetSmoothingConfig`.
- Клиентское прогнозное сглаживание (кубическая Эрмита + экстраполяция/затухание).

### 0.3 Что не входит
- Режимы FA:OFF/FA:ON, клавиатурное управление.
- Второй джойстик, кнопка BRAKE.
- Выбор цели/лок‑он.
- Тороидальный мир (wrapCoord).

---

## 1) Отличия от U2 (контрольный список)

| Аспект | U2 | Slime Arena |
|---|---|---|
| Физика | релятивистская | ньютоновская |
| Объект | корабль | круглый 2D‑слайм |
| Параметры движения | ускорения | силы/моменты (ускорения вычисляются) |
| Масса | фиксированная | динамическая |
| Трение | отсутствует | настраивается миром |
| Режимы FA | ON/OFF/Mobile | только Mobile (всегда включен) |
| Джойстики | 1 или 2 | только 1 |
| BRAKE | есть | нет |
| Форма мира | тор | прямоугольник или круг |
| HP | отдельный параметр | maxHP = масса |

---

## 2) Порядок выполнения систем (серверный тик)

Фиксированный тик симуляции: **30 Гц**. Константа: `dt = 1/30`. Запрещено использовать переменный `deltaTime` в серверной симуляции.

Порядок выполнения на каждом тике:

**FlightAssistSystem → PhysicsSystem → CollisionSystem**

---

## 3) Координаты, ориентация, единицы

### 3.1 Единицы и правило конвертации
- Масса: кг
- Радиус/позиция: м
- Скорость: м/с
- Сила: Н
- Момент (torque): Н·м
- Угол/угловая скорость (внутри симуляции): **рад**, **рад/с**

Правило:
- Поля конфигов с суффиксами `Deg`, `Degps`, `Degps2` задаются **в градусах** для удобства и **конвертируются в радианы** при загрузке.
- Все вычисления выполняются только в радианах.

### 3.2 Система координат мира
- Начало координат мира: **центр карты** `(0, 0)`.
- Ось X: вправо.
- Ось Y: вверх.
- Угол `angle` (yaw):
  - `angle = 0` смотрит вдоль **+X**.
  - Положительное направление вращения: против часовой стрелки.

### 3.3 Локальные оси слайма и преобразования
- `forward = (cos(angle), sin(angle))`
- `right  = (-sin(angle), cos(angle))`

Преобразование локальная → мировая:
- `F_world = forward * F_forward + right * F_right`

Преобразование мировая → локальная:
- `v_forward = dot(v_world, forward)`
- `v_right   = dot(v_world, right)`

---

## 4) Конфиг `SlimeConfig` (ТТХ слайма)

### 4.1 Структура
`SlimeConfig` содержит:

**Meta**
- `id: string`
- `name: string`

**Geometry**
- `baseMassKg: number` (обычные слаймы: 100)
- `baseRadiusM: number`
- `radiusFromMass: { type: "sqrt" }`

**Propulsion** (каноническая часть для симуляции)
- `thrustForwardN: number`
- `thrustReverseN: number`
- `thrustLateralN: number`
- `turnTorqueNm: number`

**Limits + Assist**
- `speedLimitForwardMps: number`
- `speedLimitReverseMps: number`
- `speedLimitLateralMps: number`
- `angularSpeedLimitRadps: number` *(в конфиге можно задавать `angularSpeedLimitDegps`, конвертировать при загрузке)*

- `comfortableBrakingTimeS: number`
- `angularStopTimeS: number`

- `autoBrakeMaxThrustFraction: number` (0..1)
- `overspeedDampingRate: number` (0..1) — доля превышения скорости, снимаемая **за один серверный тик**

- `yawFullDeflectionAngleRad: number` *(в конфиге можно задавать `yawFullDeflectionAngleDeg`)*
- `yawOscillationWindowFrames: number`
- `yawOscillationSignFlipsThreshold: number`
- `yawDampingBoostFactor: number (>=1)`
- `yawCmdEps: number` — порог «считаем, что поворотного ввода нет» (по умолчанию `0.001`)

**Combat**
- `biteDamagePctOfMass: number`
- `orbBitePctOfMass: number`

**MassScaling** (кривые масштабирования)
- набор кривых для параметров, см. раздел 5.

### 4.2 Дублирующие параметры для редактора (ускорения)
Разрешено хранить в конфиге/редакторе справочные ускорения для массы 100 кг:
- `thrustForwardAccelAtBase`
- `thrustReverseAccelAtBase`
- `thrustLateralAccelAtBase`
- `turnAngularAccelAtBase`

Правило приоритета:
- **Каноничны силы/момент** (`*N`, `turnTorqueNm`).
- Ускорения считаются производными и должны автоматически пересчитываться редактором.
- Если в файле конфигурации присутствуют и силы, и ускорения, и они расходятся — при загрузке:
  1) используются силы/момент;
  2) ускорения пересчитываются;
  3) выдаётся предупреждение валидатора.

---

## 5) Прогрессия параметров от массы (mass scaling)

### 5.1 Радиус (обязательное правило)
`radius(m) = baseRadiusM * √(m / baseMassKg)`

### 5.2 Момент инерции
Слайм аппроксимируется диском:

`I(m) = inertiaFactor * m * radius(m)^2`

- `inertiaFactor` по умолчанию: **0.5**.

### 5.3 Типы кривых
Поддерживаются кривые:

**Power**
`value(m) = baseValue * (m/baseMass)^exp`

**Log**
`value(m) = baseValue * (1 + k * ln(m/baseMass))`

Ограничения (обязательные):
- применяем `mSafe = max(m, minMassForCurves)`; по умолчанию `minMassForCurves = baseMass * 0.1`.
- итог clamp: `value = clamp(value, minValue, maxValue)` (min/max задаются в кривой либо отсутствуют).

Параметры по умолчанию для `log`:
- `k` должен быть задан явно; если не задан — `k = 0` (кривая становится константой).

### 5.4 Какие параметры масштабируются (значения по умолчанию)
По умолчанию (стартовые настройки, затем тюнинг):

- `thrustForwardN`, `thrustReverseN`, `thrustLateralN`: `power exp = 0.5`

- `turnTorqueNm`: **особое правило**.
  - Поскольку `radius ∝ √m`, то `I ∝ m * radius^2 ∝ m^2`.
  - Чтобы угловое ускорение `α = τ/I` падало примерно как `1/√m` (аналогично линейному ускорению при `F ∝ √m`), требуется `τ ∝ m^{1.5}`.
  - Поэтому значение по умолчанию: `power exp = 1.5`.
  - Допускается тюнинг экспоненты по геймплейным ощущениям.

- `speedLimit*`, `angularSpeedLimitRadps`: константа (или лёгкая деградация `power exp ∈ [-0.1..0]`)
- `biteDamagePctOfMass`: константа
- `orbBitePctOfMass`: константа

---

## 6) Классы слаймов и босс

### 6.1 Классы (охотник / воин / собиратель)
Требование ТЗ (для однозначности): **каждый класс — отдельный `SlimeConfig`**.

### 6.2 Босс
Требование ТЗ: каждый босс — отдельный `SlimeConfig`.

---

## 7) `WorldPhysicsConfig` (параметры мира)

### 7.1 Структура
- `linearDragK: number` — линейное сопротивление среды
- `angularDragK: number` — угловое сопротивление среды
- `restitution: number` — коэффициент реституции (по умолчанию 0.9)
- `maxPositionCorrectionM: number` — лимит позиционной коррекции за один тик/итерацию (по умолчанию 0.5 м)

- `worldShape: "rectangle" | "circle"`
- если `rectangle`:
  - `widthM: number`
  - `heightM: number`
- если `circle`:
  - `radiusM: number`

Границы центра карты находятся в (0,0).

### 7.2 Формулы сопротивления (drag)
Используется линейная модель (пропорционально скорости), устойчивая и предсказуемая:

- `F_drag_world = - m * linearDragK * v_world`
- `τ_drag = - I * angularDragK * angVel`

Если `linearDragK = 0`, линейного сопротивления нет.
Если `angularDragK = 0`, углового сопротивления нет.

Сила и момент сопротивления суммируются с силами/моментами от ассиста **до** интеграции.

### 7.3 Пресеты миров (пример)
| Мир | linearDragK | angularDragK | restitution |
|---|---:|---:|---:|
| Стандарт | 0.1 | 0.0 | 0.9 |
| Космос | 0.0 | 0.0 | 0.95 |
| Болото | 0.3 | 0.1 | 0.7 |
| Арена | 0.1 | 0.0 | 0.95 |

---

## 8) Ввод (1 адаптивный джойстик)

### 8.1 Формат команды на сервер
Каждый пакет ввода содержит:
- `inputSeq: int` — монотонно растущий номер команды
- `moveX, moveY ∈ [-1, 1]`

Сервер хранит для игрока:
- `lastAcceptedSeq`
- `latestInput` (последний принятый ввод)
- `lastInputServerTimeMs` (время приёма последнего ввода по времени сервера)

Правила обработки:
1) Если `inputSeq <= lastAcceptedSeq` — ввод отвергается как устаревший/дубликат.
2) Сервер на каждом своём тике применяет **последний принятый** `latestInput`.
3) Если новый ввод не поступал дольше `inputTimeoutMs`, считается, что ввода нет (`mag=0`).

Рекомендуемые значения:
- `inputTimeoutMs = 200`

### 8.2 Deadzone и поведение `mag=0`
Deadzone применяется:
- на клиенте **до отправки на сервер** (для удобства игрока),
- на сервере повторно (для безопасности и единообразия симуляции).

Расчёт:
- `len = sqrt(moveX^2 + moveY^2)`
- если `len <= deadzoneRadius` → `mag = 0`, ввод отсутствует
- иначе:
  - `mag = clamp((len - deadzoneRadius) / (1 - deadzoneRadius), 0..1)`
  - `dir = (moveX, moveY) / len`

Если `mag == 0`:
- считается, что ввода нет;
- активируются алгоритмы **гашения дрейфа** (9.4) и **демпфирования угловой скорости** (9.6).

---

## 9) `SlimeFlightAssistSystem` (всегда активен)

### 9.1 Целевой курс и команда поворота
Если `mag > 0`:
- `targetAngle = atan2(dir.y, dir.x)`
- `delta = wrapToPi(targetAngle - angle)`  (диапазон `[-π..π]`)
- `yawCmd = clamp(delta / yawFullDeflectionAngleRad, -1..1)`

Параметр:
- `yawFullDeflectionAngleRad` — угол, при котором команда поворота достигает максимума.
- Рекомендуемое значение по умолчанию: `π/2` (90°).

Антиосцилляции yaw:
- в окне `yawOscillationWindowFrames` считаем число смен знака `yawCmd`;
- если `signFlips >= yawOscillationSignFlipsThreshold` → `yawCmd = yawCmd / yawDampingBoostFactor`.

### 9.2 Команда тяги игрока
Если `mag > 0`:
- `thrustCmd = mag` (0..1)
- целевая продольная сила игрока:
  - `F_player_forward = thrustCmd * thrustForwardN(m)`

Игрок напрямую не задаёт боковую тягу. Боковая/обратная тяга может применяться ассистом только для стабилизации и торможения.

### 9.3 Итоговые ограничения сил
На каждом тике ассист формирует локальные силы `F_forward`, `F_right` и момент `τ` с ограничениями:
- `F_forward ∈ [-thrustReverseN(m), +thrustForwardN(m)]`
- `F_right   ∈ [-thrustLateralN(m), +thrustLateralN(m)]`
- `τ         ∈ [-turnTorqueNm(m), +turnTorqueNm(m)]`

Примечание: значения `thrust*` и `turnTorqueNm` уже включают масштабирование по массе.

### 9.4 Гашение дрейфа (при отсутствии ввода)
Условие: `mag == 0`.

Цель: свести скорость к нулю плавно за `comfortableBrakingTimeS`.

1) `a_des_world = - v_world / comfortableBrakingTimeS`
2) `F_des_world = m * a_des_world`
3) Перевод в локальные оси:
   - `F_des_forward = dot(F_des_world, forward)`
   - `F_des_right   = dot(F_des_world, right)`
4) Обрезка по доступным тягам:
   - `F_forward = clamp(F_des_forward, -thrustReverseN(m), +thrustForwardN(m))`
   - `F_right   = clamp(F_des_right,   -thrustLateralN(m), +thrustLateralN(m))`
5) Ограничение «комфортного режима без ввода»:
   - `F_forward *= autoBrakeMaxThrustFraction`
   - `F_right   *= autoBrakeMaxThrustFraction`

### 9.5 Мягкое гашение перескорости (после столкновений/взрывов)
Скорость может превышать лимиты. Запрещены жёсткие клэмпы скорости.

Определение:
- `overspeedDampingRate` — доля превышения, снимаемая **за тик**.
- Эквивалентное представление (для проверки):
  - если `excess = |v| - limit > 0`, то целевое новое превышение: `excessNew = excess * (1 - overspeedDampingRate)`.

Алгоритм по локальным осям:

**Forward/Reverse**
1) `v = v_forward`
2) `limit = (v >= 0) ? speedLimitForwardMps : speedLimitReverseMps`
3) `excess = abs(v) - limit`
4) если `excess <= 0` → перескорости нет
5) иначе:
   - `dv_target = -sign(v) * excess * overspeedDampingRate`
   - `a_target = dv_target / dt`
   - `F_req = m * a_target`
   - доступная тормозная сила по знаку:
     - если `v > 0` тормозим назад: `F_brakeMax = thrustReverseN(m)`
     - если `v < 0` тормозим вперёд: `F_brakeMax = thrustForwardN(m)`
   - `F_brake = clamp(F_req, -F_brakeMax, +F_brakeMax)`
   - если `mag == 0` дополнительно: `F_brake *= autoBrakeMaxThrustFraction`
   - прибавить `F_brake` к текущему `F_forward` ассиста

**Lateral**
1) `v = v_right`
2) `limit = speedLimitLateralMps`
3) `excess = abs(v) - limit`
4) если `excess > 0`:
   - `dv_target = -sign(v) * excess * overspeedDampingRate`
   - `a_target = dv_target / dt`
   - `F_req = m * a_target`
   - `F_brake = clamp(F_req, -thrustLateralN(m), +thrustLateralN(m))`
   - если `mag == 0`: `F_brake *= autoBrakeMaxThrustFraction`
   - прибавить к `F_right`

Важно: после суммирования всех вкладов (ввод игрока + drift‑brake + overspeed‑brake) применить финальную обрезку `F_forward/F_right` по ограничениям 9.3.

### 9.6 Демпфирование угловой скорости (при отсутствии поворотного ввода)
Условие «поворотного ввода нет»:
- если `mag == 0` → поворотного ввода нет;
- если `mag > 0`, но `abs(yawCmd) < yawCmdEps` → считать, что поворотного ввода нет.

Цель: уменьшать `angVel` с характерным временем `angularStopTimeS` без превышения доступного момента.

1) `alpha_target = - angVel / angularStopTimeS`
2) `τ_req = I(m) * alpha_target`
3) `τ_max = turnTorqueNm(m)`
4) `τ = clamp(τ_req, -τ_max, +τ_max)`

Если `angularStopTimeS <= 0`:
- считать `alpha_target` бесконечным, а итог ограничить моментом: `τ = -sign(angVel) * τ_max`.

### 9.7 Поворот к курсу при вводе
Если `mag > 0` и `abs(yawCmd) >= yawCmdEps`, момент поворота:
- `τ_turn = yawCmd * turnTorqueNm(m)`

Итоговый момент:
- если условие 9.7 выполнено: `τ = τ_turn`
- иначе: `τ` из 9.6

---

## 10) `SlimePhysicsSystem` (ньютоновская интеграция)

### 10.1 Итоговые силы/моменты за тик
Суммарные величины до интеграции:
- `F_total_world = F_assist_world + F_drag_world`
- `τ_total = τ_assist + τ_drag`

где:
- `F_assist_world` получаем из 9.3–9.5 и преобразования 3.3
- `F_drag_world` и `τ_drag` из 7.2

### 10.2 Интегратор: Semi‑Implicit Euler (обязательная последовательность)
Для устойчивости используется Semi‑Implicit Euler:

1) `a = F_total_world / m`
2) `vel = vel + a * dt`
3) `pos = pos + vel * dt`   (используется уже обновлённая `vel`)

4) `alpha = τ_total / I`
5) `angVel = angVel + alpha * dt`
6) `angle = angle + angVel * dt` (используется уже обновлённая `angVel`)

Угол рекомендуется нормализовать в `[-π..π]`.

### 10.3 Изменение массы во время движения (однозначное правило)
При мгновенном изменении массы (съел пузырь, откусили массу, и т.п.):
- `vel` и `angVel` **сохраняются** (аркадный подход ради управляемости).
- далее все ускорения автоматически меняются, т.к. `a = F/m`, `α = τ/I`.

---

## 11) `CollisionSystem` (столкновения)

### 11.1 Общий принцип
- Метод: **импульсный** (velocity impulses) + **позиционная коррекция** проникновения.
- `restitution` берётся из `WorldPhysicsConfig`.

### 11.2 Круг‑круг (слайм‑слайм, слайм‑пузырь)
Обозначения:
- `pA, vA, mA, rA` и `pB, vB, mB, rB`
- `invMassA = (mA>0) ? 1/mA : 0`
- `invMassB = (mB>0) ? 1/mB : 0`

Проверка пересечения:
- `d = pB - pA`
- `dist = length(d)`
- `rSum = rA + rB`
- если `dist >= rSum` → коллизии нет

Нормаль:
- если `dist > 0`: `n = d / dist`
- иначе: `n = (1, 0)` (детерминированно)

**Позиционная коррекция** (обязательна):
- `penetration = rSum - dist`
- параметры решателя:
  - `slop = 0.001` (м)
  - `percent = 0.8` (0..1)
- `corrMagRaw = max(penetration - slop, 0) / (invMassA + invMassB) * percent`
- `corrMag = min(corrMagRaw, maxPositionCorrectionM)`
- `corr = n * corrMag`
- `pA = pA - corr * invMassA`
- `pB = pB + corr * invMassB`

**Импульс**:
- `rv = vB - vA`
- `velAlongNormal = dot(rv, n)`
- если `velAlongNormal > 0` → тела расходятся, импульс не применять
- `e = restitution`
- `j = -(1 + e) * velAlongNormal / (invMassA + invMassB)`
- `impulse = n * j`
- `vA = vA - impulse * invMassA`
- `vB = vB + impulse * invMassB`

### 11.3 Круг‑граница

**Прямоугольник** (`widthM`, `heightM`): границы:
- `x ∈ [-width/2, +width/2]`, `y ∈ [-height/2, +height/2]`

Если `pos.x - r < -width/2`:
- `pos.x = -width/2 + r`
- `vel.x = abs(vel.x) * restitution`

Если `pos.x + r > +width/2`:
- `pos.x = +width/2 - r`
- `vel.x = -abs(vel.x) * restitution`

Аналогично по Y.

**Круглая карта** (`radiusM`):
- если `length(pos) + r > radiusM`:
  - `n = normalize(pos)`
  - `pos = n * (radiusM - r)`
  - отразить скорость по нормали:
    - `vN = dot(vel, n)`
    - `vel = vel - (1 + restitution) * vN * n`

### 11.4 Множественные коллизии за тик
Чтобы уменьшить проникновение:
- на каждом серверном тике выполнять **итерационный решатель**:
  - `solverIterations = 4` (по умолчанию)
  - на каждой итерации перебрать все пары потенциальных пересечений и применить 11.2, затем границы 11.3.

---

## 12) HP и масса (системное правило)

Определения:
- `maxHP = massKg`

Правила:
1) Урон снижает `HP`, **масса не меняется**.
2) Потеря массы (любым способом) уменьшает `maxHP`; затем `HP = min(HP, maxHP)`.
3) Получение массы увеличивает `maxHP` и **увеличивает текущий `HP` на ту же величину**.

Однозначный пример:
- Было: `mass=100`, `maxHP=100`, `HP=50`
- Съели: `+10 mass`
- Стало: `mass=110`, `maxHP=110`, `HP=60`

---

## 13) Клиентское прогнозное сглаживание (U2-стиль)

### 13.1 Конфиг `ClientNetSmoothingConfig` (упрощённый)
Где хранится: `config/balance.json`.

Единственный параметр:
- `lookAheadMs = 150` — экстраполяция на N миллисекунд вперёд

Все остальные константы захардкожены в клиенте для оптимальности.

### 13.2 Принцип U2-стиля
Визуальное состояние (visual state) отделено от серверного и плавно «догоняет» целевую точку.

| Аспект | Классическая интерполяция | U2-стиль |
|--------|--------------------------|----------|
| Буфер снапшотов | 3-6 | 1 (последний) |
| Рендер-время | В прошлом | В настоящем/будущем |
| Движение | Интерполяция A→B | Visual state + catch-up |
| Потеря пакетов | Экстраполяция/замедление | Плавное продолжение |

### 13.3 Константы сглаживания (захардкожены)

| Константа | Значение | Назначение |
|-----------|----------|-----------|
| `VELOCITY_WEIGHT` | 0.7 | Вес интеграции скорости vs коррекции |
| `CATCH_UP_SPEED` | 10.0 | Скорость догоняния (ед/с на ед. ошибки) |
| `MAX_CATCH_UP_SPEED` | 800 | Максимальная скорость коррекции (м/с) |
| `TELEPORT_THRESHOLD` | 100 | Порог телепорта (метры) |
| `ANGLE_CATCH_UP_SPEED` | 12.0 | Скорость догоняния угла (рад/с на рад) |

### 13.4 Алгоритм smoothStep (каждый кадр)

1) Берём последний снапшот `S`.
2) Вычисляем целевую точку:
   - `targetPos = S.pos + S.vel * (lookAheadMs/1000)`
   - `targetAngle = S.angle + S.angVel * (lookAheadMs/1000)`

3) Проверка телепорта:
   - Если `error > TELEPORT_THRESHOLD` → мгновенный перенос

4) Velocity Integration:
   - `velocityMove = visual.v * dtSec`

5) Catch-up коррекция:
   - `catchUpSpeed = min(error * CATCH_UP_SPEED, MAX_CATCH_UP_SPEED)`
   - `correction = направление_к_цели * catchUpSpeed * dtSec`

6) Комбинирование:
   - `visual += velocityMove * VELOCITY_WEIGHT + correction * (1 - VELOCITY_WEIGHT * 0.5)`

7) Интерполяция velocity к серверной

8) Сглаживание угла с `ANGLE_CATCH_UP_SPEED`

### 13.5 Особенности для разных сущностей

**Игроки (slimes):**
- Полное сглаживание позиции, скорости и угла
- Угол важен для боёвки

**Пузыри (orbs):**
- Упрощённое сглаживание только позиции
- Ускоренный catch-up (`CATCH_UP_SPEED * 1.5`)

**Сундуки (chests):**
- Без сглаживания — напрямую из снапшота

### 13.6 Подробная документация
См. `.memory_bank/modules/U2-smoothing.md`

---

## 14) Критерии приёмки (проверочные условия)

### 14.1 FlightAssist: гашение дрейфа
- При отпускании джойстика (`mag=0`) слайм с базовыми параметрами в мире `linearDragK=0.1` снижает скорость до near‑zero (|v| < 1 м/с) за время, близкое к `comfortableBrakingTimeS`.
- Допуск по времени: **±20%**.

### 14.2 FlightAssist: перескорость
- После столкновения, разогнавшего слайма выше `speedLimitForwardMps`, скорость плавно снижается до лимита в течение **1–3 секунд**.
- Запрещены резкие клэмпы скорости (скачок скорости вниз более чем на 20% за один тик без физического импульса).

### 14.3 FlightAssist: удержание лимита при движении
- При удержании джойстика в одном направлении более **2 секунд** слайм стабилизируется около `speedLimitForwardMps`.
- Допуск по превышению: **не более 5%** (в отсутствие внешних импульсов).

### 14.4 Масса и управляемость
- При увеличении массы в 10 раз (100 → 1000 кг) линейные/угловые ускорения уменьшаются согласно заданным кривым (по умолчанию: thrust `exp=0.5`, torque `exp=1.5`) без «скачков».

### 14.5 Коллизии
- При одинаковых массах и лобовом столкновении без сопротивления (`linearDragK=0`) скорости после удара соответствуют импульсному решению с `restitution`.
- Проникновение после решения коллизий не превышает `slop` + малую погрешность (≤ 0.01 м), при этом коррекция ограничена `maxPositionCorrectionM`.

---

## Приложение A) Таблица “базовый слайм” (референс)

Примечание по единицам:
- В таблице рядом могут встречаться значения в градусах (для читаемости). При загрузке конвертировать в радианы.

| Параметр | Значение |
|---|---|
| baseMassKg | 100 |
| baseRadiusM | 1.0 |
| thrustForwardN | 9000 (90 м/с² при 100 кг) |
| thrustReverseN | 6750 (67.5 м/с² при 100 кг) |
| thrustLateralN | 8500 (85 м/с² при 100 кг) |
| turnTorqueNm | 175 (пример для baseRadius=1 и inertiaFactor=0.5; далее torque масштабируется по exp=1.5) |
| speedLimitForwardMps | 260 |
| speedLimitReverseMps | 180 |
| speedLimitLateralMps | 220 |
| angularSpeedLimitDegps | 80 (→ `angularSpeedLimitRadps ≈ 1.396`) |
| comfortableBrakingTimeS | 3.5 |
| angularStopTimeS | 1.0 |
| autoBrakeMaxThrustFraction | 0.6 |
| overspeedDampingRate | 0.2 |
| yawFullDeflectionAngleDeg | 90 (→ `yawFullDeflectionAngleRad = π/2`) |
| yawCmdEps | 0.001 |
| yawOscillationWindowFrames | 12 |
| yawOscillationSignFlipsThreshold | 4 |
| yawDampingBoostFactor | 2.0 |
| biteDamagePctOfMass | 0.02 (пример) |
| orbBitePctOfMass | 0.05 (пример) |

---

## Приложение B) Рекомендуемая раскладка файлов (ориентир)

| Модуль | Путь |
|---|---|
| SlimePhysicsSystem | `server/src/rooms/ArenaRoom.ts` (встроено) |
| SlimeFlightAssistSystem | `server/src/rooms/ArenaRoom.ts` (встроено) |
| CollisionSystem | `server/src/rooms/ArenaRoom.ts` (встроено) |
| SlimeConfig | `shared/src/config.ts` |
| WorldPhysicsConfig | `shared/src/config.ts` |
| ClientNetSmoothingConfig | `shared/src/config.ts` + `config/balance.json` |
| SingleJoystickManager | `client/src/main.ts` (встроено) |
| InputTranslator | `client/src/input/joystick.ts` |
| VisualStateSystem | `client/src/main.ts` (U2-стиль: `visualPlayers`, `visualOrbs`, `smoothStep`) |

**Примечание:** `HermiteSpline`, `SnapshotStore`, `EntitySmoother` больше не используются — заменены на U2-стиль сглаживания.



