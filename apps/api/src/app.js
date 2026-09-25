import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import serversRoutes from './routes/servers.routes.js';
import apiKeysRoutes from './routes/apikeys.routes.js';
import adminRoutes from './routes/admin.routes.js';
import publicRoutes from './routes/public.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN?.split(',') || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get('/healthz', (req, res) => res.json({ ok: true, service: 'zetapanel-api' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/servers', serversRoutes);
  app.use('/api/api-keys', apiKeysRoutes);
  app.use('/api/admin', adminRoutes);

  // Public, API-key authenticated surface documented at /docs
  app.use('/api/v1', publicRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
