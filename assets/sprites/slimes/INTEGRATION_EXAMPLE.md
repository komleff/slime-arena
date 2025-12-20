// Example: How to integrate slime sprites into client rendering

import { getPlayerSprite, loadClassSprites } from "@slime-arena/shared";

/**
 * Пример интеграции спрайтов в client/src/main.ts
 * 
 * 1. При подключении к комнате, загрузить спрайты для всех классов:
 */
export async function initializeSprites() {
    try {
        // Загрузить спрайты для всех классов
        await Promise.all([
            loadClassSprites(0), // Base
            loadClassSprites(1), // Warrior
            loadClassSprites(2), // Collector
        ]);
        console.log("All sprite assets loaded");
    } catch (error) {
        console.error("Failed to load sprites:", error);
        // Fallback: использовать Canvas rendering если спрайты не загрузились
    }
}

/**
 * 2. При рендеринге игрока, вместо drawCircle() использовать:
 */
export function drawPlayerWithSprite(
    ctx: CanvasRenderingContext2D,
    player: any,
    screenX: number,
    screenY: number,
    radius: number
) {
    // Определить состояние игрока
    let state: "idle" | "moving" | "damaged" = "idle";
    
    if (player.flags & 0x04) { // FLAG_IS_DEAD
        state = "damaged";
    } else if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
        state = "moving";
    }

    // Получить URL спрайта для текущего состояния
    const spriteUrl = getPlayerSprite(player.classId, state);
    
    if (!spriteUrl) {
        // Fallback: использовать простой circle
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#9be070";
        ctx.fill();
        return;
    }

    // Получить спрайт из кеша
    const spriteImg = SPRITE_CACHE.get(spriteUrl);
    if (!spriteImg) {
        console.warn(`Sprite not in cache: ${spriteUrl}`);
        return;
    }

    // Рендерить спрайт
    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Применить масштаб
    const size = radius * 2;
    const scale = size / 256; // SPRITE_SIZE = 256
    ctx.scale(scale, scale);
    
    // Центрировать спрайт
    ctx.drawImage(spriteImg, -128, -128);
    
    ctx.restore();
}

/**
 * 3. Альтернатива: Использовать спрайты с цветовой модуляцией
 * (если спрайты чёрно-белые/монохромные)
 */
export function drawPlayerWithColoredSprite(
    ctx: CanvasRenderingContext2D,
    player: any,
    screenX: number,
    screenY: number,
    radius: number,
    color: string
) {
    // Получить спрайт
    const spriteUrl = getPlayerSprite(player.classId, "idle");
    const spriteImg = SPRITE_CACHE.get(spriteUrl);
    
    if (!spriteImg) return;

    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Применить цвет (требует createImageData манипуляции)
    const size = radius * 2;
    const scale = size / 256;
    ctx.scale(scale, scale);
    
    // Вариант 1: Простая тинтировка (работает с globalCompositeOperation)
    ctx.globalAlpha = 0.8;
    ctx.drawImage(spriteImg, -128, -128);
    
    // Вариант 2: globalCompositeOperation для цвета
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.fillRect(-128, -128, 256, 256);
    
    ctx.restore();
}

/**
 * 4. Интеграция в room.state.players.onAdd():
 * 
 * room.state.players.onAdd((player: any, sessionId: string) => {
 *     // Загрузить спрайты для класса этого игрока
 *     loadClassSprites(player.classId).catch(err => 
 *         console.warn(`Failed to load sprites for class ${player.classId}:`, err)
 *     );
 * });
 */
