import * as Colyseus from "colyseus.js";

const root = document.createElement("div");
root.style.fontFamily = "monospace";
root.style.background = "#1a1a1a";
root.style.color = "#00ff00";
root.style.padding = "20px";
root.style.height = "100vh";
root.style.overflow = "auto";
root.style.margin = "0";
root.style.whiteSpace = "pre-wrap";
root.style.wordWrap = "break-word";

document.body.appendChild(root);

const status = document.createElement("div");
status.style.marginBottom = "20px";
status.style.fontSize = "14px";
root.appendChild(status);

async function main() {
    status.textContent = "🔌 Подключение к серверу...";

    const client = new Colyseus.Client("ws://localhost:2567");

    try {
        const room = await client.joinOrCreate("arena", { name: `Player_${Math.random().toString(36).slice(2, 7)}` });
        status.textContent = "✅ Подключено к серверу\n";

        let lastPhase = "";
        let hotZonesCount = 0;
        let chestsCount = 0;
        let orbsCount = 0;
        let playersCount = 0;

        room.onStateChange.once(() => {
            console.log("Начальное состояние:", room.state);
        });

        room.state.listen("phase", (phase: string) => {
            if (phase !== lastPhase) {
                console.log(`📍 Смена фазы: ${lastPhase} → ${phase}`);
                lastPhase = phase;
            }
        });

        room.state.hotZones.onAdd = () => {
            hotZonesCount = room.state.hotZones.size;
        };

        room.state.hotZones.onRemove = () => {
            hotZonesCount = room.state.hotZones.size;
        };

        room.state.chests.onAdd = () => {
            chestsCount = room.state.chests.size;
        };

        room.state.chests.onRemove = () => {
            chestsCount = room.state.chests.size;
        };

        room.state.orbs.onAdd = () => {
            orbsCount = room.state.orbs.size;
        };

        room.state.orbs.onRemove = () => {
            orbsCount = room.state.orbs.size;
        };

        room.state.players.onAdd = () => {
            playersCount = room.state.players.size;
        };

        room.state.players.onRemove = () => {
            playersCount = room.state.players.size;
        };

        setInterval(() => {
            let info = "═══════════════════════════════════════\n";
            info += `📊 SLIME ARENA — ШАГ 3 ТЕСТ\n`;
            info += `═══════════════════════════════════════\n\n`;

            info += `⏱️  МАТЧ\n`;
            info += `   Фаза: ${room.state.phase}\n`;
            info += `   Время осталось: ${room.state.timeRemaining?.toFixed(1) ?? 0}с\n\n`;

            info += `👥 ИГРОКИ (${playersCount})\n`;
            let playerIndex = 0;
            for (const [id, player] of room.state.players.entries()) {
                playerIndex++;
                const isRebel = room.state.rebelId === id ? "⚔️ МЯТЕЖНИК" : "";
                const isLastBreath = (player.flags & 4) ? "💨 ПОСЛЕДНИЙ ВЗДОХ" : "";
                const isDead = (player.flags & 16) ? "💀 МЁРТВ" : "";
                const status = [isRebel, isLastBreath, isDead].filter(Boolean).join(" ");
                info += `   ${playerIndex}. ${player.name} | масса=${player.mass.toFixed(0)} | hp=${player.hp.toFixed(1)}/${player.maxHp.toFixed(1)} ${status}\n`;
                if (playerIndex >= 5) {
                    if (playersCount > 5) info += `   ... и ещё ${playersCount - 5}\n`;
                    break;
                }
            }
            info += "\n";

            info += `🌍 МИР\n`;
            info += `   Орбы: ${orbsCount}/${150}\n`;
            info += `   Сундуки: ${chestsCount}/${3}\n`;
            info += `   Hot Zones: ${hotZonesCount}\n\n`;

            if (hotZonesCount > 0) {
                info += `🔥 HOT ZONES\n`;
                let zoneIndex = 0;
                for (const [id, zone] of room.state.hotZones.entries()) {
                    zoneIndex++;
                    info += `   ${zoneIndex}. центр(${zone.x.toFixed(0)}, ${zone.y.toFixed(0)}) | радиус=${zone.radius.toFixed(0)} | множитель=×${zone.spawnMultiplier}\n`;
                }
                info += "\n";
            }

            if (room.state.leaderboard && room.state.leaderboard.length > 0) {
                info += `🏆 ЛИДЕРБОРД (ТОП-3)\n`;
                for (let i = 0; i < room.state.leaderboard.length; i++) {
                    const playerId = room.state.leaderboard[i];
                    const player = room.state.players.get(playerId);
                    if (player) {
                        info += `   ${i + 1}. ${player.name} | ${player.mass.toFixed(0)} масса\n`;
                    }
                }
                info += "\n";
            }

            info += `🔌 СИНХРОНИЗАЦИЯ\n`;
            info += `   Room ID: ${room.roomId}\n`;
            info += `   Session ID: ${room.sessionId}\n`;
            info += `   State: ${room.state ? "✅" : "❌"}\n`;

            status.textContent = info;
        }, 100);
    } catch (e) {
        status.textContent = `❌ Ошибка подключения: ${e}`;
        console.error(e);
    }
}

main();
