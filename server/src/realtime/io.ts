import { Server } from 'socket.io';
import { registerSocketHandlers } from './handlers';
import { adjustConnectionCount, bindIo } from './runtime';
import { RealtimeSession } from './session';

export function attachRealtime(server: Server): void {
  bindIo(server);

  server.engine.on('connection_error', (err) => {
    console.log('Connection error:', err);
  });

  server.on('connection', (socket) => {
    const connectionCount = adjustConnectionCount(1);
    console.log(`Client connected (${connectionCount} total):`, socket.id);
    console.log('Connection details:', {
      transport: socket.conn.transport.name,
      remoteAddress: socket.handshake.address,
      timestamp: new Date().toISOString()
    });

    const session: RealtimeSession = { currentUser: null };
    registerSocketHandlers(socket, session);
  });
}
