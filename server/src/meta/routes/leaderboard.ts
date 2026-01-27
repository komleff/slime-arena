/**
 * Leaderboard API routes
 *
 * GET /api/v1/leaderboard - Get leaderboard entries
 */

import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwtUtils';
import { LeaderboardEntry } from '../models/Leaderboard';

const router = express.Router();

// Lazy pool initialization
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = getPostgresPool();
  }
  return pool;
}

type LeaderboardMode = 'total' | 'best';

interface LeaderboardResponse {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  myPosition?: number;
  myValue?: number;
}

/**
 * Extract user from optional authorization header
 * Returns null if no auth or invalid token
 */
function extractUser(req: Request): AccessTokenPayload | null {
  const authHeader = req.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyAccessToken(token);
}

/**
 * GET /api/v1/leaderboard
 *
 * Query params:
 * - mode: 'total' | 'best' (required)
 * - limit: number (default 100, max 100)
 * - offset: number (default 0)
 *
 * Returns:
 * - entries: top players sorted by mass DESC
 * - myPosition: current user's position (if authenticated and not anonymous)
 * - myValue: current user's value (if authenticated and not anonymous)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const mode = req.query.mode as string;

    if (!mode || (mode !== 'total' && mode !== 'best')) {
      return res.status(400).json({
        error: 'invalid_parameters',
        message: 'mode is required and must be "total" or "best"',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const db = getPool();

    // Get leaderboard entries
    const entries = await getLeaderboardEntries(db, mode as LeaderboardMode, limit, offset);

    // Build response
    const response: LeaderboardResponse = {
      mode: mode as LeaderboardMode,
      entries,
    };

    // Check for authenticated user position
    const user = extractUser(req);
    if (user && !user.isAnonymous) {
      const userPosition = await getUserPosition(db, mode as LeaderboardMode, user.sub);
      if (userPosition) {
        response.myPosition = userPosition.position;
        response.myValue = userPosition.value;
      }
    }

    res.json(response);
  } catch (error: any) {
    console.error('[Leaderboard] Error:', error);
    res.status(500).json({
      error: 'leaderboard_error',
      message: 'Failed to fetch leaderboard',
    });
  }
});

/**
 * Fetch leaderboard entries from database
 */
async function getLeaderboardEntries(
  db: Pool,
  mode: LeaderboardMode,
  limit: number,
  offset: number
): Promise<LeaderboardEntry[]> {
  const table = mode === 'total' ? 'leaderboard_total_mass' : 'leaderboard_best_mass';
  const valueColumn = mode === 'total' ? 'total_mass' : 'best_mass';

  const result = await db.query(
    `SELECT
       ROW_NUMBER() OVER (ORDER BY lb.${valueColumn} DESC) as position,
       lb.user_id,
       u.nickname,
       COALESCE(p.selected_skin_id, 'slime_green') as skin_id,
       lb.${valueColumn} as value
     FROM ${table} lb
     INNER JOIN users u ON u.id = lb.user_id
     LEFT JOIN profiles p ON p.user_id = lb.user_id
     WHERE u.is_banned = FALSE
     ORDER BY lb.${valueColumn} DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows.map((row) => ({
    position: parseInt(row.position, 10),
    userId: row.user_id,
    nickname: row.nickname,
    skinId: row.skin_id,
    value: row.value,
  }));
}

/**
 * Get user's position in leaderboard
 */
async function getUserPosition(
  db: Pool,
  mode: LeaderboardMode,
  userId: string
): Promise<{ position: number; value: number } | null> {
  const table = mode === 'total' ? 'leaderboard_total_mass' : 'leaderboard_best_mass';
  const valueColumn = mode === 'total' ? 'total_mass' : 'best_mass';

  // Get user's value
  const userResult = await db.query(
    `SELECT ${valueColumn} as value FROM ${table} WHERE user_id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  const userValue = userResult.rows[0].value;

  // Count users with higher value
  const positionResult = await db.query(
    `SELECT COUNT(*) + 1 as position
     FROM ${table} lb
     INNER JOIN users u ON u.id = lb.user_id
     WHERE lb.${valueColumn} > $1
       AND u.is_banned = FALSE`,
    [userValue]
  );

  return {
    position: parseInt(positionResult.rows[0].position, 10),
    value: userValue,
  };
}

export default router;
