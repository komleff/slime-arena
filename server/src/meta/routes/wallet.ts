import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { WalletService } from '../services/WalletService';

const router = Router();
const walletService = new WalletService();

/**
 * GET /api/v1/wallet/balance
 * Get wallet balance
 */
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;

    const wallet = await walletService.getWallet(userId);
    if (!wallet) {
      return res.status(404).json({
        error: 'wallet_not_found',
        message: 'Wallet not found',
      });
    }

    res.json({
      softCurrency: wallet.softCurrency,
      hardCurrency: wallet.hardCurrency,
      updatedAt: wallet.updatedAt,
    });
  } catch (error: any) {
    console.error('[Wallet] Balance error:', error);
    res.status(500).json({
      error: 'wallet_error',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/wallet/transactions
 * Get transaction history
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const transactions = await walletService.getTransactionHistory(userId, Math.min(limit, 100));

    res.json({
      transactions,
    });
  } catch (error: any) {
    console.error('[Wallet] Transactions error:', error);
    res.status(500).json({
      error: 'wallet_error',
      message: error.message,
    });
  }
});

export default router;
