import express from 'express';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import resumeRoutes from './routes/resumes.js';
import jobRoutes from './routes/jobs.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import adminRoutes from './routes/admin.js';
import { servedByMiddleware } from './middleware/servedBy.js';
import statsRoutes from './routes/stats.js';
import { tenantContextMiddleware } from './middleware/tenantContext.js';
import helmet from 'helmet';
import cors from 'cors';
import config from './config.js';
import authRoutes from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    credentials: false,
  }));
  app.use(servedByMiddleware);
  // Core request tracking and logging
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Body parsing
  app.use(express.json({ limit: config.HTTP_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: config.HTTP_BODY_LIMIT }));
  app.use('/api/auth', authRoutes);
  app.use('/api', requireAuth);
  app.use('/api', tenantContextMiddleware);
  app.use('/api', createRateLimiter());

  // Routes
  app.use('/health', healthRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/stats', statsRoutes);

  // 404 & Centralized Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
