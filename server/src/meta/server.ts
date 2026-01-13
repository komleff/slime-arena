import express from 'express';
import cors from 'cors';
import { initializePostgres, closePostgres, initializeRedis, closeRedis } from '../db/pool';
import { AuthProviderFactory } from './platform/AuthProviderFactory';
import { PaymentProviderFactory } from './payment/PaymentProviderFactory';
import authRoutes from './routes/auth';
import configRoutes from './routes/config';
import configAdminRoutes from './routes/configAdmin';
import profileRoutes from './routes/profile';
import matchmakingRoutes from './routes/matchmaking';
import walletRoutes from './routes/wallet';
import shopRoutes from './routes/shop';
import adsRoutes from './routes/ads';
import abtestRoutes from './routes/abtest';
import paymentRoutes from './routes/payment';
import analyticsRoutes from './routes/analytics';
import matchResultsRoutes from './routes/matchResults';

const app = express();
const port = Number(process.env.META_PORT || 3000);
const host = process.env.META_HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[MetaServer] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';

  try {
    const pool = await initializePostgres();
    const result = await pool.query('SELECT 1');
    if (result.rowCount === 1) {
      dbStatus = 'connected';
    }
  } catch (err) {
    console.error('[Health] DB check failed:', err);
  }

  try {
    const redis = await initializeRedis();
    const ping = await redis.ping();
    if (ping === 'PONG') {
      redisStatus = 'connected';
    }
  } catch (err) {
    console.error('[Health] Redis check failed:', err);
  }

  const status = (dbStatus === 'connected' && redisStatus === 'connected') ? 'ok' : 'error';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    database: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
    service: 'MetaServer',
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/config', configAdminRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/matchmaking', matchmakingRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/shop', shopRoutes);
app.use('/api/v1/ads', adsRoutes);
app.use('/api/v1/abtest', abtestRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/match-results', matchResultsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid JSON body'
    });
  }

  console.error('[MetaServer] Error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

async function start() {
  try {
    console.log('[MetaServer] Starting...');

    // Initialize database connections
    initializePostgres();
    await initializeRedis();

    // Initialize platform auth providers
    AuthProviderFactory.initialize();

    // Initialize payment providers
    PaymentProviderFactory.initialize();

    // Start server
    app.listen(port, host, () => {
      console.log(`[MetaServer] Listening on http://${host}:${port}`);
      console.log(`[MetaServer] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[MetaServer] Available platforms: ${AuthProviderFactory.getAvailablePlatforms().join(', ')}`);
      console.log(`[MetaServer] Available payment providers: ${PaymentProviderFactory.getAvailableProviders().join(', ') || 'none'}`);
    });
  } catch (error) {
    console.error('[MetaServer] Failed to start:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('[MetaServer] Shutting down...');
  
  try {
    await closePostgres();
    await closeRedis();
    console.log('[MetaServer] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[MetaServer] Error during shutdown:', error);
    process.exit(1);
  }
}

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error: Error) => {
  console.error('[MetaServer] FATAL: Uncaught exception:', error);
  console.error('Stack:', error.stack);
  // Log but don't exit immediately - log the error for debugging
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('[MetaServer] FATAL: Unhandled promise rejection:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  // Log but don't exit - allow server to continue
});

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { app, start };
