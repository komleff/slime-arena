export function updateChests(room: any) {
    const dt = 1 / room.balance.server.tickRate;
    if (
        room.tick - room.lastChestSpawnTick >= room.chestSpawnIntervalTicks &&
        room.state.chests.size < room.balance.chests.maxCount
    ) {
        room.spawnChest();
        room.lastChestSpawnTick = room.tick;
    }

    const damping = Math.max(
        0,
        1 - room.balance.physics.environmentDrag - room.balance.physics.orbLinearDamping
    );
    for (const chest of room.state.chests.values()) {
        chest.vx *= damping;
        chest.vy *= damping;
        chest.x += chest.vx * dt;
        chest.y += chest.vy * dt;
        room.applyWorldBounds(chest, room.balance.chests.radius);
    }
}

export function chestSystem(room: any) {
    const chestEntries = Array.from(room.state.chests.entries()) as any[];
    for (const player of room.state.players.values()) {
        if (player.isDead) continue;
        const playerRadius = room.getPlayerRadius(player);
        const playerAngleRad = player.angle;
        const mouthHalf = room.getMouthHalfAngle(player);

        for (const [chestId, chest] of chestEntries) {
            if (!room.state.chests.has(chestId)) continue;
            const dx = chest.x - player.x;
            const dy = chest.y - player.y;
            const distSq = dx * dx + dy * dy;
            const touchDist = playerRadius + room.balance.chests.radius;
            if (distSq > touchDist * touchDist) continue;

            const angleToChest = Math.atan2(dy, dx);
            let angleDiff = angleToChest - playerAngleRad;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            const isMouthHit = Math.abs(angleDiff) <= mouthHalf;

            // GDD v3.3: GCD между умениями и укусами
            const gcdReady = room.tick >= player.gcdReadyTick;
            if (isMouthHit && gcdReady && room.tick >= player.lastBiteTick + room.biteCooldownTicks) {
                // GDD v3.3: Система обручей (armorRings)
                if (chest.armorRings > 0) {
                    // Снимаем один обруч
                    chest.armorRings--;
                } else {
                    // Обручей нет - открываем сундук
                    room.openChest(player, chest);
                }
                player.lastBiteTick = room.tick;
                // GDD v3.3: GCD после укуса
                player.gcdReadyTick = room.tick + room.balance.server.globalCooldownTicks;
            }
        }
    }
}
