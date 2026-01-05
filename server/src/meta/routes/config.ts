import express, { Request, Response } from 'express';
import { ConfigService } from '../services/ConfigService';

const router = express.Router();
const configService = new ConfigService();

/**
 * GET /api/v1/config/runtime
 * Get active runtime configuration
 */
router.get('/runtime', async (req: Request, res: Response) => {
  try {
    const config = await configService.getActiveConfig();
    res.json(config);
  } catch (error: any) {
    console.error('[Config] Error getting runtime config:', error);
    res.status(500).json({
      error: 'config_error',
      message: error.message || 'Failed to get configuration',
    });
  }
});

/**
 * GET /api/v1/config/:version
 * Get specific configuration version (for debugging/admin)
 */
router.get('/:version', async (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const config = await configService.getConfigByVersion(version);
    res.json(config);
  } catch (error: any) {
    console.error('[Config] Error getting config version:', error);
    res.status(404).json({
      error: 'config_not_found',
      message: error.message || 'Configuration not found',
    });
  }
});

export default router;
