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
    FLAG_PUSHING,
    FLAG_INVISIBLE,
    FLAG_LEVIATHAN,
    FLAG_RESPAWN_SHIELD,
    ZONE_TYPE_NECTAR,
    ZONE_TYPE_ICE,
    ZONE_TYPE_SLIME,
    ZONE_TYPE_LAVA,
    ZONE_TYPE_TURBO,
    OBSTACLE_TYPE_PILLAR,
    OBSTACLE_TYPE_SPIKES,
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

const boostPanel = document.createElement("div");
boostPanel.style.position = "fixed";
boostPanel.style.top = "12px";
boostPanel.style.left = "260px";
boostPanel.style.display = "none";
boostPanel.style.alignItems = "center";
boostPanel.style.gap = "8px";
boostPanel.style.padding = "6px 10px";
boostPanel.style.background = "rgba(0, 0, 0, 0.55)";
boostPanel.style.border = "1px solid rgba(255, 255, 255, 0.1)";
boostPanel.style.borderRadius = "12px";
boostPanel.style.fontSize = "12px";
boostPanel.style.color = "#e6f3ff";
boostPanel.style.pointerEvents = "none";
boostPanel.style.fontFamily = "\"IBM Plex Mono\", \"Courier New\", monospace";
root.appendChild(boostPanel);

const boostIcon = document.createElement("div");
boostIcon.style.width = "26px";
boostIcon.style.height = "26px";
boostIcon.style.borderRadius = "50%";
boostIcon.style.display = "flex";
boostIcon.style.alignItems = "center";
boostIcon.style.justifyContent = "center";
boostIcon.style.fontWeight = "700";
boostIcon.style.color = "#0b0f14";
boostPanel.appendChild(boostIcon);

const boostText = document.createElement("div");
boostText.style.display = "flex";
boostText.style.flexDirection = "column";
boostText.style.gap = "2px";
boostPanel.appendChild(boostText);

const topCenterHud = document.createElement("div");
topCenterHud.style.position = "fixed";
topCenterHud.style.top = "12px";
topCenterHud.style.left = "50%";
topCenterHud.style.transform = "translateX(-50%)";
topCenterHud.style.textAlign = "center";
topCenterHud.style.color = "#e6f3ff";
topCenterHud.style.fontFamily = "\"IBM Plex Mono\", \"Courier New\", monospace";
topCenterHud.style.pointerEvents = "none";
topCenterHud.style.display = "none";
topCenterHud.style.flexDirection = "column";
topCenterHud.style.alignItems = "center";
topCenterHud.style.gap = "4px";
topCenterHud.style.textShadow = "0 2px 4px rgba(0,0,0,0.8)";
root.appendChild(topCenterHud);

const matchTimer = document.createElement("div");
matchTimer.style.fontSize = "24px";
matchTimer.style.fontWeight = "bold";
matchTimer.style.color = "#fff";
topCenterHud.appendChild(matchTimer);

const killCounter = document.createElement("div");
killCounter.style.fontSize = "16px";
killCounter.style.color = "#ff4d4d";
killCounter.style.fontWeight = "bold";
killCounter.style.display = "none"; // Hidden by default
topCenterHud.appendChild(killCounter);

const canvas = document.createElement("canvas");
canvas.style.width = "100%";
canvas.style.height = "100vh";
canvas.style.display = "block";
canvas.style.background = "radial-gradient(circle at 30% 30%, #10141d, #090b10 60%)";
canvas.style.touchAction = "none";
canvas.tabIndex = 0;
canvas.style.outline = "none";
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
talentModal.style.left = "20px";
talentModal.style.top = "50%";
talentModal.style.transform = "translateY(-50%)";
talentModal.style.display = "none";
talentModal.style.flexDirection = "column";
talentModal.style.gap = "10px";
talentModal.style.pointerEvents = "auto";
talentModal.style.zIndex = "120";

const talentCard = document.createElement("div");
talentCard.style.width = "min(420px, 44vw)";
talentCard.style.maxHeight = "70vh";
talentCard.style.overflowY = "auto";
talentCard.style.pointerEvents = "auto";
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
talentTitle.textContent = "Выбери талант";
talentTitle.style.fontSize = "18px";
talentTitle.style.fontWeight = "700";
talentTitle.style.letterSpacing = "0.5px";

const talentTimer = document.createElement("div");
talentTimer.style.fontSize = "13px";
talentTimer.style.color = "#fbbf24";
talentTimer.style.fontWeight = "600";

const talentCount = document.createElement("div");
talentCount.style.fontSize = "12px";
talentCount.style.color = "#6fd6ff";

const talentButtons = document.createElement("div");
talentButtons.style.display = "grid";
talentButtons.style.gap = "10px";

const talentButtonsList: HTMLButtonElement[] = [];
const talentButtonElements: HTMLButtonElement[] = [];

// Создаём 3 кнопки для выбора талантов
for (let i = 0; i < 3; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.style.display = "none";
    button.style.gap = "8px";
    button.style.padding = "14px 16px";
    button.style.background = "#111b2a";
    button.style.border = "2px solid #2d4a6d";
    button.style.borderRadius = "12px";
    button.style.color = "#e6f3ff";
    button.style.fontSize = "14px";
    button.style.textAlign = "left";
    button.style.cursor = "pointer";
    button.style.transition = "transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease";
    
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
    
    talentButtons.appendChild(button);
    talentButtonElements.push(button);
    talentButtonsList.push(button);
}

// Подсказка для карточки талантов
const talentHint = document.createElement("div");
talentHint.textContent = "Клик или клавиши 7 / 8 / 9";
talentHint.style.fontSize = "11px";
talentHint.style.color = "#6a8099";
talentHint.style.textAlign = "center";
talentHint.style.marginTop = "4px";

talentCard.appendChild(talentTitle);
talentCard.appendChild(talentTimer);
talentCard.appendChild(talentCount);
talentCard.appendChild(talentButtons);
talentCard.appendChild(talentHint);
talentModal.appendChild(talentCard);
document.body.appendChild(talentModal);

const talentRewardPanel = document.createElement("div");
talentRewardPanel.style.position = "fixed";
talentRewardPanel.style.left = "20px";
talentRewardPanel.style.top = "90px";
talentRewardPanel.style.display = "none";
talentRewardPanel.style.flexDirection = "column";
talentRewardPanel.style.gap = "8px";
talentRewardPanel.style.zIndex = "115";
talentRewardPanel.style.pointerEvents = "none";
talentRewardPanel.style.fontFamily = "\"IBM Plex Mono\", \"Courier New\", monospace";

const talentRewardTitle = document.createElement("div");
talentRewardTitle.textContent = "Получен талант";
talentRewardTitle.style.fontSize = "12px";
talentRewardTitle.style.color = "#a7c6ff";
talentRewardTitle.style.fontWeight = "600";
talentRewardPanel.appendChild(talentRewardTitle);

const talentRewardCard = document.createElement("div");
talentRewardCard.style.width = "min(320px, 40vw)";
talentRewardCard.style.background = "#111b2a";
talentRewardCard.style.border = "2px solid #2d4a6d";
talentRewardCard.style.borderRadius = "12px";
talentRewardCard.style.padding = "14px 16px";
talentRewardCard.style.color = "#e6f3ff";
talentRewardCard.style.display = "grid";
talentRewardCard.style.gridTemplateColumns = "auto 1fr";
talentRewardCard.style.gap = "10px";
talentRewardCard.style.alignItems = "center";
talentRewardPanel.appendChild(talentRewardCard);

document.body.appendChild(talentRewardPanel);

// Маппинг талантов: название, иконка, описание (будет загружаться из balance.json)
const talentInfo: Record<string, { name: string; icon: string; desc: string }> = {
    // Common talents
    fastLegs: { name: "Быстрые ноги", icon: "🦵", desc: "+% к макс. скорости" },
    spinner: { name: "Юла", icon: "🌀", desc: "+% к повороту" },
    sharpTeeth: { name: "Острые зубы", icon: "🦷", desc: "+% к урону укусом" },
    glutton: { name: "Обжора", icon: "😋", desc: "+% массы от пузырей" },
    thickSkin: { name: "Толстая шкура", icon: "🛡️", desc: "−% потери от укусов" },
    economical: { name: "Экономный", icon: "💰", desc: "−% стоимость умений" },
    recharge: { name: "Перезарядка", icon: "⚡", desc: "−% кулдауны" },
    aggressor: { name: "Агрессор", icon: "💢", desc: "+12% урон, +12% потери" },
    sturdy: { name: "Стойкий", icon: "🗿", desc: "−10% к потерям" },
    accelerator: { name: "Ускоритель", icon: "🚀", desc: "+15% маршевый двигатель" },
    anchor: { name: "Якорь", icon: "⚓", desc: "+20% тормозной двигатель" },
    crab: { name: "Краб", icon: "🦀", desc: "+15% боковые двигатели" },
    bloodlust: { name: "Кровожадность", icon: "🩸", desc: "+15% массы от убийств" },
    secondWind: { name: "Второе дыхание", icon: "💨", desc: "Респаун 150 кг" },
    sense: { name: "Чутьё", icon: "👁️", desc: "Видеть сундуки заранее" },
    regeneration: { name: "Регенерация", icon: "💚", desc: "+1% массы вне боя" },
    
    // Rare talents
    poison: { name: "Яд", icon: "☠️", desc: "Укус отравляет" },
    frost: { name: "Мороз", icon: "❄️", desc: "Укус замедляет" },
    vampire: { name: "Вампир", icon: "🧛", desc: "Больше массы от укуса" },
    vacuum: { name: "Вакуум", icon: "🌪️", desc: "Пузыри к пасти" },
    motor: { name: "Мотор", icon: "⚙️", desc: "+25% все двигатели" },
    ricochet: { name: "Рикошет", icon: "↩️", desc: "Выброс отскакивает" },
    piercing: { name: "Пробивание", icon: "➡️", desc: "Выброс сквозь цель" },
    longDash: { name: "Длинный рывок", icon: "🏃", desc: "+40% дистанция рывка" },
    backNeedles: { name: "Иглы назад", icon: "🔱", desc: "3 снаряда при гибели" },
    toxic: { name: "Токсичный", icon: "☣️", desc: "×2 лужа при гибели" },
    
    // Epic talents
    lightning: { name: "Молния", icon: "⚡", desc: "+25% скорость, оглушение" },
    doubleActivation: { name: "Двойная активация", icon: "✖️", desc: "Повтор умения за 1 сек" },
    explosion: { name: "Взрыв", icon: "💥", desc: "При гибели AoE урон" },
    leviathan: { name: "Левиафан", icon: "🐋", desc: "Размер ×1.3, пасть ×1.5" },
    invisible: { name: "Невидимка", icon: "👻", desc: "1.5 сек после рывка" },
    
    // Class talents - Hunter
    ambush: { name: "Засада", icon: "🎯", desc: "+30% урон в бок/хвост" },
    momentum: { name: "Разгон", icon: "💨", desc: "+5%/сек скорость (макс +20%)" },
    hunterInvisible: { name: "Невидимка", icon: "👻", desc: "1.5 сек после рывка" },
    
    // Class talents - Warrior
    indestructible: { name: "Несокрушимый", icon: "🏰", desc: "−15% к потерям" },
    thorns: { name: "Шипы", icon: "🌵", desc: "Атакующий теряет 10% урона" },
    berserk: { name: "Берсерк", icon: "🔥", desc: "+3% урон за 100кг потерь" },
    
    // Class talents - Collector
    parasite: { name: "Паразит", icon: "🦠", desc: "+5% массы от укуса слайма" },
    magnet: { name: "Магнит", icon: "🧲", desc: "Пузыри в 50м к пасти" },
    symbiosis: { name: "Симбиоз", icon: "🤝", desc: "+50% пузырей при укусе" },
};

// Цвета рамки по редкости (GDD-Talents.md)
const rarityColors: Record<number, string> = {
    0: "#6b7280", // Common (серый)
    1: "#3b82f6", // Rare (синий)
    2: "#a855f7", // Epic (фиолетовый)
};

const rarityNames: Record<number, string> = {
    0: "Обычный",
    1: "Редкий",
    2: "Эпический",
};

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
resultsContent.style.maxWidth = "600px";
resultsContent.style.width = "90%";
resultsContent.style.padding = "20px";
resultsContent.style.display = "flex";
resultsContent.style.flexDirection = "column";
resultsContent.style.gap = "16px";

const resultsTitle = document.createElement("h1");
resultsTitle.style.fontSize = "32px";
resultsTitle.style.margin = "0";
resultsTitle.style.color = "#ffc857";
resultsTitle.style.textShadow = "0 0 20px rgba(255, 200, 87, 0.5)";

const resultsWinner = document.createElement("div");
resultsWinner.style.fontSize = "24px";
resultsWinner.style.color = "#9be070";

const resultsLeaderboard = document.createElement("div");
resultsLeaderboard.style.textAlign = "left";
resultsLeaderboard.style.background = "rgba(0, 0, 0, 0.3)";
resultsLeaderboard.style.borderRadius = "8px";
resultsLeaderboard.style.padding = "15px";
resultsLeaderboard.style.maxHeight = "200px";
resultsLeaderboard.style.overflowY = "auto";

const resultsPersonalStats = document.createElement("div");
resultsPersonalStats.style.display = "flex";
resultsPersonalStats.style.justifyContent = "space-around";
resultsPersonalStats.style.background = "rgba(255, 255, 255, 0.05)";
resultsPersonalStats.style.borderRadius = "8px";
resultsPersonalStats.style.padding = "12px";
resultsPersonalStats.style.border = "1px solid rgba(255, 255, 255, 0.1)";

const resultsClassSelection = document.createElement("div");
resultsClassSelection.style.display = "flex";
resultsClassSelection.style.gap = "10px";
resultsClassSelection.style.justifyContent = "center";
resultsClassSelection.style.marginTop = "10px";

const resultsTimer = document.createElement("div");
resultsTimer.style.fontSize = "16px";
resultsTimer.style.color = "#6fd6ff";

const resultsExitButton = document.createElement("button");
resultsExitButton.textContent = "Выйти в меню";
resultsExitButton.style.padding = "10px 20px";
resultsExitButton.style.background = "#ef4444";
resultsExitButton.style.border = "none";
resultsExitButton.style.borderRadius = "8px";
resultsExitButton.style.color = "white";
resultsExitButton.style.cursor = "pointer";
resultsExitButton.style.fontSize = "14px";
resultsExitButton.style.marginTop = "10px";
resultsExitButton.onclick = () => window.location.reload();

resultsContent.appendChild(resultsTitle);
resultsContent.appendChild(resultsWinner);
resultsContent.appendChild(resultsLeaderboard);
resultsContent.appendChild(resultsPersonalStats);
resultsContent.appendChild(resultsClassSelection);
resultsContent.appendChild(resultsTimer);
resultsContent.appendChild(resultsExitButton);
resultsOverlay.appendChild(resultsContent);
document.body.appendChild(resultsOverlay);

// Class Selection Buttons for Results Screen
// Используем classesData (определён ниже) для единого источника данных о классах
const resultsClassButtons: HTMLButtonElement[] = [];

function syncResultsClassButtons() {
    resultsClassButtons.forEach((btn) => {
        const classId = Number(btn.dataset.classId);
        const clsData = classesData.find((c) => c.id === classId);
        if (!clsData) return;
        const isSelected = classId === selectedClassId;
        btn.style.background = isSelected ? clsData.color : "rgba(255, 255, 255, 0.05)";
        btn.style.transform = isSelected ? "scale(1.05)" : "scale(1)";
    });
}

// Кнопки создаются после определения classesData (см. initResultsClassButtons)

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
// ABILITY BUTTON - кнопка способности класса
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

const abilityCooldownUi: CooldownUi = {
    button: abilityButton,
    overlay: abilityButtonCooldown,
    timer: abilityButtonTimer,
    progressCircle: abilityProgressCircle,
    baseShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
    baseBorder: "3px solid #4a90c2",
    readyShadow: "0 0 15px 5px rgba(100, 220, 255, 0.7), inset 0 0 15px rgba(100, 220, 255, 0.3)",
    readyBorder: "3px solid #64dcff",
};

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

const projectileCooldownUi: CooldownUi = {
    button: projectileButton,
    overlay: projectileCooldown,
    timer: projectileTimer,
    progressCircle: projectileProgressCircle,
    baseShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
    baseBorder: "3px solid #9a4ac2",
    readyShadow: "0 0 12px 4px rgba(199, 79, 247, 0.6), inset 0 0 12px rgba(199, 79, 247, 0.3)",
    readyBorder: "3px solid #c74ff7",
};

// ============================================
// SLOT 2 BUTTON - кнопка умения слота 2 (клавиша 3)
// ============================================
const slot2Button = document.createElement("button");
slot2Button.type = "button";
slot2Button.style.position = "fixed";
slot2Button.style.right = "170px";
slot2Button.style.bottom = "20px";
slot2Button.style.width = "60px";
slot2Button.style.height = "60px";
slot2Button.style.borderRadius = "50%";
slot2Button.style.background = "linear-gradient(135deg, #2d6d4a, #1b452c)";
slot2Button.style.border = "3px solid #4ac27a";
slot2Button.style.color = "#e6fff3";
slot2Button.style.fontSize = "24px";
slot2Button.style.cursor = "pointer";
slot2Button.style.zIndex = "50";
slot2Button.style.transition = "transform 150ms, background 150ms, opacity 150ms";
slot2Button.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.4)";
slot2Button.style.display = "none";
slot2Button.title = "3";

const slot2ButtonIcon = document.createElement("span");
slot2ButtonIcon.textContent = "🔒";
slot2ButtonIcon.style.fontSize = "24px";
slot2ButtonIcon.style.pointerEvents = "none";
slot2Button.appendChild(slot2ButtonIcon);

const slot2ButtonLabel = document.createElement("span");
slot2ButtonLabel.textContent = "3";
slot2ButtonLabel.style.position = "absolute";
slot2ButtonLabel.style.bottom = "2px";
slot2ButtonLabel.style.right = "4px";
slot2ButtonLabel.style.fontSize = "14px";
slot2ButtonLabel.style.fontWeight = "bold";
slot2ButtonLabel.style.color = "#fff";
slot2ButtonLabel.style.textShadow = "0 0 4px #000, 0 0 8px #000";
slot2ButtonLabel.style.pointerEvents = "none";
slot2Button.appendChild(slot2ButtonLabel);

// Тёмный оверлей кулдауна для Slot 2
const slot2Cooldown = document.createElement("div");
slot2Cooldown.style.position = "absolute";
slot2Cooldown.style.inset = "0";
slot2Cooldown.style.borderRadius = "50%";
slot2Cooldown.style.background = "rgba(0, 0, 0, 0.8)";
slot2Cooldown.style.pointerEvents = "none";
slot2Cooldown.style.display = "none";
slot2Button.appendChild(slot2Cooldown);

// SVG прогресс для Slot 2
const slot2Progress = document.createElementNS("http://www.w3.org/2000/svg", "svg");
slot2Progress.setAttribute("viewBox", "0 0 100 100");
slot2Progress.style.position = "absolute";
slot2Progress.style.inset = "0";
slot2Progress.style.width = "100%";
slot2Progress.style.height = "100%";
slot2Progress.style.transform = "rotate(-90deg)";
slot2Progress.style.pointerEvents = "none";

const slot2ProgressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
slot2ProgressCircle.setAttribute("cx", "50");
slot2ProgressCircle.setAttribute("cy", "50");
slot2ProgressCircle.setAttribute("r", "45");
slot2ProgressCircle.setAttribute("fill", "none");
slot2ProgressCircle.setAttribute("stroke", "#4ac27a");
slot2ProgressCircle.setAttribute("stroke-width", "6");
slot2ProgressCircle.setAttribute("stroke-linecap", "round");
slot2ProgressCircle.setAttribute("stroke-dasharray", "283");
slot2ProgressCircle.setAttribute("stroke-dashoffset", "283");
slot2ProgressCircle.style.filter = "drop-shadow(0 0 4px #4ac27a)";
slot2Progress.appendChild(slot2ProgressCircle);
slot2Button.appendChild(slot2Progress);

const slot2Timer = document.createElement("span");
slot2Timer.style.position = "absolute";
slot2Timer.style.top = "50%";
slot2Timer.style.left = "50%";
slot2Timer.style.transform = "translate(-50%, -50%)";
slot2Timer.style.fontSize = "14px";
slot2Timer.style.fontWeight = "bold";
slot2Timer.style.color = "#fff";
slot2Timer.style.textShadow = "0 0 4px #000";
slot2Timer.style.pointerEvents = "none";
slot2Timer.style.display = "none";
slot2Button.appendChild(slot2Timer);

document.body.appendChild(slot2Button);

const slot2CooldownUi: CooldownUi = {
    button: slot2Button,
    overlay: slot2Cooldown,
    timer: slot2Timer,
    progressCircle: slot2ProgressCircle,
    baseShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
    baseBorder: "3px solid #4ac27a",
    readyShadow: "0 0 12px 4px rgba(120, 255, 190, 0.6), inset 0 0 12px rgba(120, 255, 190, 0.3)",
    readyBorder: "3px solid #4ac27a",
};

// ============================================
// ABILITY CARD UI - карточка выбора умения
// ============================================
const abilityCardModal = document.createElement("div");
abilityCardModal.style.position = "fixed";
abilityCardModal.style.top = "50%";
abilityCardModal.style.right = "20px";
abilityCardModal.style.transform = "translateY(-50%)";
abilityCardModal.style.display = "none";
abilityCardModal.style.flexDirection = "column";
abilityCardModal.style.gap = "10px";
abilityCardModal.style.padding = "16px";
abilityCardModal.style.background = "linear-gradient(160deg, #101721, #0c0f14)";
abilityCardModal.style.border = "2px solid #4a90c2";
abilityCardModal.style.borderRadius = "16px";
abilityCardModal.style.zIndex = "100";
abilityCardModal.style.fontFamily = "\"IBM Plex Mono\", monospace";
abilityCardModal.style.color = "#e6f3ff";
abilityCardModal.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.6)";
abilityCardModal.style.minWidth = "200px";

const abilityCardTitle = document.createElement("div");
abilityCardTitle.textContent = "Выбери умение";
abilityCardTitle.style.fontSize = "16px";
abilityCardTitle.style.fontWeight = "700";
abilityCardTitle.style.textAlign = "center";
abilityCardTitle.style.marginBottom = "4px";
abilityCardModal.appendChild(abilityCardTitle);

const abilityCardTimer = document.createElement("div");
abilityCardTimer.style.fontSize = "13px";
abilityCardTimer.style.color = "#6fd6ff";
abilityCardTimer.style.textAlign = "center";
abilityCardTimer.style.marginBottom = "8px";
abilityCardModal.appendChild(abilityCardTimer);

const abilityCardButtons = document.createElement("div");
abilityCardButtons.style.display = "flex";
abilityCardButtons.style.flexDirection = "column";
abilityCardButtons.style.gap = "8px";
abilityCardModal.appendChild(abilityCardButtons);

// Названия и иконки умений
const abilityNames: Record<string, { name: string; icon: string; desc: string }> = {
    dash: { name: "Рывок", icon: "⚡", desc: "Мгновенное перемещение" },
    shield: { name: "Щит", icon: "🛡️", desc: "Блокирует весь урон" },
    slow: { name: "Замедление", icon: "❄️", desc: "Зона −30% скорости" },
    pull: { name: "Притяжение", icon: "🧲", desc: "Тянет пузыри" },
    projectile: { name: "Выброс", icon: "💥", desc: "Снаряд 15% урона" },
    spit: { name: "Плевок", icon: "💦", desc: "Веер из 3 снарядов" },
    bomb: { name: "Бомба", icon: "💣", desc: "AoE 50м, 12% урона" },
    push: { name: "Отталкивание", icon: "💨", desc: "Волна отброса" },
    mine: { name: "Мина", icon: "💀", desc: "Ловушка 15% урона" },
};

const abilityUpgradePrefix = "ability:";

const parseAbilityUpgradeId = (value: string): { abilityId: string; level: number } | null => {
    if (!value || !value.startsWith(abilityUpgradePrefix)) return null;
    const parts = value.split(":");
    if (parts.length < 3) return null;
    const abilityId = parts[1] || "";
    const level = Number(parts[2]);
    if (!abilityId || !Number.isInteger(level)) return null;
    return { abilityId, level };
};

const abilityUpgradeDescriptions: Record<string, Record<number, string>> = {
    dash: {
        2: "Уровень 2 — перезарядка 4 сек",
        3: "Уровень 3 — дистанция 104 м",
    },
    shield: {
        2: "Уровень 2 — отражение 30% урона",
        3: "Уровень 3 — волна отталкивания 40 м",
    },
    slow: {
        2: "Уровень 2 — радиус 100 м",
        3: "Уровень 3 — замедление 40%",
    },
    pull: {
        2: "Уровень 2 — радиус 150 м",
        3: "Уровень 3 — скорость 70 м/с",
    },
    projectile: {
        2: "Уровень 2 — урон 18%",
        3: "Уровень 3 — пробивание (60% урона второй цели)",
    },
    spit: {
        2: "Уровень 2 — 4 снаряда",
        3: "Уровень 3 — урон 9.2%",
    },
    bomb: {
        2: "Уровень 2 — радиус взрыва 70 м",
        3: "Уровень 3 — перезарядка 5 сек",
    },
    push: {
        2: "Уровень 2 — радиус 100 м",
        3: "Уровень 3 — усиленный импульс",
    },
    mine: {
        2: "Уровень 2 — 2 мины",
        3: "Уровень 3 — урон 20%",
    },
};

const getAbilityUpgradeInfo = (abilityId: string, level: number) => {
    const base = abilityNames[abilityId] ?? { name: abilityId, icon: "?", desc: "" };
    const desc = abilityUpgradeDescriptions[abilityId]?.[level] ?? "Улучшение умения";
    return {
        name: `Улучшение: ${base.name}`,
        icon: base.icon,
        desc,
    };
};

function createAbilityCardButton(index: number): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.cardChoice = String(index);
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.gap = "10px";
    btn.style.padding = "12px 14px";
    btn.style.background = "#111b2a";
    btn.style.border = "1px solid #2d4a6d";
    btn.style.borderRadius = "12px";
    btn.style.color = "#e6f3ff";
    btn.style.fontSize = "14px";
    btn.style.textAlign = "left";
    btn.style.cursor = "pointer";
    btn.style.transition = "transform 120ms, background 120ms, box-shadow 120ms";
    
    btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateX(-4px)";
        btn.style.background = "#1b2c45";
        btn.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.35)";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.transform = "translateX(0)";
        btn.style.background = "#111b2a";
        btn.style.boxShadow = "none";
    });
    
    return btn;
}

const abilityCardBtns: HTMLButtonElement[] = [];
for (let i = 0; i < 3; i++) {
    const btn = createAbilityCardButton(i);
    abilityCardBtns.push(btn);
    abilityCardButtons.appendChild(btn);
}

const abilityCardHint = document.createElement("div");
abilityCardHint.textContent = "Клик или клавиши 7 / 8 / 9";
abilityCardHint.style.fontSize = "11px";
abilityCardHint.style.color = "#6a8099";
abilityCardHint.style.textAlign = "center";
abilityCardHint.style.marginTop = "4px";
abilityCardModal.appendChild(abilityCardHint);

document.body.appendChild(abilityCardModal);

// Индикатор уровня
const levelIndicator = document.createElement("div");
levelIndicator.style.position = "fixed";
levelIndicator.style.right = "20px";
levelIndicator.style.top = "12px";
levelIndicator.style.padding = "8px 14px";
levelIndicator.style.background = "rgba(0, 0, 0, 0.55)";
levelIndicator.style.border = "1px solid rgba(255, 255, 255, 0.1)";
levelIndicator.style.borderRadius = "10px";
levelIndicator.style.display = "none";
levelIndicator.style.zIndex = "50";
levelIndicator.style.flexDirection = "column";
levelIndicator.style.gap = "4px";
levelIndicator.style.minWidth = "140px";

const levelText = document.createElement("div");
levelText.style.fontSize = "14px";
levelText.style.color = "#e6f3ff";
levelText.style.fontFamily = "\"IBM Plex Mono\", monospace";
levelText.style.fontWeight = "bold";
levelText.style.display = "flex";
levelText.style.justifyContent = "space-between";
levelIndicator.appendChild(levelText);

const levelBarContainer = document.createElement("div");
levelBarContainer.style.width = "100%";
levelBarContainer.style.height = "6px";
levelBarContainer.style.background = "rgba(255, 255, 255, 0.1)";
levelBarContainer.style.borderRadius = "3px";
levelBarContainer.style.overflow = "hidden";
levelIndicator.appendChild(levelBarContainer);

const levelBarFill = document.createElement("div");
levelBarFill.style.width = "0%";
levelBarFill.style.height = "100%";
levelBarFill.style.background = "linear-gradient(90deg, #4ade80, #22c55e)";
levelBarFill.style.transition = "width 0.3s ease";
levelBarContainer.appendChild(levelBarFill);

document.body.appendChild(levelIndicator);

// Индикатор очереди карточек
const queueIndicator = document.createElement("div");
queueIndicator.style.position = "fixed";
queueIndicator.style.right = "20px";
queueIndicator.style.bottom = "100px";
queueIndicator.style.padding = "8px 12px";
queueIndicator.style.background = "rgba(255, 165, 0, 0.9)";
queueIndicator.style.borderRadius = "20px";
queueIndicator.style.color = "#fff";
queueIndicator.style.fontWeight = "bold";
queueIndicator.style.fontSize = "14px";
queueIndicator.style.zIndex = "50";
queueIndicator.style.display = "none";
queueIndicator.style.boxShadow = "0 0 15px rgba(255, 165, 0, 0.6)";
queueIndicator.style.animation = "pulse 1.5s infinite";
document.body.appendChild(queueIndicator);

// Add pulse animation style
const styleSheet = document.createElement("style");
styleSheet.textContent = `
@keyframes pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.7); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 165, 0, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 165, 0, 0); }
}
`;
document.head.appendChild(styleSheet);

// Иконки способностей по классам
const abilityIcons: Record<number, string> = {
    0: "⚡", // Hunter - Dash
    1: "🛡️", // Warrior - Shield
    2: "🧲", // Collector - Pull
};

// Иконки классов для отображения у имени
const classIcons: Record<number, string> = {
    0: "🏹", // Hunter
    1: "⚔️", // Warrior
    2: "🧲", // Collector
};

type CooldownUi = {
    button: HTMLButtonElement;
    overlay: HTMLDivElement;
    timer: HTMLSpanElement;
    progressCircle: SVGCircleElement;
    baseShadow: string;
    baseBorder: string;
    readyShadow: string;
    readyBorder: string;
};

// Длительность кулдауна способности по id (секунды)
function getAbilityCooldownSecById(abilityId: string | null | undefined, classId?: number): number {
    if (!abilityId) {
        switch (classId) {
            case 0: return balanceConfig.abilities?.dash?.cooldownSec ?? 5;
            case 1: return balanceConfig.abilities?.shield?.cooldownSec ?? 8;
            case 2: return balanceConfig.abilities?.slow?.cooldownSec ?? 6;
            default: return 5;
        }
    }

    switch (abilityId) {
        case "dash":
            return balanceConfig.abilities?.dash?.cooldownSec ?? 5;
        case "shield":
            return balanceConfig.abilities?.shield?.cooldownSec ?? 8;
        case "slow":
            return balanceConfig.abilities?.slow?.cooldownSec ?? 6;
        case "projectile":
            return balanceConfig.abilities?.projectile?.cooldownSec ?? 4;
        case "pull":
            return balanceConfig.abilities?.magnet?.cooldownSec ?? 8;
        case "spit":
            return balanceConfig.abilities?.spit?.cooldownSec ?? 5;
        case "bomb":
            return balanceConfig.abilities?.bomb?.cooldownSec ?? 6;
        case "push":
            return balanceConfig.abilities?.push?.cooldownSec ?? 6;
        case "mine":
            return balanceConfig.abilities?.mine?.cooldownSec ?? 10;
        default:
            return 5;
    }
}

function updateCooldownUi(
    ui: CooldownUi,
    options: {
        abilityId?: string;
        classId?: number;
        cooldownStartTick?: number;
        cooldownEndTick?: number;
        serverTick: number;
        tickRate: number;
    }
) {
    const startTick = Number.isFinite(options.cooldownStartTick) ? Number(options.cooldownStartTick) : 0;
    const endTick = Number.isFinite(options.cooldownEndTick) ? Number(options.cooldownEndTick) : 0;
    const hasAbility = Boolean(options.abilityId);

    if (!hasAbility || endTick <= options.serverTick || endTick <= 0 || endTick <= startTick) {
        ui.overlay.style.display = "none";
        ui.timer.style.display = "none";
        ui.progressCircle.setAttribute("stroke-dashoffset", "0");
        ui.button.style.opacity = "1";
        ui.button.style.boxShadow = hasAbility ? ui.readyShadow : ui.baseShadow;
        ui.button.style.border = hasAbility ? ui.readyBorder : ui.baseBorder;
        return;
    }

    const ticksRemaining = endTick - options.serverTick;
    let totalTicks = endTick - startTick;
    if (!Number.isFinite(totalTicks) || totalTicks <= 0) {
        const totalSec = getAbilityCooldownSecById(options.abilityId, options.classId);
        totalTicks = totalSec * options.tickRate;
    }
    totalTicks = Math.max(1, totalTicks);
    const progress = 1 - Math.min(1, ticksRemaining / totalTicks); // 0 = начало кд, 1 = готово

    ui.overlay.style.display = "block";
    ui.button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    ui.button.style.border = "3px solid #333";

    const circumference = 283;
    const offset = circumference * (1 - progress);
    ui.progressCircle.setAttribute("stroke-dashoffset", String(offset));

    ui.timer.textContent = (ticksRemaining / options.tickRate).toFixed(1);
    ui.timer.style.display = "block";
    ui.button.style.opacity = "1";
}

// Функция для получения отображаемого имени с иконкой класса
// Если игрок - Король (Rebel), показываем корону вместо класса
function getDisplayName(name: string, classId: number, isRebel: boolean): string {
    const icon = isRebel ? "👑" : (classIcons[classId] ?? "");
    return `${icon} ${name}`;
}

// ============================================
// JOIN SCREEN - экран выбора перед входом в игру
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

// Инициализация кнопок выбора класса на экране результатов
function initResultsClassButtons() {
    classesData.forEach(cls => {
        const btn = document.createElement("button");
        btn.style.display = "flex";
        btn.style.flexDirection = "column";
        btn.style.alignItems = "center";
        btn.style.gap = "4px";
        btn.style.padding = "12px";
        btn.style.background = "rgba(255, 255, 255, 0.05)";
        btn.style.border = `2px solid ${cls.color}`;
        btn.style.borderRadius = "12px";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.style.width = "100px";
        btn.style.transition = "all 0.2s";
        btn.dataset.classId = String(cls.id);

        const icon = document.createElement("span");
        icon.textContent = cls.emoji;
        icon.style.fontSize = "24px";
        
        const name = document.createElement("span");
        name.textContent = cls.name;
        name.style.fontSize = "12px";
        name.style.fontWeight = "bold";

        btn.appendChild(icon);
        btn.appendChild(name);

        btn.onclick = () => {
            selectedClassId = cls.id;
            syncClassCards();
            syncResultsClassButtons();
            updatePlayButton();
        };

        resultsClassSelection.appendChild(btn);
        resultsClassButtons.push(btn);
    });
}

// Вызываем после определения classesData
initResultsClassButtons();

let selectedClassId = -1;  // -1 = класс не выбран
let activeRoom: any = null;

const classCardsContainer = document.createElement("div");
classCardsContainer.style.display = "flex";
classCardsContainer.style.gap = "12px";
classCardsContainer.style.marginBottom = "24px";
classCardsContainer.style.flexWrap = "wrap";
classCardsContainer.style.justifyContent = "center";

const classCards: HTMLButtonElement[] = [];

function syncClassCards() {
    classCards.forEach((c, i) => {
        const clsData = classesData[i];
        const isSelected = i === selectedClassId;
        c.style.background = isSelected ? "#1b2c45" : "#111b2a";
        c.style.border = isSelected ? `2px solid ${clsData.color}` : "2px solid #2d4a6d";
        c.style.transform = isSelected ? "scale(1.05)" : "scale(1)";
    });
}

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
        syncClassCards();
        syncResultsClassButtons();
        updatePlayButton();
    });

    classCardsContainer.appendChild(card);
    classCards.push(card);
}

// Кнопка "Играть"
const playButton = document.createElement("button");
playButton.type = "button";
playButton.textContent = "ВЫБЕРИТЕ КЛАСС";
playButton.style.padding = "16px 48px";
playButton.style.fontSize = "18px";
playButton.style.fontWeight = "700";
playButton.style.background = "linear-gradient(135deg, #6b7280, #4b5563)";
playButton.style.border = "none";
playButton.style.borderRadius = "12px";
playButton.style.color = "#9ca3af";
playButton.style.cursor = "not-allowed";
playButton.style.transition = "transform 150ms, box-shadow 150ms, background 300ms";
playButton.style.boxShadow = "0 8px 24px rgba(107, 114, 128, 0.2)";
playButton.disabled = true;

// Функция обновления состояния кнопки Play
const updatePlayButton = () => {
    if (selectedClassId >= 0 && selectedClassId <= 2) {
        playButton.textContent = "▶ ИГРАТЬ";
        playButton.style.background = "linear-gradient(135deg, #4ade80, #22c55e)";
        playButton.style.color = "#0a0e14";
        playButton.style.cursor = "pointer";
        playButton.style.boxShadow = "0 8px 24px rgba(74, 222, 128, 0.3)";
        playButton.disabled = false;
    } else {
        playButton.textContent = "ВЫБЕРИТЕ КЛАСС";
        playButton.style.background = "linear-gradient(135deg, #6b7280, #4b5563)";
        playButton.style.color = "#9ca3af";
        playButton.style.cursor = "not-allowed";
        playButton.style.boxShadow = "0 8px 24px rgba(107, 114, 128, 0.2)";
        playButton.disabled = true;
    }
};

playButton.addEventListener("mouseenter", () => {
    if (!playButton.disabled) {
        playButton.style.transform = "scale(1.05)";
        playButton.style.boxShadow = "0 12px 32px rgba(74, 222, 128, 0.4)";
    }
});
playButton.addEventListener("mouseleave", () => {
    playButton.style.transform = "scale(1)";
    if (!playButton.disabled) {
        playButton.style.boxShadow = "0 8px 24px rgba(74, 222, 128, 0.3)";
    }
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
    { fill: "#7adf7a", stroke: "#b6f0b6", glow: "rgba(120,220,140,0.55)", icon: "🎁", scale: 1 },
    { fill: "#b186ff", stroke: "#d8c1ff", glow: "rgba(190,150,255,0.65)", icon: "💎", scale: 1.08 },
    { fill: "#ffc857", stroke: "#ffe8a3", glow: "rgba(255,220,120,0.6)", icon: "📦", scale: 1.16 },
];

const keyState = { up: false, down: false, left: false, right: false };
const camera = { x: 0, y: 0 };
const desiredView = { width: 800, height: 800 }; // Увеличено в 2 раза для лучшего обзора
let hasFocus = true;
let cameraZoom = 1;
let cameraZoomTarget = 1;
let lastZoomUpdateMs = 0;
let lastDamageTimeMs = 0;

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
    const cameraConfig = balanceConfig.camera ?? DEFAULT_BALANCE_CONFIG.camera;
    const zoomMin = Math.min(cameraConfig.zoomMin, cameraConfig.zoomMax);
    const zoomMax = Math.max(cameraConfig.zoomMin, cameraConfig.zoomMax);
    cameraZoom = clamp(cameraZoom, zoomMin, zoomMax);
    cameraZoomTarget = cameraZoom;
    lastZoomUpdateMs = 0;
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
    killCount: number;
    classId: number;
    talentsAvailable: number;
    boostType: string;
    boostEndTick: number;
    boostCharges: number;
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
    armorRings: number;
};

type SnapshotHotZone = {
    id: string;
    x: number;
    y: number;
    radius: number;
    spawnMultiplier: number;
};

type SnapshotSlowZone = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    radius: number;
    slowPct: number;
};

type SnapshotToxicPool = {
    id: string;
    x: number;
    y: number;
    radius: number;
    slowPct: number;
    damagePctPerSec: number;
};

type SnapshotProjectile = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    projectileType: number;  // 0 = normal, 1 = bomb
};

type SnapshotMine = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    radius: number;
};

type Snapshot = {
    time: number;
    players: Map<string, SnapshotPlayer>;
    orbs: Map<string, SnapshotOrb>;
    chests: Map<string, SnapshotChest>;
    hotZones: Map<string, SnapshotHotZone>;
    slowZones: Map<string, SnapshotSlowZone>;
    toxicPools: Map<string, SnapshotToxicPool>;
    projectiles: Map<string, SnapshotProjectile>;
    mines: Map<string, SnapshotMine>;
};

type RenderPlayer = SnapshotPlayer & { alpha?: number };
type RenderOrb = SnapshotOrb & { alpha?: number };
type RenderChest = SnapshotChest & { alpha?: number };
type RenderHotZone = SnapshotHotZone & { alpha?: number };
type RenderSlowZone = SnapshotSlowZone & { alpha?: number };
type RenderToxicPool = SnapshotToxicPool & { alpha?: number };
type RenderProjectile = SnapshotProjectile & { alpha?: number };
type RenderMine = SnapshotMine & { alpha?: number };

type RenderState = {
    players: Map<string, RenderPlayer>;
    orbs: Map<string, RenderOrb>;
    chests: Map<string, RenderChest>;
    hotZones: Map<string, RenderHotZone>;
    slowZones: Map<string, RenderSlowZone>;
    toxicPools: Map<string, RenderToxicPool>;
    projectiles: Map<string, RenderProjectile>;
    mines: Map<string, RenderMine>;
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
const visualChests = new Map<string, VisualEntity>();
let lastRenderMs = 0;

// Система всплывающих текстов и эффектов
type FloatingText = {
    x: number;
    y: number;
    text: string;
    color: string;
    startMs: number;
    durationMs: number;
    fontSize: number;
};
type FlashEffect = {
    x: number;
    y: number;
    color: string;
    startMs: number;
    durationMs: number;
    radius: number;
};
type ChestRewardPayload = {
    chestId: string;
    x: number;
    y: number;
    type: number;
    rewardKind: "talent" | "boost" | "none";
    rewardId: string;
};
const floatingTexts: FloatingText[] = [];
const flashEffects: FlashEffect[] = [];

function addFloatingText(x: number, y: number, text: string, color: string, fontSize = 20, durationMs = 1200) {
    floatingTexts.push({ x, y, text, color, startMs: performance.now(), durationMs, fontSize });
}

function addFlashEffect(x: number, y: number, color: string, radius: number, durationMs = 400) {
    flashEffects.push({ x, y, color, startMs: performance.now(), durationMs, radius });
}

// Кэш последних позиций сундуков для эффектов при удалении
const lastChestPositions = new Map<string, { x: number; y: number; type: number }>();
const pendingChestRewards = new Map<string, { text: string; color: string; x: number; y: number }>();

// Флаг для заморозки визуального состояния при Results
// При true: smoothStep не применяется, орбы остаются на месте
// (сундуки также замораживаются в getSmoothedRenderState)
let freezeVisualState = false;

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
    visualChests.clear();
    lastRenderMs = 0;
    floatingTexts.length = 0;
    flashEffects.length = 0;
    lastChestPositions.clear();
    pendingChestRewards.clear();
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
    projectileType?: number;
};

type SnapshotMinePart = {
    id?: string;
    ownerId?: string;
    x?: number;
    y?: number;
    radius?: number;
};

type GameStateLike = {
    players: CollectionLike<Partial<SnapshotPlayer>>;
    orbs: CollectionLike<Partial<SnapshotOrb>>;
    chests: CollectionLike<Partial<SnapshotChest>>;
    hotZones: CollectionLike<Partial<SnapshotHotZone>>;
    slowZones: CollectionLike<Partial<SnapshotSlowZone>>;
    toxicPools: CollectionLike<Partial<SnapshotToxicPool>>;
    projectiles: CollectionLike<SnapshotProjectilePart>;
    mines: CollectionLike<SnapshotMinePart>;
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
        slowZones: new Map(),
        toxicPools: new Map(),
        projectiles: new Map(),
        mines: new Map(),
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
            killCount: Number(player.killCount ?? 0),
            classId: Number(player.classId ?? 0),
            talentsAvailable: Number(player.talentsAvailable ?? 0),
            boostType: String(player.boostType ?? ""),
            boostEndTick: Number(player.boostEndTick ?? 0),
            boostCharges: Number(player.boostCharges ?? 0),
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
            armorRings: Number(chest.armorRings ?? 0),
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

    for (const [id, zone] of state.slowZones.entries()) {
        snapshot.slowZones.set(id, {
            id,
            ownerId: String(zone.ownerId ?? ""),
            x: Number(zone.x ?? 0),
            y: Number(zone.y ?? 0),
            radius: Number(zone.radius ?? 0),
            slowPct: Number(zone.slowPct ?? 0.3),
        });
    }

    for (const [id, pool] of state.toxicPools.entries()) {
        snapshot.toxicPools.set(id, {
            id,
            x: Number(pool.x ?? 0),
            y: Number(pool.y ?? 0),
            radius: Number(pool.radius ?? 0),
            slowPct: Number(pool.slowPct ?? 0),
            damagePctPerSec: Number(pool.damagePctPerSec ?? 0),
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
            projectileType: Number(proj.projectileType ?? 0),
        });
    }

    for (const [id, mine] of state.mines.entries()) {
        snapshot.mines.set(id, {
            id,
            ownerId: String(mine.ownerId ?? ""),
            x: Number(mine.x ?? 0),
            y: Number(mine.y ?? 0),
            radius: Number(mine.radius ?? 15),
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
        
        // При Results заморозить орбы на месте
        if (dtSec > 0 && !freezeVisualState) {
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
    
    // Chests - smoothing similar to orbs (they can move from push)
    for (const [id, chest] of newest.chests.entries()) {
        let visual = visualChests.get(id);
        if (!visual) {
            visual = {
                x: chest.x,
                y: chest.y,
                vx: chest.vx,
                vy: chest.vy,
                angle: 0,
            };
            visualChests.set(id, visual);
        }
        
        const targetX = chest.x + chest.vx * lookAheadSec;
        const targetY = chest.y + chest.vy * lookAheadSec;
        
        // При Results заморозить сундуки на месте (как орбы)
        if (dtSec > 0 && !freezeVisualState) {
            const cfg = getSmoothingConfig();
            const dx = targetX - visual.x;
            const dy = targetY - visual.y;
            const error = Math.sqrt(dx * dx + dy * dy);
            
            if (error > cfg.teleportThreshold) {
                visual.x = targetX;
                visual.y = targetY;
            } else if (error > 0.01) {
                // Slower catch-up for chests (they're heavy)
                const catchUpSpeed = Math.min(error * cfg.catchUpSpeed * 0.8, cfg.maxCatchUpSpeed * 0.5);
                const t = Math.min(catchUpSpeed * dtSec / error, 1);
                visual.x = lerp(visual.x, targetX, t);
                visual.y = lerp(visual.y, targetY, t);
            }
            visual.vx = chest.vx;
            visual.vy = chest.vy;
        }
        
        chests.set(id, {
            ...chest,
            x: visual.x,
            y: visual.y,
            vx: visual.vx,
            vy: visual.vy,
        });
    }
    
    // Clean up removed chests
    for (const id of visualChests.keys()) {
        if (!newest.chests.has(id)) {
            visualChests.delete(id);
        }
    }
    
    // Hot zones - use direct values
    for (const [id, zone] of newest.hotZones.entries()) {
        hotZones.set(id, { ...zone });
    }
    
    // Slow zones - use direct values
    const slowZones = new Map<string, RenderSlowZone>();
    for (const [id, zone] of newest.slowZones.entries()) {
        slowZones.set(id, { ...zone });
    }

    // Toxic pools - use direct values
    const toxicPools = new Map<string, RenderToxicPool>();
    for (const [id, pool] of newest.toxicPools.entries()) {
        toxicPools.set(id, { ...pool });
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
    
    // Mines - use direct values (они не двигаются)
    const mines = new Map<string, RenderMine>();
    for (const [id, mine] of newest.mines.entries()) {
        mines.set(id, { ...mine });
    }
    
    return {
        players,
        orbs,
        chests,
        hotZones,
        slowZones,
        toxicPools,
        projectiles,
        mines,
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

function getLeviathanRadiusMul() {
    const values = balanceConfig?.talents?.epic?.leviathan?.values;
    if (Array.isArray(values) && Array.isArray(values[0])) {
        const radiusMul = Number(values[0][0] ?? 1);
        return radiusMul > 0 ? radiusMul : 1;
    }
    return 1;
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
    const majorStep = step * 5; // Каждые 5 клеток — толстая линия
    const halfW = cw / scale / 2;
    const halfH = ch / scale / 2;
    const worldHalfW = worldWidth / 2;
    const worldHalfH = worldHeight / 2;
    const startX = Math.max(-worldHalfW, Math.floor((camX - halfW) / step) * step);
    const endX = Math.min(worldHalfW, Math.ceil((camX + halfW) / step) * step);
    const startY = Math.max(-worldHalfH, Math.floor((camY - halfH) / step) * step);
    const endY = Math.min(worldHalfH, Math.ceil((camY + halfH) / step) * step);
    
    // Обычные линии сетки
    canvasCtx.strokeStyle = "rgba(255,255,255,0.12)";
    canvasCtx.lineWidth = 1;
    for (let x = startX; x <= endX; x += step) {
        if (x % majorStep === 0) continue; // Major линии рисуем отдельно
        const screen = worldToScreen(x, 0, scale, camX, camY, cw, ch);
        canvasCtx.beginPath();
        canvasCtx.moveTo(screen.x, 0);
        canvasCtx.lineTo(screen.x, ch);
        canvasCtx.stroke();
    }
    for (let y = startY; y <= endY; y += step) {
        if (y % majorStep === 0) continue;
        const screen = worldToScreen(0, y, scale, camX, camY, cw, ch);
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, screen.y);
        canvasCtx.lineTo(cw, screen.y);
        canvasCtx.stroke();
    }
    
    // Major линии (каждые 5 клеток) — ярче и толще
    canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";
    canvasCtx.lineWidth = 2;
    for (let x = Math.ceil(startX / majorStep) * majorStep; x <= endX; x += majorStep) {
        const screen = worldToScreen(x, 0, scale, camX, camY, cw, ch);
        canvasCtx.beginPath();
        canvasCtx.moveTo(screen.x, 0);
        canvasCtx.lineTo(screen.x, ch);
        canvasCtx.stroke();
    }
    for (let y = Math.ceil(startY / majorStep) * majorStep; y <= endY; y += majorStep) {
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
        // Scatter orbs от слаймов (classId + 10)
        case 10:
            return "#4ade80"; // Hunter green
        case 11:
            return "#f87171"; // Warrior red
        case 12:
            return "#60a5fa"; // Collector blue
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
    topCenterHud.style.display = "flex";
    joinScreen.style.display = "none";
    try {
        (document.activeElement as HTMLElement | null)?.blur?.();
        canvas.focus();
    } catch {
        // ignore focus errors
    }
    
    // Показываем кнопки способностей и устанавливаем иконку
    abilityButton.style.display = "flex";
    abilityButton.style.alignItems = "center";
    abilityButton.style.justifyContent = "center";
    abilityButtonIcon.textContent = abilityIcons[classId] ?? "⚡";
    
    // projectileButton и slot2Button будут показаны через updateSlot1Button/updateSlot2Button
    // после подключения к комнате и получения состояния игрока
    projectileButton.style.display = "none";
    slot2Button.style.display = "none";

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
            activeRoom = room;
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
        // Сглаженная позиция игрока для управления мышью
        let smoothedPlayerX = 0;
        let smoothedPlayerY = 0;
        let talentSelectionInFlight = false;
        let cardsCollapsed = false;
        let lastLocalMass = 0;

        queueIndicator.onclick = () => {
            cardsCollapsed = false;
        };
        let classSelectMode = false;

        // Логирование для отладки
        console.log("Room joined:", room.id);
        resetSnapshotBuffer();
        const handleStateChange = () => captureSnapshot(room.state);
        room.onStateChange(handleStateChange);
        captureSnapshot(room.state);
        
        const resetClassSelectionUi = () => {
            selectedClassId = -1;
            syncClassCards();
            syncResultsClassButtons();
            updatePlayButton();
        };

        const isValidClassId = (value: unknown) => {
            const id = Number(value);
            return Number.isInteger(id) && id >= 0 && id <= 2;
        };

        const setClassSelectMode = (enabled: boolean) => {
            if (classSelectMode === enabled) return;
            classSelectMode = enabled;

            if (enabled) {
                if (!isValidClassId(selectedClassId)) {
                    resetClassSelectionUi();
                } else {
                    syncClassCards();
                    syncResultsClassButtons();
                    updatePlayButton();
                }

                // В режиме выбора класса отключаем управление и возвращаем UI выбора
                hasFocus = false;
                keyState.up = keyState.down = keyState.left = keyState.right = false;
                mouseState.active = false;
                mouseState.moveX = 0;
                mouseState.moveY = 0;
                sendStopInput();
                detachJoystickPointerListeners();
                resetJoystick();

                // Имя не меняем без переподключения
                nameInput.disabled = true;
                randomNameBtn.disabled = true;

                canvas.style.display = "none";
                hud.style.display = "none";
                abilityButton.style.display = "none";
                projectileButton.style.display = "none";
                slot2Button.style.display = "none";
                abilityCardModal.style.display = "none";
                levelIndicator.style.display = "none";
                talentModal.style.display = "none";
                resultsOverlay.style.display = "none";
                topCenterHud.style.display = "none";
                joinScreen.style.display = "flex";
                return;
            }

            nameInput.disabled = false;
            randomNameBtn.disabled = false;

            joinScreen.style.display = "none";
            canvas.style.display = "block";
            hud.style.display = "block";
            topCenterHud.style.display = "flex";
            abilityButton.style.display = "flex";
            abilityButton.style.alignItems = "center";
            abilityButton.style.justifyContent = "center";
            try {
                (document.activeElement as HTMLElement | null)?.blur?.();
                canvas.focus();
            } catch {
                // ignore focus errors
            }
            hasFocus = true;

            // Иконка способности берётся из актуального classId игрока
            const p = room.state.players.get(room.sessionId);
            const cid = p?.classId ?? 0;
            abilityButtonIcon.textContent = abilityIcons[cid] ?? "⚡";
        };

        const refreshTalentModal = () => {
            if (!localPlayer) {
                talentModal.style.display = "none";
                return;
            }
            
            const card = localPlayer.pendingTalentCard;
            
            if (!card || !card.option0) {
                talentModal.style.display = "none";
                return;
            }

            if (cardsCollapsed) {
                talentModal.style.display = "none";
                return;
            }
            
            talentModal.style.display = "flex";
            
            // Таймер обратного отсчёта
            const serverTick = room.state.serverTick ?? 0;
            const ticksRemaining = Math.max(0, card.expiresAtTick - serverTick);
            const tickRate = balanceConfig.server?.tickRate ?? 30;
            const secondsRemaining = ticksRemaining / tickRate;
            talentTimer.textContent = `Осталось: ${secondsRemaining.toFixed(1)}с`;
            
            // Заголовок с индикатором очереди
            const queueCount = localPlayer.pendingTalentCount ?? 0;
            const queueText = queueCount > 0 ? ` (+${queueCount} ожидает)` : "";
            talentTitle.textContent = `Выбери талант${queueText}`;
            
            // Обновляем кнопки
            const options = [
                { talentId: card.option0, rarity: card.rarity0 },
                { talentId: card.option1, rarity: card.rarity1 },
                { talentId: card.option2, rarity: card.rarity2 }
            ];
            
            for (let i = 0; i < 3; i++) {
                const btn = talentButtonElements[i];
                const opt = options[i];
                
                if (!opt.talentId) {
                    btn.style.display = "none";
                    continue;
                }
                
                btn.style.display = "grid";
                btn.style.gridTemplateColumns = "auto 1fr";
                btn.style.gap = "12px";
                btn.style.alignItems = "center";
                
                const upgrade = parseAbilityUpgradeId(opt.talentId);
                const rarity = opt.rarity ?? 0;
                let rarityColor = rarityColors[rarity] ?? "#6b7280";
                let rarityLabelText = rarityNames[rarity] ?? "Обычный";
                let info = talentInfo[opt.talentId] ?? { name: opt.talentId, icon: "❓", desc: "" };

                if (upgrade) {
                    info = getAbilityUpgradeInfo(upgrade.abilityId, upgrade.level);
                    rarityColor = "#6fd6ff";
                    rarityLabelText = "Улучшение";
                }
                
                // Цвет рамки по редкости
                btn.style.borderColor = rarityColor;
                btn.style.borderWidth = "2px";
                
                btn.innerHTML = "";
                
                // Левая часть: клавиша + иконка
                const leftPart = document.createElement("div");
                leftPart.style.display = "flex";
                leftPart.style.flexDirection = "column";
                leftPart.style.alignItems = "center";
                leftPart.style.gap = "4px";
                
                const keyHint = document.createElement("span");
                keyHint.textContent = String(7 + i);
                keyHint.style.fontSize = "11px";
                keyHint.style.color = "#6a8099";
                keyHint.style.padding = "2px 6px";
                keyHint.style.background = "#1a2636";
                keyHint.style.borderRadius = "4px";
                leftPart.appendChild(keyHint);
                
                const icon = document.createElement("span");
                icon.textContent = info.icon;
                icon.style.fontSize = "28px";
                leftPart.appendChild(icon);
                
                btn.appendChild(leftPart);
                
                // Правая часть: название, редкость, описание
                const rightPart = document.createElement("div");
                rightPart.style.display = "flex";
                rightPart.style.flexDirection = "column";
                rightPart.style.gap = "4px";
                
                const name = document.createElement("span");
                name.textContent = info.name;
                name.style.fontWeight = "700";
                name.style.fontSize = "15px";
                rightPart.appendChild(name);
                
                const rarityLabel = document.createElement("span");
                rarityLabel.textContent = rarityLabelText;
                rarityLabel.style.fontSize = "11px";
                rarityLabel.style.color = rarityColor;
                rarityLabel.style.fontWeight = "600";
                rightPart.appendChild(rarityLabel);
                
                const desc = document.createElement("span");
                desc.textContent = info.desc;
                desc.style.fontSize = "12px";
                desc.style.color = "#9fb5cc";
                rightPart.appendChild(desc);
                if (!upgrade) {
                    const existingTalent = localPlayer.talents?.find((t: any) => t.id === opt.talentId);
                    if (existingTalent) {
                        const levelLabel = document.createElement("span");
                        levelLabel.textContent = `Уровень ${existingTalent.level} -> ${existingTalent.level + 1}`;
                        levelLabel.style.fontSize = "11px";
                        levelLabel.style.color = "#fbbf24";
                        levelLabel.style.fontWeight = "600";
                        rightPart.appendChild(levelLabel);
                    }
                } else {
                    const getAbilityLevel = (abilityId: string) => {
                        if (localPlayer.abilitySlot0 === abilityId) return Number(localPlayer.abilityLevel0 ?? 1);
                        if (localPlayer.abilitySlot1 === abilityId) return Number(localPlayer.abilityLevel1 ?? 1);
                        if (localPlayer.abilitySlot2 === abilityId) return Number(localPlayer.abilityLevel2 ?? 1);
                        return Math.max(1, upgrade.level - 1);
                    };
                    const currentLevel = getAbilityLevel(upgrade.abilityId);
                    const levelLabel = document.createElement("span");
                    levelLabel.textContent = `Уровень ${currentLevel} -> ${upgrade.level}`;
                    levelLabel.style.fontSize = "11px";
                    levelLabel.style.color = "#fbbf24";
                    levelLabel.style.fontWeight = "600";
                    rightPart.appendChild(levelLabel);
                }
                
                btn.appendChild(rightPart);
            }
        };

        const sendTalentChoice = (choice: number) => {
            if (talentSelectionInFlight) return;
            talentSelectionInFlight = true;
            room.send("talentChoice", { choice });
            setTimeout(() => {
                talentSelectionInFlight = false;
                refreshTalentModal();
            }, 300);
            refreshTalentModal();
        };

        const sendAbilityCardChoice = (choiceIndex: number) => {
            room.send("cardChoice", { choice: choiceIndex });
        };

        // Клик по кнопкам выбора таланта
        for (let i = 0; i < talentButtonElements.length; i++) {
            const button = talentButtonElements[i];
            button.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                event.stopPropagation();
                sendTalentChoice(i);
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
            // Сохраняем позицию для эффекта при удалении
            lastChestPositions.set(chest.id, { x: chest.x, y: chest.y, type: chest.type ?? 0 });
            chest.onChange(() => {
                // Обновляем позицию при движении
                lastChestPositions.set(chest.id, { x: chest.x, y: chest.y, type: chest.type ?? 0 });
            });
        });

        room.state.chests.onRemove((_chest: any, key: string) => {
            chestsCount--;
            console.log(`Chest removed, total: ${chestsCount}`);
            // Эффект вспышки и текста при открытии сундука
            const pos = lastChestPositions.get(key);
            if (pos) {
                const style = chestStyles[pos.type] ?? chestStyles[0];
                // Вспышка
                addFlashEffect(pos.x, pos.y, style.glow, chestRadius * 4, 500);
                const reward = pendingChestRewards.get(key);
                if (reward) {
                    addFloatingText(reward.x, reward.y, reward.text, reward.color, 18, 1500);
                    pendingChestRewards.delete(key);
                } else {
                    // Всплывающий текст по умолчанию
                    const rewardText = pos.type === 2 ? "💰 Сокровище!" : pos.type === 1 ? "💎 Награда!" : "🎁 +Талант";
                    addFloatingText(pos.x, pos.y, rewardText, style.fill, 18, 1500);
                }
                lastChestPositions.delete(key);
            }
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

        // Подписка на zones
        room.state.zones.onAdd((zone: any) => {
            zone.onChange(() => {});
        });

        room.state.zones.onRemove(() => {
            // Симметрия с другими коллекциями
        });

        const boostLabels: Record<string, string> = {
            rage: "Ярость",
            haste: "Ускорение",
            guard: "Защита",
            greed: "Жадность",
        };
        const boostIcons: Record<string, string> = {
            rage: "Я",
            haste: "У",
            guard: "З",
            greed: "Ж",
        };
        const boostColors: Record<string, string> = {
            rage: "#f97316",
            haste: "#38bdf8",
            guard: "#facc15",
            greed: "#34d399",
        };

        const getTalentRarity = (talentId: string) => {
            const talents = balanceConfig.talents;
            if (talents?.talentPool?.common?.includes(talentId)) return 0;
            if (talents?.talentPool?.rare?.includes(talentId)) return 1;
            if (talents?.talentPool?.epic?.includes(talentId)) return 2;
            const classTalents = talents?.classTalents ?? {};
            for (const group of Object.values(classTalents)) {
                if (!group) continue;
                const entry = (group as Record<string, { rarity?: string }>)[talentId];
                if (!entry) continue;
                if (entry.rarity === "epic") return 2;
                if (entry.rarity === "rare") return 1;
                if (entry.rarity === "common") return 0;
            }
            return 0;
        };

        let talentRewardTimer: number | null = null;
        const showTalentRewardCard = (talentId: string) => {
            const info = talentInfo[talentId] ?? { name: talentId, icon: "?", desc: "" };
            const rarity = getTalentRarity(talentId);
            const rarityColor = rarityColors[rarity] ?? "#6b7280";
            const rarityLabelText = rarityNames[rarity] ?? "Обычный";

            talentRewardCard.innerHTML = "";
            talentRewardCard.style.borderColor = rarityColor;

            const leftPart = document.createElement("div");
            leftPart.style.display = "flex";
            leftPart.style.flexDirection = "column";
            leftPart.style.alignItems = "center";
            leftPart.style.gap = "4px";

            const icon = document.createElement("div");
            icon.textContent = info.icon;
            icon.style.fontSize = "28px";
            icon.style.width = "36px";
            icon.style.height = "36px";
            icon.style.borderRadius = "10px";
            icon.style.display = "flex";
            icon.style.alignItems = "center";
            icon.style.justifyContent = "center";
            icon.style.background = "rgba(255, 255, 255, 0.08)";
            leftPart.appendChild(icon);

            talentRewardCard.appendChild(leftPart);

            const rightPart = document.createElement("div");
            rightPart.style.display = "flex";
            rightPart.style.flexDirection = "column";
            rightPart.style.gap = "4px";

            const name = document.createElement("div");
            name.textContent = info.name;
            name.style.fontSize = "15px";
            name.style.fontWeight = "600";
            rightPart.appendChild(name);

            const rarityLabel = document.createElement("span");
            rarityLabel.textContent = rarityLabelText;
            rarityLabel.style.fontSize = "11px";
            rarityLabel.style.color = rarityColor;
            rarityLabel.style.fontWeight = "600";
            rightPart.appendChild(rarityLabel);

            const desc = document.createElement("span");
            desc.textContent = info.desc;
            desc.style.fontSize = "12px";
            desc.style.color = "#9fb5cc";
            rightPart.appendChild(desc);

            talentRewardCard.appendChild(rightPart);

            talentRewardPanel.style.display = "flex";
            if (talentRewardTimer) {
                window.clearTimeout(talentRewardTimer);
            }
            talentRewardTimer = window.setTimeout(() => {
                talentRewardPanel.style.display = "none";
                talentRewardTimer = null;
            }, 2400);
        };

        const formatChestRewardText = (payload: ChestRewardPayload) => {
            if (payload.rewardKind === "talent") {
                const talentName = talentInfo[payload.rewardId]?.name ?? payload.rewardId;
                return `🎁 ${talentName}`;
            }
            if (payload.rewardKind === "boost") {
                const boostName = boostLabels[payload.rewardId] ?? payload.rewardId;
                const icon = boostIcons[payload.rewardId] ?? "✨";
                return `${icon} ${boostName}`;
            }
            return "";
        };

        room.onMessage("chestReward", (payload: ChestRewardPayload) => {
            if (!payload || !payload.chestId) return;
            const rewardText = formatChestRewardText(payload);
            if (!rewardText) return;
            const style = chestStyles[payload.type] ?? chestStyles[0];
            const entry = { text: rewardText, color: style.fill, x: payload.x, y: payload.y };
            if (payload.rewardKind === "talent" && payload.rewardId) {
                showTalentRewardCard(payload.rewardId);
            }
            if (lastChestPositions.has(payload.chestId)) {
                pendingChestRewards.set(payload.chestId, entry);
                return;
            }
            addFloatingText(entry.x, entry.y, entry.text, entry.color, 18, 1500);
        });

        const updateHud = () => {
            // Update Top Center HUD (Timer & Kills)
            const timeRem = room.state.timeRemaining ?? 0;
            const minutes = Math.floor(timeRem / 60);
            const seconds = Math.floor(timeRem % 60);
            matchTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const hudPlayer = renderStateForHud?.players.get(room.sessionId) ?? localPlayer;
            if (hudPlayer && hudPlayer.killCount !== undefined && hudPlayer.killCount > 0) {
                killCounter.style.display = "block";
                killCounter.textContent = `☠ ${hudPlayer.killCount}`;
            } else {
                killCounter.style.display = "none";
            }

            const statePlayer = room.state.players.get(room.sessionId);
            if (statePlayer) {
                const flags = Number(statePlayer.flags ?? 0);
                const isDead = (flags & FLAG_IS_DEAD) !== 0;
                const hasRespawnShield = (flags & FLAG_RESPAWN_SHIELD) !== 0;
                if (isDead || hasRespawnShield) {
                    cardsCollapsed = false;
                    lastLocalMass = 0;
                } else {
                    const hasPending =
                        Boolean(statePlayer.pendingAbilityCard?.option0) ||
                        Boolean(statePlayer.pendingTalentCard?.option0) ||
                        ((statePlayer.pendingCardCount ?? 0) + (statePlayer.pendingTalentCount ?? 0) > 0);
                    const currentMass = Number(statePlayer.mass ?? 0);
                    const massLoss = lastLocalMass > 0 ? Math.max(0, lastLocalMass - currentMass) : 0;
                    const tookDamage = massLoss > 0.01;
                    if (tookDamage) {
                        lastDamageTimeMs = performance.now();
                    }
                    const collapseLoss = Math.max(10, lastLocalMass * 0.1);
                    const tookHeavyDamage = massLoss >= collapseLoss;
                    if (hasPending && tookHeavyDamage) {
                        cardsCollapsed = true;
                    }
                    lastLocalMass = currentMass;
                    if (!hasPending) {
                        cardsCollapsed = false;
                    }
                }
            }

            // Update Left HUD (Debug info + Mass)
            const lines: string[] = [];
            // lines.push(`Фаза: ${room.state.phase}`);
            // lines.push(`Время: ${(room.state.timeRemaining ?? 0).toFixed(1)}с`); // Moved to center
            lines.push(`Игроки: ${playersCount}`);
            lines.push(`Орбы: ${orbsCount}/${balanceConfig.orbs.maxCount}`);
            lines.push(`Сундуки: ${chestsCount}/${balanceConfig.chests.maxCount}`);
            lines.push(`Hot Zones: ${hotZonesCount}`);
            
            if (hudPlayer) {
                lines.push(
                    `Моя масса: ${hudPlayer.mass.toFixed(0)} кг`
                );
                // Kill count moved to center
                if (hudPlayer.talentsAvailable > 0) {
                    lines.push(`Таланты: ${hudPlayer.talentsAvailable}`);
                }
                const boostType = String((hudPlayer as any).boostType ?? "");
                if (boostType) {
                    const boostEndTick = Number((hudPlayer as any).boostEndTick ?? 0);
                    const boostCharges = Number((hudPlayer as any).boostCharges ?? 0);
                    const remainingTicks = boostEndTick - Number(room.state.serverTick ?? 0);
                    const remainingSec = remainingTicks / (balanceConfig.server.tickRate || 1);
                    const boostName = boostLabels[boostType] ?? boostType;
                    const iconText = boostIcons[boostType] ?? "!";
                    const iconColor = boostColors[boostType] ?? "#94a3b8";

                    boostIcon.textContent = iconText;
                    boostIcon.style.background = iconColor;

                    boostText.innerHTML = "";
                    const nameLine = document.createElement("div");
                    nameLine.textContent = boostName;
                    boostText.appendChild(nameLine);

                    const detailLine = document.createElement("div");
                    if (boostType === "guard" || boostType === "greed") {
                        detailLine.textContent = `Заряды: ${Math.max(0, boostCharges)}`;
                    } else if (Number.isFinite(remainingSec) && remainingSec > 0) {
                        detailLine.textContent = `Осталось: ${remainingSec.toFixed(1)}с`;
                    } else {
                        detailLine.textContent = "Осталось: 0.0с";
                    }
                    detailLine.style.color = "#9fb5cc";
                    boostText.appendChild(detailLine);

                    boostPanel.style.display = "flex";
                } else {
                    boostPanel.style.display = "none";
                }
            } else {
                boostPanel.style.display = "none";
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
        
        // Обновление индикатора уровня
        const updateLevelIndicator = () => {
            const player = room.state.players.get(room.sessionId);
            if (!player) {
                levelIndicator.style.display = "none";
                return;
            }
            levelIndicator.style.display = "flex";
            const level = player.level ?? 1;
            const thresholds = balanceConfig.slime?.levelThresholds ?? [100, 200, 300, 500, 800];
            const nextThreshold = thresholds[level] ?? null;
            const prevThreshold = level > 0 ? (thresholds[level - 1] ?? 0) : 0;
            
            let progressPct = 0;
            let progressText = " MAX";
            
            if (nextThreshold) {
                const current = Math.max(0, player.mass - prevThreshold);
                const total = nextThreshold - prevThreshold;
                progressPct = Math.min(100, Math.max(0, (current / total) * 100));
                progressText = ` ${player.mass.toFixed(0)}/${nextThreshold}`;
            } else {
                progressPct = 100;
            }
            
            levelText.textContent = `Ур. ${level}${progressText}`;
            levelBarFill.style.width = `${progressPct}%`;
        };

        const updateQueueIndicator = () => {
            const player = room.state.players.get(room.sessionId);
            if (!player) {
                queueIndicator.style.display = "none";
                return;
            }
            
            const pendingCards = player.pendingCardCount ?? 0;
            const pendingTalents = player.pendingTalentCount ?? 0;
            const totalPending = pendingCards + pendingTalents;
            
            if (totalPending > 0) {
                queueIndicator.style.display = "block";
                queueIndicator.textContent = `Карточек: ${totalPending}`;
            } else {
                queueIndicator.style.display = "none";
            }
        };
        
        // Обновление UI карточки выбора умений
        const updateAbilityCardUI = () => {
            const player = room.state.players.get(room.sessionId);
            const card = player?.pendingAbilityCard;
            
            if (!card || !card.option0) {
                abilityCardModal.style.display = "none";
                return;
            }

            if (cardsCollapsed) {
                abilityCardModal.style.display = "none";
                return;
            }
            
            abilityCardModal.style.display = "flex";
            
            // Таймер
            const serverTick = room.state.serverTick ?? 0;
            const ticksRemaining = Math.max(0, card.expiresAtTick - serverTick);
            const tickRate = balanceConfig.server?.tickRate ?? 30;
            const secondsRemaining = ticksRemaining / tickRate;
            abilityCardTimer.textContent = `Осталось: ${secondsRemaining.toFixed(1)}с`;
            
            // Заголовок с номером слота и очередью
            const slotNum = (card.slotIndex ?? 0) + 1;
            const queueCount = player.pendingCardCount ?? 0;
            const queueText = queueCount > 0 ? ` (+${queueCount} ожидает)` : "";
            abilityCardTitle.textContent = `Слот ${slotNum}: выбери умение${queueText}`;
            
            // Обновляем кнопки
            const options = [card.option0, card.option1, card.option2];
            for (let i = 0; i < 3; i++) {
                const btn = abilityCardBtns[i];
                const abilityId = options[i];
                
                if (!abilityId) {
                    btn.style.display = "none";
                    continue;
                }
                
                btn.style.display = "flex";
                const info = abilityNames[abilityId] ?? { name: abilityId, icon: "❓", desc: "" };
                
                btn.innerHTML = "";
                
                const keyHint = document.createElement("span");
                keyHint.textContent = String(7 + i);
                keyHint.style.fontSize = "12px";
                keyHint.style.color = "#6a8099";
                keyHint.style.marginRight = "6px";
                btn.appendChild(keyHint);
                
                const icon = document.createElement("span");
                icon.textContent = info.icon;
                icon.style.fontSize = "20px";
                btn.appendChild(icon);
                
                const textContainer = document.createElement("div");
                textContainer.style.display = "flex";
                textContainer.style.flexDirection = "column";
                
                const name = document.createElement("span");
                name.textContent = info.name;
                name.style.fontWeight = "600";
                textContainer.appendChild(name);
                
                const desc = document.createElement("span");
                desc.textContent = info.desc;
                desc.style.fontSize = "11px";
                desc.style.color = "#9fb5cc";
                textContainer.appendChild(desc);
                
                btn.appendChild(textContainer);
            }
        };
        
        // Обновление кнопки слота 2
        const updateSlot2Button = () => {
            const player = room.state.players.get(room.sessionId);
            if (!player) {
                slot2Button.style.display = "none";
                return;
            }
            
            const abilityId = player.abilitySlot2;
            if (!abilityId) {
                // Слот не разблокирован или пуст
                const level = player.level ?? 1;
                if (level < 5) {
                    slot2Button.style.display = "none";
                } else {
                    slot2Button.style.display = "flex";
                    slot2ButtonIcon.textContent = "🔒";
                }
                return;
            }
            
            slot2Button.style.display = "flex";
            const info = abilityNames[abilityId] ?? { icon: "❓" };
            slot2ButtonIcon.textContent = info.icon;
        };
        
        // Обновление иконки кнопки Slot 1 (projectile или другое умение)
        const updateSlot1Button = () => {
            const player = room.state.players.get(room.sessionId);
            if (!player) return;
            
            const abilityId = player.abilitySlot1;
            if (!abilityId) {
                // Пока слот пуст - скрываем или показываем projectile по умолчанию
                const level = player.level ?? 1;
                if (level < 3) {
                    projectileButton.style.display = "none";
                } else {
                    projectileButton.style.display = "flex";
                    projectileButtonIcon.textContent = "🔒";
                }
                return;
            }
            
            projectileButton.style.display = "flex";
            const info = abilityNames[abilityId] ?? { icon: "💥" };
            projectileButtonIcon.textContent = info.icon;
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

            // Формируем лидерборд
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
                const kills = player.killCount ?? 0;
                row.textContent = `${medal} ${displayName} - ${player.mass.toFixed(0)} кг | 🎯 ${kills}`;
                resultsLeaderboard.appendChild(row);
            }

            // Личная статистика
            const self = room.state.players.get(room.sessionId);
            if (self) {
                resultsPersonalStats.innerHTML = "";
                
                const myRank = room.state.leaderboard.indexOf(room.sessionId) + 1;
                const rankText = myRank > 0 ? `#${myRank}` : "-";
                
                const stats = [
                    { label: "Место", value: rankText, color: "#fff" },
                    { label: "Масса", value: self.mass.toFixed(0), color: "#9be070" },
                    { label: "Убийства", value: self.killCount ?? 0, color: "#ff4d4d" }
                ];
                
                stats.forEach(stat => {
                    const div = document.createElement("div");
                    div.style.display = "flex";
                    div.style.flexDirection = "column";
                    div.style.alignItems = "center";
                    
                    const val = document.createElement("div");
                    val.textContent = String(stat.value);
                    val.style.fontSize = "20px";
                    val.style.fontWeight = "bold";
                    val.style.color = stat.color;
                    
                    const lbl = document.createElement("div");
                    lbl.textContent = stat.label;
                    lbl.style.fontSize = "12px";
                    lbl.style.color = "#9fb5cc";
                    
                    div.appendChild(val);
                    div.appendChild(lbl);
                    resultsPersonalStats.appendChild(div);
                });
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
            const baseScale = Math.min(cw / desiredView.width, ch / desiredView.height);
            const scale = baseScale * cameraZoom;
            
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
            if (document.visibilityState !== "visible") return;
            if (!document.hasFocus()) return;
            const { x, y } = computeMoveInput();
            const changed = Math.abs(x - lastSentInput.x) > 1e-3 || Math.abs(y - lastSentInput.y) > 1e-3;
            if (!changed) return;
            lastSentInput = { x, y };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: x, moveY: y });
        }, inputIntervalMs);

        const drawMinimap = (
            ctx: CanvasRenderingContext2D,
            cw: number,
            ch: number,
            scale: number,
            cameraX: number,
            cameraY: number,
            players: Map<string, any>,
            chests: Map<string, any>,
            hotZones: Map<string, any>,
            slowZones: Map<string, any>,
            toxicPools: Map<string, any>,
            zones: Map<string, any>,
            obstacles: Map<string, any>,
            safeZones: any[],
            rebelId: string
        ) => {
            // Minimap settings (GDD: 15% width)
            const mapW = cw * 0.15;
            const mapH = mapW * (worldHeight / worldWidth);
            const margin = 20;
            const mapX = cw - mapW - margin;
            const mapY = margin;

            ctx.save();
            
            // Background
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(mapX, mapY, mapW, mapH);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1;
            ctx.strokeRect(mapX, mapY, mapW, mapH);

            // Clip to minimap area
            ctx.beginPath();
            ctx.rect(mapX, mapY, mapW, mapH);
            ctx.clip();

            // Coordinate conversion (Y inverted: world Y grows up, canvas Y grows down)
            const worldToMap = (wx: number, wy: number) => {
                const nx = (wx + worldWidth / 2) / worldWidth;
                const ny = (worldHeight / 2 - wy) / worldHeight;
                return {
                    x: mapX + nx * mapW,
                    y: mapY + ny * mapH
                };
            };

            // Draw Generic Zones (New types)
            for (const [, zone] of zones.entries()) {
                const p = worldToMap(zone.x, zone.y);
                const r = (zone.radius / worldWidth) * mapW;
                
                let color = "rgba(200, 200, 200, 0.3)";
                if (zone.type === ZONE_TYPE_NECTAR) color = "rgba(200, 255, 140, 0.3)";
                else if (zone.type === ZONE_TYPE_ICE) color = "rgba(120, 220, 255, 0.3)";
                else if (zone.type === ZONE_TYPE_SLIME) color = "rgba(180, 80, 220, 0.3)";
                else if (zone.type === ZONE_TYPE_LAVA) color = "rgba(255, 120, 50, 0.3)";
                else if (zone.type === ZONE_TYPE_TURBO) color = "rgba(80, 160, 255, 0.3)";
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Hot Zones (Sweet) - Orange с обводкой для отличия от NECTAR
            for (const [, zone] of hotZones.entries()) {
                const p = worldToMap(zone.x, zone.y);
                const r = (zone.radius / worldWidth) * mapW;
                ctx.fillStyle = "rgba(255, 165, 0, 0.35)";
                ctx.strokeStyle = "rgba(255, 140, 0, 0.9)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Draw Slow Zones - Purple
            for (const [, zone] of slowZones.entries()) {
                const p = worldToMap(zone.x, zone.y);
                const r = (zone.radius / worldWidth) * mapW;
                ctx.fillStyle = "rgba(148, 0, 211, 0.3)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Toxic Pools - Green
            for (const [, zone] of toxicPools.entries()) {
                const p = worldToMap(zone.x, zone.y);
                const r = (zone.radius / worldWidth) * mapW;
                ctx.fillStyle = "rgba(34, 197, 94, 0.3)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Obstacles
            for (const [, obstacle] of obstacles.entries()) {
                const p = worldToMap(obstacle.x, obstacle.y);
                const r = (obstacle.radius / worldWidth) * mapW;
                const isSpikes = obstacle.type === OBSTACLE_TYPE_SPIKES;
                const isPillar = obstacle.type === OBSTACLE_TYPE_PILLAR;
                if (isSpikes) {
                    ctx.fillStyle = "rgba(255, 80, 80, 0.7)";
                } else if (isPillar) {
                    ctx.fillStyle = "rgba(160, 160, 160, 0.8)";
                } else {
                    ctx.fillStyle = "rgba(120, 120, 120, 0.7)";
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Safe Zones (if any)
            if (safeZones) {
                for (const zone of safeZones) {
                    const p = worldToMap(zone.x, zone.y);
                    const r = (zone.radius / worldWidth) * mapW;
                    ctx.strokeStyle = "#00ff00";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // Draw Chests
            for (const [, chest] of chests.entries()) {
                const p = worldToMap(chest.x, chest.y);
                const style = chestStyles[chest.type] ?? chestStyles[0];
                ctx.fillStyle = style.fill;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw King
            if (rebelId) {
                const king = players.get(rebelId);
                if (king) {
                    const p = worldToMap(king.x, king.y);
                    ctx.fillStyle = "#ffc857";
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                    // Crown icon
                    ctx.font = "8px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("👑", p.x, p.y - 4);
                }
            }

            // Draw Viewport Rect
            const vpW = cw / scale;
            const vpH = ch / scale;
            const vpLeft = cameraX - vpW / 2;
            const vpTop = cameraY - vpH / 2;
            
            const p1 = worldToMap(vpLeft, vpTop);
            const p2 = worldToMap(vpLeft + vpW, vpTop + vpH);
            
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

            // Draw Self Marker
            const self = players.get(room.sessionId);
            if (self) {
                const p = worldToMap(self.x, self.y);
                ctx.fillStyle = "#6fd6ff";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        };

        const render = () => {
            if (!isRendering) return;
            const now = performance.now();
            const cw = canvas.width;
            const ch = canvas.height;
            const baseScale = Math.min(cw / desiredView.width, ch / desiredView.height);

            // Use U2-style predictive smoothing
            const renderState = getSmoothedRenderState(now);
            renderStateForHud = renderState;
            const playersView = renderState ? renderState.players : room.state.players;
            const orbsView = renderState ? renderState.orbs : room.state.orbs;
            const chestsView = renderState ? renderState.chests : room.state.chests;
            const hotZonesView = renderState ? renderState.hotZones : room.state.hotZones;
            const slowZonesView = renderState ? renderState.slowZones : room.state.slowZones;
            const toxicPoolsView = renderState ? renderState.toxicPools : room.state.toxicPools;
            const projectilesView = renderState ? renderState.projectiles : room.state.projectiles;

            // Камера следит за сглаженной позицией игрока (плавное движение)
            const smoothedPlayer = renderState?.players.get(room.sessionId);
            const targetX = smoothedPlayer ? smoothedPlayer.x : (localPlayer ? localPlayer.x : 0);
            const targetY = smoothedPlayer ? smoothedPlayer.y : (localPlayer ? localPlayer.y : 0);
            // Сохраняем сглаженную позицию для управления мышью
            smoothedPlayerX = targetX;
            smoothedPlayerY = targetY;
            const cameraConfig = balanceConfig.camera ?? DEFAULT_BALANCE_CONFIG.camera;
            const zoomMin = Math.min(cameraConfig.zoomMin, cameraConfig.zoomMax);
            const zoomMax = Math.max(cameraConfig.zoomMin, cameraConfig.zoomMax);
            const zoomMassMin = Math.max(1, cameraConfig.zoomMassMin);
            const zoomMassMax = Math.max(zoomMassMin + 1, cameraConfig.zoomMassMax);
            const rawMass = Number(smoothedPlayer?.mass ?? localPlayer?.mass ?? balanceConfig.slime.initialMass ?? 100);
            const mass = Number.isFinite(rawMass) ? rawMass : (balanceConfig.slime.initialMass ?? 100);
            const massT = clamp((mass - zoomMassMin) / (zoomMassMax - zoomMassMin), 0, 1);
            const targetZoom = zoomMax - (zoomMax - zoomMin) * massT;
            const holdMs = Math.max(0, cameraConfig.zoomDamageHoldSec) * 1000;
            const previousTarget = Number.isFinite(cameraZoomTarget) && cameraZoomTarget > 0 ? cameraZoomTarget : targetZoom;
            let nextZoomTarget = targetZoom;
            if (holdMs > 0 && now - lastDamageTimeMs < holdMs) {
                nextZoomTarget = Math.min(previousTarget, targetZoom);
            }
            const clampedTarget = clamp(nextZoomTarget, zoomMin, zoomMax);
            if (!Number.isFinite(cameraZoom) || lastZoomUpdateMs <= 0) {
                cameraZoomTarget = clampedTarget;
                cameraZoom = clampedTarget;
                lastZoomUpdateMs = now;
            } else {
                cameraZoomTarget = clampedTarget;
                const dtSec = Math.max(0, (now - lastZoomUpdateMs) / 1000);
                lastZoomUpdateMs = now;
                const speed = Math.max(0, cameraConfig.zoomSpeed);
                const lerpFactor = clamp(speed * dtSec, 0, 1);
                cameraZoom += (cameraZoomTarget - cameraZoom) * lerpFactor;
                cameraZoom = clamp(cameraZoom, zoomMin, zoomMax);
            }
            const scale = baseScale * cameraZoom;
            const halfWorldW = cw / scale / 2;
            const halfWorldH = ch / scale / 2;
            const worldHalfW = worldWidth / 2;
            const worldHalfH = worldHeight / 2;
            const maxCamX = Math.max(0, worldHalfW - halfWorldW);
            const maxCamY = Math.max(0, worldHalfH - halfWorldH);
            const clampX = clamp(targetX, -maxCamX, maxCamX);
            const clampY = clamp(targetY, -maxCamY, maxCamY);
            // Камера всегда центрирована на игроке (стиль Agar.io)
            camera.x = clampX;
            camera.y = clampY;

            canvasCtx.clearRect(0, 0, cw, ch);
            drawGrid(scale, camera.x, camera.y, cw, ch);

            // Hunger Zone: красный фон вне Sweet Zones (только в Hunt/Final)
            const time = performance.now() * 0.001;
            const currentPhase = room.state.phase;
            const serverTickRate = balanceConfig.server.tickRate || 1;
            const elapsedSec = Number(room.state.serverTick ?? 0) / serverTickRate;
            const safeZonesConfig = balanceConfig.safeZones ?? DEFAULT_BALANCE_CONFIG.safeZones;
            const safeZonesActive = currentPhase === "Final" && elapsedSec >= safeZonesConfig.finalStartSec;
            
            // Устанавливаем флаг заморозки визуала при Results
            freezeVisualState = currentPhase === "Results";
            
            if ((currentPhase === "Hunt" || currentPhase === "Final") && hotZonesView.size > 0) {
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

            // Sweet Zones (бывшие Hot Zones) - золотой цвет
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

            // Slow Zones (замедление Собирателя) - фиолетовый градиент
            for (const [, zone] of slowZonesView.entries()) {
                if (Math.abs(zone.x - camera.x) > halfWorldW + zone.radius || Math.abs(zone.y - camera.y) > halfWorldH + zone.radius) continue;
                const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                const alpha = zone.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha * 0.5;
                // Фиолетовый градиент
                const gradient = canvasCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, zone.radius * scale);
                gradient.addColorStop(0, "rgba(148, 0, 211, 0.3)");
                gradient.addColorStop(0.7, "rgba(148, 0, 211, 0.15)");
                gradient.addColorStop(1, "rgba(148, 0, 211, 0)");
                canvasCtx.fillStyle = gradient;
                canvasCtx.beginPath();
                canvasCtx.arc(p.x, p.y, zone.radius * scale, 0, Math.PI * 2);
                canvasCtx.fill();
                // Обводка
                canvasCtx.strokeStyle = "rgba(148, 0, 211, 0.6)";
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
                canvasCtx.restore();
            }

            // Toxic Pools - зелёный градиент
            for (const [, pool] of toxicPoolsView.entries()) {
                if (Math.abs(pool.x - camera.x) > halfWorldW + pool.radius || Math.abs(pool.y - camera.y) > halfWorldH + pool.radius) continue;
                const p = worldToScreen(pool.x, pool.y, scale, camera.x, camera.y, cw, ch);
                const alpha = pool.alpha ?? 1;
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha * 0.55;
                const gradient = canvasCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pool.radius * scale);
                gradient.addColorStop(0, "rgba(34, 197, 94, 0.35)");
                gradient.addColorStop(0.7, "rgba(34, 197, 94, 0.15)");
                gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
                canvasCtx.fillStyle = gradient;
                canvasCtx.beginPath();
                canvasCtx.arc(p.x, p.y, pool.radius * scale, 0, Math.PI * 2);
                canvasCtx.fill();
                canvasCtx.strokeStyle = "rgba(34, 197, 94, 0.6)";
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
                canvasCtx.restore();
            }

            // Зоны эффектов
            const zonesView = room.state.zones;
            if (zonesView && zonesView.size > 0) {
                for (const [, zone] of zonesView.entries()) {
                    if (Math.abs(zone.x - camera.x) > halfWorldW + zone.radius || Math.abs(zone.y - camera.y) > halfWorldH + zone.radius) continue;
                    const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                    let fill = "rgba(200, 200, 200, 0.12)";
                    let stroke = "rgba(120, 120, 120, 0.5)";
                    if (zone.type === ZONE_TYPE_NECTAR) {
                        fill = "rgba(200, 255, 140, 0.16)";
                        stroke = "rgba(140, 220, 80, 0.55)";
                    } else if (zone.type === ZONE_TYPE_ICE) {
                        fill = "rgba(120, 220, 255, 0.16)";
                        stroke = "rgba(80, 180, 255, 0.55)";
                    } else if (zone.type === ZONE_TYPE_SLIME) {
                        fill = "rgba(180, 80, 220, 0.16)";
                        stroke = "rgba(130, 50, 200, 0.6)";
                    } else if (zone.type === ZONE_TYPE_LAVA) {
                        const pulse = 0.2 + 0.2 * Math.sin(time * 4);
                        fill = `rgba(255, 120, 50, ${0.18 + pulse * 0.2})`;
                        stroke = `rgba(255, 60, 20, ${0.6 + pulse * 0.4})`;
                    } else if (zone.type === ZONE_TYPE_TURBO) {
                        fill = "rgba(80, 160, 255, 0.16)";
                        stroke = "rgba(40, 120, 255, 0.55)";
                    }
                    drawCircle(p.x, p.y, zone.radius * scale, fill, stroke);
                }
            }

            // Безопасные зоны (финал)
            const safeZonesView = room.state.safeZones;
            if (safeZonesView) {
                const pulse = safeZonesActive ? 0.2 * Math.sin(time * 2) : 0;
                const fillAlpha = safeZonesActive ? 0.12 + pulse : 0.06;
                const strokeAlpha = safeZonesActive ? 0.7 : 0.4;
                for (const zone of safeZonesView) {
                    if (Math.abs(zone.x - camera.x) > halfWorldW + zone.radius || Math.abs(zone.y - camera.y) > halfWorldH + zone.radius) continue;
                    const p = worldToScreen(zone.x, zone.y, scale, camera.x, camera.y, cw, ch);
                    canvasCtx.save();
                    canvasCtx.globalAlpha = 1;
                    drawCircle(p.x, p.y, zone.radius * scale, `rgba(80, 220, 120, ${fillAlpha})`, `rgba(60, 200, 100, ${strokeAlpha})`);
                    canvasCtx.restore();
                }
            }

            // Препятствия
            const obstaclesView = room.state.obstacles;
            for (const [, obstacle] of obstaclesView.entries()) {
                if (Math.abs(obstacle.x - camera.x) > halfWorldW + obstacle.radius || Math.abs(obstacle.y - camera.y) > halfWorldH + obstacle.radius) continue;
                const p = worldToScreen(obstacle.x, obstacle.y, scale, camera.x, camera.y, cw, ch);
                const r = Math.max(6, obstacle.radius * scale);
                const isSpikes = obstacle.type === OBSTACLE_TYPE_SPIKES;
                const isPillar = obstacle.type === OBSTACLE_TYPE_PILLAR;
                
                if (isSpikes) {
                    // Шипастое препятствие: тёмная основа + серые шипы (не путать с красными пузырями)
                    const spikeCount = 12;
                    const innerR = r * 0.7;
                    const outerR = r * 1.15;
                    
                    // Тёмная основа
                    drawCircle(p.x, p.y, innerR, "rgba(50, 50, 50, 0.95)", "rgba(30, 30, 30, 1)");
                    
                    // Серые металлические шипы (треугольники)
                    canvasCtx.fillStyle = "rgba(120, 120, 120, 0.95)";
                    canvasCtx.strokeStyle = "rgba(180, 180, 180, 1)";
                    canvasCtx.lineWidth = 1;
                    for (let i = 0; i < spikeCount; i++) {
                        const angle = (i / spikeCount) * Math.PI * 2;
                        const nextAngle = ((i + 0.5) / spikeCount) * Math.PI * 2;
                        const prevAngle = ((i - 0.5) / spikeCount) * Math.PI * 2;
                        
                        // Точка шипа
                        const tipX = p.x + Math.cos(angle) * outerR;
                        const tipY = p.y + Math.sin(angle) * outerR;
                        // Основание шипа
                        const base1X = p.x + Math.cos(prevAngle) * innerR;
                        const base1Y = p.y + Math.sin(prevAngle) * innerR;
                        const base2X = p.x + Math.cos(nextAngle) * innerR;
                        const base2Y = p.y + Math.sin(nextAngle) * innerR;
                        
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(tipX, tipY);
                        canvasCtx.lineTo(base1X, base1Y);
                        canvasCtx.lineTo(base2X, base2Y);
                        canvasCtx.closePath();
                        canvasCtx.fill();
                        canvasCtx.stroke();
                    }
                    
                    // Предупреждающий символ в центре
                    canvasCtx.fillStyle = "rgba(255, 200, 50, 0.9)";
                    canvasCtx.font = `bold ${Math.max(10, r * 0.5)}px Arial`;
                    canvasCtx.textAlign = "center";
                    canvasCtx.textBaseline = "middle";
                    canvasCtx.fillText("⚠", p.x, p.y);
                } else {
                    // Обычный столб или pillar
                    const fill = isPillar
                        ? "rgba(140, 140, 140, 0.85)"
                        : "rgba(110, 110, 110, 0.7)";
                    const stroke = isPillar
                        ? "rgba(80, 80, 80, 0.9)"
                        : "rgba(60, 60, 60, 0.7)";
                    drawCircle(p.x, p.y, r, fill, stroke);
                }
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
                
                // GDD v3.3: Отрисовка обручей (armorRings)
                const rings = chest.armorRings ?? 0;
                if (rings > 0) {
                    canvasCtx.strokeStyle = "#888";
                    canvasCtx.lineWidth = 2;
                    for (let i = 0; i < rings; i++) {
                        const ringR = r * (1.2 + i * 0.25);
                        canvasCtx.beginPath();
                        canvasCtx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
                        canvasCtx.stroke();
                    }
                }
                
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
                // Bomb (projectileType = 1) - оранжевый
                const isMine = proj.ownerId === room.sessionId;
                const isBomb = proj.projectileType === 1;
                let fillColor: string;
                let strokeColor: string;
                if (isBomb) {
                    fillColor = "rgba(255, 165, 0, 0.9)";
                    strokeColor = "#ff8c00";
                } else {
                    fillColor = isMine ? "rgba(100, 220, 255, 0.9)" : "rgba(255, 100, 100, 0.9)";
                    strokeColor = isMine ? "#64dcff" : "#ff6464";
                }
                
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                canvasCtx.shadowColor = strokeColor;
                canvasCtx.shadowBlur = isBomb ? 12 : 8;
                drawCircle(p.x, p.y, r, fillColor, strokeColor);
                canvasCtx.shadowBlur = 0;
                canvasCtx.restore();
            }
            
            // Рендеринг мин
            const minesView = renderState ? renderState.mines : room.state.mines;
            if (minesView) {
                for (const [, mine] of minesView.entries()) {
                    if (Math.abs(mine.x - camera.x) > halfWorldW + 50 || Math.abs(mine.y - camera.y) > halfWorldH + 50) continue;
                    const p = worldToScreen(mine.x, mine.y, scale, camera.x, camera.y, cw, ch);
                    const r = Math.max(6, mine.radius * scale);
                    const alpha = mine.alpha ?? 1;
                    if (alpha <= 0.01) continue;
                    
                    const isMine = mine.ownerId === room.sessionId;
                    const fillColor = isMine ? "rgba(180, 100, 255, 0.7)" : "rgba(255, 50, 50, 0.7)";
                    const strokeColor = isMine ? "#b464ff" : "#ff3232";
                    
                    canvasCtx.save();
                    canvasCtx.globalAlpha = alpha;
                    
                    // Пульсирующий эффект
                    const pulse = 1 + 0.15 * Math.sin(time * 6);
                    const pulseR = r * pulse;
                    
                    // Внешний круг (зона детонации)
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
                    canvasCtx.strokeStyle = strokeColor;
                    canvasCtx.lineWidth = 2;
                    canvasCtx.setLineDash([4, 4]);
                    canvasCtx.stroke();
                    canvasCtx.setLineDash([]);
                    
                    // Внутренний круг (ядро)
                    canvasCtx.shadowColor = strokeColor;
                    canvasCtx.shadowBlur = 10;
                    drawCircle(p.x, p.y, r * 0.5, fillColor, strokeColor);
                    canvasCtx.shadowBlur = 0;
                    
                    // Иконка
                    canvasCtx.fillStyle = "#fff";
                    canvasCtx.font = `${Math.max(10, r * 0.6)}px "IBM Plex Mono", monospace`;
                    canvasCtx.textAlign = "center";
                    canvasCtx.textBaseline = "middle";
                    canvasCtx.fillText("💀", p.x, p.y);
                    
                    canvasCtx.restore();
                }
            }

            for (const [id, player] of playersView.entries()) {
                if (Math.abs(player.x - camera.x) > halfWorldW + 200 || Math.abs(player.y - camera.y) > halfWorldH + 200) continue;
                const p = worldToScreen(player.x, player.y, scale, camera.x, camera.y, cw, ch);
                const classRadiusMult = player.classId === 2 ? collectorRadiusMult : 1;
                const slimeConfig = getSlimeConfigForPlayer(player.classId);
                const baseRadius = getSlimeRadiusFromConfig(player.mass, slimeConfig);
                const isSelf = id === room.sessionId;
                const isInvisible = (player.flags & FLAG_INVISIBLE) !== 0;
                if (isInvisible && !isSelf) continue;
                const leviathanMul = (player.flags & FLAG_LEVIATHAN) !== 0 ? getLeviathanRadiusMul() : 1;
                const radius = baseRadius * classRadiusMult * leviathanMul * scale;
                const isRebel = id === room.state.rebelId || (player.flags & FLAG_IS_REBEL) !== 0;
                const color = isSelf ? "#6fd6ff" : "#9be070";
                const stroke = player.flags & FLAG_IS_DEAD ? "#555" : isSelf ? "#1ea6ff" : "#6ac96f";
                const r = radius;
                const angleRad = player.angle ?? 0;
                const spriteName = playerSpriteById.get(id) ?? pickSpriteForPlayer(id);
                const sprite = loadSprite(spriteName);
                let alpha = player.alpha ?? 1;
                if (isInvisible && isSelf) {
                    alpha *= 0.5;
                }
                if (alpha <= 0.01) continue;
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                
                // Визуализация респаун-щита
                if ((player.flags & FLAG_RESPAWN_SHIELD) !== 0) {
                    const shieldR = r * 1.6;
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, shieldR, 0, Math.PI * 2);
                    canvasCtx.fillStyle = `rgba(100, 200, 255, ${0.2 + 0.1 * Math.sin(time * 10)})`;
                    canvasCtx.fill();
                    canvasCtx.strokeStyle = `rgba(150, 220, 255, ${0.5 + 0.2 * Math.sin(time * 10)})`;
                    canvasCtx.lineWidth = 2;
                    canvasCtx.stroke();
                }

                // Визуализация золотого свечения Короля
                if (isRebel) {
                    const glowR = r * 1.4;
                    const glowAlpha = 0.3 + 0.1 * Math.sin(time * 5);
                    const gradient = canvasCtx.createRadialGradient(p.x, p.y, r, p.x, p.y, glowR);
                    gradient.addColorStop(0, `rgba(255, 215, 0, ${glowAlpha})`);
                    gradient.addColorStop(1, "rgba(255, 215, 0, 0)");
                    
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
                    canvasCtx.fillStyle = gradient;
                    canvasCtx.fill();
                }

                // Визуализация рывка охотника - реактивные следы
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
                    // Точка притяжения — впереди рта (0.9 до рта + 1.0 перед ртом = 1.9 радиуса)
                    // Y инвертирован (экранные координаты: Y вниз, world: Y вверх)
                    const mouthOffset = r * 1.9;
                    const mouthX = p.x + Math.cos(angleRad) * mouthOffset;
                    const mouthY = p.y - Math.sin(angleRad) * mouthOffset;
                    // Внешний круг (вокруг пасти)
                    canvasCtx.beginPath();
                    canvasCtx.arc(mouthX, mouthY, magnetRadius, 0, Math.PI * 2);
                    canvasCtx.strokeStyle = "rgba(138, 43, 226, 0.6)";
                    canvasCtx.lineWidth = 3;
                    canvasCtx.setLineDash([10, 5]);
                    canvasCtx.stroke();
                    canvasCtx.setLineDash([]);
                    // Внутреннее свечение
                    const gradient = canvasCtx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, magnetRadius);
                    gradient.addColorStop(0, "rgba(138, 43, 226, 0.2)");
                    gradient.addColorStop(0.7, "rgba(138, 43, 226, 0.1)");
                    gradient.addColorStop(1, "rgba(138, 43, 226, 0)");
                    canvasCtx.beginPath();
                    canvasCtx.arc(mouthX, mouthY, magnetRadius, 0, Math.PI * 2);
                    canvasCtx.fillStyle = gradient;
                    canvasCtx.fill();
                    // Магнитные линии (от пасти)
                    canvasCtx.strokeStyle = "rgba(200, 100, 255, 0.4)";
                    canvasCtx.lineWidth = 1;
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        const innerR = r * 0.5;
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(mouthX + Math.cos(angle) * innerR, mouthY + Math.sin(angle) * innerR);
                        canvasCtx.lineTo(mouthX + Math.cos(angle) * magnetRadius * 0.9, mouthY + Math.sin(angle) * magnetRadius * 0.9);
                        canvasCtx.stroke();
                    }
                }

                if ((player.flags & FLAG_PUSHING) !== 0) {
                    const pushRadius = (balanceConfig.abilities?.push?.radiusM ?? 80) * scale;
                    const pulse = 1 + 0.08 * Math.sin(time * 10);
                    const ringRadius = pushRadius * pulse;
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
                    canvasCtx.strokeStyle = "rgba(120, 220, 255, 0.7)";
                    canvasCtx.lineWidth = 3;
                    canvasCtx.setLineDash([8, 6]);
                    canvasCtx.shadowColor = "rgba(120, 220, 255, 0.8)";
                    canvasCtx.shadowBlur = 12;
                    canvasCtx.stroke();
                    canvasCtx.setLineDash([]);
                    canvasCtx.shadowBlur = 0;

                    const gradient = canvasCtx.createRadialGradient(p.x, p.y, r, p.x, p.y, ringRadius);
                    gradient.addColorStop(0, "rgba(120, 220, 255, 0.15)");
                    gradient.addColorStop(0.6, "rgba(120, 220, 255, 0.08)");
                    gradient.addColorStop(1, "rgba(120, 220, 255, 0)");
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
                    canvasCtx.fillStyle = gradient;
                    canvasCtx.fill();
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

            // Обновление индикаторов кулдауна
            const tickRate = balanceConfig.server?.tickRate ?? 30;
            const serverTick = room.state.serverTick ?? 0;
            updateCooldownUi(abilityCooldownUi, {
                abilityId: localPlayer?.abilitySlot0,
                classId: localPlayer?.classId,
                cooldownStartTick: localPlayer?.abilityCooldownStartTick0,
                cooldownEndTick: localPlayer?.abilityCooldownEndTick0,
                serverTick,
                tickRate,
            });
            updateCooldownUi(projectileCooldownUi, {
                abilityId: localPlayer?.abilitySlot1,
                classId: localPlayer?.classId,
                cooldownStartTick: localPlayer?.abilityCooldownStartTick1,
                cooldownEndTick: localPlayer?.abilityCooldownEndTick1,
                serverTick,
                tickRate,
            });
            updateCooldownUi(slot2CooldownUi, {
                abilityId: localPlayer?.abilitySlot2,
                classId: localPlayer?.classId,
                cooldownStartTick: localPlayer?.abilityCooldownStartTick2,
                cooldownEndTick: localPlayer?.abilityCooldownEndTick2,
                serverTick,
                tickRate,
            });

            // Отрисовка эффектов вспышки (в мировых координатах)
            const nowMs = performance.now();
            for (let i = flashEffects.length - 1; i >= 0; i--) {
                const fx = flashEffects[i];
                const elapsed = nowMs - fx.startMs;
                if (elapsed > fx.durationMs) {
                    flashEffects.splice(i, 1);
                    continue;
                }
                const progress = elapsed / fx.durationMs;
                const alpha = 1 - progress;
                const currentRadius = fx.radius * (1 + progress * 0.5);
                const screenPos = worldToScreen(fx.x, fx.y, scale, camera.x, camera.y, cw, ch);
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha * 0.8;
                const gradient = canvasCtx.createRadialGradient(
                    screenPos.x, screenPos.y, 0,
                    screenPos.x, screenPos.y, currentRadius * scale
                );
                gradient.addColorStop(0, fx.color);
                gradient.addColorStop(1, "transparent");
                canvasCtx.fillStyle = gradient;
                canvasCtx.beginPath();
                canvasCtx.arc(screenPos.x, screenPos.y, currentRadius * scale, 0, Math.PI * 2);
                canvasCtx.fill();
                canvasCtx.restore();
            }

            // Отрисовка всплывающих текстов
            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                const elapsed = nowMs - ft.startMs;
                if (elapsed > ft.durationMs) {
                    floatingTexts.splice(i, 1);
                    continue;
                }
                const progress = elapsed / ft.durationMs;
                const alpha = 1 - progress;
                const yOffset = -30 * progress; // Поднимается вверх
                const screenPos = worldToScreen(ft.x, ft.y + yOffset, scale, camera.x, camera.y, cw, ch);
                canvasCtx.save();
                canvasCtx.globalAlpha = alpha;
                canvasCtx.font = `bold ${ft.fontSize}px Arial, sans-serif`;
                canvasCtx.textAlign = "center";
                canvasCtx.textBaseline = "middle";
                // Тень для читаемости
                canvasCtx.shadowColor = "rgba(0,0,0,0.8)";
                canvasCtx.shadowBlur = 4;
                canvasCtx.shadowOffsetX = 1;
                canvasCtx.shadowOffsetY = 1;
                canvasCtx.fillStyle = ft.color;
                canvasCtx.fillText(ft.text, screenPos.x, screenPos.y);
                canvasCtx.restore();
            }

            // Minimap
            drawMinimap(
                canvasCtx,
                cw,
                ch,
                scale,
                camera.x,
                camera.y,
                playersView,
                chestsView,
                hotZonesView,
                slowZonesView,
                toxicPoolsView,
                room.state.zones,
                room.state.obstacles,
                room.state.safeZones,
                room.state.rebelId
            );

            rafId = requestAnimationFrame(render);
        };

        const sendStopInput = () => {
            lastSentInput = { x: 0, y: 0 };
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: 0, moveY: 0 });
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (document.visibilityState !== "visible") return;
            if (!document.hasFocus()) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.repeat) return;
            if (classSelectMode) return;
            const key = event.key.toLowerCase();
            hasFocus = true;
            
            // Способность активируется клавишей 1 (slot 0 - классовая способность)
            if (key === "1") {
                inputSeq += 1;
                room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 0 });
                event.preventDefault();
                return;
            }
            
            // Выброс активируется клавишей 2 (slot 1)
            if (key === "2") {
                inputSeq += 1;
                room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 1 });
                event.preventDefault();
                return;
            }
            
            // Slot 2 активируется клавишей 3
            if (key === "3") {
                inputSeq += 1;
                room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 2 });
                event.preventDefault();
                return;
            }
            
            // Выбор из карточки умений или талантов клавишами 7/8/9
            if (key === "7" || key === "8" || key === "9") {
                const choiceIndex = parseInt(key) - 7; // 7->0, 8->1, 9->2
                
                // Проверяем, что открыто: карточка умений или талантов
                const player = room.state.players.get(room.sessionId);
                const hasAbilityCard = player?.pendingAbilityCard && player.pendingAbilityCard.option0;
                const hasTalentCard = player?.pendingTalentCard && player.pendingTalentCard.option0;
                
                if (hasTalentCard) {
                    // Отправляем выбор таланта
                    sendTalentChoice(choiceIndex);
                } else if (hasAbilityCard) {
                    // Отправляем выбор умения
                    sendAbilityCardChoice(choiceIndex);
                }
                
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
            
            // Мышь не активирует джойстик — управление мышью: курсор задаёт направление
            if (isMousePointer) return;
            
            if (!isTouchPointer && !isCoarse) return;
            if (joystickState.active) return;
            
            const gate = getJoystickActivationGate();
            if (event.clientX > gate.maxX) return;
            if (event.clientY < gate.minY) return;
            
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
        
        const onFocus = () => {
            if (classSelectMode) return;
            hasFocus = true;
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
            // Не активируем если уже активен джойстик (touch имеет приоритет)
            if (joystickState.active) return;
            if (classSelectMode) return;
            
            hasFocus = true;
            mouseState.active = true;
            mouseState.screenX = event.clientX;
            mouseState.screenY = event.clientY;
        };

        const onMouseLeave = (event: MouseEvent) => {
            if (document.visibilityState !== "visible") return;
            if (!document.hasFocus()) return;
            if (classSelectMode) return;
            const rect = canvas.getBoundingClientRect();
            mouseState.active = true;
            mouseState.screenX = clamp(event.clientX, rect.left + 1, rect.right - 1);
            mouseState.screenY = clamp(event.clientY, rect.top + 1, rect.bottom - 1);
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
        
        // Обработчик кнопки Slot 2
        const onSlot2ButtonClick = () => {
            inputSeq += 1;
            room.send("input", { seq: inputSeq, moveX: lastSentInput.x, moveY: lastSentInput.y, abilitySlot: 2 });
        };
        slot2Button.addEventListener("click", onSlot2ButtonClick);
        
        // Обработчики кнопок карточки умений
        const onAbilityCardChoice = (choiceIndex: number) => {
            sendAbilityCardChoice(choiceIndex);
        };
        for (let i = 0; i < abilityCardBtns.length; i++) {
            const btn = abilityCardBtns[i];
            btn.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                event.stopPropagation();
                onAbilityCardChoice(i);
            });
        }

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
        canvas.addEventListener("mousemove", onMouseMove, { passive: true });
        canvas.addEventListener("mouseleave", onMouseLeave, { passive: true });
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onVisibilityChange);

        updateHud();
        updateResultsOverlay();
        refreshTalentModal();
        updateLevelIndicator();
        updateAbilityCardUI();
        updateSlot1Button();
        updateSlot2Button();
        render();

        const hudTimer = setInterval(() => {
            updateHud();
            updateResultsOverlay();
            refreshTalentModal();
            updateLevelIndicator();
            updateQueueIndicator();
            updateAbilityCardUI();
            updateSlot1Button();
            updateSlot2Button();
            
            const phase = room.state.phase;
            const selfPlayer = room.state.players.get(room.sessionId);
            if (phase !== "Results" && selfPlayer) {
                if (!isValidClassId(selfPlayer.classId)) {
                    // Между матчами класс сбрасывается на сервере - возвращаем экран выбора
                    if (!nameInput.disabled) {
                        nameInput.value = String(selfPlayer.name ?? nameInput.value);
                    }
                    setClassSelectMode(true);
                } else {
                    setClassSelectMode(false);
                }
            }
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
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            abilityButton.removeEventListener("click", onAbilityButtonClick);
            projectileButton.removeEventListener("click", onProjectileButtonClick);
            slot2Button.removeEventListener("click", onSlot2ButtonClick);
            
            // Hide HUD elements
            hud.style.display = "none";
            topCenterHud.style.display = "none";
            queueIndicator.style.display = "none";
            levelIndicator.style.display = "none";
            
            activeRoom = null;
            
            // Показываем экран выбора при отключении
            canvas.style.display = "none";
            hud.style.display = "none";
            abilityButton.style.display = "none";
            projectileButton.style.display = "none";
            slot2Button.style.display = "none";
            abilityCardModal.style.display = "none";
            levelIndicator.style.display = "none";
            joinScreen.style.display = "flex";
        });
    } catch (e) {
        hud.textContent = `Ошибка подключения: ${e}`;
        console.error(e);
        // Вернём экран выбора при ошибке
        canvas.style.display = "none";
        hud.style.display = "none";
        topCenterHud.style.display = "none";
        joinScreen.style.display = "flex";
    }
}

// Обработчик кнопки "Играть"
playButton.addEventListener("click", () => {
    if (playButton.disabled || selectedClassId < 0 || selectedClassId > 2) {
        return; // Класс не выбран
    }
    if (activeRoom) {
        activeRoom.send("selectClass", { classId: selectedClassId });
        return;
    }
    const name = nameInput.value.trim() || generateRandomName();
    connectToServer(name, selectedClassId);
});
