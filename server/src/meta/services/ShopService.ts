import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import { ConfigService } from './ConfigService';
import { WalletService } from './WalletService';

export interface ShopOffer {
  id: string;
  type: string;
  itemId?: string;
  amount?: number;
  price: {
    currency: 'soft' | 'hard';
    amount: number;
  };
  metadata?: Record<string, unknown>;
}

export interface PurchaseResult {
  success: boolean;
  itemId?: string;
  unlockedAt?: Date;
  message?: string;
}

/**
 * Shop service for in-game purchases
 * Integrates with RuntimeConfig for offers and WalletService for transactions
 */
export class ShopService {
  private pool: Pool;
  private configService: ConfigService;
  private walletService: WalletService;

  constructor() {
    this.pool = getPostgresPool();
    this.configService = new ConfigService();
    this.walletService = new WalletService();
  }

  /**
   * Get available shop offers from RuntimeConfig
   */
  async getOffers(): Promise<ShopOffer[]> {
    const config = await this.configService.getActiveConfig();
    if (!config) {
      return [];
    }

    // Shop offers come from RuntimeConfig.shop field
    const shopOffers = config.shop?.offers || [];

    return shopOffers;
  }

  /**
   * Purchase item with soft or hard currency
   */
  async purchase(
    userId: string,
    offerId: string,
    operationId: string
  ): Promise<PurchaseResult> {
    const offers = await this.getOffers();
    const offer = offers.find((o) => o.id === offerId);

    if (!offer) {
      throw new Error(`Offer ${offerId} not found`);
    }

    // Check if already purchased (idempotency via transactions table)
    const existingPurchase = await this.pool.query(
      'SELECT id FROM transactions WHERE user_id = $1 AND operation_id = $2',
      [userId, operationId]
    );

    if (existingPurchase.rows.length > 0) {
      console.log(`[Shop] Purchase ${operationId} already processed (idempotency)`);
      return {
        success: true,
        message: 'Purchase already completed',
      };
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Deduct currency
      await this.walletService.deductCurrency(
        userId,
        offer.price.amount,
        offer.price.currency,
        'shop_purchase',
        operationId,
        { offerId, offerType: offer.type }
      );

      // Grant item based on type
      let itemId: string | undefined;
      let unlockedAt: Date | undefined;

      if (offer.type === 'skin' && offer.itemId) {
        // Unlock skin
        const unlockResult = await client.query(
          `INSERT INTO unlocked_items (user_id, item_id, item_type, unlocked_at) 
           VALUES ($1, $2, $3, NOW()) 
           ON CONFLICT (user_id, item_id) DO NOTHING 
           RETURNING item_id, unlocked_at`,
          [userId, offer.itemId, 'skin']
        );

        if (unlockResult.rows.length > 0) {
          itemId = unlockResult.rows[0].item_id;
          unlockedAt = unlockResult.rows[0].unlocked_at;
        }
      } else if (offer.type === 'currency' && offer.amount) {
        // Grant currency (soft or hard)
        const currencyType = offer.metadata?.currencyType as 'soft' | 'hard' || 'soft';
        await this.walletService.addCurrency(
          userId,
          offer.amount,
          currencyType,
          'shop_currency_purchase',
          `${operationId}_grant`,
          { offerId }
        );
      } else if (offer.type === 'battlepass') {
        // Unlock BattlePass premium
        await client.query(
          `INSERT INTO battlepass_progress (user_id, has_premium) 
           VALUES ($1, true) 
           ON CONFLICT (user_id) DO UPDATE SET has_premium = true`,
          [userId]
        );
      }

      // Record purchase receipt
      await client.query(
        `INSERT INTO purchase_receipts (user_id, offer_id, price_amount, price_currency, platform, status) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, offerId, offer.price.amount, offer.price.currency, 'internal', 'completed']
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_log (user_id, action, details) 
         VALUES ($1, $2, $3)`,
        [userId, 'shop_purchase', JSON.stringify({ offerId, operationId })]
      );

      await client.query('COMMIT');

      console.log(`[Shop] User ${userId} purchased ${offerId}`);

      return {
        success: true,
        itemId,
        unlockedAt,
        message: 'Purchase successful',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get unlocked items for user
   */
  async getUnlockedItems(userId: string, itemType?: string): Promise<Array<{ itemId: string; itemType: string; unlockedAt: Date }>> {
    let query = 'SELECT item_id, item_type, unlocked_at FROM unlocked_items WHERE user_id = $1';
    const params: any[] = [userId];

    if (itemType) {
      query += ' AND item_type = $2';
      params.push(itemType);
    }

    query += ' ORDER BY unlocked_at DESC';

    const result = await this.pool.query(query, params);

    return result.rows.map((row: any) => ({
      itemId: row.item_id,
      itemType: row.item_type,
      unlockedAt: row.unlocked_at,
    }));
  }

  /**
   * Check if user has unlocked specific item
   */
  async hasUnlockedItem(userId: string, itemId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT id FROM unlocked_items WHERE user_id = $1 AND item_id = $2',
      [userId, itemId]
    );

    return result.rows.length > 0;
  }
}
