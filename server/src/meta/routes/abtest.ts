import { Router, Request, Response } from 'express';
import { ABTestService } from '../services/ABTestService';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
const abTestService = new ABTestService();

/**
 * GET /api/v1/abtest/assignments
 * Get all active test assignments for current user
 */
router.get('/assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const assignments = await abTestService.getAllAssignments(userId);

    res.json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error('[ABTest] Get assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assignments',
    });
  }
});

/**
 * GET /api/v1/abtest/assignment/:testId
 * Get assignment for specific test
 */
router.get('/assignment/:testId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { testId } = req.params;

    const assignment = await abTestService.getAssignment(userId, testId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Test not found or not active',
      });
    }

    res.json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error('[ABTest] Get assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assignment',
    });
  }
});

/**
 * POST /api/v1/abtest/conversion
 * Track conversion event
 */
router.post('/conversion', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { testId, eventType, eventValue } = req.body;

    if (!testId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'testId and eventType are required',
      });
    }

    await abTestService.trackConversion(testId, userId, eventType, eventValue);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('[ABTest] Track conversion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track conversion',
    });
  }
});

// ============= Admin routes =============

/**
 * GET /api/v1/abtest/admin/list
 * List all tests
 */
router.get('/admin/list', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const state = req.query.state as 'draft' | 'active' | 'paused' | 'completed' | undefined;
    const tests = await abTestService.listTests(state);

    res.json({
      success: true,
      tests,
    });
  } catch (error) {
    console.error('[ABTest] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list tests',
    });
  }
});

/**
 * GET /api/v1/abtest/admin/:testId
 * Get test details
 */
router.get('/admin/:testId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const test = await abTestService.getTest(testId);

    res.json({
      success: true,
      test,
    });
  } catch (error) {
    console.error('[ABTest] Get test error:', error);
    res.status(404).json({
      success: false,
      error: 'Test not found',
    });
  }
});

/**
 * POST /api/v1/abtest/admin/create
 * Create new test
 */
router.post('/admin/create', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId, name, variants, weights, description, startDate, endDate } = req.body;

    if (!testId || !name || !variants) {
      return res.status(400).json({
        success: false,
        error: 'testId, name, and variants are required',
      });
    }

    const test = await abTestService.createTest(testId, name, variants, weights, {
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.status(201).json({
      success: true,
      test,
    });
  } catch (error) {
    console.error('[ABTest] Create error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test',
    });
  }
});

/**
 * PUT /api/v1/abtest/admin/:testId/state
 * Update test state
 */
router.put('/admin/:testId/state', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { state } = req.body;

    if (!state || !['draft', 'active', 'paused', 'completed'].includes(state)) {
      return res.status(400).json({
        success: false,
        error: 'Valid state is required (draft, active, paused, completed)',
      });
    }

    await abTestService.updateTestState(testId, state);

    res.json({
      success: true,
      message: `Test ${testId} state updated to ${state}`,
    });
  } catch (error) {
    console.error('[ABTest] Update state error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update test state',
    });
  }
});

/**
 * GET /api/v1/abtest/admin/:testId/stats
 * Get test statistics
 */
router.get('/admin/:testId/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const stats = await abTestService.getTestStats(testId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[ABTest] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

/**
 * DELETE /api/v1/abtest/admin/:testId
 * Delete draft test
 */
router.delete('/admin/:testId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    await abTestService.deleteTest(testId);

    res.json({
      success: true,
      message: `Test ${testId} deleted`,
    });
  } catch (error) {
    console.error('[ABTest] Delete error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete test',
    });
  }
});

export default router;
