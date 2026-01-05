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

interface YandexPaymentResponse {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  metadata?: Record<string, string>;
}

/**
 * Yandex Pay payment provider
 * Uses Yandex.Checkout API
 */
export class YandexPayProvider implements IPaymentProvider {
  readonly platform = 'yandex_pay';

  private pool: Pool;
  private shopId: string | null;
  private secretKey: string | null;
  private apiBaseUrl = 'https://api.yookassa.ru/v3';

  constructor() {
    this.pool = getPostgresPool();
    this.shopId = process.env.YANDEX_SHOP_ID || null;
    this.secretKey = process.env.YANDEX_SECRET_KEY || null;
  }

  isAvailable(): boolean {
    return !!(this.shopId && this.secretKey);
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
    return `Basic ${credentials}`;
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
    if (!this.shopId || !this.secretKey) {
      throw new Error('Yandex Pay credentials not configured');
    }

    const invoiceId = crypto.randomUUID();
    const idempotenceKey = crypto.randomUUID();

    // Amount in Yandex format (string with 2 decimal places)
    const amountValue = (priceAmount / 100).toFixed(2);

    const paymentData = {
      amount: {
        value: amountValue,
        currency: priceCurrency.toUpperCase(),
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.APP_URL || 'https://slime-arena.com'}/payment/callback`,
      },
      description: `${title}: ${description}`,
      metadata: {
        invoice_id: invoiceId,
        user_id: userId,
        offer_id: offerId,
        ...Object.fromEntries(
          Object.entries(metadata || {}).map(([k, v]) => [k, String(v)])
        ),
      },
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
          'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Yandex API error: ${response.status} ${errorText}`);
      }

      const result: YandexPaymentResponse = await response.json();

      // Store pending receipt
      await this.pool.query(
        `INSERT INTO purchase_receipts 
         (receipt_id, user_id, offer_id, price_amount, price_currency, platform, status, platform_transaction_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
        [
          invoiceId,
          userId,
          offerId,
          priceAmount,
          priceCurrency.toUpperCase(),
          this.platform,
          result.id,
          JSON.stringify(metadata || {}),
        ]
      );

      return {
        invoiceId,
        offerId,
        priceAmount,
        priceCurrency: priceCurrency.toUpperCase(),
        title,
        description,
        paymentUrl: result.confirmation?.confirmation_url,
        metadata,
      };
    } catch (error) {
      console.error('[YandexPay] Failed to create invoice:', error);
      throw error;
    }
  }

  async verifyPayment(
    invoiceId: string,
    platformPayload: { payment_id: string; event?: string }
  ): Promise<PaymentResult> {
    if (!this.shopId || !this.secretKey) {
      return { success: false, error: 'Yandex Pay credentials not configured' };
    }

    try {
      // Fetch payment status from Yandex
      const response = await fetch(
        `${this.apiBaseUrl}/payments/${platformPayload.payment_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch payment: ${response.status}`,
          errorCode: 'FETCH_FAILED',
        };
      }

      const payment: YandexPaymentResponse = await response.json();

      // Verify invoice_id matches
      if (payment.metadata?.invoice_id !== invoiceId) {
        return {
          success: false,
          error: 'Invoice ID mismatch',
          errorCode: 'INVOICE_MISMATCH',
        };
      }

      if (payment.status !== 'succeeded') {
        return {
          success: false,
          error: `Payment status: ${payment.status}`,
          errorCode: 'PAYMENT_NOT_SUCCEEDED',
        };
      }

      // Update receipt to completed
      const result = await this.pool.query(
        `UPDATE purchase_receipts 
         SET status = 'completed', completed_at = NOW()
         WHERE receipt_id = $1 AND status = 'pending'
         RETURNING *`,
        [invoiceId]
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

      console.log(`[YandexPay] Payment verified: ${invoiceId}`);

      return { success: true, receipt };
    } catch (error) {
      console.error('[YandexPay] Payment verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'VERIFICATION_FAILED',
      };
    }
  }

  async refundPayment(receiptId: string): Promise<RefundResult> {
    if (!this.shopId || !this.secretKey) {
      return { success: false, error: 'Yandex Pay credentials not configured' };
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

      const idempotenceKey = crypto.randomUUID();
      const amountValue = (receipt.price_amount / 100).toFixed(2);

      const response = await fetch(`${this.apiBaseUrl}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
          'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify({
          payment_id: receipt.platform_transaction_id,
          amount: {
            value: amountValue,
            currency: receipt.price_currency,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Refund failed: ${errorText}` };
      }

      const refund = await response.json();

      // Update receipt status
      await this.pool.query(
        "UPDATE purchase_receipts SET status = 'refunded' WHERE receipt_id = $1",
        [receiptId]
      );

      console.log(`[YandexPay] Payment refunded: ${receiptId}`);

      return { success: true, refundId: refund.id };
    } catch (error) {
      console.error('[YandexPay] Refund failed:', error);
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

  /**
   * Handle Yandex webhook notification
   */
  async handleWebhook(payload: any): Promise<PaymentResult | null> {
    const event = payload.event;
    const paymentId = payload.object?.id;
    const invoiceId = payload.object?.metadata?.invoice_id;

    if (!invoiceId || !paymentId) {
      console.warn('[YandexPay] Webhook missing invoice_id or payment_id');
      return null;
    }

    if (event === 'payment.succeeded') {
      return this.verifyPayment(invoiceId, { payment_id: paymentId, event });
    }

    if (event === 'payment.canceled') {
      await this.pool.query(
        "UPDATE purchase_receipts SET status = 'failed' WHERE receipt_id = $1",
        [invoiceId]
      );
      return {
        success: false,
        error: 'Payment canceled',
        errorCode: 'PAYMENT_CANCELED',
      };
    }

    return null;
  }
}
