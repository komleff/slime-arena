import { Pool } from 'pg';
import { getPostgresPool } from '../../db/pool';
import { getRedisClient } from '../../db/redis';
import * as crypto from 'crypto';

export interface ABTest {
  testId: string;
  name: string;
  description?: string;
  variants: ABTestVariant[];
  weights: number[];
  state: 'draft' | 'active' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ABTestVariant {
  id: string;
  name: string;
  config: Record<string, any>;
}

export interface ABTestAssignment {
  testId: string;
  variantId: string;
  variantName: string;
  config: Record<string, any>;
}

export interface ABTestConversion {
  testId: string;
  variantId: string;
  userId: string;
  eventType: string;
  eventValue?: number;
  timestamp: Date;
}

const ASSIGNMENT_CACHE_PREFIX = 'abtest:assignment:';
const ASSIGNMENT_CACHE_TTL = 86400; // 24h

export class ABTestService {
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
   * Create a new A/B test
   */
  async createTest(
    testId: string,
    name: string,
    variants: ABTestVariant[],
    weights?: number[],
    options?: {
      description?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ABTest> {
    // Validate variants
    if (variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    // Default to equal weights if not provided
    const actualWeights = weights || variants.map(() => Math.floor(100 / variants.length));
    const weightSum = actualWeights.reduce((a, b) => a + b, 0);

    if (Math.abs(weightSum - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100 (got ${weightSum})`);
    }

    if (actualWeights.length !== variants.length) {
      throw new Error('Number of weights must match number of variants');
    }

    await this.pool.query(
      `INSERT INTO ab_tests (test_id, name, description, variants, weights, state, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)`,
      [
        testId,
        name,
        options?.description || null,
        JSON.stringify(variants),
        actualWeights,
        options?.startDate || null,
        options?.endDate || null,
      ]
    );

    console.log(`[ABTest] Created test ${testId} with ${variants.length} variants`);

    return this.getTest(testId);
  }

  /**
   * Get test by ID
   */
  async getTest(testId: string): Promise<ABTest> {
    const result = await this.pool.query(
      `SELECT test_id, name, description, variants, weights, state, 
              start_date, end_date, created_at, updated_at
       FROM ab_tests WHERE test_id = $1`,
      [testId]
    );

    if (result.rows.length === 0) {
      throw new Error(`A/B test ${testId} not found`);
    }

    const row = result.rows[0];
    return {
      testId: row.test_id,
      name: row.name,
      description: row.description,
      variants: row.variants,
      weights: row.weights,
      state: row.state,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all tests
   */
  async listTests(state?: ABTest['state']): Promise<ABTest[]> {
    let query = `SELECT test_id, name, description, variants, weights, state, 
                        start_date, end_date, created_at, updated_at FROM ab_tests`;
    const params: any[] = [];

    if (state) {
      query += ' WHERE state = $1';
      params.push(state);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);

    return result.rows.map((row: any) => ({
      testId: row.test_id,
      name: row.name,
      description: row.description,
      variants: row.variants,
      weights: row.weights,
      state: row.state,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Update test state
   */
  async updateTestState(testId: string, state: ABTest['state']): Promise<void> {
    const result = await this.pool.query(
      'UPDATE ab_tests SET state = $1, updated_at = NOW() WHERE test_id = $2 RETURNING test_id',
      [state, testId]
    );

    if (result.rows.length === 0) {
      throw new Error(`A/B test ${testId} not found`);
    }

    console.log(`[ABTest] Updated test ${testId} state to ${state}`);
  }

  /**
   * Get user's assignment for a test (deterministic by user_id)
   */
  async getAssignment(userId: string, testId: string): Promise<ABTestAssignment | null> {
    const redis = await getRedisClient();
    const cacheKey = `${ASSIGNMENT_CACHE_PREFIX}${userId}:${testId}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get test
    const test = await this.getTest(testId);

    // Only return assignments for active tests
    if (test.state !== 'active') {
      return null;
    }

    // Check date range
    const now = new Date();
    if (test.startDate && now < test.startDate) {
      return null;
    }
    if (test.endDate && now > test.endDate) {
      return null;
    }

    // Deterministic variant selection based on user_id and test_id
    const variantId = this.selectVariant(userId, testId, test.variants, test.weights);
    const variant = test.variants.find(v => v.id === variantId);

    if (!variant) {
      throw new Error(`Variant ${variantId} not found in test ${testId}`);
    }

    const assignment: ABTestAssignment = {
      testId,
      variantId: variant.id,
      variantName: variant.name,
      config: variant.config,
    };

    // Cache assignment
    await redis.set(cacheKey, JSON.stringify(assignment), { EX: ASSIGNMENT_CACHE_TTL });

    return assignment;
  }

  /**
   * Get all active test assignments for a user
   */
  async getAllAssignments(userId: string): Promise<ABTestAssignment[]> {
    const activeTests = await this.listTests('active');
    const assignments: ABTestAssignment[] = [];

    for (const test of activeTests) {
      const assignment = await this.getAssignment(userId, test.testId);
      if (assignment) {
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    testId: string,
    userId: string,
    eventType: string,
    eventValue?: number
  ): Promise<void> {
    // Get user's assignment
    const assignment = await this.getAssignment(userId, testId);
    if (!assignment) {
      console.warn(`[ABTest] No assignment found for user ${userId} in test ${testId}`);
      return;
    }

    await this.pool.query(
      `INSERT INTO ab_test_conversions (test_id, variant_id, user_id, event_type, event_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [testId, assignment.variantId, userId, eventType, eventValue || null]
    );

    console.log(`[ABTest] Tracked conversion for test ${testId}: ${eventType}`);
  }

  /**
   * Get test statistics
   */
  async getTestStats(testId: string): Promise<{
    testId: string;
    variantStats: Array<{
      variantId: string;
      variantName: string;
      assignments: number;
      conversions: Record<string, number>;
      conversionRate: number;
    }>;
  }> {
    const test = await this.getTest(testId);

    // Get conversion counts per variant and event type
    const conversionsResult = await this.pool.query(
      `SELECT variant_id, event_type, COUNT(*) as count
       FROM ab_test_conversions
       WHERE test_id = $1
       GROUP BY variant_id, event_type`,
      [testId]
    );

    // Get unique users per variant
    const usersResult = await this.pool.query(
      `SELECT variant_id, COUNT(DISTINCT user_id) as unique_users
       FROM ab_test_conversions
       WHERE test_id = $1
       GROUP BY variant_id`,
      [testId]
    );

    const usersByVariant: Record<string, number> = {};
    usersResult.rows.forEach((row: any) => {
      usersByVariant[row.variant_id] = parseInt(row.unique_users, 10);
    });

    const conversionsByVariant: Record<string, Record<string, number>> = {};
    conversionsResult.rows.forEach((row: any) => {
      if (!conversionsByVariant[row.variant_id]) {
        conversionsByVariant[row.variant_id] = {};
      }
      conversionsByVariant[row.variant_id][row.event_type] = parseInt(row.count, 10);
    });

    const variantStats = test.variants.map(variant => {
      const assignments = usersByVariant[variant.id] || 0;
      const conversions = conversionsByVariant[variant.id] || {};
      const totalConversions = Object.values(conversions).reduce((a, b) => a + b, 0);

      return {
        variantId: variant.id,
        variantName: variant.name,
        assignments,
        conversions,
        conversionRate: assignments > 0 ? totalConversions / assignments : 0,
      };
    });

    return { testId, variantStats };
  }

  /**
   * Delete test (only draft tests)
   */
  async deleteTest(testId: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM ab_tests WHERE test_id = $1 AND state = $2 RETURNING test_id',
      [testId, 'draft']
    );

    if (result.rows.length === 0) {
      throw new Error(`Draft test ${testId} not found`);
    }

    console.log(`[ABTest] Deleted test ${testId}`);
  }

  /**
   * Deterministic variant selection using hash
   */
  private selectVariant(
    userId: string,
    testId: string,
    variants: ABTestVariant[],
    weights: number[]
  ): string {
    // Create deterministic hash from userId + testId
    const hash = crypto
      .createHash('sha256')
      .update(`${userId}:${testId}`)
      .digest();

    // Convert first 4 bytes to number (0-4294967295)
    const hashNum = hash.readUInt32BE(0);

    // Convert to percentage (0-100)
    const percentage = (hashNum / 0xffffffff) * 100;

    // Select variant based on weights
    let cumulative = 0;
    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i];
      if (percentage < cumulative) {
        return variants[i].id;
      }
    }

    // Fallback to last variant
    return variants[variants.length - 1].id;
  }
}
