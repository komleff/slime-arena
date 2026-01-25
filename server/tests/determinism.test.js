const path = require("path");

const serverRoot = path.resolve(__dirname, "..");
process.chdir(serverRoot);

const { ArenaRoom } = require(path.resolve(__dirname, "../dist/server/src/rooms/ArenaRoom.js"));

const SEED = 12345;
const TICKS = 180;

function createRoom(seed) {
    const room = new ArenaRoom();
    room.setSimulationInterval = () => 0;
    room.onCreate({ seed });
    const mockClient = { sessionId: "", send: () => {} };
    mockClient.sessionId = "p1";
    room.onJoin(mockClient, { name: "p1" });
    mockClient.sessionId = "p2";
    room.onJoin(mockClient, { name: "p2" });
    return room;
}

function applyInputs(room, tick) {
    const pattern = [
        { x: 1, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
    ];
    const p1 = room.state.players.get("p1");
    const p2 = room.state.players.get("p2");
    if (!p1 || !p2) {
        throw new Error("Players not found");
    }
    const a = pattern[tick % pattern.length];
    const b = pattern[(tick + 2) % pattern.length];
    p1.inputX = a.x;
    p1.inputY = a.y;
    p2.inputX = b.x;
    p2.inputY = b.y;
}

function round(value) {
    return Math.round(value * 1e6) / 1e6;
}

function snapshot(room) {
    const state = room.state;
    const players = Array.from(state.players.values())
        .map((player) => ({
            id: player.id,
            x: round(player.x),
            y: round(player.y),
            vx: round(player.vx),
            vy: round(player.vy),
            angle: round(player.angle),
            mass: round(player.mass),
            hp: round(player.hp),
            maxHp: round(player.maxHp),
            level: player.level,
            classId: player.classId,
            talentsAvailable: player.talentsAvailable,
            flags: player.flags,
            isDead: player.isDead,
            isLastBreath: player.isLastBreath,
            lastBreathEndTick: player.lastBreathEndTick,
            invulnerableUntilTick: player.invulnerableUntilTick,
            respawnAtTick: player.respawnAtTick,
            gcdReadyTick: player.gcdReadyTick,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const orbs = Array.from(state.orbs.values())
        .map((orb) => ({
            id: orb.id,
            x: round(orb.x),
            y: round(orb.y),
            vx: round(orb.vx),
            vy: round(orb.vy),
            mass: round(orb.mass),
            colorId: orb.colorId,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const chests = Array.from(state.chests.values())
        .map((chest) => ({
            id: chest.id,
            x: round(chest.x),
            y: round(chest.y),
            vx: round(chest.vx),
            vy: round(chest.vy),
            type: chest.type,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const hotZones = Array.from(state.hotZones.values())
        .map((zone) => ({
            id: zone.id,
            x: round(zone.x),
            y: round(zone.y),
            radius: round(zone.radius),
            spawnMultiplier: round(zone.spawnMultiplier),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    return {
        tick: room.tick ?? room["tick"],
        phase: state.phase,
        timeRemaining: round(state.timeRemaining),
        rebelId: state.rebelId,
        leaderboard: Array.from(state.leaderboard),
        players,
        orbs,
        chests,
        hotZones,
    };
}

const roomA = createRoom(SEED);
const roomB = createRoom(SEED);

for (let i = 0; i < TICKS; i += 1) {
    applyInputs(roomA, i);
    applyInputs(roomB, i);
    roomA.onTick();
    roomB.onTick();
}

const snapA = snapshot(roomA);
const snapB = snapshot(roomB);
const hashA = JSON.stringify(snapA);
const hashB = JSON.stringify(snapB);

if (hashA !== hashB) {
    console.error("Determinism check failed");
    process.exit(1);
}

console.log("Determinism check passed");
process.exit(0);
