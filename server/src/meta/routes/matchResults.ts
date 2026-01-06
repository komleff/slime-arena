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

      // Check for idempotency - if match already exists, return success
      const existingMatch = await client.query(
        'SELECT id FROM match_results WHERE match_id = $1',
        [matchSummary.matchId]
      );

      if (existingMatch.rows.length > 0) {
        await client.query('COMMIT');
        console.log(`[MatchResults] Match ${matchSummary.matchId} already processed (idempotency)`);
        return res.json({
          success: true,
          message: 'Match results already processed',
          matchId: matchSummary.matchId,
        });
      }

      // Insert match result
      const matchResult = await client.query(
        `INSERT INTO match_results
         (match_id, mode, started_at, ended_at, config_version, build_version,
          player_count, match_stats, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id`,
        [
          matchSummary.matchId,
          matchSummary.mode,
          matchSummary.startedAt,
          matchSummary.endedAt,
          matchSummary.configVersion,
          matchSummary.buildVersion,
          matchSummary.playerResults.length,
          matchSummary.matchStats ? JSON.stringify(matchSummary.matchStats) : null,
        ]
      );

      const matchResultId = matchResult.rows[0].id;

      // Insert player results
      for (const playerResult of matchSummary.playerResults) {
        await client.query(
          `INSERT INTO player_match_results
           (match_result_id, user_id, session_id, placement, final_mass,
            kill_count, death_count, level, class_id, is_dead, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            matchResultId,
            playerResult.userId || null,
            playerResult.sessionId,
            playerResult.placement,
            playerResult.finalMass,
            playerResult.killCount,
            playerResult.deathCount,
            playerResult.level,
            playerResult.classId,
            playerResult.isDead,
          ]
        );

        // If player is authenticated, update their profile stats
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
 */
async function updatePlayerStats(client: any, playerResult: PlayerResult): Promise<void> {
  // Update profile stats
  await client.query(
    `UPDATE profiles SET
       total_matches = total_matches + 1,
       total_kills = total_kills + $2,
       total_deaths = total_deaths + $3,
       best_placement = LEAST(best_placement, $4),
       updated_at = NOW()
     WHERE user_id = $1`,
    [
      playerResult.userId,
      playerResult.killCount,
      playerResult.deathCount,
      playerResult.placement,
    ]
  );

  // Grant XP based on placement and kills
  const xpGain = calculateXpGain(playerResult);
  if (xpGain > 0) {
    await client.query(
      `UPDATE profiles SET xp = xp + $2, updated_at = NOW() WHERE user_id = $1`,
      [playerResult.userId, xpGain]
    );
  }

  // Grant coins based on placement
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
