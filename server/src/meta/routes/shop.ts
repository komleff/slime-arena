import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ShopService } from '../services/ShopService';
import { WalletService } from '../services/WalletService';

const router = Router();
const shopService = new ShopService();

/**
 * GET /api/v1/shop/offers
 * Get available shop offers
 */
router.get('/offers', authMiddleware, async (req, res) => {
  try {
    const offers = await shopService.getOffers();

    res.json({
      offers,
    });
  } catch (error: any) {
    console.error('[Shop] Offers error:', error);
    res.status(500).json({
      error: 'shop_error',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/shop/purchase
 * Purchase shop item
 */
router.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { offerId, operationId } = req.body;

    if (!offerId) {
      return res.status(400).json({
        error: 'missing_offer_id',
        message: 'offerId is required',
      });
    }

    // Generate operationId if not provided (for idempotency)
    const opId = operationId || WalletService.generateOperationId('purchase');

    const result = await shopService.purchase(userId, offerId, opId);

    res.json(result);
  } catch (error: any) {
    console.error('[Shop] Purchase error:', error);

    if (error.message.includes('Insufficient')) {
      return res.status(400).json({
        error: 'insufficient_balance',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'offer_not_found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'shop_error',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shop/unlocked
 * Get unlocked items
 */
router.get('/unlocked', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const itemType = req.query.itemType as string | undefined;

    const items = await shopService.getUnlockedItems(userId, itemType);

    res.json({
      items,
    });
  } catch (error: any) {
    console.error('[Shop] Unlocked items error:', error);
    res.status(500).json({
      error: 'shop_error',
      message: error.message,
    });
  }
});

export default router;
