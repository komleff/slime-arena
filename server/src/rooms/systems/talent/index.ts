/**
 * Talent System - модуль системы талантов
 *
 * Экспортирует функции для генерации и применения талантов.
 */

export {
    recalculateTalentModifiers,
    getTalentConfig,
    type TalentBalanceConfig,
} from "./TalentModifierCalculator";

export {
    generateTalentCard,
    buildAbilityUpgradeId,
    parseAbilityUpgradeId,
    type TalentGeneratorConfig,
    type TalentGeneratorDeps,
} from "./TalentGenerator";
