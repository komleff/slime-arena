/**
 * Payment provider interface
 * Supports multiple platforms: Telegram Stars, Yandex Pay
 */

export interface PaymentReceipt {
  receiptId: string;
  platform: string;
  userId: string;
  offerId: string;
  priceAmount: number;
  priceCurrency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  platformTransactionId: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  receipt?: PaymentReceipt;
  error?: string;
  errorCode?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export interface PaymentInvoice {
  invoiceId: string;
  offerId: string;
  priceAmount: number;
  priceCurrency: string;
  title: string;
  description: string;
  expiresAt?: Date;
  paymentUrl?: string;
  metadata?: Record<string, any>;
}

export interface IPaymentProvider {
  /**
   * Platform identifier
   */
  readonly platform: string;

  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean;

  /**
   * Create payment invoice
   */
  createInvoice(
    userId: string,
    offerId: string,
    title: string,
    description: string,
    priceAmount: number,
    priceCurrency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentInvoice>;

  /**
   * Verify payment completion
   */
  verifyPayment(
    invoiceId: string,
    platformPayload: any
  ): Promise<PaymentResult>;

  /**
   * Process refund
   */
  refundPayment(receiptId: string): Promise<RefundResult>;

  /**
   * Get payment status
   */
  getPaymentStatus(invoiceId: string): Promise<PaymentReceipt | null>;
}
