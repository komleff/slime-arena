import { Client, Room } from "colyseus.js";
import { GAME_CONFIG, getSlimeRadius } from "@slime-arena/shared";

// ===== Canvas Setup =====
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

// ===== Camera =====
interface Camera {
    x: number;
    y: number;
    scale: number;
}

const camera: Camera = {
    x: GAME_CONFIG.MAP_SIZE / 2,
    y: GAME_CONFIG.MAP_SIZE / 2,
    scale: 1,
};

const CAMERA_LERP = 0.1; // Плавность камеры
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;
const BASE_VIEWPORT = 800; // Базовый размер вьюпорта для масштабирования

// ===== Colyseus Client =====
const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsHost = window.location.hostname || "localhost";
const wsPort =
    typeof import.meta.env.VITE_WS_PORT === "string" && import.meta.env.VITE_WS_PORT.length > 0
        ? import.meta.env.VITE_WS_PORT
        : "2567";
const defaultWsUrl = `${wsProtocol}://${wsHost}:${wsPort}`;
const wsUrl =
    typeof import.meta.env.VITE_WS_URL === "string" && import.meta.env.VITE_WS_URL.length > 0
        ? import.meta.env.VITE_WS_URL
        : defaultWsUrl;
const client = new Client(wsUrl);
let room: Room | null = null;
let mySessionId: string | null = null;

// ===== Local State (для рендеринга) =====
interface LocalPlayer {
    id: string;
    name: string;
    x: number;
    y: number;
    mass: number;
    angle: number;
    hp: number;
    maxHp: number;
    isDead: boolean;
    isInvulnerable: boolean;
}

interface LocalOrb {
    id: string;
    x: number;
    y: number;
    mass: number;
    color: any;
}

const players = new Map<string, LocalPlayer>();
const orbs = new Map<string, LocalOrb>();

// ===== Цвета пузырей =====
const ORB_COLORS: Record<number, string> = {
    0: "#4ade80", // GREEN
    1: "#60a5fa", // BLUE
    2: "#f87171", // RED
    3: "#fbbf24", // GOLD
};

const ORB_DENSITY_MAP: Record<number, number> = {
    0: GAME_CONFIG.ORB_DENSITY.GREEN,
    1: GAME_CONFIG.ORB_DENSITY.BLUE,
    2: GAME_CONFIG.ORB_DENSITY.RED,
    3: GAME_CONFIG.ORB_DENSITY.GOLD,
};

// ===== Подключение к серверу =====
async function connect() {
    try {
        const playerName = prompt("Введите имя:") || "Slime";
        room = await client.joinOrCreate("arena", { name: playerName });
        mySessionId = room.sessionId;
        console.log("Connected! Session:", mySessionId);

        // Подписка на состояние игроков
        room.state.players.onAdd((player: any, sessionId: string) => {
            console.log("Player added:", sessionId, player.name);
            players.set(sessionId, {
                id: sessionId,
                name: player.name,
                x: player.x,
                y: player.y,
                mass: player.mass,
                angle: player.angle,
                hp: player.hp,
                maxHp: player.maxHp,
                isDead: player.isDead || false,
                isInvulnerable: player.isInvulnerable || false,
            });

            // Подписка на изменения
            player.onChange(() => {
                const local = players.get(sessionId);
                if (local) {
                    local.x = player.x;
                    local.y = player.y;
                    local.mass = player.mass;
                    local.angle = player.angle;
                    local.hp = player.hp;
                    local.maxHp = player.maxHp;
                    local.isDead = player.isDead || false;
                    local.isInvulnerable = player.isInvulnerable || false;
                }
            });
        });

        room.state.players.onRemove((_player: any, sessionId: string) => {
            console.log("Player removed:", sessionId);
            players.delete(sessionId);
        });

        // Подписка на пузыри
        room.state.orbs.onAdd((orb: any, orbId: string) => {
            orbs.set(orbId, {
                id: orbId,
                x: orb.x,
                y: orb.y,
                mass: orb.mass,
                color: orb.color,
            });

            orb.onChange(() => {
                const local = orbs.get(orbId);
                if (local) {
                    local.x = orb.x;
                    local.y = orb.y;
                    local.mass = orb.mass;
                    local.color = orb.color;
                }
            });
        });

        room.state.orbs.onRemove((_orb: any, orbId: string) => {
            orbs.delete(orbId);
        });

    } catch (e) {
        console.error("Connection error", e);
    }
}

// ===== Camera Update =====
function updateCamera() {
    if (!mySessionId) return;
    
    const me = players.get(mySessionId);
    if (!me || me.isDead) return;

    // Плавное следование за игроком
    camera.x += (me.x - camera.x) * CAMERA_LERP;
    camera.y += (me.y - camera.y) * CAMERA_LERP;

    // Масштаб зависит от массы (больше слайм - дальше камера)
    const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, BASE_VIEWPORT / (getSlimeRadius(me.mass) * 10)));
    camera.scale += (targetScale - camera.scale) * CAMERA_LERP;
}

// ===== Рендеринг =====
function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const screenX = (worldX - camera.x) * camera.scale + canvas.width / 2;
    const screenY = (worldY - camera.y) * camera.scale + canvas.height / 2;
    return { x: screenX, y: screenY };
}

function drawBackground() {
    // Песочный фон
    ctx.fillStyle = "#e0d5b7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сетка (еле заметная, как текстура песка/плитки)
    ctx.strokeStyle = "#d6c493";
    ctx.lineWidth = 2;

    const gridSize = 100;
    const startX = Math.floor((camera.x - canvas.width / 2 / camera.scale) / gridSize) * gridSize;
    const startY = Math.floor((camera.y - canvas.height / 2 / camera.scale) / gridSize) * gridSize;
    const endX = camera.x + canvas.width / 2 / camera.scale;
    const endY = camera.y + canvas.height / 2 / camera.scale;

    for (let x = startX; x <= endX; x += gridSize) {
        const screen = worldToScreen(x, 0);
        ctx.beginPath();
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, canvas.height);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
        const screen = worldToScreen(0, y);
        ctx.beginPath();
        ctx.moveTo(0, screen.y);
        ctx.lineTo(canvas.width, screen.y);
        ctx.stroke();
    }
}

function drawBorders() {
    // Каменные границы
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 20 * camera.scale;

    const topLeft = worldToScreen(0, 0);
    const bottomRight = worldToScreen(GAME_CONFIG.MAP_SIZE, GAME_CONFIG.MAP_SIZE);

    ctx.strokeRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
    );
}

function drawOrbs() {
    orbs.forEach((orb) => {
        const pos = worldToScreen(orb.x, orb.y);
        const density = ORB_DENSITY_MAP[orb.color as unknown as number] || 1;
        const radius = GAME_CONFIG.ORB_BASE_RADIUS * Math.sqrt(orb.mass / density) * camera.scale;

        // Glow эффект
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 1.5);
        const color = ORB_COLORS[orb.color as unknown as number] || "#ffffff";
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Основной круг
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Обводка пузыря
        ctx.lineWidth = 1 * camera.scale;
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.stroke();
    });
}

function drawSlime(player: LocalPlayer, isMe: boolean) {
    if (player.isDead) return;

    const pos = worldToScreen(player.x, player.y);
    const radius = getSlimeRadius(player.mass) * camera.scale;
    const angleRad = (player.angle * Math.PI) / 180;

    // Цвет слайма
    const baseColor = isMe ? "#22c55e" : "#ef4444";
    const darkColor = isMe ? "#16a34a" : "#dc2626";

    // Эффект неуязвимости
    if (player.isInvulnerable) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
    }

    // Тело слайма (капля)
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();
    
    // Обводка тела
    ctx.lineWidth = 3 * camera.scale;
    ctx.strokeStyle = "black";
    ctx.stroke();

    // Направление (пасть) - треугольник
    const mouthDist = radius * 0.8;
    const mouthX = pos.x + Math.cos(angleRad) * mouthDist;
    const mouthY = pos.y + Math.sin(angleRad) * mouthDist;
    const mouthSize = radius * 0.4;

    ctx.beginPath();
    ctx.arc(mouthX, mouthY, mouthSize, 0, Math.PI * 2);
    ctx.fillStyle = darkColor;
    ctx.fill();
    ctx.stroke(); // Обводка рта

    // Глаза
    const eyeOffset = radius * 0.3;
    const eyeSize = radius * 0.25; // Чуть больше глаза
    const eyeAngle1 = angleRad - 0.6;
    const eyeAngle2 = angleRad + 0.6;

    // Левый глаз
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(
        pos.x + Math.cos(eyeAngle1) * eyeOffset,
        pos.y + Math.sin(eyeAngle1) * eyeOffset,
        eyeSize,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.lineWidth = 2 * camera.scale;
    ctx.stroke();

    // Правый глаз
    ctx.beginPath();
    ctx.arc(
        pos.x + Math.cos(eyeAngle2) * eyeOffset,
        pos.y + Math.sin(eyeAngle2) * eyeOffset,
        eyeSize,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    // Зрачки
    ctx.fillStyle = "black";
    const pupilSize = eyeSize * 0.4;
    
    // Левый зрачок
    ctx.beginPath();
    ctx.arc(
        pos.x + Math.cos(eyeAngle1) * (eyeOffset + eyeSize * 0.2),
        pos.y + Math.sin(eyeAngle1) * (eyeOffset + eyeSize * 0.2),
        pupilSize,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Правый зрачок
    ctx.beginPath();
    ctx.arc(
        pos.x + Math.cos(eyeAngle2) * (eyeOffset + eyeSize * 0.2),
        pos.y + Math.sin(eyeAngle2) * (eyeOffset + eyeSize * 0.2),
        pupilSize,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = 1;

    // Имя игрока (с обводкой)
    ctx.font = `bold ${Math.max(12, 16 * camera.scale)}px Arial`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.strokeText(player.name, pos.x, pos.y - radius - 15);
    ctx.fillStyle = "white";
    ctx.fillText(player.name, pos.x, pos.y - radius - 15);

    // HP бар
    const hpBarWidth = radius * 2.5;
    const hpBarHeight = 8 * camera.scale;
    const hpPercent = player.hp / player.maxHp;

    // Фон бара
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(pos.x - hpBarWidth / 2, pos.y - radius - 30, hpBarWidth, hpBarHeight);
    
    // Обводка бара
    ctx.lineWidth = 2;
    ctx.strokeStyle = "black";
    ctx.strokeRect(pos.x - hpBarWidth / 2, pos.y - radius - 30, hpBarWidth, hpBarHeight);

    // Заполнение
    ctx.fillStyle = hpPercent > 0.5 ? "#22c55e" : hpPercent > 0.25 ? "#eab308" : "#ef4444";
    ctx.fillRect(pos.x - hpBarWidth / 2, pos.y - radius - 30, hpBarWidth * hpPercent, hpBarHeight);
}

function drawPlayers() {
    // Сначала рисуем других игроков
    players.forEach((player) => {
        if (player.id !== mySessionId) {
            drawSlime(player, false);
        }
    });

    // Потом своего (сверху)
    if (mySessionId) {
        const me = players.get(mySessionId);
        if (me) {
            drawSlime(me, true);
        }
    }
}

function drawHUD() {
    if (!mySessionId) return;
    const me = players.get(mySessionId);
    if (!me) return;

    // Стиль текста
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";

    // Карточка статуса (Лево-Верх)
    const cardX = 20;
    const cardY = 20;
    const cardW = 200;
    const cardH = 100;

    // Фон карточки
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Текст внутри карточки
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;

    // Масса
    const massText = `Масса: ${Math.floor(me.mass)}`;
    ctx.strokeText(massText, cardX + 15, cardY + 30);
    ctx.fillText(massText, cardX + 15, cardY + 30);

    // HP
    const hpText = `HP: ${Math.floor(me.hp)} / ${Math.floor(me.maxHp)}`;
    ctx.strokeText(hpText, cardX + 15, cardY + 60);
    ctx.fillText(hpText, cardX + 15, cardY + 60);

    // Игроки
    const playersText = `Игроков: ${players.size}`;
    ctx.strokeText(playersText, cardX + 15, cardY + 90);
    ctx.fillText(playersText, cardX + 15, cardY + 90);

    // Таймер / Фаза (Центр-Верх)
    const centerX = canvas.width / 2;
    ctx.textAlign = "center";
    
    // Фон таймера
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(centerX - 60, 10, 120, 50, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.strokeText("02:15", centerX, 45);
    ctx.fillText("02:15", centerX, 45);

    // Сообщение о смерти
    if (me.isDead) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeText("ВЫ ПОГИБЛИ", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText("ВЫ ПОГИБЛИ", canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = "white";
        ctx.font = "bold 24px Arial";
        ctx.strokeText("Возрождение через...", canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText("Возрождение через...", canvas.width / 2, canvas.height / 2 + 30);
    }
}

// ===== Input Controller =====
let inputX = 0;
let inputY = 0;
let inputSeq = 0;

function sendInput() {
    if (!room) return;

    inputSeq++;
    room.send("input", {
        seq: inputSeq,
        moveX: inputX,
        moveY: inputY,
    });
}

// Мышь/тач управление
canvas.addEventListener("mousemove", (e) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
        inputX = dx / dist;
        inputY = dy / dist;
    } else {
        inputX = 0;
        inputY = 0;
    }
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
        inputX = dx / dist;
        inputY = dy / dist;
    } else {
        inputX = 0;
        inputY = 0;
    }
}, { passive: false });

canvas.addEventListener("touchend", () => {
    inputX = 0;
    inputY = 0;
});

// Отправка инпута с частотой тиков
setInterval(sendInput, 1000 / GAME_CONFIG.TICK_RATE);

// ===== Game Loop =====
function gameLoop() {
    updateCamera();

    drawBackground();
    drawBorders();
    drawOrbs();
    drawPlayers();
    drawHUD();

    requestAnimationFrame(gameLoop);
}

connect();
gameLoop();
