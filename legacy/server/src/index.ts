import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { monitor } from "@colyseus/monitor";

import { ArenaRoom } from "./rooms/ArenaRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);
const gameServer = new Server({
  server,
});

// Регистрация комнат
gameServer.define("arena", ArenaRoom);

const enableMonitor =
  process.env.COLYSEUS_MONITOR === "true" || process.env.NODE_ENV !== "production";
if (enableMonitor) {
  app.use("/colyseus", monitor());
}

gameServer.listen(port);
console.log(`Listening on ws://localhost:${port}`);
