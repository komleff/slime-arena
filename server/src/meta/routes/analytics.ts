import { Router, Request, Response } from 'express';
import { AnalyticsService, EventTypes } from '../services/AnalyticsService';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
const analyticsService = new AnalyticsService();

/**
 * POST /api/v1/analytics/track
 * Track single event
 */
router.post('/track', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { eventType, properties, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required',
      });
    }

    const platform = req.headers['x-platform'] as string;
    const clientVersion = req.headers['x-client-version'] as string;

    await analyticsService.track(eventType, properties || {}, {
      userId,
      sessionId,
      platform,
      clientVersion,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics] Track error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event',
    });
  }
});

/**
 * POST /api/v1/analytics/batch
 * Track batch of events
 */
router.post('/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { events, sessionId } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'events array is required',
      });
    }

    const platform = req.headers['x-platform'] as string;
    const clientVersion = req.headers['x-client-version'] as string;

    const result = await analyticsService.trackBatch(events, {
      userId,
      sessionId,
      platform,
      clientVersion,
    });

    res.json({
      success: true,
      accepted: result.accepted,
      rejected: result.rejected,
    });
  } catch (error) {
    console.error('[Analytics] Batch track error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track events',
    });
  }
});

/**
 * GET /api/v1/analytics/event-types
 * Get list of predefined event types
 */
router.get('/event-types', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    eventTypes: Object.values(EventTypes),
  });
});

// ============= Admin routes =============

/**
 * GET /api/v1/analytics/admin/query
 * Query events (admin only)
 */
router.get('/admin/query', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      userId,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const result = await analyticsService.queryEvents({
      eventType: eventType as string,
      userId: userId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      events: result.events,
      total: result.total,
    });
  } catch (error) {
    console.error('[Analytics] Query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query events',
    });
  }
});

/**
 * GET /api/v1/analytics/admin/stats
 * Get aggregated stats (admin only)
 */
router.get('/admin/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { eventType, groupBy, startDate, endDate } = req.query;

    if (!eventType || !groupBy || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'eventType, groupBy, startDate, and endDate are required',
      });
    }

    const validGroupBy = ['hour', 'day', 'week'];
    if (!validGroupBy.includes(groupBy as string)) {
      return res.status(400).json({
        success: false,
        error: 'groupBy must be one of: hour, day, week',
      });
    }

    const stats = await analyticsService.getStats({
      eventType: eventType as string,
      groupBy: groupBy as 'hour' | 'day' | 'week',
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Analytics] Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

/**
 * POST /api/v1/analytics/admin/flush
 * Force flush events buffer (admin only)
 */
router.post('/admin/flush', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await analyticsService.flush();

    res.json({
      success: true,
      message: 'Events flushed',
    });
  } catch (error) {
    console.error('[Analytics] Flush error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to flush events',
    });
  }
});

export default router;
