/**
 * JoinTokenService - JWT-based token generation and verification for match joining
 *
 * This service creates signed tokens that authorize clients to join specific matches.
 * Tokens are validated by ArenaRoom.onAuth() before allowing connection.
 */

import jwt from 'jsonwebtoken';

export interface JoinTokenPayload {
  userId: string;
  matchId: string;
  roomId: string;
  nickname: string;
  /** Guest subject ID (UUID) for standalone guests - used for match claim verification */
  guestSubjectId?: string;
  /** Token issue time (Unix timestamp) */
  iat?: number;
  /** Token expiration time (Unix timestamp) */
  exp?: number;
}

/**
 * Service for generating and verifying join tokens
 */
export class JoinTokenService {
  private readonly secret: string;
  private readonly expiresInSeconds: number;

  constructor() {
    const hasCustomSecret = !!(process.env.JOIN_TOKEN_SECRET || process.env.JWT_SECRET);
    const isTokenRequired = process.env.JOIN_TOKEN_REQUIRED === 'true' || process.env.JOIN_TOKEN_REQUIRED === '1';
    const isProduction = process.env.NODE_ENV === 'production';

    // Fail-fast: refuse to start if tokens are required but no secret is configured
    if ((isTokenRequired || isProduction) && !hasCustomSecret) {
      throw new Error(
        '[JoinTokenService] FATAL: JOIN_TOKEN_SECRET must be set when JOIN_TOKEN_REQUIRED=true or in production!'
      );
    }

    // Get secret from environment or use default for development
    this.secret = process.env.JOIN_TOKEN_SECRET || process.env.JWT_SECRET || 'slime-arena-dev-secret';

    // Token validity period (default: 5 minutes) with validation
    const parsedExpires = parseInt(process.env.JOIN_TOKEN_EXPIRES || '300', 10);
    this.expiresInSeconds = Number.isFinite(parsedExpires) && parsedExpires > 0 ? parsedExpires : 300;

    if (!hasCustomSecret) {
      console.warn('[JoinTokenService] WARNING: Using default secret. Set JOIN_TOKEN_SECRET in production!');
    }
  }

  /**
   * Get token expiration time in seconds (for syncing TTLs)
   */
  getExpiresInSeconds(): number {
    return this.expiresInSeconds;
  }

  /**
   * Mask userId for logging (privacy protection)
   */
  maskUserId(userId: string): string {
    if (!userId || userId.length <= 4) return '***';
    return `${userId.slice(0, 4)}***`;
  }

  /**
   * Generate a join token for a player
   * @param userId - User ID (UUID) or empty string for guests
   * @param matchId - Match ID
   * @param roomId - Room ID
   * @param nickname - Player nickname
   * @param guestSubjectId - Guest subject ID (UUID) for standalone guests
   */
  generateToken(userId: string, matchId: string, roomId: string, nickname: string, guestSubjectId?: string): string {
    const payload: JoinTokenPayload = {
      userId,
      matchId,
      roomId,
      nickname,
    };

    // Add guestSubjectId only if provided (for standalone guests)
    if (guestSubjectId) {
      payload.guestSubjectId = guestSubjectId;
    }

    const token = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresInSeconds,
      algorithm: 'HS256',
    });

    const subjectInfo = guestSubjectId
      ? `guest ${this.maskUserId(guestSubjectId)}`
      : `user ${this.maskUserId(userId)}`;
    console.log(`[JoinTokenService] Generated token for ${subjectInfo} -> match ${matchId}`);

    return token;
  }

  /**
   * Verify and decode a join token
   * @throws Error if token is invalid, expired, or tampered
   */
  verifyToken(token: string): JoinTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      }) as JoinTokenPayload;

      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Join token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error(`Invalid join token: ${error.message}`);
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Verify token and check if it matches expected roomId
   * If token's roomId is empty, it's valid for any room (dev mode / quick play)
   */
  verifyTokenForRoom(token: string, expectedRoomId: string): JoinTokenPayload {
    const payload = this.verifyToken(token);

    // Allow empty roomId in token for quick play (not assigned via matchmaking)
    if (payload.roomId && payload.roomId !== expectedRoomId) {
      throw new Error(`Token roomId mismatch: expected ${expectedRoomId}, got ${payload.roomId}`);
    }

    return payload;
  }
}

// Singleton instance
export const joinTokenService = new JoinTokenService();
