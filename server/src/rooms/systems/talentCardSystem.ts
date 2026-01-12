export function talentCardSystem(room: any) {
    const currentTick = room.tick;

    for (const player of room.state.players.values()) {
        // Очистка talentChoicePressed если нет активной карточки
        if (!player.pendingTalentCard && player.talentChoicePressed2 !== null) {
            player.talentChoicePressed2 = null;
        }

        if (!player.pendingTalentCard) continue;

        const card = player.pendingTalentCard;

        // GDD 7.4.2: При смерти таймер приостанавливается (сдвигаем deadline)
        if (player.isDead) {
            card.expiresAtTick += 1;
            continue;
        }

        // Обработка выбора игрока
        if (player.talentChoicePressed2 !== null) {
            room.applyTalentCardChoice(player, player.talentChoicePressed2);
            player.talentChoicePressed2 = null;
            continue;
        }

        // GDD 7.4.1: Автовыбор по таймауту с приоритетами класса
        if (currentTick >= card.expiresAtTick) {
            room.forceAutoPickTalent(player);
        }
    }
}
