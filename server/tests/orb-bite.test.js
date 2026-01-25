const path = require("path");

const serverRoot = path.resolve(__dirname, "..");
process.chdir(serverRoot);

const { ArenaRoom } = require(path.resolve(__dirname, "../dist/server/src/rooms/ArenaRoom.js"));
const { Orb } = require(path.resolve(__dirname, "../dist/server/src/rooms/schema/GameState.js"));

function createRoom(seed = 12345) {
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

function getPlayer(room, id) {
    const player = room.state.players.get(id);
    if (!player) {
        throw new Error(`Player ${id} not found`);
    }
    return player;
}

function addOrb(room, id, mass) {
    const orb = new Orb();
    orb.id = id;
    orb.mass = mass;
    room.state.orbs.set(id, orb);
    return orb;
}

function approxEqual(actual, expected, eps = 1e-6) {
    return Math.abs(actual - expected) <= eps;
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: ${actual} !== ${expected}`);
    }
}

function assertApprox(actual, expected, message) {
    if (!approxEqual(actual, expected)) {
        throw new Error(`${message}: ${actual} !== ${expected}`);
    }
}

function runTest(name, fn) {
    try {
        fn();
        console.log(`OK: ${name}`);
    } catch (error) {
        console.error(`FAIL: ${name}`);
        console.error(error);
        process.exit(1);
    }
}

runTest("orb bite below min mass sets GCD and does nothing", () => {
    const room = createRoom();
    const player = getPlayer(room, "p1");
    room.tick = 10;
    const minMass = room.balance.orbs.orbBiteMinMass;
    player.mass = minMass - 1;
    const orb = addOrb(room, "o1", 10);
    const prevMass = player.mass;
    const prevGcd = player.gcdReadyTick;
    room.tryEatOrb(player, orb.id, orb);
    assertEqual(room.state.orbs.has(orb.id), true, "orb should remain");
    assertApprox(player.mass, prevMass, "player mass should not change");
    const expectedGcd = room.tick + room.balance.server.globalCooldownTicks;
    if (prevGcd !== expectedGcd) {
        assertEqual(player.gcdReadyTick, expectedGcd, "GCD should be set");
    }
});

runTest("orb bite swallow removes orb and grants mass", () => {
    const room = createRoom();
    const player = getPlayer(room, "p1");
    room.tick = 20;
    player.mass = 100;
    player.mod_orbMassBonus = 0;
    const slimeConfig = room.getSlimeConfig(player);
    const classStats = room.getClassStats(player);
    const bitePct = slimeConfig.combat.orbBitePctOfMass * classStats.eatingPowerMult;
    const effectiveMass = Math.min(player.mass, room.balance.orbs.orbBiteMaxMass);
    const swallowThreshold = effectiveMass * bitePct;
    const orbMass = swallowThreshold * 0.5;
    const orb = addOrb(room, "o2", orbMass);
    const prevMass = player.mass;
    room.tryEatOrb(player, orb.id, orb);
    assertEqual(room.state.orbs.has(orb.id), false, "orb should be removed");
    assertApprox(player.mass, prevMass + orbMass, "player mass should increase");
});

runTest("orb bite partial reduces orb and grants mass", () => {
    const room = createRoom();
    const player = getPlayer(room, "p1");
    room.tick = 30;
    player.mass = 100;
    player.mod_orbMassBonus = 0;
    const slimeConfig = room.getSlimeConfig(player);
    const classStats = room.getClassStats(player);
    const bitePct = slimeConfig.combat.orbBitePctOfMass * classStats.eatingPowerMult;
    const effectiveMass = Math.min(player.mass, room.balance.orbs.orbBiteMaxMass);
    const swallowThreshold = effectiveMass * bitePct;
    const orbMass = swallowThreshold * 2;
    const orb = addOrb(room, "o3", orbMass);
    const prevMass = player.mass;
    room.tryEatOrb(player, orb.id, orb);
    assertEqual(room.state.orbs.has(orb.id), true, "orb should remain");
    assertApprox(orb.mass, orbMass - swallowThreshold, "orb mass should decrease");
    assertApprox(player.mass, prevMass + swallowThreshold, "player mass should increase");
});

runTest("orb bite uses orbBiteMaxMass clamp", () => {
    const room = createRoom();
    const player = getPlayer(room, "p1");
    room.tick = 40;
    player.mass = room.balance.orbs.orbBiteMaxMass * 2;
    player.mod_orbMassBonus = 0;
    const slimeConfig = room.getSlimeConfig(player);
    const classStats = room.getClassStats(player);
    const bitePct = slimeConfig.combat.orbBitePctOfMass * classStats.eatingPowerMult;
    const effectiveMass = room.balance.orbs.orbBiteMaxMass;
    const swallowThreshold = effectiveMass * bitePct;
    const orbMass = swallowThreshold * 2;
    const orb = addOrb(room, "o4", orbMass);
    const prevMass = player.mass;
    room.tryEatOrb(player, orb.id, orb);
    assertApprox(orb.mass, orbMass - swallowThreshold, "orb mass should use clamp");
    assertApprox(player.mass, prevMass + swallowThreshold, "player mass should increase");
});

console.log("Orb bite tests passed");
process.exit(0);
