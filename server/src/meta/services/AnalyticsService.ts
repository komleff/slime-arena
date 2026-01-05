import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import { getRedisClient } from '../../db/redis';

export interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  properties: Record<string, any>;
  platform?: string;
  clientVersion?: string;
}

export interface EventBatch {
  events: AnalyticsEvent[];
  receivedAt: Date;
}

const EVENTS_BUFFER_KEY = 'analytics:buffer';
const BATCH_SIZE = parseInt(process.env.ANALYTICS_BATCH_SIZE || '100', 10);
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

/**
 * Event types enum for type safety
 */
export const EventTypes = {
  // Session events
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',

  // Match events
  MATCH_SEARCH_START: 'match_search_start',
  MATCH_SEARCH_CANCEL: 'match_search_cancel',
  MATCH_FOUND: 'match_found',
  MATCH_START: 'match_start',
  MATCH_END: 'match_end',
  MATCH_LEAVE: 'match_leave',

  // Economy events
  CURRENCY_EARN: 'currency_earn',
  CURRENCY_SPEND: 'currency_spend',
  PURCHASE_START: 'purchase_start',
  PURCHASE_COMPLETE: 'purchase_complete',
  PURCHASE_FAIL: 'purchase_fail',

  // Ad events
  AD_REQUEST: 'ad_request',
  AD_SHOW: 'ad_show',
  AD_COMPLETE: 'ad_complete',
  AD_SKIP: 'ad_skip',
  AD_REWARD_CLAIM: 'ad_reward_claim',

  // Progression events
  LEVEL_UP: 'level_up',
  ACHIEVEMENT_UNLOCK: 'achievement_unlock',
  ITEM_UNLOCK: 'item_unlock',

  // UI events
  SCREEN_VIEW: 'screen_view',
  BUTTON_CLICK: 'button_click',

  // Error events
  CLIENT_ERROR: 'client_error',
  SERVER_ERROR: 'server_error',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export class AnalyticsService {
  private pool: Pool;
  private buffer: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    this.pool = getPostgresPool();
    this.startFlushTimer();
  }

  /**
   * Track single event
   */
  async track(
    eventType: string,
    properties: Record<string, any> = {},
    options?: {
      userId?: string;
      sessionId?: string;
      platform?: string;
      clientVersion?: string;
    }
  ): Promise<void> {
    const event: AnalyticsEvent = {
      eventId: crypto.randomUUID(),
      eventType,
      userId: options?.userId,
      sessionId: options?.sessionId,
      timestamp: new Date(),
      properties,
      platform: options?.platform,
      clientVersion: options?.clientVersion,
    };

    this.buffer.push(event);

    // Auto-flush if buffer is full
    if (this.buffer.length >= BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * Track batch of events (from client)
   */
  async trackBatch(events: Array<{
    eventType: string;
    properties?: Record<string, any>;
    timestamp?: string;
  }>, options?: {
    userId?: string;
    sessionId?: string;
    platform?: string;
    clientVersion?: string;
  }): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;

    for (const event of events) {
      try {
        // Validate event type
        if (!event.eventType || typeof event.eventType !== 'string') {
          rejected++;
          continue;
        }

        const analyticsEvent: AnalyticsEvent = {
          eventId: crypto.randomUUID(),
          eventType: event.eventType,
          userId: options?.userId,
          sessionId: options?.sessionId,
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
          properties: event.properties || {},
          platform: options?.platform,
          clientVersion: options?.clientVersion,
        };

        this.buffer.push(analyticsEvent);
        accepted++;
      } catch {
        rejected++;
      }
    }

    // Auto-flush if buffer is full
    if (this.buffer.length >= BATCH_SIZE) {
      await this.flush();
    }

    return { accepted, rejected };
  }

  /**
   * Flush buffered events to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      // Batch insert to PostgreSQL
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const event of eventsToFlush) {
        placeholders.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
        );
        values.push(
          event.eventId,
          event.eventType,
          event.userId || null,
          event.sessionId || null,
          event.timestamp,
          JSON.stringify(event.properties),
          event.platform || null,
          event.clientVersion || null
        );
      }

      await this.pool.query(
        `INSERT INTO analytics_events 
         (event_id, event_type, user_id, session_id, timestamp, properties, platform, client_version)
         VALUES ${placeholders.join(', ')}`,
        values
      );

      console.log(`[Analytics] Flushed ${eventsToFlush.length} events`);
    } catch (error) {
      // On failure, put events back in buffer (with limit)
      console.error('[Analytics] Flush failed:', error);
      this.buffer = [...eventsToFlush.slice(-BATCH_SIZE), ...this.buffer].slice(-BATCH_SIZE * 2);
    }
  }

  /**
   * Also buffer to Redis for real-time analytics
   */
  async trackToRedis(
    eventType: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const event = {
        eventType,
        properties,
        timestamp: Date.now(),
      };

      await redis.lPush(EVENTS_BUFFER_KEY, JSON.stringify(event));
      // Keep only last 10000 events in Redis
      await redis.lTrim(EVENTS_BUFFER_KEY, 0, 9999);
    } catch (error) {
      console.error('[Analytics] Redis track failed:', error);
    }
  }

  /**
   * Query events (for admin dashboard)
   */
  async queryEvents(options: {
    eventType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AnalyticsEvent[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(options.eventType);
    }

    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }

    if (options.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM analytics_events ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get events
    const eventsResult = await this.pool.query(
      `SELECT * FROM analytics_events ${whereClause} 
       ORDER BY timestamp DESC 
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const events = eventsResult.rows.map((row: any) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      userId: row.user_id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      properties: row.properties,
      platform: row.platform,
      clientVersion: row.client_version,
    }));

    return { events, total };
  }

  /**
   * Get aggregated stats
   */
  async getStats(options: {
    eventType: string;
    groupBy: 'hour' | 'day' | 'week';
    startDate: Date;
    endDate: Date;
  }): Promise<Array<{ period: string; count: number }>> {
    let dateFormat: string;
    switch (options.groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case 'week':
        dateFormat = 'IYYY-IW';
        break;
      case 'day':
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const result = await this.pool.query(
      `SELECT TO_CHAR(timestamp, $1) as period, COUNT(*) as count
       FROM analytics_events
       WHERE event_type = $2 AND timestamp >= $3 AND timestamp <= $4
       GROUP BY period
       ORDER BY period`,
      [dateFormat, options.eventType, options.startDate, options.endDate]
    );

    return result.rows.map((row: any) => ({
      period: row.period,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
    console.log('[Analytics] Service shutdown complete');
  }
}
