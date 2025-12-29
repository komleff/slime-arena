export interface Vector2 {
    x: number;
    y: number;
}

// GDD v3.3: 3 фазы матча (Growth, Hunt, Final)
export const MATCH_PHASES = ["Growth", "Hunt", "Final", "Results"] as const;
export type MatchPhaseId = typeof MATCH_PHASES[number];

export interface InputCommand {
    seq: number;
    moveX: number;
    moveY: number;
    abilitySlot?: number;
    talentChoice?: number;
}
