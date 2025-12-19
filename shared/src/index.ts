export interface Point {
    x: number;
    y: number;
}

export interface SlimeState {
    id: string;
    name: string;
    x: number;
    y: number;
    mass: number;
    angle: number;
    hp: number;
    maxHp: number;
}

export interface InputData {
    seq: number;
    moveX: number;
    moveY: number;
    abilitySlot?: number;
}

export const GAME_CONFIG = {
    TICK_RATE: 30,
    MAP_SIZE: 2000,
    INITIAL_MASS: 100,
    MAX_PLAYERS: 20,
    BASE_SPEED: 300, // пикселей в секунду
    BASE_ROTATION: 180, // градусов в секунду
    FRICTION: 0.95, // линейное затухание
    DRIFT_THRESHOLD: 120,
    DRIFT_DURATION: 300, // мс
    DRIFT_SPEED_LOSS: 0.5,
    DRIFT_COOLDOWN: 500, // мс
    WALL_RESTITUTION: 0.5, // коэффициент отскока
    // Пузыри (Orbs)
    ORB_MAX_COUNT: 150,
    ORB_SPAWN_INTERVAL: 500, // мс
    ORB_MIN_MASS: 5,
    ORB_MAX_MASS: 30,
    ORB_BASE_RADIUS: 5,
    ORB_FRICTION: 0.98,
    // Плотности по цветам (влияют на радиус при той же массе)
    ORB_DENSITY: {
        GREEN: 1.0,
        BLUE: 1.2,
        RED: 0.8,
        GOLD: 1.5,
    },
    // Вероятности спавна по цветам
    ORB_SPAWN_WEIGHTS: {
        GREEN: 50,
        BLUE: 30,
        RED: 15,
        GOLD: 5,
    },
    // Поедание (Eating)
    BITE_COOLDOWN: 100, // мс между укусами
    BITE_AMOUNT: 0.3, // доля массы пузыря за один укус
    BITE_MIN_REMAINDER: 3, // минимальный остаток пузыря
    MOUTH_ANGLE: 60, // угол зоны пасти (градусы)
    // Боевая система (Combat)
    TAIL_ANGLE: 60, // угол зоны хвоста (градусы)
    I_FRAMES_DURATION: 500, // мс неуязвимости после урона
    ATTACK_COOLDOWN: 200, // мс между атаками
    MASS_STEAL_PERCENT: 0.1, // 10% от нанесенного урона в массу
    // Смерть и Респаун
    RESPAWN_TIME: 2000, // мс
    RESPAWN_SHIELD_DURATION: 5000, // мс щита при респауне
    DEATH_MASS_LOST: 0.5, // 50% массы теряется
    DEATH_MASS_TO_ORBS: 0.3, // 30% массы в пузыри
    DEATH_ORBS_COUNT: 4, // кол-во пузырей при смерти
    MIN_RESPAWN_MASS: 50, // минимальная масса при респауне
};

// Формулы из GDD
export function getSlimeHP(mass: number): number {
    return 50 + 50 * Math.log(1 + mass / 100);
}

export function getSlimeDamage(mass: number): number {
    return 10 + 10 * Math.log(1 + mass / 100);
}

export function getSlimeRadius(mass: number): number {
    return 10 * Math.sqrt(1 + Math.log(1 + mass / 50));
}
