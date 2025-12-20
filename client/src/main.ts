import * as Colyseus from "colyseus.js";
import {
    DEFAULT_BALANCE_CONFIG,
    getOrbRadius,
    FLAG_IS_REBEL,
    FLAG_LAST_BREATH,
    FLAG_IS_DEAD,
} from "@slime-arena/shared";

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

const hud = document.createElement("div");
hud.style.position = "fixed";
hud.style.top = "12px";
hud.style.left = "12px";
hud.style.padding = "10px 12px";
hud.style.background = "rgba(0, 0, 0, 0.55)";
hud.style.border = "1px solid rgba(255, 255, 255, 0.1)";
hud.style.borderRadius = "10px";
hud.style.fontSize = "13px";
hud.style.lineHeight = "1.4";
hud.style.color = "#e6f3ff";
hud.style.pointerEvents = "none";
hud.style.minWidth = "220px";
hud.style.fontFamily = "\"IBM Plex Mono\", \"Courier New\", monospace";
root.appendChild(hud);

const canvas = document.createElement("canvas");
canvas.style.width = "100%";
canvas.style.height = "100vh";
canvas.style.display = "block";
canvas.style.background = "radial-gradient(circle at 30% 30%, #10141d, #090b10 60%)";
root.appendChild(canvas);

let ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
}
const canvasCtx: CanvasRenderingContext2D = ctx;

canvas.addEventListener(
    "contextlost",
    (event) => {
        event.preventDefault();
        const restored = canvas.getContext("2d");
        if (restored) {
            ctx = restored;
        }
    },
    false
);

const talentModal = document.createElement("div");
talentModal.style.position = "fixed";
talentModal.style.inset = "0";
talentModal.style.display = "none";
talentModal.style.alignItems = "center";
talentModal.style.justifyContent = "center";
talentModal.style.padding = "24px";
talentModal.style.background = "radial-gradient(circle at top, rgba(24, 40, 60, 0.75), rgba(5, 7, 12, 0.9))";
talentModal.style.backdropFilter = "blur(2px)";
talentModal.style.zIndex = "10";

const talentCard = document.createElement("div");
talentCard.style.width = "min(520px, 92vw)";
talentCard.style.background = "linear-gradient(160deg, #101721, #0c0f14)";
talentCard.style.border = "1px solid #2a3c55";
talentCard.style.borderRadius = "16px";
talentCard.style.padding = "20px";
talentCard.style.color = "#e6f3ff";
talentCard.style.fontFamily = "\"IBM Plex Mono\", \"Courier New\", monospace";
talentCard.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.45)";
talentCard.style.display = "grid";
talentCard.style.gap = "12px";

const talentTitle = document.createElement("div");
talentTitle.textContent = "Choose a Talent";
talentTitle.style.fontSize = "18px";
talentTitle.style.fontWeight = "700";
talentTitle.style.letterSpacing = "0.5px";

const talentHint = document.createElement("div");
talentHint.textContent = "Spend one available talent to gain a boost.";
talentHint.style.fontSize = "13px";
talentHint.style.color = "#9fb5cc";

const talentCount = document.createElement("div");
talentCount.style.fontSize = "12px";
talentCount.style.color = "#6fd6ff";

const talentButtons = document.createElement("div");
talentButtons.style.display = "grid";
talentButtons.style.gap = "10px";

const talentChoices = [
    { id: 0, name: "Mass Surge", detail: "+5% mass" },
    { id: 1, name: "Vital Burst", detail: "+30% HP" },
    { id: 2, name: "Guard Pulse", detail: "+3% mass + shield" },
];

const talentButtonsList: HTMLButtonElement[] = [];

const styleTalentButton = (button: HTMLButtonElement) => {
    button.type = "button";
    button.style.display = "grid";
    button.style.gap = "4px";
    button.style.padding = "12px 14px";
    button.style.background = "#111b2a";
    button.style.border = "1px solid #2d4a6d";
    button.style.borderRadius = "12px";
    button.style.color = "#e6f3ff";
    button.style.fontSize = "14px";
    button.style.textAlign = "left";
    button.style.cursor = "pointer";
    button.style.transition = "transform 120ms ease, box-shadow 120ms ease, background 120ms ease";

    button.addEventListener("mouseenter", () => {
        if (button.disabled) return;
        button.style.transform = "translateY(-2px)";
        button.style.background = "#1b2c45";
        button.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.35)";
    });

    button.addEventListener("mouseleave", () => {
        button.style.transform = "translateY(0)";
        button.style.background = "#111b2a";
        button.style.boxShadow = "none";
    });
};

for (const choice of talentChoices) {
    const button = document.createElement("button");
    const label = document.createElement("div");
    label.textContent = choice.name;
    label.style.fontWeight = "600";
    const detail = document.createElement("div");
    detail.textContent = choice.detail;
    detail.style.fontSize = "12px";
    detail.style.color = "#a9bdd6";
    button.dataset.choice = String(choice.id);
    styleTalentButton(button);
    button.appendChild(label);
    button.appendChild(detail);
    talentButtons.appendChild(button);
    talentButtonsList.push(button);
}

talentCard.appendChild(talentTitle);
talentCard.appendChild(talentHint);
talentCard.appendChild(talentCount);
talentCard.appendChild(talentButtons);
talentModal.appendChild(talentCard);
document.body.appendChild(talentModal);

const mapSize = DEFAULT_BALANCE_CONFIG.world.mapSize;
const orbMinRadius = DEFAULT_BALANCE_CONFIG.orbs.minRadius;
const chestRadius = DEFAULT_BALANCE_CONFIG.chests.radius;
const hotZoneRadius = DEFAULT_BALANCE_CONFIG.hotZones.radius;
const collectorRadiusMult = DEFAULT_BALANCE_CONFIG.classes.collector.radiusMult;
const chestStyles = [
    { fill: "#ffc857", stroke: "#ffe8a3", glow: "rgba(255,220,120,0.6)", icon: "📦", scale: 1 },
    { fill: "#9ad4ff", stroke: "#c9e6ff", glow: "rgba(120,190,255,0.6)", icon: "🎁", scale: 1.08 },
    { fill: "#b186ff", stroke: "#d8c1ff", glow: "rgba(190,150,255,0.65)", icon: "💎", scale: 1.16 },
];

const keyState = { up: false, down: false, left: false, right: false };
const camera = { x: mapSize / 2, y: mapSize / 2 };
const cameraLerp = 0.15;
const desiredView = { width: 900, height: 700 };
let hasFocus = true;
const selfSprite = new Image();
const enemySprite = new Image();
let selfSpriteReady = false;
let enemySpriteReady = false;

const packmanYellowSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><radialGradient id="yGlow" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#fff57a"/><stop offset="50%" stop-color="#ffd53b"/><stop offset="100%" stop-color="#d6a600"/></radialGradient></defs><circle cx="256" cy="256" r="240" fill="url(#yGlow)" stroke="#f7c800" stroke-width="12"/><path d="M256 256 L480 150 A240 240 0 0 1 480 362 Z" fill="#1a0c0c"/><g fill="#ffeede" stroke="#d18a00" stroke-width="8" stroke-linejoin="round"><polygon points="360,220 400,210 375,250"/><polygon points="330,190 370,180 345,220"/><polygon points="390,260 420,260 400,295"/><polygon points="330,310 370,320 345,280"/><polygon points="360,290 395,300 370,260"/><polygon points="320,240 355,250 330,210"/><polygon points="300,270 335,280 310,240"/></g><circle cx="210" cy="190" r="48" fill="#fff" stroke="#d18a00" stroke-width="8"/><circle cx="215" cy="190" r="20" fill="#1f8f2b"/><circle cx="220" cy="190" r="10" fill="#0b3a13"/><circle cx="230" cy="180" r="6" fill="#fff"/></svg>';
const packmanRedSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><radialGradient id="rGlow" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#ffb09a"/><stop offset="50%" stop-color="#ff6b3b"/><stop offset="100%" stop-color="#c51d00"/></radialGradient></defs><circle cx="256" cy="256" r="240" fill="url(#rGlow)" stroke="#ff8a3b" stroke-width="12"/><path d="M256 256 L480 150 A240 240 0 0 1 480 362 Z" fill="#230c0c"/><g fill="#ffefc5" stroke="#c56700" stroke-width="8" stroke-linejoin="round"><polygon points="360,220 400,210 375,250"/><polygon points="330,190 370,180 345,220"/><polygon points="390,260 420,260 400,295"/><polygon points="330,310 370,320 345,280"/><polygon points="360,290 395,300 370,260"/><polygon points="320,240 355,250 330,210"/><polygon points="300,270 335,280 310,240"/></g><circle cx="210" cy="190" r="48" fill="#fff" stroke="#c56700" stroke-width="8"/><circle cx="215" cy="190" r="20" fill="#3f5f0a"/><circle cx="220" cy="190" r="10" fill="#0f2800"/><circle cx="230" cy="180" r="6" fill="#fff"/></svg>';

const svgToDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

selfSprite.src = svgToDataUri(packmanYellowSvg);
enemySprite.src = svgToDataUri(packmanRedSvg);
selfSprite.onload = () => (selfSpriteReady = true);
enemySprite.onload = () => (enemySpriteReady = true);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function worldToScreen(x: number, y: number, scale: number, camX: number, camY: number, cw: number, ch: number) {
    return {
        x: (x - camX) * scale + cw / 2,
        y: (y - camY) * scale + ch / 2,
    };
}

function drawGrid(scale: number, camX: number, camY: number, cw: number, ch: number) {
    const step = 200;
    const halfW = cw / scale / 2;
    const halfH = ch / scale / 2;
    const startX = Math.max(0, Math.floor((camX - halfW) / step) * step);
    const endX = Math.min(mapSize, Math.ceil((camX + halfW) / step) * step);
    const startY = Math.max(0, Math.floor((camY - halfH) / step) * step);
    const endY = Math.min(mapSize, Math.ceil((camY + halfH) / step) * step);
    canvasCtx.strokeStyle = "rgba(255,255,255,0.03)";
    canvasCtx.lineWidth = 1;
    for (let x = startX; x <= endX; x += step) {
        const screen = worldToScreen(x, 0, scale, camX, camY, cw, ch);
        canvasCtx.beginPath();
        canvasCtx.moveTo(screen.x, 0);
        canvasCtx.lineTo(screen.x, ch);
        canvasCtx.stroke();
    }
    for (let y = startY; y <= endY; y += step) {
        const screen = worldToScreen(0, y, scale, camX, camY, cw, ch);
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, screen.y);
        canvasCtx.lineTo(cw, screen.y);
        canvasCtx.stroke();
    }
}

function orbColor(colorId: number): string {
    switch (colorId) {
        case 0:
            return "#6ddc6a";
        case 1:
            return "#53c7ff";
        case 2:
            return "#ff6f6f";
        case 3:
            return "#ffd166";
        default:
            return "#b0b0b0";
    }
}

function drawCircle(x: number, y: number, radius: number, fill: string, stroke?: string) {
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
    canvasCtx.fillStyle = fill;
    canvasCtx.fill();
    if (stroke) {
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = stroke;
        canvasCtx.stroke();
    }
}

function drawSprite(
    img: HTMLImageElement,
    ready: boolean,
    x: number,
    y: number,
    radius: number,
    angleDeg: number,
    fallbackFill: string,
    fallbackStroke: string
) {
    if (ready) {
        const size = radius * 2;
        const angleRad = (angleDeg * Math.PI) / 180;
        canvasCtx.save();
        canvasCtx.translate(x, y);
        canvasCtx.rotate(angleRad);
        canvasCtx.drawImage(img, -size / 2, -size / 2, size, size);
        canvasCtx.restore();
    } else {
        drawCircle(x, y, radius, fallbackFill, fallbackStroke);
    }
}

async function main() {
    hud.textContent = "Подключение к серверу...";

    const client = new Colyseus.Client("ws://localhost:2567");

    try {
        const room = await client.joinOrCreate<any>("arena", { name: `Player_${Math.random().toString(36).slice(2, 7)}` });
        hud.textContent = "Подключено к серверу";

        let hotZonesCount = 0;
        let chestsCount = 0;
        let orbsCount = 0;
        let playersCount = 0;
        let inputSeq = 0;
        let localPlayer: any = null;
        let lastTalentsAvailable = 0;
        let talentSelectionInFlight = false;

        // Логирование для отладки
        console.log("Room joined:", room.id);

        const refreshTalentModal = () => {
            if (!localPlayer) {
                talentModal.style.display = "none";
                return;
            }
            const available = Number(localPlayer.talentsAvailable || 0);
            if (available !== lastTalentsAvailable) {
                talentSelectionInFlight = false;
                lastTalentsAvailable = available;
            }
            if (available <= 0) {
                talentModal.style.display = "none";
                return;
            }

            talentModal.style.display = "flex";
            talentCount.textContent = `Available talents: ${available}`;
            const canSelect = !talentSelectionInFlight;
            for (const button of talentButtonsList) {
                button.disabled = !canSelect;
                button.style.opacity = canSelect ? "1" : "0.6";
                button.style.cursor = canSelect ? "pointer" : "not-allowed";
            }
        };

        const sendTalentChoice = (choice: number) => {
            if (talentSelectionInFlight) return;
            talentSelectionInFlight = true;
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: 0, moveY: 0, talentChoice: choice });
            setTimeout(() => {
                talentSelectionInFlight = false;
                refreshTalentModal();
            }, 1000);
            refreshTalentModal();
        };

        for (const button of talentButtonsList) {
            const rawChoice = Number(button.dataset.choice);
            button.addEventListener("click", () => {
                if (!Number.isFinite(rawChoice)) return;
                sendTalentChoice(rawChoice);
            });
        }

        // Подписка на игроков (как в legacy)
        room.state.players.onAdd((player: any, sessionId: string) => {
            playersCount++;
            console.log(`Player added: ${sessionId} (${player.name}), total: ${playersCount}`);

            if (sessionId === room.sessionId) {
                localPlayer = player;
                lastTalentsAvailable = Number(player.talentsAvailable || 0);
                refreshTalentModal();
                player.onChange(() => refreshTalentModal());
            }
            
            player.onChange(() => {
                // Обновление данных игрока
            });
        });

        room.state.players.onRemove((_player: any, sessionId: string) => {
            playersCount--;
            console.log(`Player removed: ${sessionId}, total: ${playersCount}`);
            if (sessionId === room.sessionId) {
                localPlayer = null;
                refreshTalentModal();
            }
        });

        // Подписка на орбы
        room.state.orbs.onAdd((orb: any) => {
            orbsCount++;
            orb.onChange(() => {});
        });

        room.state.orbs.onRemove(() => {
            orbsCount--;
        });

        // Подписка на сундуки
        room.state.chests.onAdd((chest: any) => {
            chestsCount++;
            console.log(`Chest added, total: ${chestsCount}`);
            chest.onChange(() => {});
        });

        room.state.chests.onRemove(() => {
            chestsCount--;
            console.log(`Chest removed, total: ${chestsCount}`);
        });

        // Подписка на hot zones
        room.state.hotZones.onAdd((zone: any) => {
            hotZonesCount++;
            console.log(`Hot zone added, total: ${hotZonesCount}`);
            zone.onChange(() => {});
        });

        room.state.hotZones.onRemove(() => {
            hotZonesCount--;
            console.log(`Hot zone removed, total: ${hotZonesCount}`);
        });

        const updateHud = () => {
            const lines: string[] = [];
            lines.push(`Фаза: ${room.state.phase}`);
            lines.push(`Время: ${(room.state.timeRemaining ?? 0).toFixed(1)}с`);
            lines.push(`Игроки: ${playersCount}`);
            lines.push(`Орбы: ${orbsCount}/${DEFAULT_BALANCE_CONFIG.orbs.maxCount}`);
            lines.push(`Сундуки: ${chestsCount}/${DEFAULT_BALANCE_CONFIG.chests.maxCount}`);
            lines.push(`Hot Zones: ${hotZonesCount}`);
            if (localPlayer) {
                lines.push(
                    `Моя масса: ${localPlayer.mass.toFixed(0)} | HP: ${localPlayer.hp.toFixed(1)}/${localPlayer.maxHp.toFixed(1)}`
                );
                if (localPlayer.talentsAvailable > 0) {
                    lines.push(`Таланты: ${localPlayer.talentsAvailable}`);
                }
            }
            if (room.state.leaderboard && room.state.leaderboard.length > 0) {
                lines.push("Топ-3:");
                for (let i = 0; i < Math.min(3, room.state.leaderboard.length); i += 1) {
                    const playerId = room.state.leaderboard[i];
                    const pl = room.state.players.get(playerId);
                    if (pl) {
                        lines.push(`${i + 1}. ${pl.name} — ${pl.mass.toFixed(0)} масса`);
                    }
                }
            }
            hud.textContent = lines.join("\n");
        };

        const computeMoveInput = () => {
            let x = 0;
            let y = 0;
            if (keyState.left) x -= 1;
            if (keyState.right) x += 1;
            if (keyState.up) y -= 1;
            if (keyState.down) y += 1;
            const len = Math.hypot(x, y);
            if (len > 1e-6) {
                x /= len;
                y /= len;
            } else {
                x = 0;
                y = 0;
            }
            return { x, y };
        };

        let lastSentInput = { x: 0, y: 0 };

        const inputTimer = setInterval(() => {
            if (!hasFocus) return;
            const { x, y } = computeMoveInput();
            const changed = Math.abs(x - lastSentInput.x) > 1e-3 || Math.abs(y - lastSentInput.y) > 1e-3;
            if (!changed) return;
            lastSentInput = { x, y };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: x, moveY: y });
        }, 50);

        const render = () => {
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = Math.min(cw / desiredView.width, ch / desiredView.height);
            const halfWorldW = cw / scale / 2;
            const halfWorldH = ch / scale / 2;

            const targetX = localPlayer ? localPlayer.x : mapSize / 2;
            const targetY = localPlayer ? localPlayer.y : mapSize / 2;
            const clampX = Math.max(halfWorldW, Math.min(mapSize - halfWorldW, targetX));
            const clampY = Math.max(halfWorldH, Math.min(mapSize - halfWorldH, targetY));
            camera.x += (clampX - camera.x) * cameraLerp;
            camera.y += (clampY - camera.y) * cameraLerp;

            canvasCtx.clearRect(0, 0, cw, ch);
            drawGrid(scale, camera.x, camera.y, cw, ch);

            canvasCtx.fillStyle = "rgba(255, 99, 71, 0.08)";
            for (const [, zone] of room.state.hotZones.entries()) {
                if (Math.abs(zone.x - camera.x) > halfWorldW + hotZoneRadius || Math.abs(zone.y - camera.y) > halfWorldH + hotZoneRadius) continue;
                const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                drawCircle(p.x, p.y, zone.radius * scale, "rgba(255, 99, 71, 0.08)", "rgba(255, 99, 71, 0.4)");
            }

            for (const [, orb] of room.state.orbs.entries()) {
                if (Math.abs(orb.x - camera.x) > halfWorldW + 50 || Math.abs(orb.y - camera.y) > halfWorldH + 50) continue;
                const p = worldToScreen(orb.x, orb.y, scale, camera.x, camera.y, cw, ch);
                const r = Math.max(2, getOrbRadius(orb.mass, 1, orbMinRadius) * scale);
                drawCircle(p.x, p.y, r, orbColor(orb.colorId));
            }

            const time = performance.now() * 0.001;

            for (const [, chest] of room.state.chests.entries()) {
                if (Math.abs(chest.x - camera.x) > halfWorldW + chestRadius || Math.abs(chest.y - camera.y) > halfWorldH + chestRadius) continue;
                const p = worldToScreen(chest.x, chest.y, scale, camera.x, camera.y, cw, ch);
                const style = chestStyles[chest.type] ?? chestStyles[0];
                const pulse = 1 + 0.12 * Math.sin(time * 4 + chest.x * 0.01 + chest.y * 0.01);
                const r = chestRadius * style.scale * pulse * scale;
                canvasCtx.save();
                canvasCtx.shadowColor = style.glow;
                canvasCtx.shadowBlur = 12;
                drawCircle(p.x, p.y, r, style.fill, style.stroke);
                canvasCtx.shadowBlur = 0;
                canvasCtx.fillStyle = "#1b1b1b";
                canvasCtx.font = "16px \"IBM Plex Mono\", monospace";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText(style.icon, p.x, p.y + 5);
                canvasCtx.restore();
            }

            for (const [id, player] of room.state.players.entries()) {
                if (Math.abs(player.x - camera.x) > halfWorldW + 200 || Math.abs(player.y - camera.y) > halfWorldH + 200) continue;
                const p = worldToScreen(player.x, player.y, scale, camera.x, camera.y, cw, ch);
                const classRadiusMult = player.classId === 2 ? collectorRadiusMult : 1;
                const radius = Math.sqrt(player.mass) * classRadiusMult * scale;
                const isSelf = id === room.sessionId;
                const color = isSelf ? "#6fd6ff" : "#9be070";
                const stroke = player.flags & FLAG_IS_DEAD ? "#555" : isSelf ? "#1ea6ff" : "#6ac96f";
                const r = Math.max(radius, 12);
                const angleDeg = player.angle ?? 0;
                if (isSelf) {
                    drawSprite(selfSprite, selfSpriteReady, p.x, p.y, r, angleDeg, color, stroke);
                } else {
                    drawSprite(enemySprite, enemySpriteReady, p.x, p.y, r, angleDeg, color, stroke);
                }

                canvasCtx.fillStyle = "#e6f3ff";
                canvasCtx.font = "12px \"IBM Plex Mono\", monospace";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText(player.name, p.x, p.y - r - 6);

                const flagText: string[] = [];
                if (player.flags & FLAG_IS_REBEL) flagText.push("REB");
                if (player.flags & FLAG_LAST_BREATH) flagText.push("LB");
                if (player.flags & FLAG_IS_DEAD) flagText.push("DEAD");
                if (flagText.length > 0) {
                    canvasCtx.fillText(flagText.join(" "), p.x, p.y + r + 12);
                }
            }

            // Chest indicators по краям экрана
            for (const [, chest] of room.state.chests.entries()) {
                const dx = chest.x - camera.x;
                const dy = chest.y - camera.y;
                if (Math.abs(dx) <= halfWorldW && Math.abs(dy) <= halfWorldH) continue;
                const angle = Math.atan2(dy, dx);
                const edgeX = Math.cos(angle) * (halfWorldW - 40);
                const edgeY = Math.sin(angle) * (halfWorldH - 40);
                const screen = worldToScreen(camera.x + edgeX, camera.y + edgeY, scale, camera.x, camera.y, cw, ch);
                canvasCtx.save();
                canvasCtx.translate(screen.x, screen.y);
                canvasCtx.rotate(angle);
                canvasCtx.fillStyle = "#ffc857";
                canvasCtx.beginPath();
                canvasCtx.moveTo(12, 0);
                canvasCtx.lineTo(-8, 8);
                canvasCtx.lineTo(-8, -8);
                canvasCtx.closePath();
                canvasCtx.fill();
                canvasCtx.restore();
            }

            requestAnimationFrame(render);
        };

        const sendStopInput = () => {
            lastSentInput = { x: 0, y: 0 };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: 0, moveY: 0 });
        };

        window.addEventListener("keydown", (event) => {
            if (event.repeat) return;
            switch (event.key.toLowerCase()) {
                case "arrowup":
                case "w":
                    keyState.up = true;
                    break;
                case "arrowdown":
                case "s":
                    keyState.down = true;
                    break;
                case "arrowleft":
                case "a":
                    keyState.left = true;
                    break;
                case "arrowright":
                case "d":
                    keyState.right = true;
                    break;
                default:
                    return;
            }
            hasFocus = true;
            event.preventDefault();
        });

        window.addEventListener("keyup", (event) => {
            switch (event.key.toLowerCase()) {
                case "arrowup":
                case "w":
                    keyState.up = false;
                    break;
                case "arrowdown":
                case "s":
                    keyState.down = false;
                    break;
                case "arrowleft":
                case "a":
                    keyState.left = false;
                    break;
                case "arrowright":
                case "d":
                    keyState.right = false;
                    break;
                default:
                    return;
            }
            event.preventDefault();
        });

        window.addEventListener("blur", () => {
            hasFocus = false;
            keyState.up = keyState.down = keyState.left = keyState.right = false;
            sendStopInput();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                hasFocus = false;
                keyState.up = keyState.down = keyState.left = keyState.right = false;
                sendStopInput();
            } else {
                hasFocus = true;
            }
        });

        updateHud();
        refreshTalentModal();
        render();

        const hudTimer = setInterval(() => {
            updateHud();
            refreshTalentModal();
        }, 200);

        room.onLeave(() => {
            clearInterval(inputTimer);
            clearInterval(hudTimer);
        });
    } catch (e) {
        hud.textContent = `Ошибка подключения: ${e}`;
        console.error(e);
    }
}

main();
