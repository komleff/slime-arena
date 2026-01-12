import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import * as crypto from 'crypto';

export interface RuntimeConfig {
  configVersion: string;
  economy: any;
  shop?: {
    offers?: ShopOffer[];
  };
  ads?: {
    rewards?: Record<string, AdRewardConfig>;
  };
  battlepass?: any;
  achievements?: any;
  leaderboards?: any;
  matchmaking?: any;
  resilience?: any;
  features: {
    paymentsEnabled: boolean;
    adsRewardEnabled: boolean;
    matchmakingEnabled: boolean;
  };
  abtests?: ABTestConfig[];
}

interface ShopOffer {
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

interface AdRewardConfig {
  type: 'soft_currency' | 'hard_currency' | 'item';
  amount?: number;
  itemId?: string;
}

export interface ABTestConfig {
  testId: string;
  name: string;
  variants: ABTestVariant[];
  allocation: number[]; // percentages, must sum to 100
  startDate?: string;
  endDate?: string;
  enabled: boolean;
}

export interface ABTestVariant {
  id: string;
  name: string;
  config: Record<string, any>;
}

export interface ConfigVersion {
  configVersion: string;
  state: 'draft' | 'active' | 'archived';
  checksum: string;
  createdAt: Date;
  activatedAt?: Date;
}

export class ConfigService {
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
   * Get currently active config
   */
  async getActiveConfig(): Promise<RuntimeConfig> {
    const result = await this.pool.query(
      'SELECT config_version, payload FROM configs WHERE state = $1 ORDER BY activated_at DESC LIMIT 1',
      ['active']
    );

    if (result.rows.length === 0) {
      throw new Error('No active configuration found');
    }

    const row = result.rows[0];
    return {
      configVersion: row.config_version,
      ...row.payload,
    };
  }

  /**
   * Get config by version
   */
  async getConfigByVersion(version: string): Promise<RuntimeConfig> {
    const result = await this.pool.query(
      'SELECT config_version, payload FROM configs WHERE config_version = $1',
      [version]
    );

    if (result.rows.length === 0) {
      throw new Error(`Configuration version ${version} not found`);
    }

    const row = result.rows[0];
    return {
      configVersion: row.config_version,
      ...row.payload,
    };
  }

  /**
   * List all config versions
   */
  async listConfigs(state?: 'draft' | 'active' | 'archived'): Promise<ConfigVersion[]> {
    let query = 'SELECT config_version, state, checksum, created_at, activated_at FROM configs';
    const params: any[] = [];

    if (state) {
      query += ' WHERE state = $1';
      params.push(state);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);

    return result.rows.map((row: any) => ({
      configVersion: row.config_version,
      state: row.state,
      checksum: row.checksum,
      createdAt: row.created_at,
      activatedAt: row.activated_at,
    }));
  }

  /**
   * Create new config version (as draft)
   */
  async createConfig(version: string, payload: Partial<RuntimeConfig>): Promise<ConfigVersion> {
    // Calculate checksum
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);

    await this.pool.query(
      'INSERT INTO configs (config_version, state, payload, checksum) VALUES ($1, $2, $3, $4)',
      [version, 'draft', JSON.stringify(payload), checksum]
    );

    return {
      configVersion: version,
      state: 'draft',
      checksum,
      createdAt: new Date(),
    };
  }

  /**
   * Update draft config
   */
  async updateConfig(version: string, payload: Partial<RuntimeConfig>): Promise<ConfigVersion> {
    // Check if config is draft
    const existing = await this.pool.query(
      'SELECT state FROM configs WHERE config_version = $1',
      [version]
    );

    if (existing.rows.length === 0) {
      throw new Error(`Configuration version ${version} not found`);
    }

    if (existing.rows[0].state !== 'draft') {
      throw new Error('Only draft configs can be updated');
    }

    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);

    await this.pool.query(
      'UPDATE configs SET payload = $1, checksum = $2 WHERE config_version = $3',
      [JSON.stringify(payload), checksum, version]
    );

    return {
      configVersion: version,
      state: 'draft',
      checksum,
      createdAt: new Date(),
    };
  }

  /**
   * Activate config (atomically archive current active)
   */
  async activateConfig(version: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if config exists and is draft
      const existing = await client.query(
        'SELECT state FROM configs WHERE config_version = $1',
        [version]
      );

      if (existing.rows.length === 0) {
        throw new Error(`Configuration version ${version} not found`);
      }

      if (existing.rows[0].state === 'active') {
        // Already active
        await client.query('ROLLBACK');
        return;
      }

      // Archive current active config
      await client.query(
        'UPDATE configs SET state = $1 WHERE state = $2',
        ['archived', 'active']
      );

      // Activate the specified config
      await client.query(
        'UPDATE configs SET state = $1, activated_at = NOW() WHERE config_version = $2',
        ['active', version]
      );

      await client.query('COMMIT');

      console.log(`[Config] Activated config version ${version}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Archive config
   */
  async archiveConfig(version: string): Promise<void> {
    const result = await this.pool.query(
      'UPDATE configs SET state = $1 WHERE config_version = $2 AND state != $3 RETURNING config_version',
      ['archived', version, 'archived']
    );

    if (result.rows.length === 0) {
      throw new Error(`Configuration ${version} not found or already archived`);
    }
  }

  /**
   * Delete draft config
   */
  async deleteConfig(version: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM configs WHERE config_version = $1 AND state = $2 RETURNING config_version',
      [version, 'draft']
    );

    if (result.rows.length === 0) {
      throw new Error(`Draft configuration ${version} not found`);
    }
  }

  /**
   * Clone config to new version
   */
  async cloneConfig(sourceVersion: string, newVersion: string): Promise<ConfigVersion> {
    const source = await this.pool.query(
      'SELECT payload FROM configs WHERE config_version = $1',
      [sourceVersion]
    );

    if (source.rows.length === 0) {
      throw new Error(`Source configuration ${sourceVersion} not found`);
    }

    return this.createConfig(newVersion, source.rows[0].payload);
  }

  /**
   * Validate config payload
   */
  validateConfig(payload: Partial<RuntimeConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!payload.features) {
      errors.push('features is required');
    } else {
      if (typeof payload.features.paymentsEnabled !== 'boolean') {
        errors.push('features.paymentsEnabled must be a boolean');
      }
      if (typeof payload.features.adsRewardEnabled !== 'boolean') {
        errors.push('features.adsRewardEnabled must be a boolean');
      }
      if (typeof payload.features.matchmakingEnabled !== 'boolean') {
        errors.push('features.matchmakingEnabled must be a boolean');
      }
    }

    // Validate shop offers
    if (payload.shop?.offers) {
      payload.shop.offers.forEach((offer, index) => {
        if (!offer.id) {
          errors.push(`shop.offers[${index}].id is required`);
        }
        if (!offer.type) {
          errors.push(`shop.offers[${index}].type is required`);
        }
        if (!offer.price || typeof offer.price.amount !== 'number') {
          errors.push(`shop.offers[${index}].price.amount is required`);
        }
      });
    }

    // Validate A/B tests
    if (payload.abtests) {
      payload.abtests.forEach((test, index) => {
        if (!test.testId) {
          errors.push(`abtests[${index}].testId is required`);
        }
        if (!test.variants || test.variants.length < 2) {
          errors.push(`abtests[${index}].variants must have at least 2 variants`);
        }
        if (test.allocation) {
          const sum = test.allocation.reduce((a, b) => a + b, 0);
          if (Math.abs(sum - 100) > 0.01) {
            errors.push(`abtests[${index}].allocation must sum to 100 (got ${sum})`);
          }
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }
}
