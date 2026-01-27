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

/**
 * Match result interfaces for MatchServer → MetaServer integration
 */
export interface PlayerResult {
    userId?: string;
    sessionId: string;
    placement: number;
    finalMass: number;
    killCount: number;
    deathCount: number;
    level: number;
    classId: number;
    isDead: boolean;
}

export interface MatchStats {
    totalKills: number;
    totalBubblesCollected: number;
    matchDurationMs: number;
}

export interface MatchSummary {
    matchId: string;
    mode: string;
    startedAt: string;
    endedAt: string;
    configVersion: string;
    buildVersion: string;
    playerResults: PlayerResult[];
    matchStats?: MatchStats;
    /** Guest subject ID for claim ownership verification (set by MatchServer for guest players) */
    guestSubjectId?: string;
}
