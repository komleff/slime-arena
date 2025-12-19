import { Client } from "colyseus.js";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

const client = new Client("ws://localhost:2567");

async function connect() {
    try {
        // const room = await client.joinOrCreate("arena");
        console.log("Connected to server");
    } catch (e) {
        console.error("Connection error", e);
    }
}

function gameLoop() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.fillText("Slime Arena Prototype", 20, 40);
    }
    requestAnimationFrame(gameLoop);
}

connect();
gameLoop();
