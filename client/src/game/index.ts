/**
 * Экспорт игрового модуля
 */

export { GameLoopManager, type GameLoopCallbacks, type GameLoopConfig } from "./GameLoopManager";
export {
    SmoothingSystem,
    type VisualEntity,
    type SmoothingConfig,
    DEFAULT_SMOOTHING_CONFIG,
} from "./SmoothingSystem";
