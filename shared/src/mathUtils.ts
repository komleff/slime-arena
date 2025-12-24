/**
 * Математические утилиты общего назначения.
 */

/**
 * Ограничивает значение в заданном диапазоне.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Линейная интерполяция между двумя значениями.
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Нормализует угол в диапазон [-PI, PI].
 */
export function wrapAngle(angle: number): number {
    let value = angle;
    const twoPi = Math.PI * 2;
    while (value < -Math.PI) value += twoPi;
    while (value > Math.PI) value -= twoPi;
    return value;
}

/**
 * Нормализует угол в диапазон [0, 2*PI).
 */
export function normalizeAngle(angle: number): number {
    let value = angle % (Math.PI * 2);
    if (value < 0) value += Math.PI * 2;
    return value;
}

/**
 * Преобразует градусы в радианы.
 */
export function degToRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Преобразует радианы в градусы.
 */
export function radToDeg(rad: number): number {
    return rad * (180 / Math.PI);
}

/**
 * Вычисляет расстояние между двумя точками.
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Вычисляет квадрат расстояния между двумя точками (быстрее, без sqrt).
 */
export function distanceSq(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}
