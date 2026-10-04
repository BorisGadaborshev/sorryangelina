import express from 'express';
import cors from 'cors';
import path from 'path';
import { corsOrigin } from './config/cors';
import { getUploadDir } from './services/ImageStore';
import { connectionCount } from './realtime/runtime';
import { pool } from './config/database';
import { logger } from './utils/logger';

export const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Subo-Access'],
    credentials: true
  }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json());
  app.use('/uploads', express.static(getUploadDir(), { index: false, fallthrough: false }));
  app.use('/api/uploads', express.static(getUploadDir(), { index: false, fallthrough: false }));

  const clientBuildPath = path.resolve(__dirname, '../../client/build');
  logger.info({ clientBuildPath }, 'client build path');
  app.use(express.static(clientBuildPath));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: connectionCount,
      uptime: process.uptime()
    });
  });

  app.get('/healthz', async (_req, res) => {
    try {
      await pool.query('select 1');
      res.json({ status: 'ok' });
    } catch (error) {
      logger.error({ err: error }, 'healthz database check failed');
      res.status(503).json({ status: 'error' });
    }
  });

  return { app, clientBuildPath };
};
