import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { monitor } from "@colyseus/monitor";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { loadBalanceConfig } from "./config/loadBalanceConfig";
import { initializeMatchResultService } from "./services/MatchResultService";

const balance = loadBalanceConfig();

// Initialize MatchResultService if META_SERVER_URL is configured
const metaServerUrl = process.env.META_SERVER_URL;
const matchServerToken = process.env.MATCH_SERVER_TOKEN;
if (metaServerUrl && matchServerToken) {
    initializeMatchResultService({
        metaServerUrl,
        serverToken: matchServerToken,
    });
} else {
    console.log("[MatchServer] MatchResultService disabled: META_SERVER_URL or MATCH_SERVER_TOKEN not set");
}
const port = Number(process.env.PORT || 2567);
const host = process.env.HOST || "0.0.0.0";
const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);
const gameServer = new Server({
    server,
});

gameServer.define("arena", ArenaRoom);

const enableMonitor =
    process.env.COLYSEUS_MONITOR === "true" || process.env.NODE_ENV !== "production";
if (enableMonitor) {
    app.use("/colyseus", monitor());
}

// Глобальные обработчики ошибок — логируем и завершаем (supervisord перезапустит)
process.on("uncaughtException", (error: Error) => {
    console.error("[MatchServer] FATAL: Uncaught exception:", error);
    console.error("Стек:", error.stack);
    // Даём время записать логи, затем завершаем — supervisord перезапустит
    setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    console.error("[MatchServer] FATAL: Unhandled promise rejection:", reason);
    if (reason instanceof Error) {
        console.error("Стек:", reason.stack);
    }
    // Даём время записать логи, затем завершаем — supervisord перезапустит
    setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown для корректного завершения
const shutdown = async () => {
    console.log("[MatchServer] Shutting down gracefully...");
    try {
        await gameServer.gracefullyShutdown();
        console.log("[MatchServer] Shutdown complete");
        process.exit(0);
    } catch (error) {
        console.error("[MatchServer] Error during shutdown:", error);
        process.exit(1);
    }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

gameServer.listen(port, host);
console.log(`Balance config loaded. Tick rate: ${balance.server.tickRate}`);
console.log(`Listening on ws://${host}:${port}`);
