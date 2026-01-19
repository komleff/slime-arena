/**
 * GameLoopManager — управление игровыми таймерами и render loop.
 *
 * Централизует lifecycle игровых циклов:
 * - inputTimer: отправка ввода на сервер (33ms)
 * - hudTimer: обновление UI (200ms)
 * - renderLoop: requestAnimationFrame
 */

export interface GameLoopCallbacks {
    /** Вызывается каждый inputTimer tick */
    onInputTick: () => void;
    /** Вызывается каждый hudTimer tick */
    onHudTick: () => void;
    /** Вызывается каждый кадр рендеринга */
    onRender: () => void;
    /** Вызывается при остановке */
    onStop?: () => void;
}

export interface GameLoopConfig {
    /** Интервал отправки ввода в ms (default: 33) */
    inputIntervalMs: number;
    /** Интервал обновления HUD в ms (default: 200) */
    hudIntervalMs: number;
}

const DEFAULT_CONFIG: GameLoopConfig = {
    inputIntervalMs: 33,
    hudIntervalMs: 200,
};

export class GameLoopManager {
    private inputTimer: ReturnType<typeof setInterval> | null = null;
    private hudTimer: ReturnType<typeof setInterval> | null = null;
    private rafId: number | null = null;
    private isRunning = false;
    private isPaused = false;

    private readonly callbacks: GameLoopCallbacks;
    private readonly config: GameLoopConfig;

    constructor(callbacks: GameLoopCallbacks, config?: Partial<GameLoopConfig>) {
        this.callbacks = callbacks;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Запускает все игровые циклы
     */
    start(): void {
        if (this.isRunning) {
            console.warn("[GameLoopManager] Already running");
            return;
        }

        this.isRunning = true;
        this.isPaused = false;

        // Input timer
        this.inputTimer = setInterval(() => {
            if (this.isPaused) return;
            this.callbacks.onInputTick();
        }, this.config.inputIntervalMs);

        // HUD timer
        this.hudTimer = setInterval(() => {
            if (this.isPaused) return;
            this.callbacks.onHudTick();
        }, this.config.hudIntervalMs);

        // Render loop
        this.startRenderLoop();
    }

    /**
     * Останавливает все игровые циклы
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.isPaused = false;

        if (this.inputTimer !== null) {
            clearInterval(this.inputTimer);
            this.inputTimer = null;
        }

        if (this.hudTimer !== null) {
            clearInterval(this.hudTimer);
            this.hudTimer = null;
        }

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        this.callbacks.onStop?.();
    }

    /**
     * Приостанавливает циклы (таймеры продолжают работать, но колбэки не вызываются)
     */
    pause(): void {
        this.isPaused = true;
    }

    /**
     * Возобновляет циклы после паузы
     */
    resume(): void {
        this.isPaused = false;
    }

    /**
     * Возвращает состояние работы
     */
    get running(): boolean {
        return this.isRunning;
    }

    /**
     * Возвращает состояние паузы
     */
    get paused(): boolean {
        return this.isPaused;
    }

    private startRenderLoop(): void {
        const renderFrame = () => {
            if (!this.isRunning) return;

            if (!this.isPaused) {
                this.callbacks.onRender();
            }

            this.rafId = requestAnimationFrame(renderFrame);
        };

        this.rafId = requestAnimationFrame(renderFrame);
    }
}
