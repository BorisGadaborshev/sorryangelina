import express from 'express';
import cors from 'cors';
import path from 'path';
import { corsOrigin } from './config/cors';
import { getUploadDir } from './services/ImageStore';
import { connectionCount } from './realtime/runtime';

export const createApp = () => {
  const app = express();

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
  console.log('Client build path:', clientBuildPath);
  app.use(express.static(clientBuildPath));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: connectionCount,
      uptime: process.uptime()
    });
  });

  return { app, clientBuildPath };
};
