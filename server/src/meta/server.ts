import express from 'express';
import cors from 'cors';
import { initializePostgres, closePostgres, initializeRedis, closeRedis } from '../db/pool';
import authRoutes from './routes/auth';
import configRoutes from './routes/config';
import profileRoutes from './routes/profile';

const app = express();
const PORT = process.env.META_PORT || 3000;

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
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MetaServer',
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/profile', profileRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

    // Start server
    app.listen(PORT, () => {
      console.log(`[MetaServer] Listening on port ${PORT}`);
      console.log(`[MetaServer] Environment: ${process.env.NODE_ENV || 'development'}`);
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

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { app, start };
