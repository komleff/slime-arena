import { Obstacle, Zone, SafeZone } from "../schema/GameState";
import {
    generateObstacleSeeds,
    generateSafeZoneSeeds,
    generateZoneSeeds,
} from "../helpers/arenaGeneration";

/**
 * ArenaGenerator — генерация арены (зоны, препятствия, начальные орбы).
 * Ответственность: создание игрового пространства при старте/рестарте матча.
 */

/**
 * Генерация арены: очистка и создание зон и препятствий.
 */
export function generateArena(room: any) {
    room.state.obstacles.clear();
    room.state.safeZones.splice(0, room.state.safeZones.length);
    room.state.zones.clear();
    room.obstacleIdCounter = 0;
    room.zoneIdCounter = 0;

    const mapSize = room.balance.world.mapSize;
    const world = room.balance.worldPhysics;

    // Безопасные зоны
    const safeZoneSeeds = generateSafeZoneSeeds(room.rng, world, mapSize, room.balance.safeZones);
    for (const zoneSeed of safeZoneSeeds) {
        const zone = new SafeZone();
        zone.x = zoneSeed.x;
        zone.y = zoneSeed.y;
        zone.radius = zoneSeed.radius;
        room.state.safeZones.push(zone);
    }

    // Игровые зоны (нектар, лёд, слайм, лава, турбо)
    const zoneSeeds = generateZoneSeeds(room.rng, world, mapSize, room.balance.zones, safeZoneSeeds);
    for (const zoneSeed of zoneSeeds) {
        const zone = new Zone();
        zone.id = `zone_${room.zoneIdCounter++}`;
        zone.x = zoneSeed.x;
        zone.y = zoneSeed.y;
        zone.radius = zoneSeed.radius;
        zone.type = zoneSeed.type;
        room.state.zones.set(zone.id, zone);
    }

    // Препятствия (могут пересекаться с зонами, это допустимо по дизайну)
    const obstacles = generateObstacleSeeds(room.rng, world, mapSize, room.balance.obstacles);
    for (const obstacle of obstacles) {
        addObstacle(room, obstacle.type, obstacle.x, obstacle.y, obstacle.radius);
    }
}

/**
 * Добавление препятствия на арену.
 */
export function addObstacle(room: any, type: number, x: number, y: number, radius: number) {
    const obstacle = new Obstacle();
    obstacle.id = `obs_${room.obstacleIdCounter++}`;
    obstacle.x = x;
    obstacle.y = y;
    obstacle.radius = radius;
    obstacle.type = type;
    room.state.obstacles.set(obstacle.id, obstacle);
}

/**
 * Создание начальных орбов при старте матча.
 */
export function spawnInitialOrbs(room: any) {
    const count = Math.min(room.balance.orbs.initialCount, room.balance.orbs.maxCount);
    for (let i = 0; i < count; i += 1) {
        room.spawnOrb();
    }
}
