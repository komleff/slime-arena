import * as Colyseus from "colyseus.js";
import {
    DEFAULT_BALANCE_CONFIG,
    type BalanceConfig,
    getOrbRadius,
    getSlimeRadius,
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
canvas.style.touchAction = "none";
root.appendChild(canvas);

const getCanvasContext = () => {
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context unavailable");
    }
    return context;
};

let canvasCtx = getCanvasContext();

canvas.addEventListener(
    "contextlost",
    (event) => {
        event.preventDefault();
    },
    false
);
canvas.addEventListener(
    "contextrestored",
    () => {
        canvasCtx = getCanvasContext();
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

const joystickLayer = document.createElement("div");
joystickLayer.style.position = "fixed";
joystickLayer.style.inset = "0";
joystickLayer.style.pointerEvents = "none";
joystickLayer.style.zIndex = "5";

const joystickBase = document.createElement("div");
joystickBase.style.position = "fixed";
joystickBase.style.borderRadius = "50%";
joystickBase.style.border = "2px solid rgba(255, 255, 255, 0.18)";
joystickBase.style.background = "rgba(12, 16, 24, 0.25)";
joystickBase.style.backdropFilter = "blur(2px)";
joystickBase.style.opacity = "0";
joystickBase.style.transform = "translate(-50%, -50%)";

const joystickKnob = document.createElement("div");
joystickKnob.style.position = "fixed";
joystickKnob.style.borderRadius = "50%";
joystickKnob.style.background = "rgba(150, 200, 255, 0.55)";
joystickKnob.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.35)";
joystickKnob.style.opacity = "0";
joystickKnob.style.transform = "translate(-50%, -50%)";

joystickLayer.appendChild(joystickBase);
joystickLayer.appendChild(joystickKnob);
document.body.appendChild(joystickLayer);

let balanceConfig: BalanceConfig = DEFAULT_BALANCE_CONFIG;
let mapSize = balanceConfig.world.mapSize;
let orbMinRadius = balanceConfig.orbs.minRadius;
let chestRadius = balanceConfig.chests.radius;
let hotZoneRadius = balanceConfig.hotZones.radius;
let collectorRadiusMult = balanceConfig.classes.collector.radiusMult;
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
const joystickState = {
    active: false,
    pointerId: null as number | null,
    pointerType: null as string | null,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
    moveX: 0,
    moveY: 0,
};
let joystickRadius = balanceConfig.controls.joystickRadius;
let joystickDeadzone = balanceConfig.controls.joystickDeadzone;
let joystickSensitivity = balanceConfig.controls.joystickSensitivity;
let joystickMode = balanceConfig.controls.joystickMode;
let joystickFollowSpeed = balanceConfig.controls.joystickFollowSpeed;
let joystickKnobRadius = joystickRadius * 0.45;
const joystickFixedBase = { x: joystickRadius + 24, y: window.innerHeight - joystickRadius - 24 };
const joystickLeftZoneRatio = 1;
const joystickLandscapeRatio = 1;
const slimeSpriteNames = [
    "slime-angrybird.png",
    "slime-astronaut.png",
    "slime-base.png",
    "slime-cccp.png",
    "slime-crazy.png",
    "slime-crystal.png",
    "slime-cyberneon.png",
    "slime-frost.png",
    "slime-greeendragon.png",
    "slime-knight.png",
    "slime-mecha.png",
    "slime-ninja.png",
    "slime-pinklove.png",
    "slime-pirate.png",
    "slime-pumpkin.png",
    "slime-reddragon.png",
    "slime-redfire.png",
    "slime-samurai.png",
    "slime-shark.png",
    "slime-tomato.png",
    "slime-toxic.png",
    "slime-wizard.png",
    "slime-zombi.png",
];
const baseUrl = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const assetBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
const spriteCache = new Map<
    string,
    {
        img: HTMLImageElement;
        ready: boolean;
        scale: number;
    }
>();
const playerSpriteById = new Map<string, string>();
const spriteMeasureCanvas = document.createElement("canvas");
const spriteMeasureCtx = spriteMeasureCanvas.getContext("2d", { willReadFrequently: true });
const applyBalanceConfig = (config: BalanceConfig) => {
    balanceConfig = config;
    mapSize = config.world.mapSize;
    orbMinRadius = config.orbs.minRadius;
    chestRadius = config.chests.radius;
    hotZoneRadius = config.hotZones.radius;
    collectorRadiusMult = config.classes.collector.radiusMult;
    camera.x = Math.min(Math.max(camera.x, 0), mapSize);
    camera.y = Math.min(Math.max(camera.y, 0), mapSize);
    updateJoystickConfig();
};

const updateJoystickConfig = () => {
    joystickRadius = Number(balanceConfig.controls.joystickRadius ?? 90);
    joystickDeadzone = Number(balanceConfig.controls.joystickDeadzone ?? 0.1);
    joystickSensitivity = Number(balanceConfig.controls.joystickSensitivity ?? 1);
    joystickMode = balanceConfig.controls.joystickMode ?? "adaptive";
    joystickFollowSpeed = Number(balanceConfig.controls.joystickFollowSpeed ?? 0.8);
    joystickKnobRadius = joystickRadius * 0.45;
    const rect = canvas.getBoundingClientRect();
    joystickFixedBase.x = rect.left + joystickRadius + 24;
    joystickFixedBase.y = rect.top + rect.height - joystickRadius - 24;
    joystickBase.style.width = `${joystickRadius * 2}px`;
    joystickBase.style.height = `${joystickRadius * 2}px`;
    joystickKnob.style.width = `${joystickKnobRadius * 2}px`;
    joystickKnob.style.height = `${joystickKnobRadius * 2}px`;
    if (joystickMode === "fixed" && joystickState.active) {
        joystickState.baseX = joystickFixedBase.x;
        joystickState.baseY = joystickFixedBase.y;
        updateJoystickVisual();
    }
};

const setJoystickVisible = (visible: boolean) => {
    const opacity = visible ? "1" : "0";
    joystickBase.style.opacity = opacity;
    joystickKnob.style.opacity = opacity;
};

const updateJoystickVisual = () => {
    joystickBase.style.left = `${joystickState.baseX}px`;
    joystickBase.style.top = `${joystickState.baseY}px`;
    joystickKnob.style.left = `${joystickState.knobX}px`;
    joystickKnob.style.top = `${joystickState.knobY}px`;
};

const resetJoystick = () => {
    joystickState.active = false;
    joystickState.pointerId = null;
    joystickState.pointerType = null;
    joystickState.moveX = 0;
    joystickState.moveY = 0;
    joystickState.knobX = joystickState.baseX;
    joystickState.knobY = joystickState.baseY;
    setJoystickVisible(false);
};

const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    let baseX = joystickState.baseX;
    let baseY = joystickState.baseY;
    let dx = clientX - baseX;
    let dy = clientY - baseY;
    let distance = Math.hypot(dx, dy);

    const allowAdaptiveBase = joystickMode === "adaptive" && joystickState.pointerType !== "mouse";
    if (allowAdaptiveBase && distance > joystickRadius) {
        const excess = distance - joystickRadius;
        const shift = excess * joystickFollowSpeed;
        const nx = distance > 0 ? dx / distance : 0;
        const ny = distance > 0 ? dy / distance : 0;
        baseX += nx * shift;
        baseY += ny * shift;
        joystickState.baseX = baseX;
        joystickState.baseY = baseY;
        dx = clientX - baseX;
        dy = clientY - baseY;
        distance = Math.hypot(dx, dy);
    }

    const rect = canvas.getBoundingClientRect();
    let minX = rect.left + joystickRadius;
    let maxX = rect.left + rect.width - joystickRadius;
    let minY = rect.top + joystickRadius;
    let maxY = rect.top + rect.height - joystickRadius;
    if (maxX < minX) {
        minX = rect.left + rect.width / 2;
        maxX = minX;
    }
    if (maxY < minY) {
        minY = rect.top + rect.height / 2;
        maxY = minY;
    }
    const clampedBaseX = clamp(baseX, minX, maxX);
    const clampedBaseY = clamp(baseY, minY, maxY);
    if (clampedBaseX !== baseX || clampedBaseY !== baseY) {
        baseX = clampedBaseX;
        baseY = clampedBaseY;
        joystickState.baseX = baseX;
        joystickState.baseY = baseY;
        dx = clientX - baseX;
        dy = clientY - baseY;
        distance = Math.hypot(dx, dy);
    }

    if (distance > joystickRadius && distance > 0) {
        const scale = joystickRadius / distance;
        dx *= scale;
        dy *= scale;
        distance = joystickRadius;
    }

    const deadzonePx = joystickRadius * joystickDeadzone;
    let outX = 0;
    let outY = 0;
    if (distance > deadzonePx) {
        const normalized = (distance - deadzonePx) / Math.max(joystickRadius - deadzonePx, 1);
        const scale = normalized / Math.max(distance, 1);
        outX = dx * scale;
        outY = dy * scale;
    }

    outX = clamp(outX * joystickSensitivity, -1, 1);
    outY = clamp(outY * joystickSensitivity, -1, 1);

    joystickState.moveX = outX;
    joystickState.moveY = outY;
    joystickState.knobX = baseX + dx;
    joystickState.knobY = baseY + dy;
    updateJoystickVisual();
};

const getJoystickActivationLimit = () => {
    const rect = canvas.getBoundingClientRect();
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    const ratio = isLandscape ? joystickLandscapeRatio : joystickLeftZoneRatio;
    if (ratio >= 0.999) return Number.POSITIVE_INFINITY;
    return rect.left + rect.width * ratio;
};

updateJoystickConfig();

type SnapshotPlayer = {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    mass: number;
    hp: number;
    maxHp: number;
    classId: number;
    talentsAvailable: number;
    flags: number;
};

type SnapshotOrb = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    mass: number;
    colorId: number;
};

type SnapshotChest = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: number;
};

type SnapshotHotZone = {
    id: string;
    x: number;
    y: number;
    radius: number;
    spawnMultiplier: number;
};

type Snapshot = {
    time: number;
    players: Map<string, SnapshotPlayer>;
    orbs: Map<string, SnapshotOrb>;
    chests: Map<string, SnapshotChest>;
    hotZones: Map<string, SnapshotHotZone>;
};

type RenderPlayer = SnapshotPlayer & { alpha?: number };
type RenderOrb = SnapshotOrb & { alpha?: number };
type RenderChest = SnapshotChest & { alpha?: number };
type RenderHotZone = SnapshotHotZone & { alpha?: number };

type RenderState = {
    players: Map<string, RenderPlayer>;
    orbs: Map<string, RenderOrb>;
    chests: Map<string, RenderChest>;
    hotZones: Map<string, RenderHotZone>;
};

const snapshotBuffer: Snapshot[] = [];
const snapshotBufferLimit = 30;
let interpolationDelayMs = 100;
const interpolationDelayClamp = { min: 60, max: 200 };
const maxExtrapolationMs = 120;
const hermiteMaxDistance = 300;
const hermiteMaxDtMs = 120;
let lastSnapshotTime: number | null = null;
let avgSnapshotIntervalMs = 100;
const resetSnapshotBuffer = () => {
    snapshotBuffer.length = 0;
    lastSnapshotTime = null;
    avgSnapshotIntervalMs = 100;
    interpolationDelayMs = 100;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
    const delta = ((b - a + 540) % 360) - 180;
    return a + delta * t;
};
const shouldUseHermite = (dx: number, dy: number, dtMs: number) => {
    if (dtMs <= 0 || dtMs > hermiteMaxDtMs) return false;
    return dx * dx + dy * dy <= hermiteMaxDistance * hermiteMaxDistance;
};

const hermiteInterpolate = (p0: number, v0: number, p1: number, v1: number, t: number, dt: number) => {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return p0 * h00 + v0 * dt * h10 + p1 * h01 + v1 * dt * h11;
};

type CollectionLike<T> = {
    entries(): IterableIterator<[string, T]>;
};

type GameStateLike = {
    players: CollectionLike<Partial<SnapshotPlayer>>;
    orbs: CollectionLike<Partial<SnapshotOrb>>;
    chests: CollectionLike<Partial<SnapshotChest>>;
    hotZones: CollectionLike<Partial<SnapshotHotZone>>;
};

const captureSnapshot = (state: GameStateLike) => {
    const now = performance.now();
    const snapshot: Snapshot = {
        time: now,
        players: new Map(),
        orbs: new Map(),
        chests: new Map(),
        hotZones: new Map(),
    };

    for (const [id, player] of state.players.entries()) {
        snapshot.players.set(id, {
            id,
            name: String(player.name ?? ""),
            x: Number(player.x ?? 0),
            y: Number(player.y ?? 0),
            vx: Number(player.vx ?? 0),
            vy: Number(player.vy ?? 0),
            angle: Number(player.angle ?? 0),
            mass: Number(player.mass ?? 0),
            hp: Number(player.hp ?? 0),
            maxHp: Number(player.maxHp ?? 0),
            classId: Number(player.classId ?? 0),
            talentsAvailable: Number(player.talentsAvailable ?? 0),
            flags: Number(player.flags ?? 0),
        });
    }

    for (const [id, orb] of state.orbs.entries()) {
        snapshot.orbs.set(id, {
            id,
            x: Number(orb.x ?? 0),
            y: Number(orb.y ?? 0),
            vx: Number(orb.vx ?? 0),
            vy: Number(orb.vy ?? 0),
            mass: Number(orb.mass ?? 0),
            colorId: Number(orb.colorId ?? 0),
        });
    }

    for (const [id, chest] of state.chests.entries()) {
        snapshot.chests.set(id, {
            id,
            x: Number(chest.x ?? 0),
            y: Number(chest.y ?? 0),
            vx: Number(chest.vx ?? 0),
            vy: Number(chest.vy ?? 0),
            type: Number(chest.type ?? 0),
        });
    }

    for (const [id, zone] of state.hotZones.entries()) {
        snapshot.hotZones.set(id, {
            id,
            x: Number(zone.x ?? 0),
            y: Number(zone.y ?? 0),
            radius: Number(zone.radius ?? 0),
            spawnMultiplier: Number(zone.spawnMultiplier ?? 0),
        });
    }

    if (lastSnapshotTime !== null) {
        const dt = now - lastSnapshotTime;
        if (dt > 0) {
            avgSnapshotIntervalMs = avgSnapshotIntervalMs * 0.9 + dt * 0.1;
            interpolationDelayMs = clamp(
                avgSnapshotIntervalMs * 2,
                interpolationDelayClamp.min,
                interpolationDelayClamp.max
            );
        }
    }
    lastSnapshotTime = now;

    snapshotBuffer.push(snapshot);
    if (snapshotBuffer.length > snapshotBufferLimit) {
        snapshotBuffer.shift();
    }
};

const extrapolateMotion = <T extends { x: number; y: number; vx: number; vy: number }>(
    entity: T,
    dtSec: number
): T => ({
    ...entity,
    x: entity.x + entity.vx * dtSec,
    y: entity.y + entity.vy * dtSec,
});

const interpolatePlayer = (older: SnapshotPlayer, newer: SnapshotPlayer, t: number, dtSec: number): RenderPlayer => {
    const dtMs = dtSec * 1000;
    const dx = newer.x - older.x;
    const dy = newer.y - older.y;
    const useHermite = shouldUseHermite(dx, dy, dtMs);
    return {
        ...newer,
        x: useHermite ? hermiteInterpolate(older.x, older.vx, newer.x, newer.vx, t, dtSec) : lerp(older.x, newer.x, t),
        y: useHermite ? hermiteInterpolate(older.y, older.vy, newer.y, newer.vy, t, dtSec) : lerp(older.y, newer.y, t),
        vx: lerp(older.vx, newer.vx, t),
        vy: lerp(older.vy, newer.vy, t),
        angle: lerpAngle(older.angle, newer.angle, t),
        mass: lerp(older.mass, newer.mass, t),
        hp: lerp(older.hp, newer.hp, t),
        maxHp: lerp(older.maxHp, newer.maxHp, t),
    };
};

const interpolateOrb = (older: SnapshotOrb, newer: SnapshotOrb, t: number, dtSec: number): RenderOrb => {
    const dtMs = dtSec * 1000;
    const dx = newer.x - older.x;
    const dy = newer.y - older.y;
    const useHermite = shouldUseHermite(dx, dy, dtMs);
    return {
        ...newer,
        x: useHermite ? hermiteInterpolate(older.x, older.vx, newer.x, newer.vx, t, dtSec) : lerp(older.x, newer.x, t),
        y: useHermite ? hermiteInterpolate(older.y, older.vy, newer.y, newer.vy, t, dtSec) : lerp(older.y, newer.y, t),
        vx: lerp(older.vx, newer.vx, t),
        vy: lerp(older.vy, newer.vy, t),
        mass: lerp(older.mass, newer.mass, t),
    };
};

const interpolateChest = (older: SnapshotChest, newer: SnapshotChest, t: number, dtSec: number): RenderChest => {
    const dtMs = dtSec * 1000;
    const dx = newer.x - older.x;
    const dy = newer.y - older.y;
    const useHermite = shouldUseHermite(dx, dy, dtMs);
    return {
        ...newer,
        x: useHermite ? hermiteInterpolate(older.x, older.vx, newer.x, newer.vx, t, dtSec) : lerp(older.x, newer.x, t),
        y: useHermite ? hermiteInterpolate(older.y, older.vy, newer.y, newer.vy, t, dtSec) : lerp(older.y, newer.y, t),
        vx: lerp(older.vx, newer.vx, t),
        vy: lerp(older.vy, newer.vy, t),
    };
};

const interpolateHotZone = (older: SnapshotHotZone, newer: SnapshotHotZone, t: number): RenderHotZone => ({
    ...newer,
    x: lerp(older.x, newer.x, t),
    y: lerp(older.y, newer.y, t),
    radius: lerp(older.radius, newer.radius, t),
    spawnMultiplier: lerp(older.spawnMultiplier, newer.spawnMultiplier, t),
});

const clonePlayers = (source: Map<string, SnapshotPlayer>): Map<string, RenderPlayer> => {
    const result = new Map<string, RenderPlayer>();
    for (const [id, player] of source.entries()) {
        result.set(id, { ...player });
    }
    return result;
};

const cloneOrbs = (source: Map<string, SnapshotOrb>): Map<string, RenderOrb> => {
    const result = new Map<string, RenderOrb>();
    for (const [id, orb] of source.entries()) {
        result.set(id, { ...orb });
    }
    return result;
};

const cloneChests = (source: Map<string, SnapshotChest>): Map<string, RenderChest> => {
    const result = new Map<string, RenderChest>();
    for (const [id, chest] of source.entries()) {
        result.set(id, { ...chest });
    }
    return result;
};

const cloneHotZones = (source: Map<string, SnapshotHotZone>): Map<string, RenderHotZone> => {
    const result = new Map<string, RenderHotZone>();
    for (const [id, zone] of source.entries()) {
        result.set(id, { ...zone });
    }
    return result;
};

const extrapolateState = (snapshot: Snapshot, dtSec: number): RenderState => {
    const players = new Map<string, RenderPlayer>();
    const orbs = new Map<string, RenderOrb>();
    const chests = new Map<string, RenderChest>();
    const hotZones = new Map<string, RenderHotZone>();
    for (const [id, player] of snapshot.players.entries()) {
        players.set(id, extrapolateMotion(player, dtSec));
    }
    for (const [id, orb] of snapshot.orbs.entries()) {
        orbs.set(id, extrapolateMotion(orb, dtSec));
    }
    for (const [id, chest] of snapshot.chests.entries()) {
        chests.set(id, extrapolateMotion(chest, dtSec));
    }
    for (const [id, zone] of snapshot.hotZones.entries()) {
        hotZones.set(id, { ...zone });
    }
    return {
        players,
        orbs,
        chests,
        hotZones,
    };
};

const interpolateState = (older: Snapshot, newer: Snapshot, t: number, dtSec: number): RenderState => {
    const players = new Map<string, RenderPlayer>();
    const orbs = new Map<string, RenderOrb>();
    const chests = new Map<string, RenderChest>();
    const hotZones = new Map<string, RenderHotZone>();

    for (const [id, player] of newer.players.entries()) {
        const prev = older.players.get(id);
        players.set(id, prev ? interpolatePlayer(prev, player, t, dtSec) : { ...player });
    }
    for (const [id, orb] of newer.orbs.entries()) {
        const prev = older.orbs.get(id);
        orbs.set(id, prev ? interpolateOrb(prev, orb, t, dtSec) : { ...orb });
    }
    for (const [id, chest] of newer.chests.entries()) {
        const prev = older.chests.get(id);
        chests.set(id, prev ? interpolateChest(prev, chest, t, dtSec) : { ...chest });
    }
    for (const [id, zone] of newer.hotZones.entries()) {
        const prev = older.hotZones.get(id);
        hotZones.set(id, prev ? interpolateHotZone(prev, zone, t) : { ...zone });
    }

    const fadeAlpha = clamp(1 - t, 0, 1);
    for (const [id, player] of older.players.entries()) {
        if (!newer.players.has(id)) {
            players.set(id, { ...player, alpha: fadeAlpha });
        }
    }
    for (const [id, orb] of older.orbs.entries()) {
        if (!newer.orbs.has(id)) {
            orbs.set(id, { ...orb, alpha: fadeAlpha });
        }
    }
    for (const [id, chest] of older.chests.entries()) {
        if (!newer.chests.has(id)) {
            chests.set(id, { ...chest, alpha: fadeAlpha });
        }
    }
    for (const [id, zone] of older.hotZones.entries()) {
        if (!newer.hotZones.has(id)) {
            hotZones.set(id, { ...zone, alpha: fadeAlpha });
        }
    }

    return {
        players,
        orbs,
        chests,
        hotZones,
    };
};

const getRenderState = (renderTimeMs: number): RenderState | null => {
    if (snapshotBuffer.length === 0) return null;
    const oldest = snapshotBuffer[0];
    const newest = snapshotBuffer[snapshotBuffer.length - 1];

    if (renderTimeMs <= oldest.time) {
        return {
            players: clonePlayers(oldest.players),
            orbs: cloneOrbs(oldest.orbs),
            chests: cloneChests(oldest.chests),
            hotZones: cloneHotZones(oldest.hotZones),
        };
    }

    if (renderTimeMs >= newest.time) {
        const dtMs = Math.min(renderTimeMs - newest.time, maxExtrapolationMs);
        return extrapolateState(newest, dtMs / 1000);
    }

    if (snapshotBuffer.length < 2) {
        return {
            players: clonePlayers(newest.players),
            orbs: cloneOrbs(newest.orbs),
            chests: cloneChests(newest.chests),
            hotZones: cloneHotZones(newest.hotZones),
        };
    }

    let low = 0;
    let high = snapshotBuffer.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (snapshotBuffer[mid].time <= renderTimeMs) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    const olderIndex = Math.max(0, low - 1);
    const older = snapshotBuffer[olderIndex];
    const newer = snapshotBuffer[Math.min(olderIndex + 1, snapshotBuffer.length - 1)];

    const dtMs = Math.max(newer.time - older.time, 0.001);
    const t = clamp((renderTimeMs - older.time) / dtMs, 0, 1);
    return interpolateState(older, newer, t, dtMs / 1000);
};

const computeSpriteScale = (img: HTMLImageElement) => {
    if (!spriteMeasureCtx) return 1;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return 1;
    spriteMeasureCanvas.width = w;
    spriteMeasureCanvas.height = h;
    spriteMeasureCtx.clearRect(0, 0, w, h);
    spriteMeasureCtx.drawImage(img, 0, 0, w, h);
    const data = spriteMeasureCtx.getImageData(0, 0, w, h).data;
    const alphaThreshold = 8;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const a = data[(y * w + x) * 4 + 3];
            if (a > alphaThreshold) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX || maxY < minY) return 1;
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const fill = Math.max(boxW / w, boxH / h);
    if (fill <= 0) return 1;
    return clamp(1 / fill, 1, 6);
};

function loadSprite(name: string) {
    if (spriteCache.has(name)) return spriteCache.get(name)!;
    const img = new Image();
    const entry = { img, ready: false, scale: 1 };
    spriteCache.set(name, entry);
    img.onload = () => {
        entry.scale = computeSpriteScale(img);
        entry.ready = true;
    };
    img.src = `${assetBase}assets/sprites/slimes/base/${name}`;
    return entry;
}

function hashSessionId(sessionId: string): number {
    let h = 0;
    for (let i = 0; i < sessionId.length; i += 1) {
        h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
    }
    return h;
}

function pickSpriteForPlayer(sessionId: string): string {
    const hash = hashSessionId(sessionId);
    return slimeSpriteNames[hash % slimeSpriteNames.length];
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateJoystickConfig();
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

function drawCrown(x: number, y: number, size: number, fill: string, stroke?: string) {
    const w = size;
    const h = size * 0.7;
    const half = w / 2;

    canvasCtx.save();
    canvasCtx.translate(x, y);
    canvasCtx.beginPath();
    canvasCtx.moveTo(-half, 0);
    canvasCtx.lineTo(-half + w * 0.2, -h);
    canvasCtx.lineTo(0, -h * 0.55);
    canvasCtx.lineTo(half - w * 0.2, -h);
    canvasCtx.lineTo(half, 0);
    canvasCtx.closePath();
    canvasCtx.fillStyle = fill;
    canvasCtx.fill();
    if (stroke) {
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = stroke;
        canvasCtx.stroke();
    }
    canvasCtx.restore();
}

function drawSprite(
    img: HTMLImageElement,
    ready: boolean,
    x: number,
    y: number,
    radius: number,
    angleDeg: number,
    fallbackFill: string,
    fallbackStroke: string,
    spriteScale = 1
) {
    if (ready) {
        const size = radius * 2 * spriteScale;
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

    const env = import.meta as { env?: { BASE_URL?: string; VITE_WS_URL?: string } };
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const defaultWsUrl = `${protocol}://${window.location.hostname}:2567`;
    const wsUrl = env.env?.VITE_WS_URL ?? defaultWsUrl;
    const client = new Colyseus.Client(wsUrl);

        try {
            const room = await client.joinOrCreate<any>("arena", { name: `Player_${Math.random().toString(36).slice(2, 7)}` });
            hud.textContent = "Подключено к серверу";
            room.onMessage("balance", (config: BalanceConfig) => {
                if (!config) return;
                applyBalanceConfig(config);
            });

        let hotZonesCount = 0;
        let chestsCount = 0;
        let orbsCount = 0;
        let playersCount = 0;
        let inputSeq = 0;
        let localPlayer: any = null;
        let renderStateForHud: RenderState | null = null;
        let lastTalentsAvailable = 0;
        let talentSelectionInFlight = false;

        // Логирование для отладки
        console.log("Room joined:", room.id);
        resetSnapshotBuffer();
        const handleStateChange = () => captureSnapshot(room.state);
        room.onStateChange(handleStateChange);
        captureSnapshot(room.state);

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
            playerSpriteById.set(sessionId, pickSpriteForPlayer(sessionId));
            
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
            playerSpriteById.delete(sessionId);
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
            lines.push(`Орбы: ${orbsCount}/${balanceConfig.orbs.maxCount}`);
            lines.push(`Сундуки: ${chestsCount}/${balanceConfig.chests.maxCount}`);
            lines.push(`Hot Zones: ${hotZonesCount}`);
            const hudPlayer = renderStateForHud?.players.get(room.sessionId) ?? localPlayer;
            if (hudPlayer) {
                lines.push(
                    `Моя масса: ${hudPlayer.mass.toFixed(0)} | HP: ${hudPlayer.hp.toFixed(1)}/${hudPlayer.maxHp.toFixed(1)}`
                );
                if (hudPlayer.talentsAvailable > 0) {
                    lines.push(`Таланты: ${hudPlayer.talentsAvailable}`);
                }
            }
            if (room.state.leaderboard && room.state.leaderboard.length > 0) {
                lines.push("Топ-3:");
                for (let i = 0; i < Math.min(3, room.state.leaderboard.length); i += 1) {
                    const playerId = room.state.leaderboard[i];
                    const pl = room.state.players.get(playerId);
                    if (pl) {
                        lines.push(`${i + 1}. ${pl.name} - ${pl.mass.toFixed(0)} масса`);
                    }
                }
            }
            hud.textContent = lines.join("\n");
        };

        const computeMoveInput = () => {
            if (joystickState.active) {
                return { x: joystickState.moveX, y: joystickState.moveY };
            }
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
        let isRendering = true;
        let rafId: number | null = null;

        const inputIntervalMs = Math.max(16, Math.round(1000 / balanceConfig.server.tickRate));
        const inputTimer = setInterval(() => {
            if (!hasFocus) return;
            const { x, y } = computeMoveInput();
            const changed = Math.abs(x - lastSentInput.x) > 1e-3 || Math.abs(y - lastSentInput.y) > 1e-3;
            if (!changed) return;
            lastSentInput = { x, y };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: x, moveY: y });
        }, inputIntervalMs);

        const render = () => {
            if (!isRendering) return;
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = Math.min(cw / desiredView.width, ch / desiredView.height);
            const halfWorldW = cw / scale / 2;
            const halfWorldH = ch / scale / 2;

            const renderState = getRenderState(performance.now() - interpolationDelayMs);
            renderStateForHud = renderState;
            const playersView = renderState ? renderState.players : room.state.players;
            const orbsView = renderState ? renderState.orbs : room.state.orbs;
            const chestsView = renderState ? renderState.chests : room.state.chests;
            const hotZonesView = renderState ? renderState.hotZones : room.state.hotZones;

            const cameraTarget = renderState?.players.get(room.sessionId) ?? localPlayer;
            const targetX = cameraTarget ? cameraTarget.x : mapSize / 2;
            const targetY = cameraTarget ? cameraTarget.y : mapSize / 2;
            const clampX = Math.max(halfWorldW, Math.min(mapSize - halfWorldW, targetX));
            const clampY = Math.max(halfWorldH, Math.min(mapSize - halfWorldH, targetY));
            camera.x += (clampX - camera.x) * cameraLerp;
            camera.y += (clampY - camera.y) * cameraLerp;

            canvasCtx.clearRect(0, 0, cw, ch);
            drawGrid(scale, camera.x, camera.y, cw, ch);

            canvasCtx.fillStyle = "rgba(255, 99, 71, 0.08)";
            for (const [, zone] of hotZonesView.entries()) {
                if (Math.abs(zone.x - camera.x) > halfWorldW + hotZoneRadius || Math.abs(zone.y - camera.y) > halfWorldH + hotZoneRadius) continue;
                const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                const alpha = zone.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                drawCircle(p.x, p.y, zone.radius * scale, "rgba(255, 99, 71, 0.08)", "rgba(255, 99, 71, 0.4)");
                canvasCtx.restore();
            }

            for (const [, orb] of orbsView.entries()) {
                if (Math.abs(orb.x - camera.x) > halfWorldW + 50 || Math.abs(orb.y - camera.y) > halfWorldH + 50) continue;
                const p = worldToScreen(orb.x, orb.y, scale, camera.x, camera.y, cw, ch);
                const orbType = balanceConfig.orbs.types[orb.colorId];
                const density = orbType?.density ?? 1;
                const r = Math.max(2, getOrbRadius(orb.mass, density, orbMinRadius) * scale);
                const alpha = orb.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                drawCircle(p.x, p.y, r, orbColor(orb.colorId));
                canvasCtx.restore();
            }

            const time = performance.now() * 0.001;

            for (const [, chest] of chestsView.entries()) {
                if (Math.abs(chest.x - camera.x) > halfWorldW + chestRadius || Math.abs(chest.y - camera.y) > halfWorldH + chestRadius) continue;
                const p = worldToScreen(chest.x, chest.y, scale, camera.x, camera.y, cw, ch);
                const style = chestStyles[chest.type] ?? chestStyles[0];
                const pulse = 1 + 0.12 * Math.sin(time * 4 + chest.x * 0.01 + chest.y * 0.01);
                const r = chestRadius * style.scale * pulse * scale;
                const alpha = chest.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
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

            for (const [id, player] of playersView.entries()) {
                if (Math.abs(player.x - camera.x) > halfWorldW + 200 || Math.abs(player.y - camera.y) > halfWorldH + 200) continue;
                const p = worldToScreen(player.x, player.y, scale, camera.x, camera.y, cw, ch);
                const classRadiusMult = player.classId === 2 ? collectorRadiusMult : 1;
                const baseRadius = getSlimeRadius(player.mass, balanceConfig.formulas);
                const radius = baseRadius * classRadiusMult * scale;
                const isSelf = id === room.sessionId;
                const isRebel = id === room.state.rebelId || (player.flags & FLAG_IS_REBEL) !== 0;
                const color = isSelf ? "#6fd6ff" : "#9be070";
                const stroke = player.flags & FLAG_IS_DEAD ? "#555" : isSelf ? "#1ea6ff" : "#6ac96f";
                const r = Math.max(radius, 12);
                const angleDeg = player.angle ?? 0;
                const spriteName = playerSpriteById.get(id) ?? pickSpriteForPlayer(id);
                const sprite = loadSprite(spriteName);
                const alpha = player.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                drawSprite(sprite.img, sprite.ready, p.x, p.y, r, angleDeg, color, stroke, sprite.scale);

                canvasCtx.fillStyle = "#e6f3ff";
                canvasCtx.font = "12px \"IBM Plex Mono\", monospace";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText(player.name, p.x, p.y - r - 6);
                if (isRebel) {
                    const markerY = p.y - r - 18;
                    canvasCtx.fillStyle = "#ff4d4d";
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(p.x, markerY);
                    canvasCtx.lineTo(p.x - 7, markerY + 12);
                    canvasCtx.lineTo(p.x + 7, markerY + 12);
                    canvasCtx.closePath();
                    canvasCtx.fill();
                }

                const flagText: string[] = [];
                if (player.flags & FLAG_IS_REBEL) flagText.push("KING");
                if (player.flags & FLAG_LAST_BREATH) flagText.push("LB");
                if (player.flags & FLAG_IS_DEAD) flagText.push("DEAD");
                if (flagText.length > 0) {
                    canvasCtx.fillText(flagText.join(" "), p.x, p.y + r + 12);
                }

                if ((player.flags & FLAG_IS_REBEL) !== 0) {
                    const crownSize = Math.max(14, Math.min(26, r * 0.9));
                    drawCrown(p.x, p.y - r - crownSize * 0.25, crownSize, "#ffc857", "#ffe8a3");
                }
                canvasCtx.restore();
            }

            // Chest indicators по краям экрана
            for (const [, chest] of chestsView.entries()) {
                const dx = chest.x - camera.x;
                const dy = chest.y - camera.y;
                if (Math.abs(dx) <= halfWorldW && Math.abs(dy) <= halfWorldH) continue;
                const angle = Math.atan2(dy, dx);
                const edgeX = Math.cos(angle) * (halfWorldW - 40);
                const edgeY = Math.sin(angle) * (halfWorldH - 40);
                const screen = worldToScreen(camera.x + edgeX, camera.y + edgeY, scale, camera.x, camera.y, cw, ch);
                const style = chestStyles[chest.type] ?? chestStyles[0];
                const alpha = chest.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                canvasCtx.translate(screen.x, screen.y);
                canvasCtx.rotate(angle);
                canvasCtx.fillStyle = style.fill;
                canvasCtx.strokeStyle = style.stroke;
                canvasCtx.lineWidth = 2;
                canvasCtx.beginPath();
                canvasCtx.moveTo(12, 0);
                canvasCtx.lineTo(-8, 8);
                canvasCtx.lineTo(-8, -8);
                canvasCtx.closePath();
                canvasCtx.fill();
                canvasCtx.stroke();
                canvasCtx.restore();
            }

            // KING indicator по краям экрана (для тех, кто не KING)
            const localIsKing = (playersView.get(room.sessionId)?.flags ?? 0) & FLAG_IS_REBEL;
            if (!localIsKing) {
                const kingId = room.state.rebelId;
                const king = kingId ? playersView.get(kingId) : null;
                if (king) {
                    const dx = king.x - camera.x;
                    const dy = king.y - camera.y;
                    if (Math.abs(dx) > halfWorldW || Math.abs(dy) > halfWorldH) {
                        const angle = Math.atan2(dy, dx);
                        const edgeX = Math.cos(angle) * (halfWorldW - 54);
                        const edgeY = Math.sin(angle) * (halfWorldH - 54);
                        const screen = worldToScreen(
                            camera.x + edgeX,
                            camera.y + edgeY,
                            scale,
                            camera.x,
                            camera.y,
                            cw,
                            ch
                        );
                        const alpha = king.alpha ?? 1;
                        if (alpha > 0.01) {
                            canvasCtx.save();
                            canvasCtx.globalAlpha = alpha;
                            canvasCtx.translate(screen.x, screen.y);
                            canvasCtx.rotate(angle);

                            canvasCtx.fillStyle = "#ffc857";
                            canvasCtx.strokeStyle = "#ffe8a3";
                            canvasCtx.lineWidth = 2;
                            canvasCtx.beginPath();
                            canvasCtx.moveTo(14, 0);
                            canvasCtx.lineTo(-10, 10);
                            canvasCtx.lineTo(-10, -10);
                            canvasCtx.closePath();
                            canvasCtx.fill();
                            canvasCtx.stroke();

                            canvasCtx.restore();

                            drawCrown(screen.x, screen.y - 16, 18, "#ffc857", "#ffe8a3");
                        }
                    }
                }
            }

            rafId = requestAnimationFrame(render);
        };

        const sendStopInput = () => {
            lastSentInput = { x: 0, y: 0 };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: 0, moveY: 0 });
        };

        const onKeyDown = (event: KeyboardEvent) => {
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
        };

        const onKeyUp = (event: KeyboardEvent) => {
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
        };

        let joystickPointerListenersAttached = false;

        const attachJoystickPointerListeners = () => {
            if (joystickPointerListenersAttached) return;
            window.addEventListener("pointermove", onPointerMove, { passive: false });
            window.addEventListener("pointerup", onPointerUp, { passive: false });
            window.addEventListener("pointercancel", onPointerCancel, { passive: false });
            joystickPointerListenersAttached = true;
        };

        const detachJoystickPointerListeners = () => {
            if (!joystickPointerListenersAttached) return;
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
            joystickPointerListenersAttached = false;
        };

        const onPointerDown = (event: PointerEvent) => {
            const isCoarse = window.matchMedia("(pointer: coarse)").matches;
            const isTouchPointer = event.pointerType === "touch" || event.pointerType === "pen";
            const isMousePointer = event.pointerType === "mouse";
            const isPrimaryMouseButton = isMousePointer && event.button === 0;
            if (!isTouchPointer && !isPrimaryMouseButton && !isCoarse) return;
            if (joystickState.active) return;
            if (!isPrimaryMouseButton) {
                const activationLimit = getJoystickActivationLimit();
                if (event.clientX > activationLimit) return;
            }
            event.preventDefault();
            hasFocus = true;
            joystickState.active = true;
            joystickState.pointerId = event.pointerId;
            joystickState.pointerType = event.pointerType;
            attachJoystickPointerListeners();
            if (joystickMode === "fixed") {
                joystickState.baseX = joystickFixedBase.x;
                joystickState.baseY = joystickFixedBase.y;
            } else {
                joystickState.baseX = event.clientX;
                joystickState.baseY = event.clientY;
            }
            joystickState.knobX = joystickState.baseX;
            joystickState.knobY = joystickState.baseY;
            setJoystickVisible(true);
            updateJoystickFromPointer(event.clientX, event.clientY);
            try {
                canvas.setPointerCapture(event.pointerId);
            } catch {
                // ignore pointer capture errors
            }
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!joystickState.active) return;
            if (event.pointerId !== joystickState.pointerId) return;
            event.preventDefault();
            updateJoystickFromPointer(event.clientX, event.clientY);
        };

        const onPointerUp = (event: PointerEvent) => {
            if (!joystickState.active) return;
            if (event.pointerId !== joystickState.pointerId) return;
            event.preventDefault();
            detachJoystickPointerListeners();
            resetJoystick();
            if (!keyState.up && !keyState.down && !keyState.left && !keyState.right) {
                sendStopInput();
            }
        };

        const onPointerCancel = (event: PointerEvent) => {
            if (!joystickState.active) return;
            if (event.pointerId !== joystickState.pointerId) return;
            event.preventDefault();
            detachJoystickPointerListeners();
            resetJoystick();
            if (!keyState.up && !keyState.down && !keyState.left && !keyState.right) {
                sendStopInput();
            }
        };

        const onBlur = () => {
            hasFocus = false;
            keyState.up = keyState.down = keyState.left = keyState.right = false;
            sendStopInput();
            detachJoystickPointerListeners();
            resetJoystick();
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                hasFocus = false;
                keyState.up = keyState.down = keyState.left = keyState.right = false;
                sendStopInput();
                detachJoystickPointerListeners();
                resetJoystick();
            } else {
                hasFocus = true;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onVisibilityChange);

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
            isRendering = false;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            detachJoystickPointerListeners();
            resetSnapshotBuffer();
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            canvas.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        });
    } catch (e) {
        hud.textContent = `Ошибка подключения: ${e}`;
        console.error(e);
    }
}

main();
