import { Router, Request, Response } from 'express';
import { ConfigService } from '../services/ConfigService';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
const configService = new ConfigService();

/**
 * GET /api/v1/config/admin/list
 * List all config versions
 */
router.get('/admin/list', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const state = req.query.state as 'draft' | 'active' | 'archived' | undefined;
    const configs = await configService.listConfigs(state);

    res.json({
      success: true,
      configs,
    });
  } catch (error) {
    console.error('[Config] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list configs',
    });
  }
});

/**
 * GET /api/v1/config/admin/:version
 * Get config by version
 */
router.get('/admin/:version', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const config = await configService.getConfigByVersion(version);

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[Config] Get error:', error);
    res.status(404).json({
      success: false,
      error: 'Config not found',
    });
  }
});

/**
 * POST /api/v1/config/admin/create
 * Create new config version
 */
router.post('/admin/create', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version, payload } = req.body;

    if (!version || !payload) {
      return res.status(400).json({
        success: false,
        error: 'version and payload are required',
      });
    }

    // Validate payload
    const validation = configService.validateConfig(payload);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid config payload',
        validationErrors: validation.errors,
      });
    }

    const configVersion = await configService.createConfig(version, payload);

    res.status(201).json({
      success: true,
      config: configVersion,
    });
  } catch (error) {
    console.error('[Config] Create error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create config',
    });
  }
});

/**
 * PUT /api/v1/config/admin/:version
 * Update draft config
 */
router.put('/admin/:version', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const { payload } = req.body;

    if (!payload) {
      return res.status(400).json({
        success: false,
        error: 'payload is required',
      });
    }

    // Validate payload
    const validation = configService.validateConfig(payload);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid config payload',
        validationErrors: validation.errors,
      });
    }

    const configVersion = await configService.updateConfig(version, payload);

    res.json({
      success: true,
      config: configVersion,
    });
  } catch (error) {
    console.error('[Config] Update error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config',
    });
  }
});

/**
 * POST /api/v1/config/admin/:version/activate
 * Activate config version
 */
router.post('/admin/:version/activate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    await configService.activateConfig(version);

    res.json({
      success: true,
      message: `Config ${version} activated`,
    });
  } catch (error) {
    console.error('[Config] Activate error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to activate config',
    });
  }
});

/**
 * POST /api/v1/config/admin/:version/archive
 * Archive config version
 */
router.post('/admin/:version/archive', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    await configService.archiveConfig(version);

    res.json({
      success: true,
      message: `Config ${version} archived`,
    });
  } catch (error) {
    console.error('[Config] Archive error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive config',
    });
  }
});

/**
 * DELETE /api/v1/config/admin/:version
 * Delete draft config
 */
router.delete('/admin/:version', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    await configService.deleteConfig(version);

    res.json({
      success: true,
      message: `Config ${version} deleted`,
    });
  } catch (error) {
    console.error('[Config] Delete error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete config',
    });
  }
});

/**
 * POST /api/v1/config/admin/:version/clone
 * Clone config to new version
 */
router.post('/admin/:version/clone', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const { newVersion } = req.body;

    if (!newVersion) {
      return res.status(400).json({
        success: false,
        error: 'newVersion is required',
      });
    }

    const configVersion = await configService.cloneConfig(version, newVersion);

    res.status(201).json({
      success: true,
      config: configVersion,
    });
  } catch (error) {
    console.error('[Config] Clone error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clone config',
    });
  }
});

/**
 * POST /api/v1/config/admin/validate
 * Validate config payload without saving
 */
router.post('/admin/validate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { payload } = req.body;

    if (!payload) {
      return res.status(400).json({
        success: false,
        error: 'payload is required',
      });
    }

    const validation = configService.validateConfig(payload);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
    });
  } catch (error) {
    console.error('[Config] Validate error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed',
    });
  }
});

export default router;
