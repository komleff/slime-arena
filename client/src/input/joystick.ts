/**
 * Состояние виртуального джойстика
 */
export interface JoystickState {
    active: boolean;
    pointerId: number | null;
    pointerType: string | null;
    baseX: number;
    baseY: number;
    knobX: number;
    knobY: number;
    moveX: number;
    moveY: number;
}

/**
 * Конфигурация джойстика
 */
export interface JoystickConfig {
    radius: number;
    deadzone: number;
    sensitivity: number;
    mode: "fixed" | "adaptive";
    followSpeed: number;
    knobRadius: number;
}

/**
 * Создаёт начальное состояние джойстика
 */
export function createJoystickState(): JoystickState {
    return {
        active: false,
        pointerId: null,
        pointerType: null,
        baseX: 0,
        baseY: 0,
        knobX: 0,
        knobY: 0,
        moveX: 0,
        moveY: 0,
    };
}

/**
 * Создаёт конфиг джойстика из баланса
 */
export function createJoystickConfig(
    radius: number,
    deadzone: number,
    sensitivity: number,
    mode: string,
    followSpeed: number
): JoystickConfig {
    // Валидация mode: только "adaptive" или "fixed", иначе fallback
    const validModes: JoystickConfig["mode"][] = ["adaptive", "fixed"];
    const validatedMode: JoystickConfig["mode"] = validModes.includes(mode as JoystickConfig["mode"])
        ? (mode as JoystickConfig["mode"])
        : "adaptive";
    return {
        radius,
        deadzone,
        sensitivity,
        mode: validatedMode,
        followSpeed,
        knobRadius: radius * 0.45,
    };
}

/**
 * Сбрасывает состояние джойстика
 */
export function resetJoystick(state: JoystickState): void {
    state.active = false;
    state.pointerId = null;
    state.pointerType = null;
    state.moveX = 0;
    state.moveY = 0;
    state.knobX = state.baseX;
    state.knobY = state.baseY;
}

/**
 * Ограничивает значение в пределах
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Обновляет состояние джойстика по позиции указателя
 * @returns {{ baseShifted: boolean; baseClamped: boolean }}
 */
export function updateJoystickFromPointer(
    state: JoystickState,
    config: JoystickConfig,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
): { baseShifted: boolean; baseClamped: boolean } {
    let baseX = state.baseX;
    let baseY = state.baseY;
    let dx = clientX - baseX;
    let dy = clientY - baseY;
    let distance = Math.hypot(dx, dy);
    const baseShifted = false;
    let baseClamped = false;

    // В adaptive режиме база фиксируется в точке активации и НЕ смещается.
    // Это обеспечивает стабильное управление на мобильных устройствах.
    // (Смещение было убрано по задаче slime-arena-zmf)

    // Ограничиваем базу в пределах canvas
    let minX = canvasRect.left + config.radius;
    let maxX = canvasRect.left + canvasRect.width - config.radius;
    let minY = canvasRect.top + config.radius;
    let maxY = canvasRect.top + canvasRect.height - config.radius;
    if (maxX < minX) {
        minX = canvasRect.left + canvasRect.width / 2;
        maxX = minX;
    }
    if (maxY < minY) {
        minY = canvasRect.top + canvasRect.height / 2;
        maxY = minY;
    }
    const clampedBaseX = clamp(baseX, minX, maxX);
    const clampedBaseY = clamp(baseY, minY, maxY);
    if (clampedBaseX !== baseX || clampedBaseY !== baseY) {
        baseX = clampedBaseX;
        baseY = clampedBaseY;
        state.baseX = baseX;
        state.baseY = baseY;
        dx = clientX - baseX;
        dy = clientY - baseY;
        distance = Math.hypot(dx, dy);
        baseClamped = true;
    }

    // Ограничиваем knob радиусом
    if (distance > config.radius && distance > 0) {
        const scale = config.radius / distance;
        dx *= scale;
        dy *= scale;
        distance = config.radius;
    }

    // Применяем deadzone
    const deadzonePx = config.radius * config.deadzone;
    let outX = 0;
    let outY = 0;
    if (distance > deadzonePx) {
        const normalized = (distance - deadzonePx) / Math.max(config.radius - deadzonePx, 1);
        const scale = normalized / Math.max(distance, 1);
        outX = dx * scale;
        outY = dy * scale;
    }

    // Применяем чувствительность и ограничиваем
    outX = clamp(outX * config.sensitivity, -1, 1);
    outY = clamp(outY * config.sensitivity, -1, 1);

    state.moveX = outX;
    state.moveY = outY;
    state.knobX = baseX + dx;
    state.knobY = baseY + dy;
    return { baseShifted, baseClamped };
}

/**
 * Создаёт DOM-элементы джойстика
 */
export function createJoystickElements(): {
    layer: HTMLDivElement;
    base: HTMLDivElement;
    knob: HTMLDivElement;
} {
    const layer = document.createElement("div");
    layer.style.position = "fixed";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "5";

    const base = document.createElement("div");
    base.style.position = "fixed";
    base.style.borderRadius = "50%";
    base.style.border = "2px solid rgba(255, 255, 255, 0.18)";
    base.style.background = "rgba(12, 16, 24, 0.25)";
    base.style.backdropFilter = "blur(2px)";
    base.style.opacity = "0";
    base.style.transform = "translate(-50%, -50%)";

    const knob = document.createElement("div");
    knob.style.position = "fixed";
    knob.style.borderRadius = "50%";
    knob.style.background = "rgba(150, 200, 255, 0.55)";
    knob.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.35)";
    knob.style.opacity = "0";
    knob.style.transform = "translate(-50%, -50%)";

    layer.appendChild(base);
    layer.appendChild(knob);

    return { layer, base, knob };
}

/**
 * Обновляет визуальное положение джойстика
 */
export function updateJoystickVisual(
    state: JoystickState,
    base: HTMLDivElement,
    knob: HTMLDivElement
): void {
    base.style.left = `${state.baseX}px`;
    base.style.top = `${state.baseY}px`;
    knob.style.left = `${state.knobX}px`;
    knob.style.top = `${state.knobY}px`;
}

/**
 * Устанавливает видимость джойстика
 */
export function setJoystickVisible(
    visible: boolean,
    base: HTMLDivElement,
    knob: HTMLDivElement
): void {
    const opacity = visible ? "1" : "0";
    base.style.opacity = opacity;
    knob.style.opacity = opacity;
}

/**
 * Обновляет размеры элементов джойстика
 */
export function updateJoystickSize(
    config: JoystickConfig,
    base: HTMLDivElement,
    knob: HTMLDivElement
): void {
    base.style.width = `${config.radius * 2}px`;
    base.style.height = `${config.radius * 2}px`;
    knob.style.width = `${config.knobRadius * 2}px`;
    knob.style.height = `${config.knobRadius * 2}px`;
}
