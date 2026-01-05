import { getRedisClient } from '../../db/pool';
import { RedisClientType } from 'redis';
import { WalletService } from './WalletService';
import { ConfigService } from './ConfigService';
import * as crypto from 'crypto';

export interface AdGrant {
  grantId: string;
  userId: string;
  rewardType: 'soft_currency' | 'hard_currency' | 'item';
  rewardAmount?: number;
  rewardItemId?: string;
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
}

/**
 * Ads service for rewarded ads
 * Implements grantId-based reward system with idempotency
 */
export class AdsService {
  private redis: RedisClientType;
  private walletService: WalletService;
  private configService: ConfigService;
  private readonly GRANT_TTL_SECONDS = 300; // 5 minutes
  private readonly GRANT_PREFIX = 'ads:grant:';

  constructor() {
    this.redis = getRedisClient();
    this.walletService = new WalletService();
    this.configService = new ConfigService();
  }

  /**
   * Generate ad grant (called before showing ad)
   * Returns grantId that client can use to claim reward after ad completion
   */
  async generateGrant(userId: string, adPlacement: string): Promise<string> {
    // Get ad rewards configuration from RuntimeConfig
    const config = await this.configService.getActiveConfig();
    if (!config) {
      throw new Error('RuntimeConfig not available');
    }

    const configData = JSON.parse(config.data);
    const adRewards = configData.ads?.rewards || {};

    // Get reward for this placement
    const placementReward = adRewards[adPlacement];
    if (!placementReward) {
      throw new Error(`Unknown ad placement: ${adPlacement}`);
    }

    // Generate unique grantId
    const grantId = `grant_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    const grant: AdGrant = {
      grantId,
      userId,
      rewardType: placementReward.type || 'soft_currency',
      rewardAmount: placementReward.amount,
      rewardItemId: placementReward.itemId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.GRANT_TTL_SECONDS * 1000,
      claimed: false,
    };

    // Store grant in Redis with TTL
    await this.redis.setEx(
      `${this.GRANT_PREFIX}${grantId}`,
      this.GRANT_TTL_SECONDS,
      JSON.stringify(grant)
    );

    console.log(`[Ads] Generated grant ${grantId} for user ${userId} (placement: ${adPlacement})`);

    return grantId;
  }

  /**
   * Claim reward after ad completion (idempotent)
   */
  async claimReward(userId: string, grantId: string, operationId: string): Promise<AdGrant> {
    // Get grant from Redis
    const grantData = await this.redis.get(`${this.GRANT_PREFIX}${grantId}`);
    if (!grantData) {
      throw new Error('Grant not found or expired');
    }

    const grant: AdGrant = JSON.parse(grantData);

    // Verify userId matches
    if (grant.userId !== userId) {
      throw new Error('Grant belongs to different user');
    }

    // Check if already claimed
    if (grant.claimed) {
      console.log(`[Ads] Grant ${grantId} already claimed (idempotency)`);
      return grant;
    }

    // Grant reward based on type
    if (grant.rewardType === 'soft_currency' && grant.rewardAmount) {
      await this.walletService.addCurrency(
        userId,
        grant.rewardAmount,
        'soft',
        'ad_reward',
        operationId,
        { grantId, adType: 'rewarded' }
      );
    } else if (grant.rewardType === 'hard_currency' && grant.rewardAmount) {
      await this.walletService.addCurrency(
        userId,
        grant.rewardAmount,
        'hard',
        'ad_reward',
        operationId,
        { grantId, adType: 'rewarded' }
      );
    } else if (grant.rewardType === 'item' && grant.rewardItemId) {
      // TODO: Grant item (e.g., unlock skin, give booster)
      console.log(`[Ads] Item reward not implemented yet: ${grant.rewardItemId}`);
    }

    // Mark as claimed
    grant.claimed = true;
    await this.redis.setEx(
      `${this.GRANT_PREFIX}${grantId}`,
      this.GRANT_TTL_SECONDS,
      JSON.stringify(grant)
    );

    console.log(`[Ads] User ${userId} claimed reward from grant ${grantId}`);

    return grant;
  }

  /**
   * Get grant status
   */
  async getGrant(grantId: string): Promise<AdGrant | null> {
    const grantData = await this.redis.get(`${this.GRANT_PREFIX}${grantId}`);
    if (!grantData) {
      return null;
    }

    return JSON.parse(grantData);
  }

  /**
   * Revoke grant (e.g., if user closes ad)
   */
  async revokeGrant(grantId: string): Promise<void> {
    await this.redis.del(`${this.GRANT_PREFIX}${grantId}`);
    console.log(`[Ads] Revoked grant ${grantId}`);
  }
}
