/**
 * Математические утилиты для ArenaRoom
 */

/**
 * Ограничивает значение в заданных пределах
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Нормализует угол в диапазон [-π, π]
 */
export function normalizeAngle(angle: number): number {
    let value = angle;
    while (value < -Math.PI) value += Math.PI * 2;
    while (value > Math.PI) value -= Math.PI * 2;
    return value;
}

/**
 * Конвертирует секунды в тики
 */
export function secondsToTicks(seconds: number, tickRate: number): number {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.max(1, Math.round(seconds * tickRate));
}

/**
 * Конвертирует миллисекунды в тики
 */
export function msToTicks(ms: number, tickRate: number): number {
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    const msPerTick = 1000 / tickRate;
    return Math.max(1, Math.round(ms / msPerTick));
}
