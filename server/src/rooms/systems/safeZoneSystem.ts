export function safeZoneSystem(room: any) {
    if (!room.isSafeZoneActive()) return;
    if (room.state.safeZones.length === 0) return;
    const damagePerSec = Math.max(0, room.balance.safeZones.damagePctPerSec);
    if (damagePerSec <= 0) return;

    const dt = 1 / room.balance.server.tickRate;
    for (const player of room.state.players.values()) {
        if (player.isDead) continue;
        if (player.isLastBreath) continue;
        if (room.tick < player.invulnerableUntilTick) continue;
        if (room.isInsideSafeZone(player)) continue;
        const damageTakenMult = room.getDamageTakenMultiplier(player);
        const massLoss = player.mass * damagePerSec * dt * damageTakenMult;
        if (massLoss > 0 && !room.tryConsumeGuard(player)) {
            room.applyMassDelta(player, -massLoss);
        }
    }
}
