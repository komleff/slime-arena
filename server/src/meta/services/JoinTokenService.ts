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
    // Get secret from environment or use default for development
    this.secret = process.env.JOIN_TOKEN_SECRET || process.env.JWT_SECRET || 'slime-arena-dev-secret';

    // Token validity period (default: 5 minutes)
    this.expiresInSeconds = parseInt(process.env.JOIN_TOKEN_EXPIRES || '300', 10);

    if (!process.env.JOIN_TOKEN_SECRET && !process.env.JWT_SECRET) {
      console.warn('[JoinTokenService] WARNING: Using default secret. Set JOIN_TOKEN_SECRET in production!');
    }
  }

  /**
   * Generate a join token for a player
   */
  generateToken(userId: string, matchId: string, roomId: string, nickname: string): string {
    const payload: JoinTokenPayload = {
      userId,
      matchId,
      roomId,
      nickname,
    };

    const token = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresInSeconds,
      algorithm: 'HS256',
    });

    console.log(`[JoinTokenService] Generated token for user ${userId} -> match ${matchId}`);

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
   */
  verifyTokenForRoom(token: string, expectedRoomId: string): JoinTokenPayload {
    const payload = this.verifyToken(token);

    if (payload.roomId !== expectedRoomId) {
      throw new Error(`Token roomId mismatch: expected ${expectedRoomId}, got ${payload.roomId}`);
    }

    return payload;
  }
}

// Singleton instance
export const joinTokenService = new JoinTokenService();
