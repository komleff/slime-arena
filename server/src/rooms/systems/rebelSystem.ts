export function rebelSystem(room: any) {
    if (room.tick - room.lastRebelUpdateTick < room.rebelUpdateIntervalTicks) return;
    room.lastRebelUpdateTick = room.tick;

    const alivePlayers = (Array.from(room.state.players.values()) as any[]).filter((player) => !player.isDead);
    if (alivePlayers.length === 0) {
        room.state.rebelId = "";
        room.updateLeaderboard();
        return;
    }

    let totalMass = 0;
    let leader = alivePlayers[0];
    for (const player of alivePlayers) {
        totalMass += player.mass;
        if (player.mass > leader.mass) leader = player;
    }
    const avgMass = totalMass / alivePlayers.length;
    if (leader.mass >= avgMass * room.balance.rebel.massThresholdMultiplier) {
        room.state.rebelId = leader.id;
    } else {
        room.state.rebelId = "";
    }
    room.updateLeaderboard();
}
