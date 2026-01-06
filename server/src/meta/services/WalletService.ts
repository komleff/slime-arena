import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import * as crypto from 'crypto';

export interface Wallet {
  userId: string;
  softCurrency: number;
  hardCurrency: number;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: 'soft' | 'hard';
  operationId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Wallet service for managing player currencies
 * Implements idempotent transactions and audit trail
 */
export class WalletService {
  private _pool: Pool | null = null;

  /**
   * Lazy initialization: получаем пул только при первом обращении
   */
  private get pool(): Pool {
    if (!this._pool) {
      this._pool = getPostgresPool();
    }
    return this._pool;
  }

  /**
   * Get wallet balance for user
   */
  async getWallet(userId: string): Promise<Wallet | null> {
    const result = await this.pool.query(
      'SELECT user_id, coins, gems, updated_at FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      softCurrency: parseInt(row.coins, 10),
      hardCurrency: parseInt(row.gems, 10),
      updatedAt: row.updated_at,
    };
  }

  /**
   * Add currency to wallet (idempotent)
   * @param operationId - Unique operation ID for idempotency
   */
  async addCurrency(
    userId: string,
    amount: number,
    currency: 'soft' | 'hard',
    type: string,
    operationId: string,
    metadata?: Record<string, unknown>
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if operation already processed (idempotency)
      const existingTx = await client.query(
        'SELECT id FROM transactions WHERE user_id = $1 AND operation_id = $2',
        [userId, operationId]
      );

      if (existingTx.rows.length > 0) {
        // Operation already processed, return current wallet
        await client.query('ROLLBACK');
        const wallet = await this.getWallet(userId);
        if (!wallet) {
          throw new Error('Wallet not found');
        }
        console.log(`[Wallet] Operation ${operationId} already processed (idempotency)`);
        return wallet;
      }

      // Update wallet
      const column = currency === 'soft' ? 'coins' : 'gems';
      const updateResult = await client.query(
        `UPDATE wallets SET ${column} = ${column} + $1, updated_at = NOW() 
         WHERE user_id = $2 
         RETURNING user_id, coins, gems, updated_at`,
        [amount, userId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      // Record transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, currency, operation_id, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, type, amount, currency, operationId, metadata ? JSON.stringify(metadata) : null]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_log (user_id, action, details) 
         VALUES ($1, $2, $3)`,
        [userId, 'wallet_add_currency', JSON.stringify({ type, amount, currency, operationId })]
      );

      await client.query('COMMIT');

      const row = updateResult.rows[0];
      console.log(`[Wallet] Added ${amount} ${currency} to user ${userId} (type: ${type})`);

      return {
        userId: row.user_id,
        softCurrency: parseInt(row.coins, 10),
        hardCurrency: parseInt(row.gems, 10),
        updatedAt: row.updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deduct currency from wallet (idempotent)
   * @param operationId - Unique operation ID for idempotency
   */
  async deductCurrency(
    userId: string,
    amount: number,
    currency: 'soft' | 'hard',
    type: string,
    operationId: string,
    metadata?: Record<string, unknown>
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if operation already processed (idempotency)
      const existingTx = await client.query(
        'SELECT id FROM transactions WHERE user_id = $1 AND operation_id = $2',
        [userId, operationId]
      );

      if (existingTx.rows.length > 0) {
        // Operation already processed, return current wallet
        await client.query('ROLLBACK');
        const wallet = await this.getWallet(userId);
        if (!wallet) {
          throw new Error('Wallet not found');
        }
        console.log(`[Wallet] Operation ${operationId} already processed (idempotency)`);
        return wallet;
      }

      // Check balance
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const currentBalance = currency === 'soft' ? wallet.softCurrency : wallet.hardCurrency;
      if (currentBalance < amount) {
        throw new Error(`Insufficient ${currency} currency balance`);
      }

      // Update wallet
      const column = currency === 'soft' ? 'coins' : 'gems';
      const updateResult = await client.query(
        `UPDATE wallets SET ${column} = ${column} - $1, updated_at = NOW() 
         WHERE user_id = $2 
         RETURNING user_id, coins, gems, updated_at`,
        [amount, userId]
      );

      // Record transaction (negative amount for deduction)
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, currency, operation_id, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, type, -amount, currency, operationId, metadata ? JSON.stringify(metadata) : null]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_log (user_id, action, details) 
         VALUES ($1, $2, $3)`,
        [userId, 'wallet_deduct_currency', JSON.stringify({ type, amount, currency, operationId })]
      );

      await client.query('COMMIT');

      const row = updateResult.rows[0];
      console.log(`[Wallet] Deducted ${amount} ${currency} from user ${userId} (type: ${type})`);

      return {
        userId: row.user_id,
        softCurrency: parseInt(row.coins, 10),
        hardCurrency: parseInt(row.gems, 10),
        updatedAt: row.updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(userId: string, limit: number = 50): Promise<Transaction[]> {
    const result = await this.pool.query(
      `SELECT id, user_id, type, amount, currency, operation_id, metadata, created_at 
       FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      amount: parseInt(row.amount, 10),
      currency: row.currency,
      operationId: row.operation_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Generate unique operation ID for idempotency
   */
  static generateOperationId(prefix: string = 'op'): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}
