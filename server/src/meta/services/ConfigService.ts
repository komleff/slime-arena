import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';

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
  abtests?: any;
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

export class ConfigService {
  private pool: Pool;

  constructor() {
    this.pool = getPostgresPool();
  }

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

  async createConfig(version: string, payload: any, checksum: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO configs (config_version, state, payload, checksum) VALUES ($1, $2, $3, $4)',
      [version, 'draft', payload, checksum]
    );
  }

  async activateConfig(version: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Deactivate all active configs
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
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
