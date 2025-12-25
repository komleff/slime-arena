export interface Vector2 {
    x: number;
    y: number;
}

export const MATCH_PHASES = ["Spawn", "Collect", "Hunt", "Chaos", "Final", "Results"] as const;
export type MatchPhaseId = typeof MATCH_PHASES[number];

export interface InputCommand {
    seq: number;
    moveX: number;
    moveY: number;
    abilitySlot?: number;
    talentChoice?: number;
}
