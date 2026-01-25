/**
 * RatingService - manages player ratings and leaderboards
 *
 * Responsibilities:
 * - Award rating after each match (for registered users)
 * - Initialize rating at registration (from claimToken)
 * - Ensure idempotency via rating_awards table
 */

import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import { ClaimTokenPayload } from '../utils/jwtUtils';

export interface AwardRatingResult {
  success: boolean;
  reason?: 'already_awarded' | 'user_anonymous' | 'user_not_found';
  newTotalMass?: number;
  newBestMass?: number;
  isNewRecord?: boolean;
}

export interface InitializeRatingResult {
  totalMass: number;
  bestMass: number;
  matchesPlayed: number;
}

export class RatingService {
  private _pool: Pool | null = null;

  private get pool(): Pool {
    if (!this._pool) {
      this._pool = getPostgresPool();
    }
    return this._pool;
  }

  /**
   * Award rating to user after match completion
   *
   * Rules:
   * - Only awards to registered users (is_anonymous = false)
   * - Idempotent: checks rating_awards before awarding
   * - Updates both total_mass and best_mass leaderboards
   *
   * @param userId - User ID
   * @param matchId - Match ID
   * @param finalMass - Mass at end of match
   * @param playersInMatch - Number of players in the match
   */
  async awardRating(
    userId: string,
    matchId: string,
    finalMass: number,
    playersInMatch: number
  ): Promise<AwardRatingResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user exists and is not anonymous
      const userResult = await client.query(
        'SELECT is_anonymous FROM users WHERE id = $1 AND is_banned = FALSE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, reason: 'user_not_found' };
      }

      if (userResult.rows[0].is_anonymous) {
        await client.query('ROLLBACK');
        return { success: false, reason: 'user_anonymous' };
      }

      // Check idempotency: has this match already been awarded?
      const awardCheck = await client.query(
        'SELECT 1 FROM rating_awards WHERE user_id = $1 AND match_id = $2',
        [userId, matchId]
      );

      if (awardCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, reason: 'already_awarded' };
      }

      // Get current best_mass for comparison
      const currentBestResult = await client.query(
        'SELECT best_mass FROM leaderboard_best_mass WHERE user_id = $1',
        [userId]
      );
      const currentBestMass = currentBestResult.rows[0]?.best_mass ?? 0;
      const isNewRecord = finalMass > currentBestMass;

      // UPSERT leaderboard_total_mass
      const totalMassResult = await client.query(
        `INSERT INTO leaderboard_total_mass (user_id, total_mass, matches_played, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           total_mass = leaderboard_total_mass.total_mass + $2,
           matches_played = leaderboard_total_mass.matches_played + 1,
           updated_at = NOW()
         RETURNING total_mass`,
        [userId, finalMass]
      );
      const newTotalMass = totalMassResult.rows[0].total_mass;

      // Update best_mass if new record
      let newBestMass = currentBestMass;
      if (isNewRecord) {
        const bestMassResult = await client.query(
          `INSERT INTO leaderboard_best_mass (user_id, best_mass, best_match_id, players_in_match, achieved_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             best_mass = $2,
             best_match_id = $3,
             players_in_match = $4,
             achieved_at = NOW(),
             updated_at = NOW()
           RETURNING best_mass`,
          [userId, finalMass, matchId, playersInMatch]
        );
        newBestMass = bestMassResult.rows[0].best_mass;
      }

      // Record the award for idempotency
      await client.query(
        'INSERT INTO rating_awards (user_id, match_id, awarded_at) VALUES ($1, $2, NOW())',
        [userId, matchId]
      );

      await client.query('COMMIT');

      console.log(
        `[RatingService] Awarded rating to user ${userId.slice(0, 8)}...: ` +
        `+${finalMass} mass, total: ${newTotalMass}, best: ${newBestMass}` +
        (isNewRecord ? ' (NEW RECORD!)' : '')
      );

      return {
        success: true,
        newTotalMass,
        newBestMass,
        isNewRecord,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize rating for a newly registered user
   *
   * Called from auth/upgrade endpoint after profile completion.
   * Uses claimToken data to set initial values.
   *
   * @param userId - New user ID
   * @param claimToken - Decoded claim token with match data
   * @param playersInMatch - Number of players in the match
   */
  async initializeRating(
    userId: string,
    claimToken: ClaimTokenPayload,
    playersInMatch: number
  ): Promise<InitializeRatingResult> {
    const { matchId, finalMass } = claimToken;

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create leaderboard_total_mass entry
      await client.query(
        `INSERT INTO leaderboard_total_mass (user_id, total_mass, matches_played, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, finalMass]
      );

      // Create leaderboard_best_mass entry
      await client.query(
        `INSERT INTO leaderboard_best_mass (user_id, best_mass, best_match_id, players_in_match, achieved_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, finalMass, matchId, playersInMatch]
      );

      // Record the award for idempotency (first match)
      await client.query(
        `INSERT INTO rating_awards (user_id, match_id, awarded_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, match_id) DO NOTHING`,
        [userId, matchId]
      );

      await client.query('COMMIT');

      console.log(
        `[RatingService] Initialized rating for user ${userId.slice(0, 8)}...: ` +
        `total: ${finalMass}, best: ${finalMass}, matches: 1`
      );

      return {
        totalMass: finalMass,
        bestMass: finalMass,
        matchesPlayed: 1,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's current rating stats
   */
  async getUserRating(userId: string): Promise<{
    totalMass: number;
    bestMass: number;
    matchesPlayed: number;
  } | null> {
    const totalResult = await this.pool.query(
      'SELECT total_mass, matches_played FROM leaderboard_total_mass WHERE user_id = $1',
      [userId]
    );

    if (totalResult.rows.length === 0) {
      return null;
    }

    const bestResult = await this.pool.query(
      'SELECT best_mass FROM leaderboard_best_mass WHERE user_id = $1',
      [userId]
    );

    return {
      totalMass: totalResult.rows[0].total_mass,
      matchesPlayed: totalResult.rows[0].matches_played,
      bestMass: bestResult.rows[0]?.best_mass ?? 0,
    };
  }
}

// Singleton instance
export const ratingService = new RatingService();
