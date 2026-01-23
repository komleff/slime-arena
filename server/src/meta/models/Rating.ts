/**
 * Rating models for meta-gameplay
 * Based on migrations 007_meta_gameplay_tables.sql
 */

/**
 * Rating Award record
 * Ensures idempotency of rating distribution per match
 * Prevents double-awarding rating for the same match
 */
export interface RatingAward {
  userId: string;
  matchId: string;
  awardedAt: Date;
}
