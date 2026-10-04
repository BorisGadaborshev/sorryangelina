import './config/env';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/database';
import { createApp } from './app';
import { registerHttpRoutes } from './http/routes';
import { attachRealtime } from './realtime/io';
import { corsOrigin } from './config/cors';
import { pool } from './config/database';
import { io as boundIo } from './realtime/runtime';
import { RoomService } from './services/RoomService';
import {
  ensureUploadDir,
  IMAGE_CLEANUP_INTERVAL_MS,
  migrateInlineImages,
  purgeExpiredImages
} from './services/ImageStore';

connectDB().catch((err) => {
  console.error('PostgreSQL connection error:', err);
  if (process.env.NODE_ENV === 'production') {
    console.error('Server will keep running, but database-backed features may fail until PostgreSQL is available.');
    return;
  }
  process.exit(1);
});

const { app, clientBuildPath } = createApp();
registerHttpRoutes(app);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io',
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 5e6,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  upgradeTimeout: 10000,
  allowEIO3: true,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

attachRealtime(io);

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  void ensureUploadDir()
    .then(() => migrateInlineImages())
    .catch((error) => {
      console.error('Failed to prepare image storage:', error);
    });
});

const broadcastExpiredImages = async () => {
  try {
    const changes = await purgeExpiredImages();
    for (const change of changes) {
      const room = await RoomService.getRoom(change.roomId);
      if (!room) continue;
      if (change.backgroundCleared) {
        boundIo.to(change.roomId).emit('room-background-updated', { backgroundImage: room.features?.backgroundImage || '' });
      }
      if (change.clearedCardIds.length > 0) {
        boundIo.to(change.roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
      }
    }
  } catch (error) {
    console.error('Failed to purge expired images:', error);
  }
};

const imageCleanup = setInterval(() => {
  void broadcastExpiredImages();
}, IMAGE_CLEANUP_INTERVAL_MS);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

let shuttingDown = false;
const shutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down`);
  clearInterval(imageCleanup);
  io.close();
  httpServer.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
