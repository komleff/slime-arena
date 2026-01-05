import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import * as crypto from 'crypto';

export interface User {
  id: string;
  platformType: string;
  platformId: string;
  nickname: string;
  avatarUrl?: string;
  locale: string;
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  expiresAt: Date;
}

export class AuthService {
  private pool: Pool;
  private readonly SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor() {
    this.pool = getPostgresPool();
  }

  /**
   * Verify platform authentication and create/update user
   * For now, this is a simple implementation - platform-specific verification should be added
   */
  async verifyAndCreateSession(
    platformType: string,
    platformAuthToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ user: User; session: Session }> {
    // TODO: Add platform-specific token verification (Telegram, Yandex, etc.)
    // For now, we'll parse a simple format: "platform_id:nickname"
    const [platformId, nickname] = platformAuthToken.split(':');
    
    if (!platformId || !nickname) {
      throw new Error('Invalid auth token format');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Find or create user
      let userResult = await client.query(
        'SELECT id, platform_type, platform_id, nickname, avatar_url, locale FROM users WHERE platform_type = $1 AND platform_id = $2',
        [platformType, platformId]
      );

      let user: User;

      if (userResult.rows.length === 0) {
        // Create new user
        const insertUserResult = await client.query(
          `INSERT INTO users (platform_type, platform_id, nickname, last_login_at) 
           VALUES ($1, $2, $3, NOW()) 
           RETURNING id, platform_type, platform_id, nickname, avatar_url, locale`,
          [platformType, platformId, nickname]
        );
        user = this.mapUserRow(insertUserResult.rows[0]);

        // Create profile
        await client.query(
          'INSERT INTO profiles (user_id) VALUES ($1)',
          [user.id]
        );

        // Create wallet
        await client.query(
          'INSERT INTO wallets (user_id) VALUES ($1)',
          [user.id]
        );
      } else {
        user = this.mapUserRow(userResult.rows[0]);

        // Update last login
        await client.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = $1',
          [user.id]
        );
      }

      // Generate access token
      const accessToken = this.generateAccessToken();
      const tokenHash = this.hashToken(accessToken);
      const expiresAt = new Date(Date.now() + this.SESSION_DURATION_MS);

      // Create session
      const sessionResult = await client.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        [user.id, tokenHash, expiresAt, ip, userAgent]
      );

      await client.query('COMMIT');

      return {
        user,
        session: {
          id: sessionResult.rows[0].id,
          userId: user.id,
          accessToken,
          expiresAt,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify session token and return user
   */
  async verifySession(accessToken: string): Promise<User | null> {
    const tokenHash = this.hashToken(accessToken);

    const result = await this.pool.query(
      `SELECT u.id, u.platform_type, u.platform_id, u.nickname, u.avatar_url, u.locale
       FROM users u
       INNER JOIN sessions s ON s.user_id = u.id
       WHERE s.token_hash = $1 
         AND s.expires_at > NOW()
         AND s.revoked_at IS NULL
         AND u.is_banned = FALSE`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Revoke session
   */
  async revokeSession(accessToken: string): Promise<void> {
    const tokenHash = this.hashToken(accessToken);

    await this.pool.query(
      'UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
  }

  private generateAccessToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private mapUserRow(row: any): User {
    return {
      id: row.id,
      platformType: row.platform_type,
      platformId: row.platform_id,
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      locale: row.locale,
    };
  }
}
