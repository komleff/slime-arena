export type { Vector2, MatchPhaseId, InputCommand } from "./types.js";
export { MATCH_PHASES } from "./types.js";
export type { BalanceConfig, ResolvedBalanceConfig, FormulaConfig, MatchPhaseConfig } from "./config.js";
export { DEFAULT_BALANCE_CONFIG, resolveBalanceConfig } from "./config.js";
export {
    getSlimeHp,
    getSlimeDamage,
    getSlimeRadius,
    getOrbRadius,
    getSpeedMultiplier,
    getTurnRateDeg,
} from "./formulas.js";
export {
    FLAG_RESPAWN_SHIELD,
    FLAG_ABILITY_SHIELD,
    FLAG_LAST_BREATH,
    FLAG_IS_REBEL,
    FLAG_IS_DEAD,
} from "./constants.js";
