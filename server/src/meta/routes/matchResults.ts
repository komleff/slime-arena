import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import { requireServerToken } from '../middleware/auth';
import { MatchSummary, PlayerResult } from '@slime-arena/shared/src/types';

const router = express.Router();

/**
 * Lazy pool accessor
 */
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    _pool = getPostgresPool();
  }
  return _pool;
}

/**
 * POST /api/v1/match-results/submit
 * Submit match results from MatchServer
 * Requires ServerToken authorization
 *
 * Schema: match_results table uses JSONB `summary` field for all player data
 * See: server/src/db/migrations/001_initial_schema.sql
 */
router.post('/submit', requireServerToken, async (req: Request, res: Response) => {
  try {
    const matchSummary = req.body as MatchSummary;

    // Validate required fields
    if (!matchSummary.matchId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'matchId is required',
      });
    }

    if (!matchSummary.playerResults || matchSummary.playerResults.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'playerResults is required and must not be empty',
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Build summary JSONB with playerResults and matchStats
      const summary = {
        playerResults: matchSummary.playerResults,
        matchStats: matchSummary.matchStats || null,
      };

      // Use INSERT ... ON CONFLICT DO NOTHING for race-condition-safe idempotency
      // This handles concurrent requests atomically without SELECT→INSERT race
      const insertResult = await client.query(
        `INSERT INTO match_results
         (match_id, mode, started_at, ended_at, config_version, build_version, summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id) DO NOTHING
         RETURNING match_id`,
        [
          matchSummary.matchId,
          matchSummary.mode,
          matchSummary.startedAt,
          matchSummary.endedAt,
          matchSummary.configVersion,
          matchSummary.buildVersion,
          JSON.stringify(summary),
        ]
      );

      // If no rows returned, match was already processed (idempotency)
      // Note: rowCount can be null in pg types, use falsy check
      if (!insertResult.rowCount) {
        await client.query('COMMIT');
        console.log(`[MatchResults] Match ${matchSummary.matchId} already processed (idempotency)`);
        return res.json({
          success: true,
          message: 'Match results already processed',
          matchId: matchSummary.matchId,
        });
      }

      // Update authenticated players' stats (XP and coins only)
      for (const playerResult of matchSummary.playerResults) {
        if (playerResult.userId) {
          await updatePlayerStats(client, playerResult);
        }
      }

      await client.query('COMMIT');

      console.log(`[MatchResults] Saved match ${matchSummary.matchId} with ${matchSummary.playerResults.length} players`);

      res.json({
        success: true,
        message: 'Match results saved',
        matchId: matchSummary.matchId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[MatchResults] Error submitting results:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to save match results',
    });
  }
});

/**
 * Update player profile stats after match
 *
 * Note: profiles table only has columns: user_id, level, xp, selected_skin_id
 * Stats like total_matches, total_kills are stored in match_results.summary JSONB
 * and can be computed via SQL aggregation when needed.
 */
async function updatePlayerStats(client: any, playerResult: PlayerResult): Promise<void> {
  // Grant XP based on placement and kills
  // profiles.xp column exists in schema
  const xpGain = calculateXpGain(playerResult);
  if (xpGain > 0) {
    await client.query(
      `UPDATE profiles SET xp = xp + $2, updated_at = NOW() WHERE user_id = $1`,
      [playerResult.userId, xpGain]
    );
  }

  // Grant coins based on placement
  // wallets.coins column exists in schema
  const coinsGain = calculateCoinsGain(playerResult);
  if (coinsGain > 0) {
    await client.query(
      `UPDATE wallets SET coins = coins + $2, updated_at = NOW() WHERE user_id = $1`,
      [playerResult.userId, coinsGain]
    );
  }
}

/**
 * Calculate XP gain based on match performance
 */
function calculateXpGain(playerResult: PlayerResult): number {
  let xp = 10; // Base XP for completing a match

  // Placement bonus
  if (playerResult.placement === 1) xp += 50;
  else if (playerResult.placement === 2) xp += 30;
  else if (playerResult.placement === 3) xp += 20;
  else if (playerResult.placement <= 5) xp += 10;

  // Kill bonus
  xp += playerResult.killCount * 5;

  return xp;
}

/**
 * Calculate coins gain based on match performance
 */
function calculateCoinsGain(playerResult: PlayerResult): number {
  let coins = 5; // Base coins for completing a match

  // Placement bonus
  if (playerResult.placement === 1) coins += 25;
  else if (playerResult.placement === 2) coins += 15;
  else if (playerResult.placement === 3) coins += 10;
  else if (playerResult.placement <= 5) coins += 5;

  // Kill bonus
  coins += playerResult.killCount * 2;

  return coins;
}

export default router;
