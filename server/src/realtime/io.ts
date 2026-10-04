import { Server } from 'socket.io';
import { registerSocketHandlers } from './handlers';
import { adjustConnectionCount, bindIo } from './runtime';
import { RealtimeSession } from './session';
import { verifyAuthToken } from '../config/jwt';
import { bindRoomSync } from './roomSync';
import { clearEventRateLimit } from './on';
import { logger } from '../utils/logger';

export function attachRealtime(server: Server): void {
  bindIo(server);
  bindRoomSync(server);

  server.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token) {
      const auth = verifyAuthToken(token);
      if (auth) {
        socket.data.auth = auth;
      }
    }
    next();
  });

  server.engine.on('connection_error', (err) => {
    logger.warn({ err }, 'socket connection error');
  });

  server.on('connection', (socket) => {
    const connectionCount = adjustConnectionCount(1);
    logger.info({ socketId: socket.id, connectionCount }, 'client connected');

    const session: RealtimeSession = { currentUser: null };
    registerSocketHandlers(socket, session);
    socket.on('disconnect', () => {
      clearEventRateLimit(socket.id);
    });
  });
}
