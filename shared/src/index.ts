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

export const GAME_CONFIG = {
    TICK_RATE: 30,
    MAP_SIZE: 2000,
    INITIAL_MASS: 100,
    MAX_PLAYERS: 20
};
