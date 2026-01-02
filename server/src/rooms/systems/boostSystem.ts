export function boostSystem(room: any) {
    for (const player of room.state.players.values()) {
        if (!player.boostType) continue;
        if (
            player.boostType !== "rage" &&
            player.boostType !== "haste" &&
            player.boostType !== "guard" &&
            player.boostType !== "greed"
        ) {
            room.clearBoost(player);
            continue;
        }
        if (player.boostEndTick > 0 && room.tick >= player.boostEndTick) {
            room.clearBoost(player);
            continue;
        }
        if (
            (player.boostType === "guard" || player.boostType === "greed") &&
            player.boostCharges <= 0
        ) {
            room.clearBoost(player);
        }
    }
}
