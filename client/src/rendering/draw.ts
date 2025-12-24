/**
 * Функции отрисовки для клиента
 */

/**
 * Возвращает CSS-цвет для типа орба
 */
export function getOrbColor(colorId: number): string {
    switch (colorId) {
        case 0:
            return "#6ddc6a"; // green
        case 1:
            return "#53c7ff"; // blue
        case 2:
            return "#ff6f6f"; // red
        case 3:
            return "#ffd166"; // yellow
        default:
            return "#b0b0b0"; // gray
    }
}

/**
 * Рисует залитый круг с опциональной обводкой
 */
export function drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    fill: string,
    stroke?: string
): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
}

/**
 * Рисует корону лидера
 */
export function drawCrown(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    fill: string,
    stroke?: string
): void {
    const w = size;
    const h = size * 0.7;
    const half = w / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(-half + w * 0.2, -h);
    ctx.lineTo(0, -h * 0.55);
    ctx.lineTo(half - w * 0.2, -h);
    ctx.lineTo(half, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Рисует спрайт слайма или fallback-круг
 */
export function drawSprite(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    ready: boolean,
    x: number,
    y: number,
    radius: number,
    angleRad: number,
    fallbackFill: string,
    fallbackStroke: string,
    spriteScale = 1
): void {
    if (ready) {
        const size = radius * 2 * spriteScale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-angleRad);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
    } else {
        drawCircle(ctx, x, y, radius, fallbackFill, fallbackStroke);
    }
}

/**
 * Конвертирует мировые координаты в экранные
 */
export function worldToScreen(
    x: number,
    y: number,
    scale: number,
    camX: number,
    camY: number,
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number } {
    return {
        x: (x - camX) * scale + canvasWidth / 2,
        y: (y - camY) * scale + canvasHeight / 2,
    };
}

/**
 * Ограничивает значение в заданных пределах
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Линейная интерполяция
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Сглаженная интерполяция (ease)
 */
export function smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
}
