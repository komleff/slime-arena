# Reverse: Game State Schema
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Модуль Game State Schema определяет все серверные сущности, синхронизируемые с клиентами через Colyseus Schema. Файл `GameState.ts` содержит 15 Schema-классов, которые образуют полное состояние игрового мира: игроки (Player), объекты (Orb, Chest, Projectile, Mine), зоны (HotZone, SlowZone, ToxicPool, Zone, SafeZone), препятствия (Obstacle) и мета-объекты (Talent, TalentCard, AbilityCard, GameState).

Паттерн разделения: поля с декоратором `@type()` автоматически синхронизируются Colyseus с клиентом. Поля без `@type()` (server-only) существуют только на сервере и используются для внутренних расчётов, cooldown-тиков, модификаторов талантов и вспомогательного состояния.

Корневой объект `GameState` содержит коллекции (MapSchema/ArraySchema) всех сущностей и глобальные параметры матча (фаза, таймер, тик, matchId, leaderboard).

---

## 2. Исходные файлы

| Файл | Назначение |
|------|------------|
| `server/src/rooms/schema/GameState.ts` | Определение всех Schema-классов (309 строк) |
| `shared/src/types.ts` | Общие типы: `InputCommand`, `MatchPhaseId`, `PlayerResult`, `MatchSummary` |
| `shared/src/constants.ts` | Битовые флаги `FLAG_*`, типы зон `ZONE_TYPE_*`, типы препятствий `OBSTACLE_TYPE_*` |
| `server/src/rooms/ArenaRoom.ts` | Потребитель Schema — игровая логика, обновление флагов, управление фазами |
| `shared/src/config.ts` | Типы `BoostType`, `SlimeConfig`, конфигурация баланса |

---

## 3. Schema-классы

### 3.1 Talent

**Назначение:** Приобретённый талант игрока (из карточки выбора или сундука).

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | ID таланта (например, `fastLegs`, `sharpTeeth`) |
| `level` | `number` | да | Уровень таланта (1–3) |

Server-only полей нет.

---

### 3.2 TalentCard

**Назначение:** Карточка выбора таланта, показываемая игроку при повышении уровня. Содержит 3 варианта для выбора.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `option0` | `string` | да | ID первого варианта таланта |
| `option1` | `string` | да | ID второго варианта таланта |
| `option2` | `string` | да | ID третьего варианта таланта |
| `rarity0` | `number` | да | Редкость первого варианта (0=common, 1=rare, 2=epic) |
| `rarity1` | `number` | да | Редкость второго варианта |
| `rarity2` | `number` | да | Редкость третьего варианта |
| `expiresAtTick` | `number` | да | Тик автовыбора (если игрок не выбрал вовремя) |

Server-only полей нет.

---

### 3.3 AbilityCard

**Назначение:** Карточка выбора способности, показываемая при достижении уровня, открывающего новый слот (level 3 или 5).

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `slotIndex` | `number` | да | Индекс открываемого слота (1 или 2) |
| `option0` | `string` | да | ID первого варианта способности |
| `option1` | `string` | да | ID второго варианта способности |
| `option2` | `string` | да | ID третьего варианта способности |
| `expiresAtTick` | `number` | да | Тик автовыбора |

Server-only полей нет.

---

### 3.4 Player (детально)

**Назначение:** Главная сущность — игрок или бот. Самый крупный класс (~175 полей). Содержит позицию, физику, боевое состояние, систему способностей, таланты, модификаторы и вспомогательное серверное состояние.

#### 3.4.1 Синхронизируемые поля (@type)

**Идентификация и отображение:**

| Поле | Тип | Назначение |
|------|-----|------------|
| `id` | `string` | Session ID игрока (ключ в MapSchema) |
| `name` | `string` | Отображаемое имя |
| `spriteId` | `string` | ID спрайта (из `SPRITE_NAMES`, выбирается по хешу) |

**Позиция и физика:**

| Поле | Тип | Назначение |
|------|-----|------------|
| `x` | `number` | Координата X в мировом пространстве |
| `y` | `number` | Координата Y в мировом пространстве |
| `vx` | `number` | Скорость по X (м/с) |
| `vy` | `number` | Скорость по Y (м/с) |
| `angle` | `number` | Угол поворота (рад) |
| `angVel` | `number` | Угловая скорость (рад/с) |
| `mass` | `number` | Текущая масса слайма |

**Боевая система и прогресс:**

| Поле | Тип | Назначение |
|------|-----|------------|
| `killCount` | `number` | Количество убийств |
| `level` | `number` | Текущий уровень |
| `classId` | `number` | Класс: 0=Hunter, 1=Warrior, 2=Collector |
| `flags` | `number` | Битовая маска состояний (см. секцию 4) |
| `biteResistPct` | `number` | Бонус сопротивления укусу от талантов |

**Способности (Ability System):**

| Поле | Тип | Назначение |
|------|-----|------------|
| `abilityCooldownTick` | `number` | (deprecated?) Общий cooldown-тик |
| `abilityCooldownStartTick0` | `number` | Начало cooldown-а слота 0 |
| `abilityCooldownEndTick0` | `number` | Конец cooldown-а слота 0 |
| `abilityCooldownStartTick1` | `number` | Начало cooldown-а слота 1 |
| `abilityCooldownEndTick1` | `number` | Конец cooldown-а слота 1 |
| `abilityCooldownStartTick2` | `number` | Начало cooldown-а слота 2 |
| `abilityCooldownEndTick2` | `number` | Конец cooldown-а слота 2 |
| `abilitySlot0` | `string` | ID способности в классовом слоте (slot 0) |
| `abilitySlot1` | `string` | ID способности в слоте 2 (открывается на level 3) |
| `abilitySlot2` | `string` | ID способности в слоте 3 (открывается на level 5) |
| `abilityLevel0` | `number` | Уровень способности слота 0 |
| `abilityLevel1` | `number` | Уровень способности слота 1 |
| `abilityLevel2` | `number` | Уровень способности слота 2 |
| `pendingAbilityCard` | `AbilityCard` | Текущая карточка выбора способности (или null) |
| `pendingCardCount` | `number` | Кол-во карточек в очереди на выбор |

**Таланты:**

| Поле | Тип | Назначение |
|------|-----|------------|
| `talentsAvailable` | `number` | Количество доступных талантов для выбора |
| `talents` | `ArraySchema<Talent>` | Массив приобретённых талантов |
| `pendingTalentCard` | `TalentCard` | Текущая карточка выбора таланта (или null) |
| `pendingTalentCount` | `number` | Кол-во талантов в очереди на выбор |

**Бусты:**

| Поле | Тип | Назначение |
|------|-----|------------|
| `boostType` | `string` | Тип активного буста: `"rage"`, `"haste"`, `"guard"`, `"greed"` или `""` |
| `boostEndTick` | `number` | Тик окончания буста |
| `boostCharges` | `number` | Оставшиеся заряды буста |

**Прочие синхронизируемые:**

| Поле | Тип | Назначение |
|------|-----|------------|
| `pendingLavaScatterMass` | `number` | Масса для рассеивания при попадании в лаву |

#### 3.4.2 Server-only поля (не синхронизируются)

**Идентификация (мета):**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `userId` | `string` | `""` | User ID зарегистрированного пользователя (из joinToken) |
| `guestSubjectId` | `string` | `""` | Guest subject ID (для гостей, из joinToken) |

**Ввод и обработка:**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `inputX` | `number` | 0 | Последний ввод джойстика по X |
| `inputY` | `number` | 0 | Последний ввод джойстика по Y |
| `lastProcessedSeq` | `number` | 0 | Последний обработанный sequence number (анти-повтор) |
| `lastInputTick` | `number` | 0 | Тик последнего ввода |

**Состояние жизни/смерти:**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `isDead` | `boolean` | false | Мёртв ли игрок |
| `respawnAtTick` | `number` | 0 | Тик возрождения |
| `isLastBreath` | `boolean` | false | В состоянии Last Breath (предсмертие) |
| `lastBreathEndTick` | `number` | 0 | Тик окончания Last Breath |
| `invulnerableUntilTick` | `number` | 0 | Тик окончания неуязвимости (респаун-щит) |
| `lastDamagedById` | `string` | `""` | ID последнего атаковавшего (для ассистов/kill-атрибуции) |
| `lastDamagedAtTick` | `number` | 0 | Тик последнего полученного урона |

**Дрифт:**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `isDrifting` | `boolean` | false | В дрифте |
| `driftEndTick` | `number` | 0 | Тик окончания дрифта |
| `driftCooldownEndTick` | `number` | 0 | Тик окончания cooldown-а дрифта |

**Боевые таймеры:**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `lastBiteTick` | `number` | 0 | Тик последнего укуса |
| `lastAttackTick` | `number` | 0 | Тик последней атаки |
| `gcdReadyTick` | `number` | 0 | Тик готовности GCD (global cooldown, 3 тика = 100 мс) |

**Эффекты контроля (CC):**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `stunEndTick` | `number` | 0 | Конец оглушения |
| `frostEndTick` | `number` | 0 | Конец замораживания |
| `frostSlowPct` | `number` | 0 | Процент замедления от мороза |
| `poisonEndTick` | `number` | 0 | Конец отравления |
| `poisonDamagePctPerSec` | `number` | 0 | Урон от яда (% массы в секунду) |
| `poisonTickAccumulator` | `number` | 0 | Аккумулятор тиков яда (для пересчёта урона) |
| `invisibleEndTick` | `number` | 0 | Конец невидимости |
| `slowPct` | `number` | 0 | Текущий процент замедления (от зон) |

**Очередь способностей:**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `queuedAbilitySlot` | `number\|null` | null | Слот способности в очереди |
| `queuedAbilityTick` | `number` | 0 | Тик постановки в очередь |
| `abilitySlotPressed` | `number\|null` | null | Нажатый слот (из текущего ввода) |

**Двойная способность (талант):**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `doubleAbilityWindowEndTick` | `number` | 0 | Окно для двойного использования |
| `doubleAbilitySlot` | `number\|null` | null | Слот двойной способности |
| `doubleAbilitySecondUsed` | `boolean` | false | Использовано ли второе применение |

**Ability state (кратковременные эффекты):**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `dashEndTick` | `number` | 0 | Конец рывка (dash) |
| `dashTargetX` | `number` | 0 | Цель рывка X |
| `dashTargetY` | `number` | 0 | Цель рывка Y |
| `shieldEndTick` | `number` | 0 | Конец щита |
| `magnetEndTick` | `number` | 0 | Конец притяжения (magnet) |
| `pushEndTick` | `number` | 0 | Конец волны отталкивания |

**Flight assist:**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `assistFx` | `number` | 0 | Сила ассиста по X |
| `assistFy` | `number` | 0 | Сила ассиста по Y |
| `assistTorque` | `number` | 0 | Крутящий момент ассиста |
| `yawSignHistory` | `number[]` | `[]` | История знаков поворота (для стабилизации) |

**Card/Talent choice (server-only буфер ввода):**

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `talentChoicePressed` | `number\|null` | null | Нажатый выбор таланта (из ввода) |
| `cardChoicePressed` | `number\|null` | null | Нажатый выбор из карточки (0, 1, 2) |
| `talentChoicePressed2` | `number\|null` | null | Нажатый выбор таланта (отдельный буфер) |
| `pendingCardSlots` | `number[]` | `[]` | Очередь слотов, ожидающих карточки |
| `pendingTalentQueue` | `number[]` | `[]` | Очередь талантов |

#### 3.4.3 Модификаторы талантов (mod_*, server-only)

Все поля `mod_*` вычисляются из текущих талантов игрока через `recalculateTalentModifiers()`. Они не синхронизируются с клиентом — результат применяется через физику, урон и эффекты на сервере.

**Движение:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_speedLimitBonus` | 0 | Бонус к лимиту скорости |
| `mod_turnBonus` | 0 | Бонус к скорости поворота |
| `mod_thrustForwardBonus` | 0 | Бонус к тяге вперёд |
| `mod_thrustReverseBonus` | 0 | Бонус к тяге назад |
| `mod_thrustLateralBonus` | 0 | Бонус к боковой тяге |

**Боевая система:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_biteDamageBonus` | 0 | Бонус урона укуса |
| `mod_damageBonus` | 0 | Общий бонус урона |
| `mod_damageTakenBonus` | 0 | Множитель получаемого урона |
| `mod_allDamageReduction` | 0 | Уменьшение всего урона |
| `mod_killMassBonus` | 0 | Бонус массы за убийство |

**Орбы/ресурсы:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_orbMassBonus` | 0 | Бонус массы при сборе орба |
| `mod_respawnMass` | 100 | Масса при респауне (default = 100) |

**Способности:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_abilityCostReduction` | 0 | Уменьшение стоимости способности |
| `mod_cooldownReduction` | 0 | Уменьшение cooldown-а способности |
| `mod_dashDistanceBonus` | 0 | Бонус дальности dash-а |

**Вакуум (притяжение орбов):**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_vacuumRadius` | 0 | Радиус притяжения орбов |
| `mod_vacuumSpeed` | 0 | Скорость притяжения орбов |

**Яд:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_poisonDamagePctPerSec` | 0 | Урон яда (% в секунду) |
| `mod_poisonDurationSec` | 0 | Длительность яда (секунды) |

**Мороз:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_frostSlowPct` | 0 | Процент замедления от мороза |
| `mod_frostDurationSec` | 0 | Длительность мороза (секунды) |

**Вампиризм:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_vampireSideGainPct` | 0 | Вампиризм при боковом укусе (%) |
| `mod_vampireTailGainPct` | 0 | Вампиризм при укусе в хвост (%) |

**Снаряды:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_projectileRicochet` | 0 | Количество рикошетов снаряда |
| `mod_projectilePiercingDamagePct` | 0 | Урон при проникающих попаданиях |
| `mod_projectilePiercingHits` | 0 | Количество проникающих попаданий |

**Молния:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_lightningSpeedBonus` | 0 | Бонус скорости молнии |
| `mod_lightningStunSec` | 0 | Длительность стана от молнии |

**Двойная способность:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_doubleAbilityWindowSec` | 0 | Окно двойного использования (секунды) |
| `mod_doubleAbilitySecondCostMult` | 0 | Множитель стоимости второго применения |

**Смерть (on-death эффекты):**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_deathExplosionRadiusM` | 0 | Радиус взрыва при смерти (метры) |
| `mod_deathExplosionDamagePct` | 0 | Урон взрыва при смерти (%) |
| `mod_deathNeedlesCount` | 0 | Количество игл при смерти |
| `mod_deathNeedlesDamagePct` | 0 | Урон игл при смерти (%) |

**Левиафан (трансформация):**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_leviathanRadiusMul` | 1 | Множитель радиуса в форме Левиафана |
| `mod_leviathanMouthMul` | 1 | Множитель рта (зоны укуса) Левиафана |

**Невидимость:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_invisibleDurationSec` | 0 | Длительность невидимости (секунды) |

**Токсичный пул:**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_toxicPoolBonus` | 1 | Множитель бонуса токсичных луж |

**Классовые таланты (Class Talents):**

| Поле | Default | Назначение |
|------|---------|------------|
| `mod_thornsDamage` | 0 | Warrior: урон отражения при укусе |
| `mod_ambushDamage` | 0 | Hunter: бонус урона из невидимости |
| `mod_parasiteMass` | 0 | Collector: кража массы при уроне |
| `mod_magnetRadius` | 0 | Collector: радиус притяжения орбов |
| `mod_magnetSpeed` | 0 | Collector: скорость притяжения орбов |

---

### 3.5 Orb

**Назначение:** Пузырь (orb) — собираемый ресурс массы. Рассыпается при смерти игрока, спавнится на карте и при открытии сундуков.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `vx` | `number` | да | Скорость X (орбы могут двигаться после рассыпания) |
| `vy` | `number` | да | Скорость Y |
| `mass` | `number` | да | Масса орба |
| `colorId` | `number` | да | Тип/цвет орба (индекс в `balance.orbs.types`; classId+10 для PvP-орбов) |

Server-only полей нет.

---

### 3.6 Chest

**Назначение:** Сундук — объект с бронёй (armorRings), при разрушении даёт талант, буст или орбы.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `vx` | `number` | да | Скорость X (сундуки имеют физику) |
| `vy` | `number` | да | Скорость Y |
| `type` | `number` | да | Тип: 0=rare, 1=epic, 2=gold |
| `armorRings` | `number` | да | Количество защитных обручей (нужно разбить перед открытием) |

Server-only полей нет.

---

### 3.7 HotZone

**Назначение:** Горячая зона — область повышенного спавна орбов.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `x` | `number` | да | Координата X центра |
| `y` | `number` | да | Координата Y центра |
| `radius` | `number` | да | Радиус зоны |
| `spawnMultiplier` | `number` | да | Множитель спавна орбов (default=1) |

Server-only полей нет.

---

### 3.8 SlowZone

**Назначение:** Зона замедления — временная область, замедляющая игроков.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `ownerId` | `string` | да | ID игрока-создателя |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `radius` | `number` | да | Радиус зоны |
| `slowPct` | `number` | да | Процент замедления (default=0.3, т.е. 30%) |

| Поле (server-only) | Тип | Default | Назначение |
|---------------------|-----|---------|------------|
| `endTick` | `number` | 0 | Тик исчезновения зоны |

---

### 3.9 ToxicPool

**Назначение:** Токсичная лужа — зона с замедлением и уроном по массе.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `radius` | `number` | да | Радиус (default=20) |
| `slowPct` | `number` | да | Процент замедления (default=0.2, т.е. 20%) |
| `damagePctPerSec` | `number` | да | Урон по массе в секунду (default=0.01, т.е. 1%) |

| Поле (server-only) | Тип | Default | Назначение |
|---------------------|-----|---------|------------|
| `endTick` | `number` | 0 | Тик исчезновения лужи |

---

### 3.10 Projectile

**Назначение:** Снаряд способности — летящий объект с уроном, может быть обычным или бомбой.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `ownerId` | `string` | да | ID игрока-создателя |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `vx` | `number` | да | Скорость X |
| `vy` | `number` | да | Скорость Y |
| `radius` | `number` | да | Радиус хитбокса (default=8) |
| `damagePct` | `number` | да | Урон в % массы цели (default=0.10, т.е. 10%) |
| `projectileType` | `number` | да | Тип: 0=normal, 1=bomb |

| Поле (server-only) | Тип | Default | Назначение |
|---------------------|-----|---------|------------|
| `spawnTick` | `number` | 0 | Тик создания (для lifetime) |
| `maxRangeM` | `number` | 300 | Максимальная дальность (метры) |
| `startX` | `number` | 0 | Начальная координата X (для расчёта дальности) |
| `startY` | `number` | 0 | Начальная координата Y |
| `explosionRadiusM` | `number` | 0 | Радиус взрыва (для bomb) |
| `remainingRicochets` | `number` | 0 | Оставшиеся рикошеты (от таланта) |
| `remainingPierces` | `number` | 0 | Оставшиеся проникающие попадания |
| `piercingDamagePct` | `number` | 0 | Урон при проникающем попадании |
| `lastHitId` | `string` | `""` | ID последнего поражённого (анти-повторное попадание) |
| `allowDeadOwner` | `boolean` | false | Разрешить снаряд без живого владельца |

---

### 3.11 Mine

**Назначение:** Мина — стационарный объект с уроном при контакте.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `ownerId` | `string` | да | ID игрока-создателя |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `radius` | `number` | да | Радиус (default=15) |
| `damagePct` | `number` | да | Урон в % массы (default=0.15, т.е. 15%) |

| Поле (server-only) | Тип | Default | Назначение |
|---------------------|-----|---------|------------|
| `endTick` | `number` | 0 | Тик исчезновения мины |

---

### 3.12 Zone

**Назначение:** Статическая зона эффекта (генерируется при создании арены). Тип определяет эффект.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `x` | `number` | да | Координата X центра |
| `y` | `number` | да | Координата Y центра |
| `radius` | `number` | да | Радиус зоны |
| `type` | `number` | да | Тип зоны: `ZONE_TYPE_*` (см. секцию 4) |

Server-only полей нет.

---

### 3.13 Obstacle

**Назначение:** Препятствие на арене (столб или шипы). Статический объект с коллизией.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `id` | `string` | да | Уникальный ID |
| `x` | `number` | да | Координата X |
| `y` | `number` | да | Координата Y |
| `radius` | `number` | да | Радиус хитбокса |
| `type` | `number` | да | Тип: `OBSTACLE_TYPE_*` (см. секцию 4) |

Server-only полей нет.

---

### 3.14 SafeZone

**Назначение:** Безопасная зона (для финальной фазы). Игроки вне зоны получают урон.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `x` | `number` | да | Координата X центра |
| `y` | `number` | да | Координата Y центра |
| `radius` | `number` | да | Радиус зоны |

Примечание: SafeZone не имеет `id` — единственный Schema-класс без явного идентификатора. Хранится в ArraySchema, а не MapSchema.

Server-only полей нет.

---

### 3.15 GameState

**Назначение:** Корневой объект состояния комнаты Colyseus. Содержит все коллекции сущностей и глобальные параметры матча.

| Поле | Тип | Sync | Назначение |
|------|-----|------|------------|
| `phase` | `string` | да | Фаза матча (см. ниже) |
| `timeRemaining` | `number` | да | Оставшееся время фазы (секунды) |
| `serverTick` | `number` | да | Текущий серверный тик |
| `rebelId` | `string` | да | Session ID текущего Короля (Rebel) |
| `matchId` | `string` | да | UUID матча для `/match-results/claim` |
| `shutdownAt` | `number` | да | Timestamp (ms) запланированной перезагрузки; 0 = нет |
| `players` | `MapSchema<Player>` | да | Все игроки (ключ = sessionId) |
| `orbs` | `MapSchema<Orb>` | да | Все орбы |
| `chests` | `MapSchema<Chest>` | да | Все сундуки |
| `hotZones` | `MapSchema<HotZone>` | да | Горячие зоны |
| `slowZones` | `MapSchema<SlowZone>` | да | Зоны замедления |
| `toxicPools` | `MapSchema<ToxicPool>` | да | Токсичные лужи |
| `projectiles` | `MapSchema<Projectile>` | да | Снаряды |
| `mines` | `MapSchema<Mine>` | да | Мины |
| `zones` | `MapSchema<Zone>` | да | Зоны эффектов (статические) |
| `obstacles` | `MapSchema<Obstacle>` | да | Препятствия |
| `safeZones` | `ArraySchema<SafeZone>` | да | Безопасные зоны (финал) |
| `leaderboard` | `ArraySchema<string>` | да | ID игроков, отсортированные по массе (убывание) |

Server-only полей нет (GameState целиком синхронизируется).

---

## 4. Битовые флаги

Определены в `shared/src/constants.ts`. Используются в поле `Player.flags` (синхронизируется).

| Константа | Значение | Бит | Назначение | Устанавливается в |
|-----------|----------|-----|------------|-------------------|
| `FLAG_RESPAWN_SHIELD` | `1 << 0` | 0 | Неуязвимость после респауна (5 сек) | `updatePlayerFlags()`: `tick < invulnerableUntilTick` и не мёртв |
| `FLAG_ABILITY_SHIELD` | `1 << 1` | 1 | Активный щит (ability) | `updatePlayerFlags()`: `tick < shieldEndTick` |
| `FLAG_LAST_BREATH` | `1 << 2` | 2 | Состояние предсмерти (Last Breath) | `updatePlayerFlags()`: `isLastBreath == true` |
| `FLAG_IS_REBEL` | `1 << 3` | 3 | Игрок является Королём (Rebel) | `updatePlayerFlags()`: `id === state.rebelId` |
| `FLAG_IS_DEAD` | `1 << 4` | 4 | Игрок мёртв | `updatePlayerFlags()`: `isDead == true` |
| `FLAG_DASHING` | `1 << 5` | 5 | В процессе рывка (dash) | `updatePlayerFlags()`: `tick < dashEndTick` |
| `FLAG_MAGNETIZING` | `1 << 6` | 6 | Магнит активен (притяжение орбов) | `updatePlayerFlags()`: `tick < magnetEndTick` |
| `FLAG_SLOWED` | `1 << 7` | 7 | Замедлён (в зоне SlowZone) | `slowZoneSystem()` — устанавливается отдельно, сохраняется в `updatePlayerFlags()` |
| `FLAG_PUSHING` | `1 << 8` | 8 | Волна отталкивания активна | `updatePlayerFlags()`: `tick < pushEndTick` |
| `FLAG_STUNNED` | `1 << 9` | 9 | Оглушён | `updatePlayerFlags()`: `tick < stunEndTick` |
| `FLAG_INVISIBLE` | `1 << 10` | 10 | Невидимый | `updatePlayerFlags()`: `tick < invisibleEndTick` |
| `FLAG_LEVIATHAN` | `1 << 11` | 11 | В форме Левиафана | `updatePlayerFlags()`: `mod_leviathanRadiusMul > 1 \|\| mod_leviathanMouthMul > 1` |

**Паттерн:** Все флаги пересчитываются с нуля каждый тик в `updatePlayerFlags()`, кроме `FLAG_SLOWED`, который сохраняется из предыдущего значения `player.flags` (устанавливается в `slowZoneSystem()` до вызова `updatePlayerFlags()`).

**Типы зон** (используются в `Zone.type`):

| Константа | Значение | Эффект |
|-----------|----------|--------|
| `ZONE_TYPE_NECTAR` | 1 | Зона нектара (усиленный спавн/сбор) |
| `ZONE_TYPE_ICE` | 2 | Ледяная зона (замедление, скольжение) |
| `ZONE_TYPE_SLIME` | 3 | Зона слизи |
| `ZONE_TYPE_LAVA` | 4 | Лавовая зона (урон) |
| `ZONE_TYPE_TURBO` | 5 | Зона ускорения |

**Типы препятствий** (используются в `Obstacle.type`):

| Константа | Значение | Эффект |
|-----------|----------|--------|
| `OBSTACLE_TYPE_PILLAR` | 1 | Столб (коллизия, без урона) |
| `OBSTACLE_TYPE_SPIKES` | 2 | Шипы (коллизия + урон) |

---

## 5. Коллекции GameState

| Поле | Коллекция | Ключ | Тип элемента | Примечание |
|------|-----------|------|--------------|------------|
| `players` | `MapSchema` | sessionId (string) | `Player` | Ключ = `client.sessionId` от Colyseus |
| `orbs` | `MapSchema` | id (string) | `Orb` | Генерируемый UUID |
| `chests` | `MapSchema` | id (string) | `Chest` | Генерируемый UUID |
| `hotZones` | `MapSchema` | id (string) | `HotZone` | Генерируемый UUID |
| `slowZones` | `MapSchema` | id (string) | `SlowZone` | Временные, удаляются по `endTick` |
| `toxicPools` | `MapSchema` | id (string) | `ToxicPool` | Временные, удаляются по `endTick` |
| `projectiles` | `MapSchema` | id (string) | `Projectile` | Временные, удаляются по дальности/попаданию |
| `mines` | `MapSchema` | id (string) | `Mine` | Временные, удаляются по `endTick` |
| `zones` | `MapSchema` | id (string) | `Zone` | Статические, создаются при генерации арены |
| `obstacles` | `MapSchema` | id (string) | `Obstacle` | Статические, создаются при генерации арены |
| `safeZones` | `ArraySchema` | index (number) | `SafeZone` | Используются в финальной фазе; без id |
| `leaderboard` | `ArraySchema` | index (number) | `string` | SessionId игроков, отсортированные по массе |

**MapSchema vs ArraySchema:** Большинство коллекций используют MapSchema (ключ = id строки). Это позволяет эффективно добавлять и удалять объекты по id. Только `safeZones` и `leaderboard` используют ArraySchema, что обоснованно: safeZones не имеют уникальных id и редко меняются; leaderboard — упорядоченный список.

---

## 6. Захардкоженные значения

| Где | Значение | Описание |
|-----|----------|----------|
| `GameState.phase` | `"Spawn"` (default) | Начальная фаза — не из `MATCH_PHASES` (см. расхождение п.7) |
| `Player.mod_respawnMass` | `100` | Масса при респауне по умолчанию |
| `Player.mod_leviathanRadiusMul` | `1` | Базовый множитель радиуса Левиафана |
| `Player.mod_leviathanMouthMul` | `1` | Базовый множитель рта Левиафана |
| `Player.mod_toxicPoolBonus` | `1` | Базовый множитель токсичного пула |
| `SlowZone.slowPct` | `0.3` | 30% замедления по умолчанию |
| `ToxicPool.radius` | `20` | Радиус токсичной лужи по умолчанию |
| `ToxicPool.slowPct` | `0.2` | 20% замедления по умолчанию |
| `ToxicPool.damagePctPerSec` | `0.01` | 1% массы/сек урон по умолчанию |
| `Projectile.radius` | `8` | Радиус хитбокса снаряда |
| `Projectile.damagePct` | `0.10` | 10% массы урон снаряда |
| `Projectile.maxRangeM` | `300` | Максимальная дальность (метры) |
| `Mine.radius` | `15` | Радиус мины |
| `Mine.damagePct` | `0.15` | 15% массы урон мины |
| `HotZone.spawnMultiplier` | `1` | Базовый множитель спавна |
| `Talent.level` | `1` | Начальный уровень таланта |
| `Chest.type = 0` | rare | Маппинг: 0→rare, 1→epic, 2→gold |
| `Projectile.projectileType = 0` | normal | Маппинг: 0→normal, 1→bomb |

---

## 7. Расхождения с документацией

### 7.1 Фазы матча: `"Spawn"` не входит в `MATCH_PHASES`

**Код:** `GameState.phase` инициализируется как `"Spawn"` (default в Schema). Фаза `"Spawn"` используется в ArenaRoom как начальная фаза ожидания игроков.

**Документация:** `shared/src/types.ts` определяет `MATCH_PHASES = ["Growth", "Hunt", "Final", "Results"]`. Тип `MatchPhaseId` не включает `"Spawn"`.

**Расхождение:** Поле `phase` объявлено как `string`, а не `MatchPhaseId`, что позволяет любое значение. Фактически в матче 5 фаз: Spawn → Growth → Hunt → Final → Results, но `MatchPhaseId` знает только о 4 из них.

### 7.2 Сущности в systemPatterns.md

**Документация:** `.memory_bank/systemPatterns.md` перечисляет сущности: `SlimeEntity`, `OrbEntity`, `ProjectileEntity`, `ChestEntity`, `ZoneEntity`.

**Код:** Классы названы `Player`, `Orb`, `Projectile`, `Chest`, `Zone`. Суффикс `Entity` в коде не используется.

**Дополнительные сущности в коде:** `HotZone`, `SlowZone`, `ToxicPool`, `Mine`, `Obstacle`, `SafeZone` — не упомянуты в systemPatterns.md.

### 7.3 Флаги в systemPatterns.md неполные

**Документация:** systemPatterns.md перечисляет 6 флагов: `FLAG_DASHING`, `FLAG_SHIELDED`, `FLAG_STUNNED`, `FLAG_INVISIBLE`, `FLAG_INVULNERABLE`, `FLAG_PUSHING`.

**Код:** В constants.ts 12 флагов. `FLAG_SHIELDED` в коде называется `FLAG_ABILITY_SHIELD`, `FLAG_INVULNERABLE` — `FLAG_RESPAWN_SHIELD`. Отсутствуют в документации: `FLAG_LAST_BREATH`, `FLAG_IS_REBEL`, `FLAG_IS_DEAD`, `FLAG_MAGNETIZING`, `FLAG_SLOWED`, `FLAG_LEVIATHAN`.

### 7.4 Architecture Part 1 не описывает Schema-модель

**Документация:** Architecture v4.2.5 Part 1 описывает высокоуровневую архитектуру, но не содержит детального описания Schema-классов, полей или сущностей.

**Факт:** Описание на уровне "один матч = одна комната Colyseus" и "клиент отправляет InputCommand" — без спецификации того, что именно содержит GameState. Детальная модель данных существует только в коде.

### 7.5 classId не задокументирован как enum

**Код:** `Player.classId` — number. Из `shared/src/sprites.ts` следует: 0=Hunter, 1=Warrior, 2=Collector.

**Документация:** Нигде не зафиксирован маппинг classId → имя класса в виде константы или типа. Только комментарии в sprites.ts.

---

## 8. Технический долг

### 8.1 Player — God Object

Класс `Player` содержит ~175 полей и совмещает:
- Физику (x, y, vx, vy, mass, angle, angVel)
- Боевую систему (killCount, biteResistPct, lastBiteTick, lastAttackTick)
- Систему способностей (abilitySlot0..2, abilityLevel0..2, cooldown-тики, dash/shield/magnet/push состояние)
- Систему талантов (talents, pendingTalentCard, 47 полей mod_*)
- Эффекты контроля (stun, frost, poison, invisible)
- Мета-идентификацию (userId, guestSubjectId)
- Ввод (inputX, inputY, lastProcessedSeq)
- UI-состояние (pendingAbilityCard, pendingCardCount)

Это затрудняет понимание, тестирование и рефакторинг. В идеале стоит декомпозировать на компоненты (ECS-подход).

### 8.2 Дублирование имён полей

Два поля для выбора таланта: `talentChoicePressed` и `talentChoicePressed2`. Непонятно, зачем два буфера.

### 8.3 `abilityCooldownTick` — предположительно deprecated

Поле `abilityCooldownTick` сосуществует с `abilityCooldownStartTick0..2` / `abilityCooldownEndTick0..2`. Вероятно, осталось от старой системы с одним слотом.

### 8.4 phase как string, а не enum

`GameState.phase: string` позволяет опечатки. Должен быть `MatchPhaseId`, расширенный фазой `"Spawn"`.

### 8.5 Default-значения в Schema vs balance.json

Захардкоженные default-ы (Projectile.radius=8, Mine.damagePct=0.15, ToxicPool.radius=20) перезаписываются при создании объекта из balance.json. Однако если баланс не задан, используются захардкоженные значения, что может привести к расхождению с ожиданиями.

### 8.6 Отсутствие типизации для chest.type и projectileType

Числовые маппинги (0=rare/1=epic/2=gold; 0=normal/1=bomb) не вынесены в константы. Маппинг разбросан по коду (`getChestTypeId()`, inline тернарники).

### 8.7 SafeZone без id

SafeZone — единственный класс без поля `id`, использующий ArraySchema вместо MapSchema. Это создаёт асимметрию в модели.

### 8.8 Нет комментариев для многих mod_* полей

Часть модификаторов имеет комментарии (`mod_thornsDamage`, `mod_ambushDamage`), но большинство — без пояснения, как именно они применяются в формулах.

---

## 9. Заметки для форка BonkRace

> BonkRace — гоночная игра на основе физики Slime Arena. Ниже — рекомендации по адаптации Schema для гоночного контекста.

### Сущности: что убрать

| Slime Arena | Действие | Причина |
|-------------|----------|---------|
| `Talent`, `TalentCard` | Убрать | Гонка не предполагает прокачку талантов внутри матча |
| `AbilityCard` | Убрать | Нет карточек выбора в гонке |
| `Chest` | Убрать | Заменяется пикапами на трассе |
| `HotZone` | Убрать | Нет зон спавна орбов |
| `SlowZone` | Переосмыслить | Может стать зоной замедления на трассе (грязь, песок) |
| `ToxicPool` | Переосмыслить | Зона урона → зона штрафа (потеря скорости/позиции) |
| `Mine` | Оставить | Мина на трассе — классический гоночный элемент |
| `SafeZone` | Убрать | Нет логики сужения зоны |
| `rebelId` (King) | Убрать | Нет системы Короля |

### Сущности: что заменить

| Slime Arena | BonkRace | Изменения |
|-------------|----------|-----------|
| `Player` | `Racer` | Убрать: талант-систему (все mod_*, talents, pending*Card), killCount, biteResistPct, boostType/EndTick. Добавить: `lap` (текущий круг), `checkpoint` (последний чекпоинт), `racePosition` (позиция в гонке), `totalTime` (время прохождения), `respawnCheckpointIdx` (чекпоинт для респауна). Оставить: физику (x, y, vx, vy, angle, angVel, mass), способности (упрощённо: boost/shield/attack). |
| `Orb` | `Boost` (пикап) | Убрать: mass, colorId. Добавить: `pickupType` (speed, shield, projectile, nitro), `respawnTick`. Позиция остаётся. |
| `Zone` | `TrackZone` | ZONE_TYPE заменить на: TURBO_PAD (ускорение), MUD (замедление), ICE (скольжение), JUMP_PAD. |
| `Obstacle` | `TrackObstacle` | Оставить как есть. Добавить тип BARRIER (стена трассы). |
| `GameState` | `RaceState` | Убрать: rebelId, matchId (если нет мета-интеграции). Добавить: `totalLaps`, `raceStartTick`, `finishedRacers` (ArraySchema<string>). phase → `"Lobby"`, `"Countdown"`, `"Racing"`, `"Finished"`. |

### Коллекции: что изменить

| Slime Arena | BonkRace | Тип |
|-------------|----------|-----|
| `players` → `racers` | `MapSchema<Racer>` | Без изменений |
| `orbs` → `pickups` | `MapSchema<Boost>` | Фиксированные позиции на трассе, респавн по таймеру |
| `chests` | Удалить | — |
| `hotZones` | Удалить | — |
| `zones` → `trackZones` | `MapSchema<TrackZone>` | Зоны эффектов на трассе |
| `obstacles` → `trackObstacles` | `MapSchema<TrackObstacle>` | Стены, барьеры |
| `leaderboard` → `racePositions` | `ArraySchema<string>` | Порядок по позиции в гонке, а не по массе |
| `safeZones` | Удалить | — |
| `projectiles` | Оставить | Атакующие пикапы |
| `mines` | Оставить | Мины на трассе |

### Битовые флаги: адаптация

| Slime Arena | BonkRace | Примечание |
|-------------|----------|------------|
| `FLAG_RESPAWN_SHIELD` | Оставить | Неуязвимость после респауна |
| `FLAG_ABILITY_SHIELD` | Оставить | Щит от пикапа |
| `FLAG_LAST_BREATH` | Убрать | Нет предсмертия в гонке |
| `FLAG_IS_REBEL` | Убрать | Нет Короля |
| `FLAG_IS_DEAD` | → `FLAG_CRASHED` | Авария → респаун на чекпоинте |
| `FLAG_DASHING` | → `FLAG_NITRO` | Ускорение от пикапа |
| `FLAG_MAGNETIZING` | Убрать | Нет притяжения орбов |
| `FLAG_SLOWED` | Оставить | Замедление от зон/атак |
| `FLAG_PUSHING` | Убрать или адаптировать | Столкновение = физика |
| `FLAG_STUNNED` | → `FLAG_SPUN_OUT` | Потеря управления после столкновения |
| `FLAG_INVISIBLE` | Убрать | Нет невидимости в гонке |
| `FLAG_LEVIATHAN` | Убрать | Нет трансформаций |

### Ключевое архитектурное решение

Player в Slime Arena — God Object с ~175 полями. Для BonkRace рекомендуется:
1. Выделить `RacerPhysics` (x, y, vx, vy, angle, angVel, mass) — синхронизируемый компонент
2. Выделить `RacerProgress` (lap, checkpoint, racePosition, totalTime) — синхронизируемый компонент
3. Оставить server-only состояние минимальным (inputX/Y, respawnTick, cooldownTick)
4. Модификаторы талантов убрать полностью — в гонке нет прокачки в матче
