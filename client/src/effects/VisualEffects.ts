/**
 * Модуль визуальных эффектов: всплывающие тексты и вспышки.
 * Извлечён из main.ts для разделения ответственности.
 */

import { worldToScreen } from "../rendering";

// ─── Типы ────────────────────────────────────────────────────────────────────

export type FloatingText = {
    x: number;
    y: number;
    text: string;
    color: string;
    startMs: number;
    durationMs: number;
    fontSize: number;
};

export type FlashEffect = {
    x: number;
    y: number;
    color: string;
    startMs: number;
    durationMs: number;
    radius: number;
};

// ─── Класс управления визуальными эффектами ──────────────────────────────────

/**
 * Менеджер визуальных эффектов.
 * Хранит и отрисовывает всплывающие тексты и вспышки.
 */
export class VisualEffects {
    private floatingTexts: FloatingText[] = [];
    private flashEffects: FlashEffect[] = [];

    /**
     * Добавить всплывающий текст в мировых координатах.
     * Текст поднимается вверх и плавно исчезает.
     */
    addFloatingText(
        x: number,
        y: number,
        text: string,
        color: string,
        fontSize = 20,
        durationMs = 1200
    ): void {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            startMs: performance.now(),
            durationMs,
            fontSize,
        });
    }

    /**
     * Добавить эффект вспышки (радиальный градиент) в мировых координатах.
     */
    addFlashEffect(
        x: number,
        y: number,
        color: string,
        radius: number,
        durationMs = 400
    ): void {
        this.flashEffects.push({
            x,
            y,
            color,
            startMs: performance.now(),
            durationMs,
            radius,
        });
    }

    /**
     * Очистить все эффекты.
     */
    clear(): void {
        this.floatingTexts.length = 0;
        this.flashEffects.length = 0;
    }

    /**
     * Отрисовка эффектов вспышки.
     * Вспышка расширяется и затухает со временем.
     */
    drawFlashEffects(
        ctx: CanvasRenderingContext2D,
        scale: number,
        camX: number,
        camY: number,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        const nowMs = performance.now();
        for (let i = this.flashEffects.length - 1; i >= 0; i--) {
            const fx = this.flashEffects[i];
            const elapsed = nowMs - fx.startMs;
            if (elapsed > fx.durationMs) {
                this.flashEffects.splice(i, 1);
                continue;
            }
            const progress = elapsed / fx.durationMs;
            const alpha = 1 - progress;
            const currentRadius = fx.radius * (1 + progress * 0.5);
            const screenPos = worldToScreen(
                fx.x,
                fx.y,
                scale,
                camX,
                camY,
                canvasWidth,
                canvasHeight
            );
            ctx.save();
            ctx.globalAlpha = alpha * 0.8;
            const gradient = ctx.createRadialGradient(
                screenPos.x,
                screenPos.y,
                0,
                screenPos.x,
                screenPos.y,
                currentRadius * scale
            );
            gradient.addColorStop(0, fx.color);
            gradient.addColorStop(1, "transparent");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, currentRadius * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Отрисовка всплывающих текстов.
     * Текст поднимается вверх и плавно исчезает.
     */
    drawFloatingTexts(
        ctx: CanvasRenderingContext2D,
        scale: number,
        camX: number,
        camY: number,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        const nowMs = performance.now();
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            const elapsed = nowMs - ft.startMs;
            if (elapsed > ft.durationMs) {
                this.floatingTexts.splice(i, 1);
                continue;
            }
            const progress = elapsed / ft.durationMs;
            const alpha = 1 - progress;
            const yOffset = -30 * progress; // Поднимается вверх
            const screenPos = worldToScreen(
                ft.x,
                ft.y + yOffset,
                scale,
                camX,
                camY,
                canvasWidth,
                canvasHeight
            );
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${ft.fontSize}px Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // Тень для читаемости
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, screenPos.x, screenPos.y);
            ctx.restore();
        }
    }

    /**
     * Отрисовать все эффекты (вспышки и тексты).
     */
    draw(
        ctx: CanvasRenderingContext2D,
        scale: number,
        camX: number,
        camY: number,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        this.drawFlashEffects(ctx, scale, camX, camY, canvasWidth, canvasHeight);
        this.drawFloatingTexts(ctx, scale, camX, camY, canvasWidth, canvasHeight);
    }
}
