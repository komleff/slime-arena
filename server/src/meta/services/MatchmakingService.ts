import { getRedisClient } from '../../db/pool';
import { RedisClientType } from 'redis';
import { joinTokenService } from './JoinTokenService';

export interface MatchmakingRequest {
  userId: string;
  nickname: string;
  rating: number;
  timestamp: number;
  /** Guest subject ID (UUID) for standalone guests - used for match claim verification */
  guestSubjectId?: string;
}

export interface MatchAssignment {
  roomId: string;
  roomHost: string;
  roomPort: number;
  matchId: string;
  players: Array<{ userId: string; nickname: string; guestSubjectId?: string }>;
  /** JWT token for joining the match (per-player) */
  joinToken?: string;
}

export interface PlayerMatchAssignment extends MatchAssignment {
  /** JWT token for this specific player */
  joinToken: string;
}

/**
 * Matchmaking service using Redis queue
 * Implements simple FIFO matchmaking for Soft Launch
 */
export class MatchmakingService {
  private _redis: RedisClientType | null = null;
  private readonly QUEUE_KEY = 'matchmaking:queue';
  private readonly MATCH_PREFIX = 'matchmaking:match:';
  private readonly USER_MATCH_PREFIX = 'matchmaking:user:'; // Maps userId -> matchId
  private readonly TIMEOUT_MS = 60000; // 60 seconds timeout
  private readonly PLAYERS_PER_MATCH = 8;

  private get redis(): RedisClientType {
    if (!this._redis) {
      this._redis = getRedisClient();
    }
    return this._redis;
  }

  constructor() {}

  /**
   * Add player to matchmaking queue
   * @param userId - User ID (UUID) or empty string for guests
   * @param nickname - Player nickname
   * @param rating - Player rating (default: 1500)
   * @param guestSubjectId - Guest subject ID (UUID) for standalone guests
   */
  async joinQueue(userId: string, nickname: string, rating: number = 1500, guestSubjectId?: string): Promise<void> {
    const request: MatchmakingRequest = {
      userId,
      nickname,
      rating,
      timestamp: Date.now(),
      guestSubjectId,
    };

    // Check if user is already in queue
    const inQueue = await this.isInQueue(userId);
    if (inQueue) {
      throw new Error('User already in matchmaking queue');
    }

    // Add to sorted set by timestamp (FIFO)
    await this.redis.zAdd(this.QUEUE_KEY, {
      score: request.timestamp,
      value: JSON.stringify(request),
    });

    console.log(`[Matchmaking] User ${userId} joined queue (rating: ${rating})`);
  }

  /**
   * Remove player from matchmaking queue
   */
  async leaveQueue(userId: string): Promise<boolean> {
    // Get all queue members
    const members = await this.redis.zRange(this.QUEUE_KEY, 0, -1);

    for (const member of members) {
      const request: MatchmakingRequest = JSON.parse(member);
      if (request.userId === userId) {
        await this.redis.zRem(this.QUEUE_KEY, member);
        console.log(`[Matchmaking] User ${userId} left queue`);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user is in queue
   */
  async isInQueue(userId: string): Promise<boolean> {
    const members = await this.redis.zRange(this.QUEUE_KEY, 0, -1);

    for (const member of members) {
      const request: MatchmakingRequest = JSON.parse(member);
      if (request.userId === userId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get queue position (0-based)
   */
  async getQueuePosition(userId: string): Promise<number> {
    const members = await this.redis.zRange(this.QUEUE_KEY, 0, -1);

    for (let i = 0; i < members.length; i++) {
      const request: MatchmakingRequest = JSON.parse(members[i]);
      if (request.userId === userId) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Process matchmaking queue and create matches
   * Should be called periodically (e.g., every 2-5 seconds)
   */
  async processQueue(): Promise<MatchAssignment[]> {
    const members = await this.redis.zRange(this.QUEUE_KEY, 0, -1);

    if (members.length < 2) {
      // Need at least 2 players for a match
      return [];
    }

    const requests: MatchmakingRequest[] = members.map((m: string) => JSON.parse(m));
    const now = Date.now();

    // Remove timed-out requests
    const validRequests = requests.filter((req) => {
      if (now - req.timestamp > this.TIMEOUT_MS) {
        console.log(`[Matchmaking] Request timeout for user ${req.userId}`);
        this.redis.zRem(this.QUEUE_KEY, JSON.stringify(req));
        return false;
      }
      return true;
    });

    if (validRequests.length < 2) {
      return [];
    }

    const assignments: MatchAssignment[] = [];

    // Create matches (simple FIFO, no rating-based matchmaking for Soft Launch)
    while (validRequests.length >= 2) {
      const playersToMatch = validRequests.splice(0, Math.min(this.PLAYERS_PER_MATCH, validRequests.length));

      if (playersToMatch.length >= 2) {
        const assignment = await this.createMatch(playersToMatch);
        assignments.push(assignment);

        // Remove players from queue
        for (const player of playersToMatch) {
          await this.redis.zRem(this.QUEUE_KEY, JSON.stringify(player));
        }
      }
    }

    return assignments;
  }

  /**
   * Create a match and assign room
   */
  private async createMatch(players: MatchmakingRequest[]): Promise<MatchAssignment> {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // TODO: In production, this should query MatchServer registry to find available room
    // For Soft Launch, we use hardcoded room details
    const roomHost = process.env.MATCH_SERVER_HOST || 'localhost';
    const roomPort = parseInt(process.env.MATCH_SERVER_PORT || '2567', 10);
    const roomId = `arena_${matchId}`;

    // Generate joinToken for each player and store mapping
    const playerTokens: Record<string, string> = {};
    for (const player of players) {
      const token = joinTokenService.generateToken(
        player.userId,
        matchId,
        roomId,
        player.nickname,
        player.guestSubjectId
      );
      playerTokens[player.userId] = token;
    }

    const assignment: MatchAssignment = {
      roomId,
      roomHost,
      roomPort,
      matchId,
      players: players.map((p) => ({
        userId: p.userId,
        nickname: p.nickname,
        guestSubjectId: p.guestSubjectId,
      })),
    };

    // Use same TTL as token expiration for consistency
    const ttlSeconds = joinTokenService.getExpiresInSeconds();

    // Store match assignment in Redis
    await this.redis.setEx(
      `${this.MATCH_PREFIX}${matchId}`,
      ttlSeconds,
      JSON.stringify(assignment)
    );

    // Store player tokens separately
    await this.redis.setEx(
      `${this.MATCH_PREFIX}${matchId}:tokens`,
      ttlSeconds,
      JSON.stringify(playerTokens)
    );

    // Store user-to-match mapping for each player
    for (const player of players) {
      await this.redis.setEx(
        `${this.USER_MATCH_PREFIX}${player.userId}`,
        ttlSeconds,
        matchId
      );
    }

    console.log(`[Matchmaking] Created match ${matchId} with ${players.length} players`);

    return assignment;
  }

  /**
   * Get matchId assigned to a user (if any)
   */
  async getUserMatchId(userId: string): Promise<string | null> {
    return await this.redis.get(`${this.USER_MATCH_PREFIX}${userId}`);
  }

  /**
   * Clear user's match assignment (when they join the room)
   */
  async clearUserMatchAssignment(userId: string): Promise<void> {
    await this.redis.del(`${this.USER_MATCH_PREFIX}${userId}`);
  }

  /**
   * Generate a fallback token for a player (when original token expired/missing)
   */
  private generateFallbackToken(
    userId: string,
    matchId: string,
    assignment: MatchAssignment
  ): string {
    const player = assignment.players.find((p) => p.userId === userId);
    if (!player) {
      throw new Error(`Player ${userId} not found in match ${matchId}`);
    }
    return joinTokenService.generateToken(
      userId,
      matchId,
      assignment.roomId,
      player.nickname,
      player.guestSubjectId
    );
  }

  /**
   * Get player-specific match assignment with their joinToken
   */
  async getPlayerAssignment(matchId: string, userId: string): Promise<PlayerMatchAssignment | null> {
    const assignment = await this.getMatchAssignment(matchId);
    if (!assignment) {
      return null;
    }

    // Check if user is part of this match
    const isPlayer = assignment.players.some((p) => p.userId === userId);
    if (!isPlayer) {
      return null;
    }

    // Get the player's token
    const tokensData = await this.redis.get(`${this.MATCH_PREFIX}${matchId}:tokens`);
    if (!tokensData) {
      // Tokens expired or not found - generate a new one
      console.warn(`[Matchmaking] Tokens not found for match ${matchId}, generating new one`);
      const token = this.generateFallbackToken(userId, matchId, assignment);
      return { ...assignment, joinToken: token };
    }

    const playerTokens: Record<string, string> = JSON.parse(tokensData);
    const joinToken = playerTokens[userId];

    if (!joinToken) {
      // Token not found for this user - generate a new one
      console.warn(`[Matchmaking] Token not found for user ${userId} in match ${matchId}`);
      const token = this.generateFallbackToken(userId, matchId, assignment);
      return { ...assignment, joinToken: token };
    }

    return { ...assignment, joinToken };
  }

  /**
   * Get match assignment by matchId
   */
  async getMatchAssignment(matchId: string): Promise<MatchAssignment | null> {
    const data = await this.redis.get(`${this.MATCH_PREFIX}${matchId}`);
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{ queueSize: number; oldestTimestamp: number | null }> {
    const size = await this.redis.zCard(this.QUEUE_KEY);

    if (size === 0) {
      return { queueSize: 0, oldestTimestamp: null };
    }

    const oldest = await this.redis.zRange(this.QUEUE_KEY, 0, 0);
    if (oldest.length > 0) {
      const request: MatchmakingRequest = JSON.parse(oldest[0]);
      return { queueSize: size, oldestTimestamp: request.timestamp };
    }

    return { queueSize: size, oldestTimestamp: null };
  }
}
