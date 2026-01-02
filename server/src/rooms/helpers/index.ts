/**
 * Экспорт всех хелперов для ArenaRoom
 */

export { clamp, normalizeAngle, secondsToTicks, msToTicks } from "./mathUtils";
export {
    type WorldBounds,
    getWorldBounds,
    randomPointInMap,
    clampPointToWorld,
    applyWorldBoundsCollision,
} from "./worldUtils";
export {
    type ObstacleSeed,
    type SafeZoneSeed,
    type ZoneSeed,
    getMapSizeKey,
    randomPointInMapWithMargin,
    isInsideWorld,
    generateObstacleSeeds,
    generateSafeZoneSeeds,
    generateZoneSeeds,
} from "./arenaGeneration";
