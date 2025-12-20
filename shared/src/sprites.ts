// Sprite-related constants and utilities for slime skins

export interface SlimeSprite {
    idle: string;
    moving: string;
    eating?: string;
    damaged?: string;
    attacking?: string; // для Warrior
    absorbing?: string; // для Collector
    hunting?: string; // для Hunter
}

export const SLIME_SPRITES: Record<number, SlimeSprite> = {
    // Base класс (classId = 0)
    0: {
        idle: "/sprites/slimes/base/slime-idle.png",
        moving: "/sprites/slimes/base/slime-moving.png",
        eating: "/sprites/slimes/base/slime-eating.png",
        damaged: "/sprites/slimes/base/slime-damaged.png",
    },
    // Warrior (classId = 1)
    1: {
        idle: "/sprites/slimes/warrior/warrior-idle.png",
        moving: "/sprites/slimes/warrior/warrior-moving.png",
        attacking: "/sprites/slimes/warrior/warrior-attacking.png",
        damaged: "/sprites/slimes/warrior/warrior-damaged.png",
    },
    // Collector (classId = 2)
    2: {
        idle: "/sprites/slimes/collector/collector-idle.png",
        moving: "/sprites/slimes/collector/collector-moving.png",
        absorbing: "/sprites/slimes/collector/collector-absorbing.png",
        damaged: "/sprites/slimes/collector/collector-damaged.png",
    },
    // Hunter (classId = 3)
    3: {
        idle: "/sprites/slimes/hunter/hunter-idle.png",
        moving: "/sprites/slimes/hunter/hunter-moving.png",
        hunting: "/sprites/slimes/hunter/hunter-hunting.png",
        damaged: "/sprites/slimes/hunter/hunter-damaged.png",
    },
};

export const SPRITE_SIZE = 256; // размер спрайта в пикселях
export const SPRITE_CACHE = new Map<string, HTMLImageElement>();

/**
 * Загружает спрайт в кеш
 */
export function loadSprite(url: string): Promise<HTMLImageElement> {
    if (SPRITE_CACHE.has(url)) {
        return Promise.resolve(SPRITE_CACHE.get(url)!);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            SPRITE_CACHE.set(url, img);
            resolve(img);
        };
        img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
        img.src = url;
    });
}

/**
 * Загружает все спрайты для класса
 */
export async function loadClassSprites(classId: number): Promise<void> {
    const sprites = SLIME_SPRITES[classId];
    if (!sprites) return;

    const urls = Object.values(sprites).filter((url): url is string => url !== undefined);
    await Promise.all(urls.map(url => loadSprite(url)));
}

/**
 * Получает спрайт для состояния игрока
 */
export function getPlayerSprite(
    classId: number,
    state: "idle" | "moving" | "eating" | "damaged" | "attacking" | "absorbing" | "hunting"
): string | undefined {
    const sprites = SLIME_SPRITES[classId];
    if (!sprites) return undefined;

    // Первоприоритет - спец-состояние
    if (state === "attacking" && "attacking" in sprites) return sprites.attacking;
    if (state === "absorbing" && "absorbing" in sprites) return sprites.absorbing;
    if (state === "hunting" && "hunting" in sprites) return sprites.hunting;
    if (state === "eating" && "eating" in sprites) return sprites.eating;

    // Обычные состояния
    if (state === "damaged" && sprites.damaged) return sprites.damaged;
    if (state === "moving" && sprites.moving) return sprites.moving;

    // Fallback на idle
    return sprites.idle;
}
