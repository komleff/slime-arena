/**
 * Leaderboard models for meta-gameplay
 * Based on migrations 007_meta_gameplay_tables.sql
 */

/**
 * Total Mass Leaderboard entry
 * Tracks cumulative mass across all matches for a user
 */
export interface LeaderboardTotalMass {
  userId: string;
  totalMass: number;
  matchesPlayed: number;
  updatedAt: Date;
}

/**
 * Best Mass Leaderboard entry
 * Tracks the highest mass achieved in a single match
 */
export interface LeaderboardBestMass {
  userId: string;
  bestMass: number;
  bestMatchId: string | null;
  playersInMatch: number;
  achievedAt: Date;
  updatedAt: Date;
}

/**
 * Leaderboard entry for client response
 * Includes user info and position
 */
export interface LeaderboardEntry {
  position: number;
  userId: string;
  nickname: string;
  skinId: string;
  value: number;
  /** Only present for mode=total */
  matchesPlayed?: number;
}
