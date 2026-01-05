import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { MatchmakingService } from '../services/MatchmakingService';

const router = Router();
const matchmakingService = new MatchmakingService();

/**
 * POST /api/v1/matchmaking/join
 * Join matchmaking queue
 */
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { rating } = req.body;

    await matchmakingService.joinQueue(userId, req.user!.nickname, rating || 1500);

    const position = await matchmakingService.getQueuePosition(userId);

    res.json({
      success: true,
      queuePosition: position,
      message: 'Joined matchmaking queue',
    });
  } catch (error: any) {
    console.error('[Matchmaking] Join error:', error);
    res.status(400).json({
      error: 'matchmaking_error',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/matchmaking/cancel
 * Leave matchmaking queue
 */
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;

    const removed = await matchmakingService.leaveQueue(userId);

    res.json({
      success: removed,
      message: removed ? 'Left matchmaking queue' : 'Not in queue',
    });
  } catch (error: any) {
    console.error('[Matchmaking] Cancel error:', error);
    res.status(400).json({
      error: 'matchmaking_error',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/matchmaking/status
 * Get matchmaking status for current user
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;

    const inQueue = await matchmakingService.isInQueue(userId);
    const position = inQueue ? await matchmakingService.getQueuePosition(userId) : -1;
    const stats = await matchmakingService.getQueueStats();

    res.json({
      inQueue,
      queuePosition: position,
      queueStats: stats,
    });
  } catch (error: any) {
    console.error('[Matchmaking] Status error:', error);
    res.status(500).json({
      error: 'matchmaking_error',
      message: error.message,
    });
  }
});

export default router;
