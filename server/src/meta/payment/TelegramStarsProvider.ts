import {
  IPaymentProvider,
  PaymentInvoice,
  PaymentResult,
  RefundResult,
  PaymentReceipt,
} from './IPaymentProvider';
import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import * as crypto from 'crypto';

interface TelegramInvoiceParams {
  chat_id: number | string;
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: Array<{ label: string; amount: number }>;
}

interface TelegramPreCheckoutQuery {
  id: string;
  from: { id: number };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

interface TelegramSuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

/**
 * Telegram Stars payment provider
 * Uses Telegram Bot Payments API with Stars currency
 */
export class TelegramStarsProvider implements IPaymentProvider {
  readonly platform = 'telegram_stars';

  private pool: Pool;
  private botToken: string | null;
  private apiBaseUrl = 'https://api.telegram.org';

  constructor() {
    this.pool = getPostgresPool();
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
  }

  isAvailable(): boolean {
    return !!this.botToken;
  }

  async createInvoice(
    userId: string,
    offerId: string,
    title: string,
    description: string,
    priceAmount: number,
    priceCurrency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentInvoice> {
    if (!this.botToken) {
      throw new Error('Telegram bot token not configured');
    }

    // Generate unique invoice ID
    const invoiceId = crypto.randomUUID();

    // Payload contains our internal data
    const payload = JSON.stringify({
      invoiceId,
      userId,
      offerId,
      ...metadata,
    });

    // Stars currency uses XTR code
    const currency = priceCurrency === 'stars' ? 'XTR' : priceCurrency;

    // Create invoice link via Telegram API
    const invoiceParams: TelegramInvoiceParams = {
      chat_id: userId,
      title,
      description,
      payload,
      currency,
      prices: [{ label: title, amount: priceAmount }],
    };

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/bot${this.botToken}/createInvoiceLink`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceParams),
        }
      );

      const result = await response.json();

      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }

      // Store pending receipt
      await this.pool.query(
        `INSERT INTO purchase_receipts 
         (receipt_id, user_id, offer_id, price_amount, price_currency, platform, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
        [invoiceId, userId, offerId, priceAmount, currency, this.platform, JSON.stringify(metadata || {})]
      );

      return {
        invoiceId,
        offerId,
        priceAmount,
        priceCurrency: currency,
        title,
        description,
        paymentUrl: result.result,
        metadata,
      };
    } catch (error) {
      console.error('[TelegramStars] Failed to create invoice:', error);
      throw error;
    }
  }

  async verifyPayment(
    invoiceId: string,
    platformPayload: TelegramSuccessfulPayment
  ): Promise<PaymentResult> {
    try {
      // Parse our payload from the payment
      const payloadData = JSON.parse(platformPayload.invoice_payload);

      if (payloadData.invoiceId !== invoiceId) {
        return {
          success: false,
          error: 'Invoice ID mismatch',
          errorCode: 'INVOICE_MISMATCH',
        };
      }

      // Update receipt to completed
      const result = await this.pool.query(
        `UPDATE purchase_receipts 
         SET status = 'completed', 
             platform_transaction_id = $1,
             completed_at = NOW()
         WHERE receipt_id = $2 AND status = 'pending'
         RETURNING *`,
        [platformPayload.telegram_payment_charge_id, invoiceId]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Receipt not found or already processed',
          errorCode: 'RECEIPT_NOT_FOUND',
        };
      }

      const row = result.rows[0];
      const receipt: PaymentReceipt = {
        receiptId: row.receipt_id,
        platform: row.platform,
        userId: row.user_id,
        offerId: row.offer_id,
        priceAmount: row.price_amount,
        priceCurrency: row.price_currency,
        status: row.status,
        platformTransactionId: row.platform_transaction_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        metadata: row.metadata,
      };

      console.log(`[TelegramStars] Payment verified: ${invoiceId}`);

      return { success: true, receipt };
    } catch (error) {
      console.error('[TelegramStars] Payment verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'VERIFICATION_FAILED',
      };
    }
  }

  async answerPreCheckoutQuery(
    queryId: string,
    ok: boolean,
    errorMessage?: string
  ): Promise<boolean> {
    if (!this.botToken) {
      throw new Error('Telegram bot token not configured');
    }

    const response = await fetch(
      `${this.apiBaseUrl}/bot${this.botToken}/answerPreCheckoutQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: queryId,
          ok,
          error_message: errorMessage,
        }),
      }
    );

    const result = await response.json();
    return result.ok;
  }

  async refundPayment(receiptId: string): Promise<RefundResult> {
    if (!this.botToken) {
      return { success: false, error: 'Telegram bot token not configured' };
    }

    try {
      // Get receipt
      const receiptResult = await this.pool.query(
        'SELECT * FROM purchase_receipts WHERE receipt_id = $1',
        [receiptId]
      );

      if (receiptResult.rows.length === 0) {
        return { success: false, error: 'Receipt not found' };
      }

      const receipt = receiptResult.rows[0];

      if (receipt.status !== 'completed') {
        return { success: false, error: 'Cannot refund non-completed payment' };
      }

      // Call Telegram refund API (Stars-specific)
      const response = await fetch(
        `${this.apiBaseUrl}/bot${this.botToken}/refundStarPayment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: parseInt(receipt.user_id, 10),
            telegram_payment_charge_id: receipt.platform_transaction_id,
          }),
        }
      );

      const result = await response.json();

      if (!result.ok) {
        return { success: false, error: result.description };
      }

      // Update receipt status
      await this.pool.query(
        "UPDATE purchase_receipts SET status = 'refunded' WHERE receipt_id = $1",
        [receiptId]
      );

      console.log(`[TelegramStars] Payment refunded: ${receiptId}`);

      return { success: true, refundId: receiptId };
    } catch (error) {
      console.error('[TelegramStars] Refund failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPaymentStatus(invoiceId: string): Promise<PaymentReceipt | null> {
    const result = await this.pool.query(
      'SELECT * FROM purchase_receipts WHERE receipt_id = $1',
      [invoiceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      receiptId: row.receipt_id,
      platform: row.platform,
      userId: row.user_id,
      offerId: row.offer_id,
      priceAmount: row.price_amount,
      priceCurrency: row.price_currency,
      status: row.status,
      platformTransactionId: row.platform_transaction_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      metadata: row.metadata,
    };
  }
}
