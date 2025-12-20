import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { monitor } from "@colyseus/monitor";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { loadBalanceConfig } from "./config/loadBalanceConfig";

const balance = loadBalanceConfig();
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

gameServer.listen(port, host);
console.log(`Balance config loaded. Tick rate: ${balance.server.tickRate}`);
console.log(`Listening on ws://${host}:${port}`);
