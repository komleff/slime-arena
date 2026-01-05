import express, { Request, Response } from 'express';
import { PlayerService } from '../services/PlayerService';
import { requireAuth } from '../middleware/auth';

const router = express.Router();
const playerService = new PlayerService();

/**
 * GET /api/v1/profile
 * Get player profile
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const profile = await playerService.getProfile(userId);
    res.json(profile);
  } catch (error: any) {
    console.error('[Profile] Error getting profile:', error);
    res.status(500).json({
      error: 'profile_error',
      message: error.message || 'Failed to get profile',
    });
  }
});

/**
 * POST /api/v1/profile/nickname
 * Update player nickname
 */
router.post('/nickname', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { nickname, operationId } = req.body;

    if (!nickname || !operationId) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'nickname and operationId are required',
      });
    }

    await playerService.updateNickname(userId, nickname, operationId);
    
    // Return updated profile
    const profile = await playerService.getProfile(userId);
    res.json(profile);
  } catch (error: any) {
    console.error('[Profile] Error updating nickname:', error);
    res.status(400).json({
      error: 'update_failed',
      message: error.message || 'Failed to update nickname',
    });
  }
});

export default router;
