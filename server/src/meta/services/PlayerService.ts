import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';

export interface Profile {
  userId: string;
  level: number;
  xp: number;
  selectedSkinId?: string;
}

export interface Wallet {
  coins: number;
  gems: number;
}

export interface ProfileSummary extends Profile {
  nickname: string;
  wallet: Wallet;
}

export class PlayerService {
  private _pool: Pool | null = null;

  /**
   * Lazy initialization: получаем пул только при первом обращении
   */
  private get pool(): Pool {
    if (!this._pool) {
      this._pool = getPostgresPool();
    }
    return this._pool;
  }

  async getProfile(userId: string): Promise<ProfileSummary> {
    const result = await this.pool.query(
      `SELECT 
        u.nickname,
        p.level,
        p.xp,
        p.selected_skin_id,
        w.coins,
        w.gems
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       INNER JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    const row = result.rows[0];
    return {
      userId,
      nickname: row.nickname,
      level: row.level,
      xp: row.xp,
      selectedSkinId: row.selected_skin_id,
      wallet: {
        coins: parseInt(row.coins, 10),
        gems: parseInt(row.gems, 10),
      },
    };
  }

  async updateNickname(userId: string, nickname: string, operationId: string): Promise<void> {
    // Check nickname length and format
    if (nickname.length < 3 || nickname.length > 50) {
      throw new Error('Nickname must be between 3 and 50 characters');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check idempotency
      const existingTransaction = await client.query(
        'SELECT id FROM transactions WHERE user_id = $1 AND operation_id = $2',
        [userId, operationId]
      );

      if (existingTransaction.rows.length > 0) {
        // Operation already performed
        await client.query('COMMIT');
        return;
      }

      // Update nickname
      await client.query(
        'UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2',
        [nickname, userId]
      );

      // Record transaction for idempotency
      await client.query(
        `INSERT INTO transactions (user_id, operation_id, type, source, payload) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, operationId, 'update', 'profile', JSON.stringify({ nickname })]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateSelectedSkin(userId: string, skinId: string): Promise<void> {
    // TODO: Verify that user has unlocked this skin
    await this.pool.query(
      'UPDATE profiles SET selected_skin_id = $1, updated_at = NOW() WHERE user_id = $2',
      [skinId, userId]
    );
  }

  async addXP(userId: string, amount: number): Promise<{ newLevel: number; newXP: number }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT level, xp FROM profiles WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Profile not found');
      }

      let level = result.rows[0].level;
      let xp = result.rows[0].xp + amount;

      // Simple level-up logic (can be refined)
      const xpPerLevel = 1000;
      while (xp >= xpPerLevel) {
        xp -= xpPerLevel;
        level++;
      }

      await client.query(
        'UPDATE profiles SET level = $1, xp = $2, updated_at = NOW() WHERE user_id = $3',
        [level, xp, userId]
      );

      await client.query('COMMIT');

      return { newLevel: level, newXP: xp };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
