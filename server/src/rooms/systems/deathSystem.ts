export function deathSystem(room: any) {
    const minSlimeMass = room.balance.physics.minSlimeMass;
    for (const player of room.state.players.values()) {
        if (player.isLastBreath && room.tick >= player.lastBreathEndTick) {
            player.isLastBreath = false;
        }

        // Mass-as-HP: смерть при массе <= minSlimeMass
        if (!player.isDead && player.mass <= minSlimeMass && !player.isLastBreath) {
            room.handlePlayerDeath(player);
        }

        if (player.isDead && room.tick >= player.respawnAtTick) {
            room.handlePlayerRespawn(player);
        }
    }
}
