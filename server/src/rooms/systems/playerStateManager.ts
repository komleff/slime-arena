/**
 * PlayerStateManager — управление состоянием игрока.
 * Ответственность: смерть, респаун, уровни, флаги состояния.
 */

/**
 * Обработка смерти игрока.
 */
export function handlePlayerDeath(room: any, player: any) {
    player.isDead = true;
    player.isLastBreath = false;
    player.lastBreathEndTick = 0;
    player.respawnAtTick = room.tick + room.respawnDelayTicks;
    player.vx = 0;
    player.vy = 0;
    player.inputX = 0;
    player.inputY = 0;
    player.invisibleEndTick = 0;
    player.doubleAbilityWindowEndTick = 0;
    player.doubleAbilitySlot = null;
    player.doubleAbilitySecondUsed = false;
    room.clearBoost(player);

    const killerId = player.lastDamagedById;
    if (killerId) {
        const killer = room.state.players.get(killerId);
        if (killer && !killer.isDead && killer.id !== player.id) {
            killer.killCount++;
            room.awardKillMass(killer);
        }
    }
    room.logTelemetry("player_death", {
        killerId: killerId || null,
        mass: player.mass,
        classId: player.classId,
    }, player);
    player.lastDamagedById = "";
    player.lastDamagedAtTick = 0;

    room.spawnDeathExplosion(player);
    room.spawnDeathNeedles(player);
    room.spawnToxicPool(player);

    const massForOrbs = player.mass * room.balance.death.massToOrbsPercent;
    let orbsCount = room.balance.death.orbsCount;

    // Минимальная масса орба
    const minOrbMass = room.balance.combat.scatterOrbMinMass ?? 5;
    if (massForOrbs < minOrbMass) return;
    let perOrbMass = massForOrbs / Math.max(1, orbsCount);
    if (perOrbMass < minOrbMass) {
        orbsCount = Math.floor(massForOrbs / minOrbMass);
        if (orbsCount <= 0) return;
        perOrbMass = massForOrbs / orbsCount;
    }

    const count = Math.min(
        orbsCount,
        room.balance.orbs.maxCount - room.state.orbs.size
    );
    if (count <= 0) return;
    const deathOrbColorId = room.getDamageOrbColorId(player);

    for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        const spread = 30;
        const orbX = player.x + Math.cos(angle) * spread;
        const orbY = player.y + Math.sin(angle) * spread;
        const orb = room.forceSpawnOrb(orbX, orbY, perOrbMass, deathOrbColorId);
        if (orb) {
            const spreadSpeed = 150;
            orb.vx = Math.cos(angle) * spreadSpeed;
            orb.vy = Math.sin(angle) * spreadSpeed;
        }
    }
}

/**
 * Обработка респауна игрока.
 */
export function handlePlayerRespawn(room: any, player: any) {
    player.isDead = false;
    player.isLastBreath = false;
    player.lastBreathEndTick = 0;
    const baseRespawn = Math.max(room.balance.death.minRespawnMass, player.mod_respawnMass);
    const respawnMass = Math.max(
        baseRespawn,
        player.mass * (1 - room.balance.death.massLostPercent)
    );
    player.mass = respawnMass;
    const spawn = room.findSpawnPoint(
        room.getPlayerRadius(player),
        room.balance.obstacles.spacing,
        room.balance.obstacles.placementRetries
    );
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.angVel = 0;
    player.stunEndTick = 0;
    player.frostEndTick = 0;
    player.frostSlowPct = 0;
    player.poisonEndTick = 0;
    player.poisonDamagePctPerSec = 0;
    player.poisonTickAccumulator = 0;
    player.invisibleEndTick = 0;
    player.slowPct = 0;
    room.clearBoost(player);
    player.doubleAbilityWindowEndTick = 0;
    player.doubleAbilitySlot = null;
    player.doubleAbilitySecondUsed = false;
    player.lastDamagedById = "";
    player.lastDamagedAtTick = 0;
    player.pendingLavaScatterMass = 0;
    player.invulnerableUntilTick = room.tick + room.respawnShieldTicks;
    player.gcdReadyTick = room.tick;
    player.queuedAbilitySlot = null;
}

/**
 * Обновление уровня игрока по массе.
 */
export function updatePlayerLevel(room: any, player: any) {
    const thresholds = room.balance.slime.levelThresholds;
    const slotUnlockLevels = room.balance.slime.slotUnlockLevels;
    const talentGrantLevels = room.balance.slime.talentGrantLevels;

    // Вычисляем текущий уровень по массе
    let newLevel = 1;
    for (let i = 0; i < thresholds.length; i++) {
        if (player.mass >= thresholds[i]) {
            newLevel = i + 2;
        }
    }

    // Уровни после базовых: порог * 1.5^n
    if (thresholds.length > 0) {
        const lastThreshold = thresholds[thresholds.length - 1];
        let dynamicThreshold = lastThreshold * 1.5;
        if (player.mass >= dynamicThreshold) {
            let dynamicLevel = thresholds.length + 1;
            while (player.mass >= dynamicThreshold) {
                newLevel = dynamicLevel;
                dynamicLevel += 1;
                dynamicThreshold *= 1.5;
            }
        }
    }

    if (newLevel <= player.level) return;

    const oldLevel = player.level;
    player.level = newLevel;

    // Обрабатываем каждый пройденный уровень
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        // Проверяем разблокировку слотов умений
        for (let slotIdx = 1; slotIdx < slotUnlockLevels.length; slotIdx++) {
            const unlockLevel = slotUnlockLevels[slotIdx];
            if (lvl === unlockLevel) {
                const slotProp = slotIdx === 1 ? "abilitySlot1" : "abilitySlot2";
                if (player[slotProp] === "") {
                    if (!player.pendingCardSlots.includes(slotIdx)) {
                        player.pendingCardSlots.push(slotIdx);
                        player.pendingCardCount = player.pendingCardSlots.length;
                    }
                }
            }
        }

        // Проверяем выдачу таланта
        const isTalentLevel = talentGrantLevels.includes(lvl) || lvl > thresholds.length;
        if (isTalentLevel) {
            room.awardTalentToPlayer(player);
        }
    }

    // Генерируем карточку для первого слота в очереди
    room.tryGenerateNextCard(player);
}
