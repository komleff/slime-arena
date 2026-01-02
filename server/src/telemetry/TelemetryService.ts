import fs from "fs";
import path from "path";

export type TelemetryEvent = {
    event: string;
    ts: number;
    tick: number;
    matchId: string;
    roomId: string;
    phase?: string;
    playerId?: string;
    data?: Record<string, unknown>;
};

type TelemetryOptions = {
    enabled?: boolean;
    logDir?: string;
    flushEvery?: number;
    flushIntervalMs?: number;
};

export class TelemetryService {
    private enabled = false;
    private logPath = "";
    private queue: TelemetryEvent[] = [];
    private flushEvery = 20;
    private flushIntervalMs = 2000;
    private timer: NodeJS.Timeout | null = null;

    constructor(options: TelemetryOptions = {}) {
        this.enabled = options.enabled ?? true;
        if (!this.enabled) return;
        const logDir = options.logDir ?? path.resolve(__dirname, "..", "..", "logs");
        this.flushEvery = Math.max(1, Math.floor(options.flushEvery ?? this.flushEvery));
        this.flushIntervalMs = Math.max(250, Math.floor(options.flushIntervalMs ?? this.flushIntervalMs));
        const date = new Date();
        const dayStamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
            date.getDate()
        ).padStart(2, "0")}`;
        this.logPath = path.join(logDir, `telemetry-${dayStamp}.jsonl`);
        try {
            fs.mkdirSync(logDir, { recursive: true });
        } catch (error) {
            console.warn("Telemetry disabled: cannot create log dir", error);
            this.enabled = false;
            return;
        }
        this.timer = setInterval(() => {
            this.flush();
        }, this.flushIntervalMs);
        this.timer.unref?.();
    }

    log(event: TelemetryEvent) {
        if (!this.enabled) return;
        this.queue.push(event);
        if (this.queue.length >= this.flushEvery) {
            this.flush();
        }
    }

    flush() {
        if (!this.enabled) return;
        if (this.queue.length === 0) return;
        const lines = this.queue.map((item) => JSON.stringify(item)).join("\n") + "\n";
        this.queue = [];
        try {
            fs.appendFileSync(this.logPath, lines, "utf-8");
        } catch (error) {
            console.warn("Telemetry disabled: cannot write log", error);
            this.enabled = false;
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }
    }

    close() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.flush();
    }
}
