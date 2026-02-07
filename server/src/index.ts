// FIX-000: Загрузка .env.local ПЕРЕД любыми импортами, зависящими от env
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { Server, matchMaker } from "colyseus";
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

// ============================================================================
// Internal API для MetaServer (защищён токеном)
// ============================================================================

/**
 * GET /api/internal/rooms
 * Возвращает список активных игровых комнат с метриками.
 * Требует MATCH_SERVER_TOKEN в заголовке Authorization.
 */
app.get("/api/internal/rooms", async (req, res) => {
    // Проверяем токен авторизации
    const authHeader = req.get("authorization");
    const expectedToken = process.env.MATCH_SERVER_TOKEN;

    if (!expectedToken) {
        console.error("[MatchServer] MATCH_SERVER_TOKEN not configured");
        return res.status(500).json({ error: "Server misconfiguration" });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
        return res.status(403).json({ error: "Invalid token" });
    }

    try {
        // Получаем список комнат через matchMaker
        const rooms = await matchMaker.query({ name: "arena" });

        // Собираем детальную статистику для каждой комнаты
        const roomsStats = await Promise.all(
            rooms.map(async (room) => {
                try {
                    // Вызываем метод getRoomStats() на удалённой комнате
                    const stats = await matchMaker.remoteRoomCall(
                        room.roomId,
                        "getRoomStats"
                    );
                    return stats;
                } catch (err) {
                    // Комната могла закрыться между query и remoteRoomCall
                    console.warn(`[MatchServer] Failed to get stats for room ${room.roomId}:`, err);
                    return null;
                }
            })
        );

        // Фильтруем null (закрытые комнаты)
        const validRooms = roomsStats.filter((r) => r !== null);

        res.json(validRooms);
    } catch (error) {
        console.error("[MatchServer] Error fetching rooms:", error);
        res.status(500).json({ error: "Failed to fetch rooms" });
    }
});

/**
 * POST /api/internal/shutdown-notify
 * Уведомляет все комнаты о предстоящей перезагрузке сервера.
 * Body: { shutdownAt: number } — Unix timestamp (ms).
 */
app.post("/api/internal/shutdown-notify", async (req, res) => {
    const authHeader = req.get("authorization");
    const expectedToken = process.env.MATCH_SERVER_TOKEN;

    if (!expectedToken) {
        console.error("[MatchServer] MATCH_SERVER_TOKEN not configured");
        return res.status(500).json({ error: "Server misconfiguration" });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
        return res.status(403).json({ error: "Invalid token" });
    }

    const { shutdownAt } = req.body;
    if (shutdownAt == null || typeof shutdownAt !== "number" || !Number.isFinite(shutdownAt)) {
        return res.status(400).json({ error: "shutdownAt (finite number) is required" });
    }

    try {
        const rooms = await matchMaker.query({ name: "arena" });
        let notified = 0;

        await Promise.all(
            rooms.map(async (room) => {
                try {
                    await matchMaker.remoteRoomCall(room.roomId, "setShutdownAt", [shutdownAt]);
                    notified++;
                } catch (err) {
                    console.warn(`[MatchServer] Failed to notify room ${room.roomId}:`, err);
                }
            })
        );

        console.log(`[MatchServer] Shutdown notification sent to ${notified}/${rooms.length} rooms (shutdownAt: ${new Date(shutdownAt).toISOString()})`);
        res.json({ notified, total: rooms.length });
    } catch (error) {
        console.error("[MatchServer] Error sending shutdown notifications:", error);
        res.status(500).json({ error: "Failed to notify rooms" });
    }
});

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
