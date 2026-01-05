import { Router, Request, Response } from 'express';
import { PaymentProviderFactory } from '../payment/PaymentProviderFactory';
import { TelegramStarsProvider } from '../payment/TelegramStarsProvider';
import { YandexPayProvider } from '../payment/YandexPayProvider';
import { WalletService } from '../services/WalletService';
import { ShopService } from '../services/ShopService';
import { AnalyticsService, EventTypes } from '../services/AnalyticsService';
import { requireAuth } from '../middleware/auth';
import * as crypto from 'crypto';

const router = Router();
const walletService = new WalletService();
const shopService = new ShopService();
const analyticsService = new AnalyticsService();

/**
 * GET /api/v1/payment/providers
 * Get available payment providers
 */
router.get('/providers', async (_req: Request, res: Response) => {
  const providers = PaymentProviderFactory.getAvailableProviders();

  res.json({
    success: true,
    providers,
  });
});

/**
 * POST /api/v1/payment/create-invoice
 * Create payment invoice for an offer
 */
router.post('/create-invoice', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { offerId, platform } = req.body;

    if (!offerId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'offerId and platform are required',
      });
    }

    const provider = PaymentProviderFactory.getProvider(platform);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: `Payment provider ${platform} not available`,
      });
    }

    // Get offer from shop
    const offers = await shopService.getOffers();
    const offer = offers.find(o => o.id === offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found',
      });
    }

    // Only hard currency offers can be paid with real money
    if (offer.price.currency !== 'hard') {
      return res.status(400).json({
        success: false,
        error: 'Only hard currency offers can use payment providers',
      });
    }

    // Track analytics
    await analyticsService.track(EventTypes.PURCHASE_START, {
      offerId,
      platform,
      amount: offer.price.amount,
    }, { userId });

    // Create invoice
    const invoice = await provider.createInvoice(
      userId,
      offerId,
      offer.type === 'skin' ? `Скин: ${offer.itemId}` : `${offer.amount} кристаллов`,
      `Покупка в Slime Arena`,
      offer.price.amount,
      platform === 'telegram_stars' ? 'XTR' : 'RUB',
      { offerType: offer.type, itemId: offer.itemId }
    );

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('[Payment] Create invoice error:', error);

    await analyticsService.track(EventTypes.PURCHASE_FAIL, {
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { userId: req.user?.id });

    res.status(500).json({
      success: false,
      error: 'Failed to create invoice',
    });
  }
});

/**
 * POST /api/v1/payment/verify
 * Verify payment completion
 */
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { invoiceId, platform, platformPayload } = req.body;

    if (!invoiceId || !platform || !platformPayload) {
      return res.status(400).json({
        success: false,
        error: 'invoiceId, platform, and platformPayload are required',
      });
    }

    const provider = PaymentProviderFactory.getProvider(platform);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: `Payment provider ${platform} not available`,
      });
    }

    const result = await provider.verifyPayment(invoiceId, platformPayload);

    if (result.success && result.receipt) {
      // Grant the purchased item
      const receipt = result.receipt;

      // Get offer type from metadata
      const metadata = receipt.metadata || {};
      const operationId = `payment:${receipt.receiptId}:${crypto.randomUUID().substring(0, 8)}`;

      if (metadata.offerType === 'hard_currency') {
        // Grant hard currency
        await walletService.addCurrency(
          userId,
          metadata.amount || 100,
          'hard',
          'purchase',
          operationId,
          { receiptId: receipt.receiptId }
        );
      } else if (metadata.offerType === 'skin' && metadata.itemId) {
        // Purchase skin through ShopService
        await shopService.purchase(userId, receipt.offerId, operationId);
      }

      // Track analytics
      await analyticsService.track(EventTypes.PURCHASE_COMPLETE, {
        receiptId: receipt.receiptId,
        offerId: receipt.offerId,
        platform,
        amount: receipt.priceAmount,
        currency: receipt.priceCurrency,
      }, { userId });

      res.json({
        success: true,
        receipt,
      });
    } else {
      await analyticsService.track(EventTypes.PURCHASE_FAIL, {
        invoiceId,
        platform,
        error: result.error,
        errorCode: result.errorCode,
      }, { userId });

      res.status(400).json({
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      });
    }
  } catch (error) {
    console.error('[Payment] Verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
    });
  }
});

/**
 * GET /api/v1/payment/status/:invoiceId
 * Get payment status
 */
router.get('/status/:invoiceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const platform = req.query.platform as string;

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'platform query param is required',
      });
    }

    const provider = PaymentProviderFactory.getProvider(platform);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: `Payment provider ${platform} not available`,
      });
    }

    const receipt = await provider.getPaymentStatus(invoiceId);

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    // Only return if it belongs to the user
    if (receipt.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error('[Payment] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status',
    });
  }
});

/**
 * POST /api/v1/payment/webhook/telegram
 * Telegram payment webhook
 */
router.post('/webhook/telegram', async (req: Request, res: Response) => {
  try {
    const provider = PaymentProviderFactory.getProvider('telegram_stars') as TelegramStarsProvider;
    if (!provider) {
      return res.status(503).json({ ok: false });
    }

    const update = req.body;

    // Handle pre_checkout_query
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      // Always accept for now (can add validation here)
      await provider.answerPreCheckoutQuery(query.id, true);
      return res.json({ ok: true });
    }

    // Handle successful_payment in message
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const payload = JSON.parse(payment.invoice_payload);

      const result = await provider.verifyPayment(payload.invoiceId, payment);

      if (result.success && result.receipt) {
        // Grant item (same logic as /verify)
        const receipt = result.receipt;
        const metadata = receipt.metadata || {};
        const operationId = `webhook:telegram:${receipt.receiptId}:${crypto.randomUUID().substring(0, 8)}`;

        if (metadata.offerType === 'hard_currency') {
          await walletService.addCurrency(
            receipt.userId,
            metadata.amount || 100,
            'hard',
            'purchase',
            operationId,
            { receiptId: receipt.receiptId }
          );
        } else if (metadata.offerType === 'skin' && metadata.itemId) {
          await shopService.purchase(receipt.userId, receipt.offerId, operationId);
        }

        await analyticsService.track(EventTypes.PURCHASE_COMPLETE, {
          receiptId: receipt.receiptId,
          offerId: receipt.offerId,
          platform: 'telegram_stars',
          amount: receipt.priceAmount,
          currency: receipt.priceCurrency,
          source: 'webhook',
        }, { userId: receipt.userId });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[Payment] Telegram webhook error:', error);
    res.status(500).json({ ok: false });
  }
});

/**
 * POST /api/v1/payment/webhook/yandex
 * Yandex payment webhook
 */
router.post('/webhook/yandex', async (req: Request, res: Response) => {
  try {
    const provider = PaymentProviderFactory.getProvider('yandex_pay') as YandexPayProvider;
    if (!provider) {
      return res.status(503).send();
    }

    const result = await provider.handleWebhook(req.body);

    if (result?.success && result.receipt) {
      // Grant item
      const receipt = result.receipt;
      const metadata = receipt.metadata || {};
      const operationId = `webhook:yandex:${receipt.receiptId}:${crypto.randomUUID().substring(0, 8)}`;

      if (metadata.offerType === 'hard_currency') {
        await walletService.addCurrency(
          receipt.userId,
          metadata.amount || 100,
          'hard',
          'purchase',
          operationId,
          { receiptId: receipt.receiptId }
        );
      } else if (metadata.offerType === 'skin' && metadata.itemId) {
        await shopService.purchase(receipt.userId, receipt.offerId, operationId);
      }

      await analyticsService.track(EventTypes.PURCHASE_COMPLETE, {
        receiptId: receipt.receiptId,
        offerId: receipt.offerId,
        platform: 'yandex_pay',
        amount: receipt.priceAmount,
        currency: receipt.priceCurrency,
        source: 'webhook',
      }, { userId: receipt.userId });
    }

    res.status(200).send();
  } catch (error) {
    console.error('[Payment] Yandex webhook error:', error);
    res.status(500).send();
  }
});

export default router;
