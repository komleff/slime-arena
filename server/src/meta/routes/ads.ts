import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AdsService } from '../services/AdsService';
import { WalletService } from '../services/WalletService';

const router = Router();
const adsService = new AdsService();

/**
 * POST /api/v1/ads/grant
 * Generate ad grant before showing ad
 */
router.post('/grant', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { adPlacement } = req.body;

    if (!adPlacement) {
      return res.status(400).json({
        error: 'missing_ad_placement',
        message: 'adPlacement is required',
      });
    }

    const grantId = await adsService.generateGrant(userId, adPlacement);

    res.json({
      grantId,
      message: 'Ad grant created. Show ad and call /ads/claim after completion.',
    });
  } catch (error: any) {
    console.error('[Ads] Grant error:', error);

    if (error.message.includes('Unknown ad placement')) {
      return res.status(400).json({
        error: 'invalid_placement',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'ads_error',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ads/claim
 * Claim reward after ad completion
 */
router.post('/claim', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { grantId, operationId } = req.body;

    if (!grantId) {
      return res.status(400).json({
        error: 'missing_grant_id',
        message: 'grantId is required',
      });
    }

    // Generate operationId if not provided (for idempotency)
    const opId = operationId || WalletService.generateOperationId('ad_claim');

    const grant = await adsService.claimReward(userId, grantId, opId);

    res.json({
      success: true,
      rewardType: grant.rewardType,
      rewardAmount: grant.rewardAmount,
      rewardItemId: grant.rewardItemId,
      message: 'Reward claimed successfully',
    });
  } catch (error: any) {
    console.error('[Ads] Claim error:', error);

    if (error.message.includes('not found') || error.message.includes('expired')) {
      return res.status(404).json({
        error: 'grant_not_found',
        message: error.message,
      });
    }

    if (error.message.includes('different user')) {
      return res.status(403).json({
        error: 'grant_mismatch',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'ads_error',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/ads/grant/:grantId
 * Get grant status
 */
router.get('/grant/:grantId', authMiddleware, async (req, res) => {
  try {
    const { grantId } = req.params;

    const grant = await adsService.getGrant(grantId);

    if (!grant) {
      return res.status(404).json({
        error: 'grant_not_found',
        message: 'Grant not found or expired',
      });
    }

    res.json(grant);
  } catch (error: any) {
    console.error('[Ads] Grant status error:', error);
    res.status(500).json({
      error: 'ads_error',
      message: error.message,
    });
  }
});

export default router;
