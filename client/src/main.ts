import * as Colyseus from "colyseus.js";
import {
    DEFAULT_BALANCE_CONFIG,
    type BalanceConfig,
    getOrbRadius,
    getSlimeRadiusFromConfig,
    FLAG_IS_REBEL,
    FLAG_LAST_BREATH,
    FLAG_IS_DEAD,
    FLAG_ABILITY_SHIELD,
    FLAG_DASHING,
    FLAG_MAGNETIZING,
    clamp,
    lerp,
    wrapAngle,
    generateRandomName,
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
    { id: 0, name: "Mass Surge", detail: "+5% массы" },
    { id: 1, name: "Mass Boost", detail: "+30% массы" },
    { id: 2, name: "Guard Pulse", detail: "+3% массы + щит" },
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

// Results overlay для фазы Results
const resultsOverlay = document.createElement("div");
resultsOverlay.style.position = "fixed";
resultsOverlay.style.inset = "0";
resultsOverlay.style.display = "none";
resultsOverlay.style.flexDirection = "column";
resultsOverlay.style.alignItems = "center";
resultsOverlay.style.justifyContent = "center";
resultsOverlay.style.background = "rgba(10, 15, 30, 0.92)";
resultsOverlay.style.zIndex = "1000";
resultsOverlay.style.fontFamily = "\"IBM Plex Mono\", monospace";
resultsOverlay.style.color = "#e6f3ff";

const resultsContent = document.createElement("div");
resultsContent.style.textAlign = "center";
resultsContent.style.maxWidth = "500px";
resultsContent.style.padding = "20px";

const resultsTitle = document.createElement("h1");
resultsTitle.style.fontSize = "32px";
resultsTitle.style.marginBottom = "10px";
resultsTitle.style.color = "#ffc857";
resultsTitle.style.textShadow = "0 0 20px rgba(255, 200, 87, 0.5)";

const resultsWinner = document.createElement("div");
resultsWinner.style.fontSize = "24px";
resultsWinner.style.marginBottom = "20px";
resultsWinner.style.color = "#9be070";

const resultsLeaderboard = document.createElement("div");
resultsLeaderboard.style.textAlign = "left";
resultsLeaderboard.style.background = "rgba(0, 0, 0, 0.3)";
resultsLeaderboard.style.borderRadius = "8px";
resultsLeaderboard.style.padding = "15px";
resultsLeaderboard.style.marginBottom = "20px";

const resultsTimer = document.createElement("div");
resultsTimer.style.fontSize = "16px";
resultsTimer.style.color = "#6fd6ff";

resultsContent.appendChild(resultsTitle);
resultsContent.appendChild(resultsWinner);
resultsContent.appendChild(resultsLeaderboard);
resultsContent.appendChild(resultsTimer);
resultsOverlay.appendChild(resultsContent);
document.body.appendChild(resultsOverlay);

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

// ============================================
// ABILITY BUTTON — кнопка способности класса
// ============================================

const abilityButton = document.createElement("button");
abilityButton.type = "button";
abilityButton.style.position = "fixed";
abilityButton.style.right = "20px";
abilityButton.style.bottom = "20px";
abilityButton.style.width = "70px";
abilityButton.style.height = "70px";
abilityButton.style.borderRadius = "50%";
abilityButton.style.background = "linear-gradient(135deg, #2d4a6d, #1b2c45)";
abilityButton.style.border = "3px solid #4a90c2";
abilityButton.style.color = "#e6f3ff";
abilityButton.style.fontSize = "28px";
abilityButton.style.cursor = "pointer";
abilityButton.style.zIndex = "50";
abilityButton.style.transition = "transform 150ms, background 150ms, opacity 150ms";
abilityButton.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.4)";
abilityButton.style.display = "none"; // Скрыта до входа в игру
abilityButton.title = "1";

// Span для иконки способности (чтобы не использовать textContent и не удалять детей)
const abilityButtonIcon = document.createElement("span");
abilityButtonIcon.style.fontSize = "28px";
abilityButtonIcon.style.pointerEvents = "none";
abilityButtonIcon.style.zIndex = "1";
abilityButton.appendChild(abilityButtonIcon);

// Подпись с цифрой на кнопке
const abilityButtonLabel = document.createElement("span");
abilityButtonLabel.textContent = "1";
abilityButtonLabel.style.position = "absolute";
abilityButtonLabel.style.bottom = "2px";
abilityButtonLabel.style.right = "6px";
abilityButtonLabel.style.fontSize = "16px";
abilityButtonLabel.style.fontWeight = "bold";
abilityButtonLabel.style.color = "#fff";
abilityButtonLabel.style.textShadow = "0 0 4px #000, 0 0 8px #000";
abilityButtonLabel.style.pointerEvents = "none";
abilityButton.appendChild(abilityButtonLabel);

// Тёмный оверлей кулдауна
const abilityButtonCooldown = document.createElement("div");
abilityButtonCooldown.style.position = "absolute";
abilityButtonCooldown.style.inset = "0";
abilityButtonCooldown.style.borderRadius = "50%";
abilityButtonCooldown.style.background = "rgba(0, 0, 0, 0.8)";
abilityButtonCooldown.style.pointerEvents = "none";
abilityButtonCooldown.style.display = "none";
abilityButton.appendChild(abilityButtonCooldown);

// Яркая полоска прогресса восстановления (SVG дуга)
const abilityButtonProgress = document.createElementNS("http://www.w3.org/2000/svg", "svg");
abilityButtonProgress.setAttribute("viewBox", "0 0 100 100");
abilityButtonProgress.style.position = "absolute";
abilityButtonProgress.style.inset = "0";
abilityButtonProgress.style.width = "100%";
abilityButtonProgress.style.height = "100%";
abilityButtonProgress.style.transform = "rotate(-90deg)";
abilityButtonProgress.style.pointerEvents = "none";

const abilityProgressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
abilityProgressCircle.setAttribute("cx", "50");
abilityProgressCircle.setAttribute("cy", "50");
abilityProgressCircle.setAttribute("r", "45");
abilityProgressCircle.setAttribute("fill", "none");
abilityProgressCircle.setAttribute("stroke", "#4fc3f7");
abilityProgressCircle.setAttribute("stroke-width", "6");
abilityProgressCircle.setAttribute("stroke-linecap", "round");
abilityProgressCircle.setAttribute("stroke-dasharray", "283"); // 2 * PI * 45
abilityProgressCircle.setAttribute("stroke-dashoffset", "283");
abilityProgressCircle.style.filter = "drop-shadow(0 0 4px #4fc3f7)";
abilityButtonProgress.appendChild(abilityProgressCircle);
abilityButton.appendChild(abilityButtonProgress);

// Текст таймера кулдауна
const abilityButtonTimer = document.createElement("span");
abilityButtonTimer.style.position = "absolute";
abilityButtonTimer.style.top = "50%";
abilityButtonTimer.style.left = "50%";
abilityButtonTimer.style.transform = "translate(-50%, -50%)";
abilityButtonTimer.style.fontSize = "18px";
abilityButtonTimer.style.fontWeight = "bold";
abilityButtonTimer.style.color = "#fff";
abilityButtonTimer.style.textShadow = "0 0 4px #000";
abilityButtonTimer.style.pointerEvents = "none";
abilityButtonTimer.style.display = "none";
abilityButton.appendChild(abilityButtonTimer);

document.body.appendChild(abilityButton);

// === Кнопка Выброса (Projectile) - Slot 1, клавиша 2 ===
const projectileButton = document.createElement("button");
projectileButton.type = "button";
projectileButton.style.position = "fixed";
projectileButton.style.right = "100px"; // Слева от кнопки способности класса
projectileButton.style.bottom = "20px";
projectileButton.style.width = "60px";
projectileButton.style.height = "60px";
projectileButton.style.borderRadius = "50%";
projectileButton.style.background = "linear-gradient(135deg, #4a2d6d, #2b1b45)";
projectileButton.style.border = "3px solid #9a4ac2";
projectileButton.style.color = "#f3e6ff";
projectileButton.style.fontSize = "24px";
projectileButton.style.cursor = "pointer";
projectileButton.style.zIndex = "50";
projectileButton.style.transition = "transform 150ms, background 150ms, opacity 150ms";
projectileButton.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.4)";
projectileButton.style.display = "none";
projectileButton.title = "2";

const projectileButtonIcon = document.createElement("span");
projectileButtonIcon.textContent = "💥";
projectileButtonIcon.style.fontSize = "24px";
projectileButtonIcon.style.pointerEvents = "none";
projectileButton.appendChild(projectileButtonIcon);

const projectileButtonLabel = document.createElement("span");
projectileButtonLabel.textContent = "2";
projectileButtonLabel.style.position = "absolute";
projectileButtonLabel.style.bottom = "2px";
projectileButtonLabel.style.right = "4px";
projectileButtonLabel.style.fontSize = "14px";
projectileButtonLabel.style.fontWeight = "bold";
projectileButtonLabel.style.color = "#fff";
projectileButtonLabel.style.textShadow = "0 0 4px #000, 0 0 8px #000";
projectileButtonLabel.style.pointerEvents = "none";
projectileButton.appendChild(projectileButtonLabel);

// Тёмный оверлей кулдауна для Projectile
const projectileCooldown = document.createElement("div");
projectileCooldown.style.position = "absolute";
projectileCooldown.style.inset = "0";
projectileCooldown.style.borderRadius = "50%";
projectileCooldown.style.background = "rgba(0, 0, 0, 0.8)";
projectileCooldown.style.pointerEvents = "none";
projectileCooldown.style.display = "none";
projectileButton.appendChild(projectileCooldown);

// SVG прогресс для Projectile
const projectileProgress = document.createElementNS("http://www.w3.org/2000/svg", "svg");
projectileProgress.setAttribute("viewBox", "0 0 100 100");
projectileProgress.style.position = "absolute";
projectileProgress.style.inset = "0";
projectileProgress.style.width = "100%";
projectileProgress.style.height = "100%";
projectileProgress.style.transform = "rotate(-90deg)";
projectileProgress.style.pointerEvents = "none";

const projectileProgressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
projectileProgressCircle.setAttribute("cx", "50");
projectileProgressCircle.setAttribute("cy", "50");
projectileProgressCircle.setAttribute("r", "45");
projectileProgressCircle.setAttribute("fill", "none");
projectileProgressCircle.setAttribute("stroke", "#c74ff7");
projectileProgressCircle.setAttribute("stroke-width", "6");
projectileProgressCircle.setAttribute("stroke-linecap", "round");
projectileProgressCircle.setAttribute("stroke-dasharray", "283");
projectileProgressCircle.setAttribute("stroke-dashoffset", "283");
projectileProgressCircle.style.filter = "drop-shadow(0 0 4px #c74ff7)";
projectileProgress.appendChild(projectileProgressCircle);
projectileButton.appendChild(projectileProgress);

const projectileTimer = document.createElement("span");
projectileTimer.style.position = "absolute";
projectileTimer.style.top = "50%";
projectileTimer.style.left = "50%";
projectileTimer.style.transform = "translate(-50%, -50%)";
projectileTimer.style.fontSize = "14px";
projectileTimer.style.fontWeight = "bold";
projectileTimer.style.color = "#fff";
projectileTimer.style.textShadow = "0 0 4px #000";
projectileTimer.style.pointerEvents = "none";
projectileTimer.style.display = "none";
projectileButton.appendChild(projectileTimer);

document.body.appendChild(projectileButton);

// Иконки способностей по классам
const abilityIcons: Record<number, string> = {
    0: "⚡", // Hunter - Dash
    1: "🛡️", // Warrior - Shield
    2: "🧲", // Collector - Magnet
};

// Иконки классов для отображения у имени
const classIcons: Record<number, string> = {
    0: "🏹", // Hunter
    1: "⚔️", // Warrior
    2: "🧲", // Collector
};

// Длительность кулдауна способности по классам (секунды)
function getAbilityCooldownSec(classId: number): number {
    switch (classId) {
        case 0: return balanceConfig.abilities?.dash?.cooldownSec ?? 5;
        case 1: return balanceConfig.abilities?.shield?.cooldownSec ?? 8;
        case 2: return balanceConfig.abilities?.magnet?.cooldownSec ?? 6;
        default: return 5;
    }
}

// Обновление индикатора кулдауна на кнопке способности
function updateAbilityCooldown(player: { abilityCooldownTick?: number; classId?: number } | null, serverTick: number, tickRate: number) {
    if (!player) {
        abilityButtonCooldown.style.display = "none";
        abilityButtonTimer.style.display = "none";
        abilityProgressCircle.setAttribute("stroke-dashoffset", "0");
        abilityButton.style.opacity = "1";
        abilityButton.style.boxShadow = "0 0 15px 5px rgba(100, 220, 255, 0.7), inset 0 0 15px rgba(100, 220, 255, 0.3)";
        abilityButton.style.border = "3px solid #64dcff";
        return;
    }
    
    const cooldownTick = player.abilityCooldownTick ?? 0;
    if (cooldownTick <= serverTick) {
        // Способность готова - яркое свечение
        abilityButtonCooldown.style.display = "none";
        abilityButtonTimer.style.display = "none";
        abilityProgressCircle.setAttribute("stroke-dashoffset", "0");
        abilityButton.style.opacity = "1";
        abilityButton.style.boxShadow = "0 0 15px 5px rgba(100, 220, 255, 0.7), inset 0 0 15px rgba(100, 220, 255, 0.3)";
        abilityButton.style.border = "3px solid #64dcff";
        return;
    }
    
    const ticksRemaining = cooldownTick - serverTick;
    const secondsRemaining = ticksRemaining / tickRate;
    const totalCooldownSec = getAbilityCooldownSec(player.classId ?? 0);
    const totalTicks = totalCooldownSec * tickRate;
    const progress = 1 - Math.min(1, ticksRemaining / totalTicks); // 0 = начало кд, 1 = готово
    
    // Тёмный оверлей и убираем яркое свечение
    abilityButtonCooldown.style.display = "block";
    abilityButton.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    abilityButton.style.border = "3px solid #333";
    
    // Яркая полоска прогресса (283 = полный круг)
    const circumference = 283;
    const offset = circumference * (1 - progress);
    abilityProgressCircle.setAttribute("stroke-dashoffset", String(offset));
    
    // Показываем оставшееся время
    abilityButtonTimer.textContent = secondsRemaining.toFixed(1);
    abilityButtonTimer.style.display = "block";
    abilityButton.style.opacity = "1";
}

// Функция для получения отображаемого имени с иконкой класса
// Если игрок — Король (Rebel), показываем корону вместо класса
function getDisplayName(name: string, classId: number, isRebel: boolean): string {
    const icon = isRebel ? "👑" : (classIcons[classId] ?? "");
    return `${icon} ${name}`;
}

// ============================================
// JOIN SCREEN — экран выбора перед входом в игру
// ============================================

const joinScreen = document.createElement("div");
joinScreen.style.position = "fixed";
joinScreen.style.inset = "0";
joinScreen.style.display = "flex";
joinScreen.style.flexDirection = "column";
joinScreen.style.alignItems = "center";
joinScreen.style.justifyContent = "center";
joinScreen.style.background = "linear-gradient(160deg, #0a0e14, #151c28)";
joinScreen.style.zIndex = "2000";
joinScreen.style.fontFamily = "\"IBM Plex Mono\", monospace";
joinScreen.style.color = "#e6f3ff";
joinScreen.style.padding = "20px";

const joinTitle = document.createElement("h1");
joinTitle.textContent = "🟢 Slime Arena";
joinTitle.style.fontSize = "clamp(28px, 6vw, 42px)";
joinTitle.style.marginBottom = "8px";
joinTitle.style.color = "#9be070";
joinTitle.style.textShadow = "0 0 20px rgba(155, 224, 112, 0.4)";

const joinSubtitle = document.createElement("div");
joinSubtitle.textContent = "Выбери класс и вперёд!";
joinSubtitle.style.fontSize = "14px";
joinSubtitle.style.color = "#9fb5cc";
joinSubtitle.style.marginBottom = "24px";

// Контейнер для имени
const nameContainer = document.createElement("div");
nameContainer.style.display = "flex";
nameContainer.style.gap = "8px";
nameContainer.style.marginBottom = "20px";
nameContainer.style.width = "min(320px, 90vw)";

const nameInput = document.createElement("input");
nameInput.type = "text";
nameInput.placeholder = "Твоё имя...";
nameInput.maxLength = 24;
nameInput.style.flex = "1";
nameInput.style.padding = "12px 14px";
nameInput.style.fontSize = "15px";
nameInput.style.background = "#111b2a";
nameInput.style.border = "1px solid #2d4a6d";
nameInput.style.borderRadius = "10px";
nameInput.style.color = "#e6f3ff";
nameInput.style.outline = "none";
nameInput.value = generateRandomName();

const randomNameBtn = document.createElement("button");
randomNameBtn.type = "button";
randomNameBtn.textContent = "🎲";
randomNameBtn.style.padding = "12px 16px";
randomNameBtn.style.fontSize = "18px";
randomNameBtn.style.background = "#1b2c45";
randomNameBtn.style.border = "1px solid #2d4a6d";
randomNameBtn.style.borderRadius = "10px";
randomNameBtn.style.cursor = "pointer";
randomNameBtn.style.transition = "background 150ms";
randomNameBtn.addEventListener("mouseenter", () => { randomNameBtn.style.background = "#2a3f5f"; });
randomNameBtn.addEventListener("mouseleave", () => { randomNameBtn.style.background = "#1b2c45"; });
randomNameBtn.addEventListener("click", () => {
    nameInput.value = generateRandomName();
});

nameContainer.appendChild(nameInput);
nameContainer.appendChild(randomNameBtn);

// Карточки классов
const classesData = [
    { 
        id: 0, 
        name: "Охотник", 
        emoji: "🏹",
        desc: "+15% скорость", 
        ability: "Рывок",
        color: "#4ade80"
    },
    { 
        id: 1, 
        name: "Воин", 
        emoji: "⚔️",
        desc: "−15% потерь при укусах, +10% урон", 
        ability: "Щит",
        color: "#f87171"
    },
    { 
        id: 2, 
        name: "Собиратель", 
        emoji: "🧲",
        desc: "+25% радиус сбора", 
        ability: "Притяжение",
        color: "#60a5fa"
    },
];

let selectedClassId = 0;

const classCardsContainer = document.createElement("div");
classCardsContainer.style.display = "flex";
classCardsContainer.style.gap = "12px";
classCardsContainer.style.marginBottom = "24px";
classCardsContainer.style.flexWrap = "wrap";
classCardsContainer.style.justifyContent = "center";

const classCards: HTMLButtonElement[] = [];

for (const cls of classesData) {
    const card = document.createElement("button");
    card.type = "button";
    card.style.width = "min(140px, 28vw)";
    card.style.padding = "16px 12px";
    card.style.background = cls.id === selectedClassId ? "#1b2c45" : "#111b2a";
    card.style.border = cls.id === selectedClassId ? `2px solid ${cls.color}` : "2px solid #2d4a6d";
    card.style.borderRadius = "14px";
    card.style.cursor = "pointer";
    card.style.transition = "transform 150ms, background 150ms, border 150ms";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "center";
    card.style.gap = "8px";
    card.dataset.classId = String(cls.id);

    const emoji = document.createElement("div");
    emoji.textContent = cls.emoji;
    emoji.style.fontSize = "32px";

    const name = document.createElement("div");
    name.textContent = cls.name;
    name.style.fontSize = "15px";
    name.style.fontWeight = "600";
    name.style.color = cls.color;

    const desc = document.createElement("div");
    desc.textContent = cls.desc;
    desc.style.fontSize = "11px";
    desc.style.color = "#9fb5cc";

    const ability = document.createElement("div");
    ability.textContent = `⚡ ${cls.ability}`;
    ability.style.fontSize = "11px";
    ability.style.color = "#6fd6ff";
    ability.style.marginTop = "4px";

    card.appendChild(emoji);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(ability);

    card.addEventListener("mouseenter", () => {
        if (cls.id !== selectedClassId) {
            card.style.background = "#182538";
        }
    });
    card.addEventListener("mouseleave", () => {
        if (cls.id !== selectedClassId) {
            card.style.background = "#111b2a";
        }
    });
    card.addEventListener("click", () => {
        selectedClassId = cls.id;
        classCards.forEach((c, i) => {
            const clsData = classesData[i];
            c.style.background = i === selectedClassId ? "#1b2c45" : "#111b2a";
            c.style.border = i === selectedClassId ? `2px solid ${clsData.color}` : "2px solid #2d4a6d";
            c.style.transform = i === selectedClassId ? "scale(1.05)" : "scale(1)";
        });
    });

    classCardsContainer.appendChild(card);
    classCards.push(card);
}

// Кнопка "Играть"
const playButton = document.createElement("button");
playButton.type = "button";
playButton.textContent = "▶ ИГРАТЬ";
playButton.style.padding = "16px 48px";
playButton.style.fontSize = "18px";
playButton.style.fontWeight = "700";
playButton.style.background = "linear-gradient(135deg, #4ade80, #22c55e)";
playButton.style.border = "none";
playButton.style.borderRadius = "12px";
playButton.style.color = "#0a0e14";
playButton.style.cursor = "pointer";
playButton.style.transition = "transform 150ms, box-shadow 150ms";
playButton.style.boxShadow = "0 8px 24px rgba(74, 222, 128, 0.3)";
playButton.addEventListener("mouseenter", () => {
    playButton.style.transform = "scale(1.05)";
    playButton.style.boxShadow = "0 12px 32px rgba(74, 222, 128, 0.4)";
});
playButton.addEventListener("mouseleave", () => {
    playButton.style.transform = "scale(1)";
    playButton.style.boxShadow = "0 8px 24px rgba(74, 222, 128, 0.3)";
});

// Собираем экран
joinScreen.appendChild(joinTitle);
joinScreen.appendChild(joinSubtitle);
joinScreen.appendChild(nameContainer);
joinScreen.appendChild(classCardsContainer);
joinScreen.appendChild(playButton);
document.body.appendChild(joinScreen);

// Скрываем canvas и HUD до входа в игру
canvas.style.display = "none";
hud.style.display = "none";

// ============================================
// END JOIN SCREEN
// ============================================

let balanceConfig: BalanceConfig = DEFAULT_BALANCE_CONFIG;
let worldWidth = balanceConfig.worldPhysics.widthM ?? balanceConfig.world.mapSize;
let worldHeight = balanceConfig.worldPhysics.heightM ?? balanceConfig.world.mapSize;
let chestRadius = balanceConfig.chests.radius;
let hotZoneRadius = balanceConfig.hotZones.radius;
let collectorRadiusMult = balanceConfig.classes.collector.radiusMult;
const chestStyles = [
    { fill: "#ffc857", stroke: "#ffe8a3", glow: "rgba(255,220,120,0.6)", icon: "📦", scale: 1 },
    { fill: "#9ad4ff", stroke: "#c9e6ff", glow: "rgba(120,190,255,0.6)", icon: "🎁", scale: 1.08 },
    { fill: "#b186ff", stroke: "#d8c1ff", glow: "rgba(190,150,255,0.65)", icon: "💎", scale: 1.16 },
];

const keyState = { up: false, down: false, left: false, right: false };
const camera = { x: 0, y: 0 };
const desiredView = { width: 400, height: 400 };
let hasFocus = true;

// Кэш matchMedia для определения типа устройства
let isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
window.matchMedia("(pointer: coarse)").addEventListener("change", (e) => {
    isCoarsePointer = e.matches;
});

// Состояние управления мышью (agar.io style)
const mouseState = {
    active: false,
    screenX: 0,
    screenY: 0,
    moveX: 0,
    moveY: 0,
};

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
const updateWorldBounds = () => {
    const shape = balanceConfig.worldPhysics.worldShape;
    if (shape === "circle") {
        const radius = balanceConfig.worldPhysics.radiusM ?? balanceConfig.world.mapSize / 2;
        worldWidth = radius * 2;
        worldHeight = radius * 2;
    } else {
        worldWidth = balanceConfig.worldPhysics.widthM ?? balanceConfig.world.mapSize;
        worldHeight = balanceConfig.worldPhysics.heightM ?? balanceConfig.world.mapSize;
    }
};
const applyBalanceConfig = (config: BalanceConfig) => {
    balanceConfig = config;
    updateWorldBounds();
    chestRadius = config.chests.radius;
    hotZoneRadius = config.hotZones.radius;
    collectorRadiusMult = config.classes.collector.radiusMult;
    camera.x = Math.min(Math.max(camera.x, -worldWidth / 2), worldWidth / 2);
    camera.y = Math.min(Math.max(camera.y, -worldHeight / 2), worldHeight / 2);
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

// No top exclusion while HUD/abilities are not implemented.
const joystickLandscapeTopExclusionRatio = 0;

const getJoystickActivationGate = () => {
    const rect = canvas.getBoundingClientRect();
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    const ratioX = isLandscape ? joystickLandscapeRatio : joystickLeftZoneRatio;
    const maxX = ratioX >= 0.999 ? Number.POSITIVE_INFINITY : rect.left + rect.width * ratioX;
    const minY = isLandscape ? rect.top + rect.height * joystickLandscapeTopExclusionRatio : Number.NEGATIVE_INFINITY;
    return { maxX, minY };
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
    angVel: number;
    mass: number;
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

type SnapshotProjectile = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
};

type Snapshot = {
    time: number;
    players: Map<string, SnapshotPlayer>;
    orbs: Map<string, SnapshotOrb>;
    chests: Map<string, SnapshotChest>;
    hotZones: Map<string, SnapshotHotZone>;
    projectiles: Map<string, SnapshotProjectile>;
};

type RenderPlayer = SnapshotPlayer & { alpha?: number };
type RenderOrb = SnapshotOrb & { alpha?: number };
type RenderChest = SnapshotChest & { alpha?: number };
type RenderHotZone = SnapshotHotZone & { alpha?: number };
type RenderProjectile = SnapshotProjectile & { alpha?: number };

type RenderState = {
    players: Map<string, RenderPlayer>;
    orbs: Map<string, RenderOrb>;
    chests: Map<string, RenderChest>;
    hotZones: Map<string, RenderHotZone>;
    projectiles: Map<string, RenderProjectile>;
};

// U2-стиль: храним только последний снапшот
let latestSnapshot: Snapshot | null = null;

// === Visual State System (U2-style predictive smoothing) ===
// Visual state is what we actually draw - it smoothly catches up to server state
type VisualEntity = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
};
const visualPlayers = new Map<string, VisualEntity>();
const visualOrbs = new Map<string, VisualEntity>();
let lastRenderMs = 0;

// Smoothing config - читаем из balance.json
// velocityWeight: 0 = только catch-up, 1 = только интеграция velocity
// Оптимально 0.6-0.8 для Slime Arena: хороший баланс между точностью и плавностью
const getSmoothingConfig = () => balanceConfig?.clientNetSmoothing ?? {
    lookAheadMs: 150,
    velocityWeight: 0.7,
    catchUpSpeed: 10.0,
    maxCatchUpSpeed: 800,
    teleportThreshold: 100,
    angleCatchUpSpeed: 12.0
};

const resetSnapshotBuffer = () => {
    latestSnapshot = null;
    visualPlayers.clear();
    visualOrbs.clear();
    lastRenderMs = 0;
};

// Smoothly move visual state towards target with velocity integration
// Гибрид: интегрируем velocity для предсказуемости + catch-up для коррекции ошибки
const smoothStep = (
    visual: VisualEntity,
    targetX: number,
    targetY: number,
    targetVx: number,
    targetVy: number,
    targetAngle: number,
    dtSec: number
): void => {
    const cfg = getSmoothingConfig();
    
    // Calculate position error
    const dx = targetX - visual.x;
    const dy = targetY - visual.y;
    const error = Math.sqrt(dx * dx + dy * dy);
    
    // Teleport if error is too large (e.g., respawn)
    if (error > cfg.teleportThreshold) {
        visual.x = targetX;
        visual.y = targetY;
        visual.vx = targetVx;
        visual.vy = targetVy;
        visual.angle = targetAngle;
        return;
    }
    
    // Интегрируем целевую velocity (предсказуемое движение по серверной скорости)
    // Используем targetVx, а не visual.vx, чтобы первый кадр после телепорта был корректным
    const velocityMoveX = targetVx * dtSec;
    const velocityMoveY = targetVy * dtSec;
    
    // Затем вычисляем catch-up коррекцию (устранение ошибки)
    let correctionX = 0;
    let correctionY = 0;
    if (error > 0.01) {
        const catchUpSpeed = Math.min(error * cfg.catchUpSpeed, cfg.maxCatchUpSpeed);
        correctionX = (dx / error) * catchUpSpeed * dtSec;
        correctionY = (dy / error) * catchUpSpeed * dtSec;
        
        // Don't overshoot with correction
        if (Math.abs(correctionX) > Math.abs(dx)) correctionX = dx;
        if (Math.abs(correctionY) > Math.abs(dy)) correctionY = dy;
    }
    
    // Комбинируем: velocity движение + взвешенная коррекция
    // velocityWeight контролирует баланс: при 0.7 это 70% velocity + 30% коррекция
    visual.x += velocityMoveX * cfg.velocityWeight + correctionX * (1 - cfg.velocityWeight);
    visual.y += velocityMoveY * cfg.velocityWeight + correctionY * (1 - cfg.velocityWeight);
    
    // Плавно приближаем visual velocity к серверной (для следующей итерации сглаживания)
    const velocityLerp = clamp(dtSec * 8, 0, 1);
    visual.vx = lerp(visual.vx, targetVx, velocityLerp);
    visual.vy = lerp(visual.vy, targetVy, velocityLerp);
    
    // Smooth angle interpolation
    const angleDelta = wrapAngle(targetAngle - visual.angle);
    const angleError = Math.abs(angleDelta);
    if (angleError > 0.001) {
        const angleCatchUp = Math.min(angleError * cfg.angleCatchUpSpeed, Math.PI * 4) * dtSec;
        if (angleCatchUp >= angleError) {
            visual.angle = targetAngle;
        } else {
            visual.angle = wrapAngle(visual.angle + Math.sign(angleDelta) * angleCatchUp);
        }
    }
};

// clamp, lerp, wrapAngle теперь импортируются из @slime-arena/shared

type CollectionLike<T> = {
    entries(): IterableIterator<[string, T]>;
};

type SnapshotProjectilePart = {
    id?: string;
    ownerId?: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    radius?: number;
};

type GameStateLike = {
    players: CollectionLike<Partial<SnapshotPlayer>>;
    orbs: CollectionLike<Partial<SnapshotOrb>>;
    chests: CollectionLike<Partial<SnapshotChest>>;
    hotZones: CollectionLike<Partial<SnapshotHotZone>>;
    projectiles: CollectionLike<SnapshotProjectilePart>;
};

const captureSnapshot = (state: GameStateLike) => {
    const now = performance.now();
    
    // U2-стиль: проверяем дебаунс по последнему снапшоту
    if (latestSnapshot && now - latestSnapshot.time < 10) return;
    
    const snapshot: Snapshot = {
        time: now,
        players: new Map(),
        orbs: new Map(),
        chests: new Map(),
        hotZones: new Map(),
        projectiles: new Map(),
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
            angVel: Number(player.angVel ?? 0),
            mass: Number(player.mass ?? 0),
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

    for (const [id, proj] of state.projectiles.entries()) {
        snapshot.projectiles.set(id, {
            id,
            ownerId: String(proj.ownerId ?? ""),
            x: Number(proj.x ?? 0),
            y: Number(proj.y ?? 0),
            vx: Number(proj.vx ?? 0),
            vy: Number(proj.vy ?? 0),
            radius: Number(proj.radius ?? 8),
        });
    }

    // U2-стиль: сохраняем только последний снапшот
    latestSnapshot = snapshot;
    
    // U2-стиль: сохраняем только последний снапшот
    latestSnapshot = snapshot;
};

// U2-style predictive smoothing: visual state catches up to target
const getSmoothedRenderState = (nowMs: number): RenderState | null => {
    // U2-стиль: используем только последний снапшот
    if (!latestSnapshot) return null;
    
    const newest = latestSnapshot;
    
    // Calculate frame delta
    const dtSec = lastRenderMs > 0 ? Math.min((nowMs - lastRenderMs) / 1000, 0.1) : 0;
    lastRenderMs = nowMs;
    
    // Predict target position: last known position + velocity * lookAhead
    const lookAheadSec = getSmoothingConfig().lookAheadMs / 1000;
    
    // Result maps
    const players = new Map<string, RenderPlayer>();
    const orbs = new Map<string, RenderOrb>();
    const chests = new Map<string, RenderChest>();
    const hotZones = new Map<string, RenderHotZone>();
    const projectiles = new Map<string, RenderProjectile>();
    
    // Process players with visual smoothing
    for (const [id, player] of newest.players.entries()) {
        // Get or create visual state
        let visual = visualPlayers.get(id);
        if (!visual) {
            visual = {
                x: player.x,
                y: player.y,
                vx: player.vx,
                vy: player.vy,
                angle: player.angle,
            };
            visualPlayers.set(id, visual);
        }
        
        // Calculate target position (server pos + velocity * lookAhead)
        const targetX = player.x + player.vx * lookAheadSec;
        const targetY = player.y + player.vy * lookAheadSec;
        const targetAngle = wrapAngle(player.angle + player.angVel * lookAheadSec);
        
        // Smooth visual towards target
        if (dtSec > 0) {
            smoothStep(visual, targetX, targetY, player.vx, player.vy, targetAngle, dtSec);
        }
        
        // Build render player from visual state
        players.set(id, {
            ...player,
            x: visual.x,
            y: visual.y,
            vx: visual.vx,
            vy: visual.vy,
            angle: visual.angle,
        });
    }
    
    // Clean up removed players
    for (const id of visualPlayers.keys()) {
        if (!newest.players.has(id)) {
            visualPlayers.delete(id);
        }
    }
    
    // Process orbs with visual smoothing (simplified - less critical)
    for (const [id, orb] of newest.orbs.entries()) {
        let visual = visualOrbs.get(id);
        if (!visual) {
            visual = {
                x: orb.x,
                y: orb.y,
                vx: orb.vx,
                vy: orb.vy,
                angle: 0,
            };
            visualOrbs.set(id, visual);
        }
        
        // Orbs use simpler smoothing (just position)
        const targetX = orb.x + orb.vx * lookAheadSec;
        const targetY = orb.y + orb.vy * lookAheadSec;
        
        if (dtSec > 0) {
            // Faster catch-up for orbs
            const cfg = getSmoothingConfig();
            const dx = targetX - visual.x;
            const dy = targetY - visual.y;
            const error = Math.sqrt(dx * dx + dy * dy);
            
            if (error > cfg.teleportThreshold) {
                visual.x = targetX;
                visual.y = targetY;
            } else if (error > 0.01) {
                const catchUpSpeed = Math.min(error * cfg.catchUpSpeed * 1.5, cfg.maxCatchUpSpeed);
                const t = Math.min(catchUpSpeed * dtSec / error, 1);
                visual.x = lerp(visual.x, targetX, t);
                visual.y = lerp(visual.y, targetY, t);
            }
            visual.vx = orb.vx;
            visual.vy = orb.vy;
        }
        
        orbs.set(id, {
            ...orb,
            x: visual.x,
            y: visual.y,
            vx: visual.vx,
            vy: visual.vy,
        });
    }
    
    // Clean up removed orbs
    for (const id of visualOrbs.keys()) {
        if (!newest.orbs.has(id)) {
            visualOrbs.delete(id);
        }
    }
    
    // Chests - use direct values (they don't move fast)
    for (const [id, chest] of newest.chests.entries()) {
        chests.set(id, { ...chest });
    }
    
    // Hot zones - use direct values
    for (const [id, zone] of newest.hotZones.entries()) {
        hotZones.set(id, { ...zone });
    }
    
    // Projectiles - simple interpolation (they move fast)
    for (const [id, proj] of newest.projectiles.entries()) {
        const targetX = proj.x + proj.vx * lookAheadSec;
        const targetY = proj.y + proj.vy * lookAheadSec;
        projectiles.set(id, {
            ...proj,
            x: targetX,
            y: targetY,
        });
    }
    
    return {
        players,
        orbs,
        chests,
        hotZones,
        projectiles,
    };
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

function getSlimeConfigForPlayer(classId: number) {
    switch (classId) {
        case 1:
            return balanceConfig.slimeConfigs.warrior;
        case 2:
            return balanceConfig.slimeConfigs.collector;
        case 0:
            return balanceConfig.slimeConfigs.hunter;
        default:
            return balanceConfig.slimeConfigs.base;
    }
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
        y: (camY - y) * scale + ch / 2,
    };
}

function drawGrid(scale: number, camX: number, camY: number, cw: number, ch: number) {
    const step = 200;
    const halfW = cw / scale / 2;
    const halfH = ch / scale / 2;
    const worldHalfW = worldWidth / 2;
    const worldHalfH = worldHeight / 2;
    const startX = Math.max(-worldHalfW, Math.floor((camX - halfW) / step) * step);
    const endX = Math.min(worldHalfW, Math.ceil((camX + halfW) / step) * step);
    const startY = Math.max(-worldHalfH, Math.floor((camY - halfH) / step) * step);
    const endY = Math.min(worldHalfH, Math.ceil((camY + halfH) / step) * step);
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
    angleRad: number,
    fallbackFill: string,
    fallbackStroke: string,
    spriteScale = 1
) {
    if (ready) {
        const size = radius * 2 * spriteScale;
        canvasCtx.save();
        canvasCtx.translate(x, y);
        canvasCtx.rotate(-angleRad);
        canvasCtx.drawImage(img, -size / 2, -size / 2, size, size);
        canvasCtx.restore();
    } else {
        drawCircle(x, y, radius, fallbackFill, fallbackStroke);
    }
}

async function connectToServer(playerName: string, classId: number) {
    // Показываем canvas и HUD
    canvas.style.display = "block";
    hud.style.display = "block";
    joinScreen.style.display = "none";
    
    // Показываем кнопки способностей и устанавливаем иконку
    abilityButton.style.display = "flex";
    abilityButton.style.alignItems = "center";
    abilityButton.style.justifyContent = "center";
    abilityButtonIcon.textContent = abilityIcons[classId] ?? "⚡";
    
    projectileButton.style.display = "flex";
    projectileButton.style.alignItems = "center";
    projectileButton.style.justifyContent = "center";

    hud.textContent = "Подключение к серверу...";

    const env = import.meta as { env?: { BASE_URL?: string; VITE_WS_URL?: string } };
    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "wss" : "ws";
    
    let defaultWsUrl: string;
    if (isHttps && window.location.hostname.includes("overmobile.space")) {
        defaultWsUrl = `${protocol}://slime-arena-server.overmobile.space`;
    } else {
        defaultWsUrl = `${protocol}://${window.location.hostname}:2567`;
    }
    
    const wsUrl = env.env?.VITE_WS_URL ?? defaultWsUrl;
    console.log("WebSocket URL:", wsUrl);
    const client = new Colyseus.Client(wsUrl);

        try {
            // Отправляем выбор игрока на сервер
            const room = await client.joinOrCreate<any>("arena", {
                name: playerName,
                classId,
            });
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
        // Сглаженная позиция игрока для управления мышью
        let smoothedPlayerX = 0;
        let smoothedPlayerY = 0;
        let talentSelectionInFlight = false;

        // Логирование для отладки
        console.log("Room joined:", room.id);
        resetSnapshotBuffer();
        const handleStateChange = () => captureSnapshot(room.state);
        room.onStateChange(handleStateChange);
        captureSnapshot(room.state);

        // Таймер автовыбора таланта (7 секунд)
        const TALENT_AUTO_SELECT_MS = 7000;
        let talentAutoSelectTimer: ReturnType<typeof setTimeout> | null = null;
        let talentAutoSelectStartTime = 0;

        const clearTalentAutoSelect = () => {
            if (talentAutoSelectTimer !== null) {
                clearTimeout(talentAutoSelectTimer);
                talentAutoSelectTimer = null;
            }
        };

        const startTalentAutoSelect = () => {
            clearTalentAutoSelect();
            talentAutoSelectStartTime = Date.now();
            talentAutoSelectTimer = setTimeout(() => {
                // Автовыбор случайного таланта (0, 1 или 2)
                const randomChoice = Math.floor(Math.random() * 3);
                sendTalentChoice(randomChoice);
            }, TALENT_AUTO_SELECT_MS);
        };

        const refreshTalentModal = () => {
            if (!localPlayer) {
                talentModal.style.display = "none";
                clearTalentAutoSelect();
                return;
            }
            const available = Number(localPlayer.talentsAvailable || 0);
            if (available !== lastTalentsAvailable) {
                talentSelectionInFlight = false;
                lastTalentsAvailable = available;
                // Новый талант доступен — запускаем таймер автовыбора
                if (available > 0) {
                    startTalentAutoSelect();
                } else {
                    clearTalentAutoSelect();
                }
            }
            if (available <= 0) {
                talentModal.style.display = "none";
                return;
            }

            talentModal.style.display = "flex";
            
            // Показываем оставшееся время до автовыбора
            const elapsed = Date.now() - talentAutoSelectStartTime;
            const remaining = Math.max(0, Math.ceil((TALENT_AUTO_SELECT_MS - elapsed) / 1000));
            talentCount.textContent = `Таланты: ${available} (авто через ${remaining}с)`;
            
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
            clearTalentAutoSelect();
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
                // Сразу центрируем камеру на игроке
                camera.x = player.x;
                camera.y = player.y;
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
                    `Моя масса: ${hudPlayer.mass.toFixed(0)} кг`
                );
                if (hudPlayer.talentsAvailable > 0) {
                    lines.push(`Таланты: ${hudPlayer.talentsAvailable}`);
                }
            }
            if (room.state.leaderboard && room.state.leaderboard.length > 0) {
                lines.push("Лидеры:");
                for (let i = 0; i < Math.min(5, room.state.leaderboard.length); i += 1) {
                    const playerId = room.state.leaderboard[i];
                    const pl = room.state.players.get(playerId);
                    if (pl) {
                        const isKing = (pl.flags & FLAG_IS_REBEL) !== 0;
                        const crown = isKing ? "👑 " : "";
                        const isSelf = playerId === room.sessionId;
                        const selfMark = isSelf ? " ◀" : "";
                        lines.push(`${i + 1}. ${crown}${pl.name} - ${pl.mass.toFixed(0)}${selfMark}`);
                    }
                }
            }
            hud.textContent = lines.join("\n");
        };

        const updateResultsOverlay = () => {
            const phase = room.state.phase;
            if (phase !== "Results") {
                resultsOverlay.style.display = "none";
                return;
            }

            resultsOverlay.style.display = "flex";
            resultsTitle.textContent = "🏆 Матч завершён!";

            // Получаем победителя
            const leaderId = room.state.leaderboard?.[0];
            const winner = leaderId ? room.state.players.get(leaderId) : null;
            if (winner) {
                const isKing = (winner.flags & FLAG_IS_REBEL) !== 0;
                const crown = isKing ? "👑 " : "";
                resultsWinner.textContent = `${crown}Победитель: ${winner.name}`;
            } else {
                resultsWinner.textContent = "Нет победителя";
            }

            // Формируем лидерборд с использованием DOM API (безопаснее innerHTML)
            resultsLeaderboard.innerHTML = "";
            
            const leaderboardTitle = document.createElement("div");
            leaderboardTitle.style.fontSize = "14px";
            leaderboardTitle.style.marginBottom = "8px";
            leaderboardTitle.style.color = "#9fb5cc";
            leaderboardTitle.textContent = "Таблица лидеров:";
            resultsLeaderboard.appendChild(leaderboardTitle);
            
            const maxEntries = Math.min(10, room.state.leaderboard?.length ?? 0);
            for (let i = 0; i < maxEntries; i++) {
                const playerId = room.state.leaderboard[i];
                const player = room.state.players.get(playerId);
                if (!player) continue;

                const isKing = (player.flags & FLAG_IS_REBEL) !== 0;
                const isSelf = playerId === room.sessionId;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                const displayName = getDisplayName(player.name, player.classId ?? 0, isKing);
                
                const row = document.createElement("div");
                row.style.padding = "4px 0";
                if (isSelf) {
                    row.style.color = "#6fd6ff";
                    row.style.fontWeight = "bold";
                }
                // textContent безопасно экранирует имя
                row.textContent = `${medal} ${displayName} - ${player.mass.toFixed(0)} масса`;
                resultsLeaderboard.appendChild(row);
            }

            // Таймер до рестарта
            const timeRemaining = room.state.timeRemaining ?? 0;
            resultsTimer.textContent = `Новый матч через ${Math.ceil(timeRemaining)}с...`;
        };

        // Обновление управления мышью: вычисляем направление от слайма к курсору
        const updateMouseControl = () => {
            if (!mouseState.active || !localPlayer) return;
            
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = Math.min(cw / desiredView.width, ch / desiredView.height);
            
            // Позиция слайма на экране (используем сглаженные координаты, как и камера)
            const playerScreen = worldToScreen(smoothedPlayerX, smoothedPlayerY, scale, camera.x, camera.y, cw, ch);
            
            // Позиция курсора относительно слайма на экране
            const dx = mouseState.screenX - playerScreen.x;
            const dy = mouseState.screenY - playerScreen.y;
            
            // Расстояние от слайма (в пикселях)
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Мёртвая зона в центре (из конфига)
            const deadzone = balanceConfig.controls.mouseDeadzone;
            if (dist < deadzone) {
                mouseState.moveX = 0;
                mouseState.moveY = 0;
                return;
            }
            
            // Нормализуем направление
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Интенсивность зависит от расстояния (линейно до maxDist из конфига)
            const maxDist = balanceConfig.controls.mouseMaxDist;
            const intensity = Math.min(1, (dist - deadzone) / (maxDist - deadzone));
            
            mouseState.moveX = nx * intensity;
            mouseState.moveY = ny * intensity;
        };

        const computeMoveInput = () => {
            // Приоритет: джойстик > мышь > клавиатура
            if (joystickState.active) {
                return { x: joystickState.moveX, y: -joystickState.moveY };
            }
            if (mouseState.active) {
                updateMouseControl();
                return { x: mouseState.moveX, y: -mouseState.moveY };
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
            return { x, y: -y };
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
            const now = performance.now();
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = Math.min(cw / desiredView.width, ch / desiredView.height);
            const halfWorldW = cw / scale / 2;
            const halfWorldH = ch / scale / 2;
            const worldHalfW = worldWidth / 2;
            const worldHalfH = worldHeight / 2;

            // Use U2-style predictive smoothing
            const renderState = getSmoothedRenderState(now);
            renderStateForHud = renderState;
            const playersView = renderState ? renderState.players : room.state.players;
            const orbsView = renderState ? renderState.orbs : room.state.orbs;
            const chestsView = renderState ? renderState.chests : room.state.chests;
            const hotZonesView = renderState ? renderState.hotZones : room.state.hotZones;
            const projectilesView = renderState ? renderState.projectiles : room.state.projectiles;

            // Камера следит за сглаженной позицией игрока (плавное движение)
            const smoothedPlayer = renderState?.players.get(room.sessionId);
            const targetX = smoothedPlayer ? smoothedPlayer.x : (localPlayer ? localPlayer.x : 0);
            const targetY = smoothedPlayer ? smoothedPlayer.y : (localPlayer ? localPlayer.y : 0);
            // Сохраняем сглаженную позицию для управления мышью
            smoothedPlayerX = targetX;
            smoothedPlayerY = targetY;
            const maxCamX = Math.max(0, worldHalfW - halfWorldW);
            const maxCamY = Math.max(0, worldHalfH - halfWorldH);
            const clampX = clamp(targetX, -maxCamX, maxCamX);
            const clampY = clamp(targetY, -maxCamY, maxCamY);
            // Камера всегда центрирована на игроке (стиль Agar.io)
            camera.x = clampX;
            camera.y = clampY;

            canvasCtx.clearRect(0, 0, cw, ch);
            drawGrid(scale, camera.x, camera.y, cw, ch);

            // Hunger Zone: красный фон вне Sweet Zones (только в Chaos/Final)
            const currentPhase = room.state.phase;
            if ((currentPhase === "Chaos" || currentPhase === "Final") && hotZonesView.size > 0) {
                // Рисуем красный фон на весь экран
                canvasCtx.save();
                canvasCtx.fillStyle = "rgba(139, 0, 0, 0.12)";
                canvasCtx.fillRect(0, 0, cw, ch);
                // Вырезаем Safe Zones (Sweet Zones) используя destination-out
                canvasCtx.globalCompositeOperation = "destination-out";
                for (const [, zone] of hotZonesView.entries()) {
                    const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                    const alpha = zone.alpha ?? 1;
                    if (alpha <= 0.01) continue;
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, zone.radius * scale, 0, Math.PI * 2);
                    canvasCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
                    canvasCtx.fill();
                }
                canvasCtx.restore();
            }

            // Sweet Zones (бывшие Hot Zones) — золотой цвет
            for (const [, zone] of hotZonesView.entries()) {
                if (Math.abs(zone.x - camera.x) > halfWorldW + hotZoneRadius || Math.abs(zone.y - camera.y) > halfWorldH + hotZoneRadius) continue;
                const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                const alpha = zone.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                drawCircle(p.x, p.y, zone.radius * scale, "rgba(255, 215, 0, 0.08)", "rgba(255, 215, 0, 0.4)");
                canvasCtx.restore();
            }

            for (const [, orb] of orbsView.entries()) {
                if (Math.abs(orb.x - camera.x) > halfWorldW + 50 || Math.abs(orb.y - camera.y) > halfWorldH + 50) continue;
                const p = worldToScreen(orb.x, orb.y, scale, camera.x, camera.y, cw, ch);
                const orbType = balanceConfig.orbs.types[orb.colorId];
                const density = orbType?.density ?? 1;
                const r = Math.max(2, getOrbRadius(orb.mass, density) * scale);
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

            // Рендеринг снарядов (projectiles)
            for (const [, proj] of projectilesView.entries()) {
                if (Math.abs(proj.x - camera.x) > halfWorldW + 50 || Math.abs(proj.y - camera.y) > halfWorldH + 50) continue;
                const p = worldToScreen(proj.x, proj.y, scale, camera.x, camera.y, cw, ch);
                const r = Math.max(4, proj.radius * scale);
                const alpha = proj.alpha ?? 1;
                if (alpha <= 0.01) continue;
                
                // Определяем цвет снаряда: свой = голубой, чужой = красный
                const isMine = proj.ownerId === room.sessionId;
                const fillColor = isMine ? "rgba(100, 220, 255, 0.9)" : "rgba(255, 100, 100, 0.9)";
                const strokeColor = isMine ? "#64dcff" : "#ff6464";
                
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                canvasCtx.shadowColor = strokeColor;
                canvasCtx.shadowBlur = 8;
                drawCircle(p.x, p.y, r, fillColor, strokeColor);
                canvasCtx.shadowBlur = 0;
                canvasCtx.restore();
            }

            for (const [id, player] of playersView.entries()) {
                if (Math.abs(player.x - camera.x) > halfWorldW + 200 || Math.abs(player.y - camera.y) > halfWorldH + 200) continue;
                const p = worldToScreen(player.x, player.y, scale, camera.x, camera.y, cw, ch);
                const classRadiusMult = player.classId === 2 ? collectorRadiusMult : 1;
                const slimeConfig = getSlimeConfigForPlayer(player.classId);
                const baseRadius = getSlimeRadiusFromConfig(player.mass, slimeConfig);
                const radius = baseRadius * classRadiusMult * scale;
                const isSelf = id === room.sessionId;
                const isRebel = id === room.state.rebelId || (player.flags & FLAG_IS_REBEL) !== 0;
                const color = isSelf ? "#6fd6ff" : "#9be070";
                const stroke = player.flags & FLAG_IS_DEAD ? "#555" : isSelf ? "#1ea6ff" : "#6ac96f";
                const r = radius;
                const angleRad = player.angle ?? 0;
                const spriteName = playerSpriteById.get(id) ?? pickSpriteForPlayer(id);
                const sprite = loadSprite(spriteName);
                const alpha = player.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                
                // Визуализация рывка охотника — реактивные следы
                if ((player.flags & FLAG_DASHING) !== 0) {
                    const trailCount = 5;
                    const trailSpacing = r * 0.6;
                    const dirX = Math.cos(angleRad);
                    const dirY = -Math.sin(angleRad);
                    for (let i = 1; i <= trailCount; i++) {
                        const trailAlpha = 0.4 - i * 0.07;
                        const trailSize = r * (1 - i * 0.12);
                        const offsetX = -dirX * trailSpacing * i;
                        const offsetY = -dirY * trailSpacing * i;
                        canvasCtx.beginPath();
                        canvasCtx.arc(p.x + offsetX, p.y + offsetY, trailSize, 0, Math.PI * 2);
                        canvasCtx.fillStyle = `rgba(255, 200, 100, ${trailAlpha})`;
                        canvasCtx.fill();
                    }
                    // Огненный хвост
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x - dirX * r * 0.5, p.y - dirY * r * 0.5, r * 0.4, 0, Math.PI * 2);
                    canvasCtx.fillStyle = "rgba(255, 100, 50, 0.6)";
                    canvasCtx.shadowColor = "#ff6600";
                    canvasCtx.shadowBlur = 15;
                    canvasCtx.fill();
                    canvasCtx.shadowBlur = 0;
                }
                
                // Визуализация магнитного поля собирателя
                if ((player.flags & FLAG_MAGNETIZING) !== 0) {
                    const magnetRadius = (balanceConfig.abilities?.magnet?.radiusM ?? 150) * scale;
                    // Внешний круг
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, magnetRadius, 0, Math.PI * 2);
                    canvasCtx.strokeStyle = "rgba(138, 43, 226, 0.6)";
                    canvasCtx.lineWidth = 3;
                    canvasCtx.setLineDash([10, 5]);
                    canvasCtx.stroke();
                    canvasCtx.setLineDash([]);
                    // Внутреннее свечение
                    const gradient = canvasCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, magnetRadius);
                    gradient.addColorStop(0, "rgba(138, 43, 226, 0.2)");
                    gradient.addColorStop(0.7, "rgba(138, 43, 226, 0.1)");
                    gradient.addColorStop(1, "rgba(138, 43, 226, 0)");
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, magnetRadius, 0, Math.PI * 2);
                    canvasCtx.fillStyle = gradient;
                    canvasCtx.fill();
                    // Магнитные линии
                    canvasCtx.strokeStyle = "rgba(200, 100, 255, 0.4)";
                    canvasCtx.lineWidth = 1;
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        const innerR = r * 1.5;
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(p.x + Math.cos(angle) * innerR, p.y + Math.sin(angle) * innerR);
                        canvasCtx.lineTo(p.x + Math.cos(angle) * magnetRadius * 0.9, p.y + Math.sin(angle) * magnetRadius * 0.9);
                        canvasCtx.stroke();
                    }
                }
                
                // Визуализация щита воина
                if ((player.flags & FLAG_ABILITY_SHIELD) !== 0) {
                    const shieldRadius = r * 1.4;
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, shieldRadius, 0, Math.PI * 2);
                    canvasCtx.strokeStyle = "#4fc3f7";
                    canvasCtx.lineWidth = 4;
                    canvasCtx.shadowColor = "#4fc3f7";
                    canvasCtx.shadowBlur = 15;
                    canvasCtx.stroke();
                    canvasCtx.shadowBlur = 0;
                    // Внутреннее свечение
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, shieldRadius, 0, Math.PI * 2);
                    canvasCtx.fillStyle = "rgba(79, 195, 247, 0.15)";
                    canvasCtx.fill();
                }
                
                drawSprite(sprite.img, sprite.ready, p.x, p.y, r, angleRad, color, stroke, sprite.scale);

                // Имя с иконкой класса (или короной для Короля)
                const displayName = getDisplayName(player.name, player.classId ?? 0, isRebel);
                canvasCtx.fillStyle = isRebel ? "#ffc857" : "#e6f3ff";
                canvasCtx.font = "12px \"IBM Plex Mono\", monospace";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText(displayName, p.x, p.y - r - 6);

                const isKing = (player.flags & FLAG_IS_REBEL) !== 0;
                const otherFlags: string[] = [];
                if (player.flags & FLAG_LAST_BREATH) otherFlags.push("LB");
                if (player.flags & FLAG_IS_DEAD) otherFlags.push("DEAD");

                if (isKing) {
                    canvasCtx.fillStyle = "#ffc857";
                    canvasCtx.fillText("KING", p.x, p.y + r + 12);
                    if (otherFlags.length > 0) {
                        canvasCtx.fillStyle = "#e6f3ff";
                        canvasCtx.fillText(otherFlags.join(" "), p.x, p.y + r + 24);
                    }
                } else if (otherFlags.length > 0) {
                    canvasCtx.fillStyle = "#e6f3ff";
                    canvasCtx.fillText(otherFlags.join(" "), p.x, p.y + r + 12);
                }

                canvasCtx.restore();
            }

            // Chest indicators по краям экрана
            for (const [, chest] of chestsView.entries()) {
                const dx = chest.x - camera.x;
                const dy = chest.y - camera.y;
                if (Math.abs(dx) <= halfWorldW && Math.abs(dy) <= halfWorldH) continue;
                const worldAngle = Math.atan2(dy, dx);
                const screenAngle = Math.atan2(-dy, dx);
                const edgeX = Math.cos(worldAngle) * (halfWorldW - 40);
                const edgeY = Math.sin(worldAngle) * (halfWorldH - 40);
                const screen = worldToScreen(camera.x + edgeX, camera.y + edgeY, scale, camera.x, camera.y, cw, ch);
                const style = chestStyles[chest.type] ?? chestStyles[0];
                const alpha = chest.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                canvasCtx.translate(screen.x, screen.y);
                canvasCtx.rotate(screenAngle);
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
                        const worldAngle = Math.atan2(dy, dx);
                        const screenAngle = Math.atan2(-dy, dx);
                        const edgeX = Math.cos(worldAngle) * (halfWorldW - 54);
                        const edgeY = Math.sin(worldAngle) * (halfWorldH - 54);
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
                            canvasCtx.rotate(screenAngle);

                            canvasCtx.fillStyle = "#ff4d4d";
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

            // Обновление индикатора кулдауна способности
            const tickRate = balanceConfig.server?.tickRate ?? 30;
            updateAbilityCooldown(localPlayer, room.state.serverTick ?? 0, tickRate);

            rafId = requestAnimationFrame(render);
        };

        const sendStopInput = () => {
            lastSentInput = { x: 0, y: 0 };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: 0, moveY: 0 });
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) return;
            const key = event.key.toLowerCase();
            
            // Способность активируется клавишей 1 (slot 0 — классовая способность)
            if (key === "1") {
                inputSeq += 1;
                room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 0 });
                event.preventDefault();
                return;
            }
            
            // Выброс активируется клавишей 2 (slot 1 — универсальная способность)
            if (key === "2") {
                inputSeq += 1;
                room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 1 });
                event.preventDefault();
                return;
            }
            
            switch (key) {
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
            // Кэшируем результат matchMedia
            const isCoarse = isCoarsePointer;
            const isTouchPointer = event.pointerType === "touch" || event.pointerType === "pen";
            const isMousePointer = event.pointerType === "mouse";
            const isPrimaryMouseButton = isMousePointer && event.button === 0;
            if (!isTouchPointer && !isPrimaryMouseButton && !isCoarse) return;
            if (joystickState.active) return;
            if (!isPrimaryMouseButton) {
                const gate = getJoystickActivationGate();
                if (event.clientX > gate.maxX) return;
                if (event.clientY < gate.minY) return;
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
            mouseState.active = false;
            mouseState.moveX = 0;
            mouseState.moveY = 0;
            sendStopInput();
            detachJoystickPointerListeners();
            resetJoystick();
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                hasFocus = false;
                keyState.up = keyState.down = keyState.left = keyState.right = false;
                mouseState.active = false;
                mouseState.moveX = 0;
                mouseState.moveY = 0;
                sendStopInput();
                detachJoystickPointerListeners();
                resetJoystick();
            } else {
                hasFocus = true;
            }
        };

        // Управление мышью для ПК (agar.io style)
        // Приоритет: touch/joystick > mouse
        const onMouseMove = (event: MouseEvent) => {
            // Активируем только если это настоящая мышь (не touch)
            // Кэшируем результат matchMedia
            if (isCoarsePointer) return;
            
            // Не активируем если уже активен джойстик
            if (joystickState.active) return;
            
            hasFocus = true;
            mouseState.active = true;
            mouseState.screenX = event.clientX;
            mouseState.screenY = event.clientY;
        };

        const onMouseLeave = () => {
            // Отключаем управление мышью когда курсор покидает окно
            mouseState.active = false;
            mouseState.moveX = 0;
            mouseState.moveY = 0;
        };
        
        // Обработчик кнопки способности
        const onAbilityButtonClick = () => {
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 0 });
        };
        abilityButton.addEventListener("click", onAbilityButtonClick);
        
        // Обработчик кнопки Выброса (Projectile)
        const onProjectileButtonClick = () => {
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 1 });
        };
        projectileButton.addEventListener("click", onProjectileButtonClick);

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
        canvas.addEventListener("mousemove", onMouseMove, { passive: true });
        canvas.addEventListener("mouseleave", onMouseLeave, { passive: true });
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onVisibilityChange);

        updateHud();
        updateResultsOverlay();
        refreshTalentModal();
        render();

        const hudTimer = setInterval(() => {
            updateHud();
            updateResultsOverlay();
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
            canvas.removeEventListener("mousemove", onMouseMove);
            canvas.removeEventListener("mouseleave", onMouseLeave);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            abilityButton.removeEventListener("click", onAbilityButtonClick);
            projectileButton.removeEventListener("click", onProjectileButtonClick);
            
            // Показываем экран выбора при отключении
            canvas.style.display = "none";
            hud.style.display = "none";
            abilityButton.style.display = "none";
            projectileButton.style.display = "none";
            joinScreen.style.display = "flex";
        });
    } catch (e) {
        hud.textContent = `Ошибка подключения: ${e}`;
        console.error(e);
        // Вернём экран выбора при ошибке
        canvas.style.display = "none";
        hud.style.display = "none";
        joinScreen.style.display = "flex";
    }
}

// Обработчик кнопки "Играть"
playButton.addEventListener("click", () => {
    const name = nameInput.value.trim() || generateRandomName();
    connectToServer(name, selectedClassId);
});
