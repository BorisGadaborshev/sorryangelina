import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './src/config/database';
import { RoomService } from './src/services/RoomService';
import type { Card } from './src/types';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://sorryangelina.vercel.app', 'https://sorryangelina-git-main-borisgadaborshevs-projects.vercel.app']
    : 'http://localhost:3000',
  credentials: true
}));

// Create Socket.IO instance
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://sorryangelina.vercel.app', 'https://sorryangelina-git-main-borisgadaborshevs-projects.vercel.app']
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Use consistent path without trailing slash
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  addTrailingSlash: false
});

// Connect to PostgreSQL
connectDB().catch(console.error);

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('create-room', async ({ roomId, password, username }) => {
    console.log('Attempting to create room:', { roomId, username, socketId: socket.id });
    
    try {
      // Проверяем, существует ли уже комната с таким ID
      const existingRoom = await RoomService.getRoom(roomId);
      if (existingRoom) {
        console.log('Room already exists:', roomId);
        socket.emit('error', 'Room with this ID already exists');
        return;
      }

      // Создаем новую комнату
      const room = await RoomService.createRoom(roomId, password, socket.id, username);
      if (!room) {
        console.log('Failed to create room - room is null');
        socket.emit('error', 'Failed to create room');
        return;
      }

      // Присоединяемся к комнате
      await socket.join(roomId);
      console.log('Room created and joined successfully:', { roomId, username });
      
      // Отправляем подтверждение
      socket.emit('room-joined', { 
        room,
        userId: socket.id,
        state: {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        }
      });
    } catch (error) {
      console.error('Error in create-room handler:', error);
      socket.emit('error', error instanceof Error ? error.message : 'Failed to create room');
    }
  });

  socket.on('join-room', async ({ roomId, password, username }) => {
    console.log('Attempting to join room:', { roomId, username, socketId: socket.id });
    
    try {
      // Проверяем существование комнаты
      const room = await RoomService.getRoom(roomId);
      if (!room) {
        console.log('Room not found:', roomId);
        socket.emit('error', 'Room not found');
        return;
      }

      // Проверяем пароль
      const isValidPassword = await RoomService.validatePassword(roomId, password);
      if (!isValidPassword) {
        console.log('Invalid password for room:', roomId);
        socket.emit('error', 'Invalid password');
        return;
      }

      // Добавляем пользователя в комнату
      const updatedRoom = await RoomService.addUser(roomId, {
        id: socket.id,
        name: username,
        roomId,
        role: 'user',
        isReady: false
      });

      if (!updatedRoom) {
        console.log('Failed to add user to room');
        socket.emit('error', 'Failed to join room');
        return;
      }

      // Присоединяемся к комнате
      await socket.join(roomId);
      console.log('Room joined successfully:', { roomId, username });

      // Отправляем подтверждение
      socket.emit('room-joined', { 
        room: updatedRoom,
        userId: socket.id,
        state: {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        }
      });

      // Уведомляем других пользователей
      socket.to(roomId).emit('user-joined', updatedRoom.users.find(u => u.id === socket.id));
    } catch (error) {
      console.error('Error in join-room handler:', error);
      socket.emit('error', error instanceof Error ? error.message : 'Failed to join room');
    }
  });

  socket.on('update-ready-state', async ({ isReady }) => {
    try {
      const roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
      if (!roomId) return;
      const room = await RoomService.updateUserReadyState(roomId, socket.id, isReady);
      if (room) {
        io.to(roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
      }
    } catch (error) {
      console.error('Error in update-ready-state:', error);
    }
  });

  socket.on('change-phase', async ({ phase }) => {
    try {
      const roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
      if (!roomId) return;

      const updatedRoom = await RoomService.updatePhase(roomId, phase as 'creation' | 'voting' | 'discussion', socket.id);
      if (!updatedRoom) {
        socket.emit('error', 'Failed to change phase');
        return;
      }

      let sortedCards: Card[] = updatedRoom.cards;
      if (phase === 'discussion') {
        sortedCards = [...updatedRoom.cards].sort((a, b) => ((b.likes?.length || 0) + (b.dislikes?.length || 0)) - ((a.likes?.length || 0) + (a.dislikes?.length || 0)));
      }

      const roomWithReset = await RoomService.resetUsersReadyState(roomId);
      if (roomWithReset) {
        io.to(roomId).emit('phase-changed', { phase: roomWithReset.phase, cards: sortedCards });
        io.to(roomId).emit('state-updated', {
          cards: sortedCards,
          phase: roomWithReset.phase,
          users: roomWithReset.users
        });
      }
    } catch (error) {
      console.error('Error in change-phase:', error);
      socket.emit('error', 'Failed to change phase');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Development server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  try {
    const { pathname, search } = new URL(req.url, 'http://localhost');

    // Health check (support both /api/health and /health)
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/health')) {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    // REST endpoint: list rooms
    if (req.method === 'GET' && pathname === '/api/rooms') {
      try {
        const rooms = await RoomService.getAllRooms();
        res.json(rooms.map((r: { id: string; users: any[]; phase: any }) => ({ id: r.id, usersCount: r.users.length, phase: r.phase })));
      } catch (e) {
        console.error('Error getting rooms (serverless):', e);
        res.status(500).json({ error: 'Failed to get rooms' });
      }
      return;
    }

    // Handle Socket.IO
    const isSocketPath =
      pathname === '/socket.io' ||
      pathname?.startsWith('/socket.io/') ||
      pathname === '/api/server' ||
      pathname?.startsWith('/api/server') ||
      pathname === '/api/socket.io' ||
      pathname?.startsWith('/api/socket.io/');
    const looksLikeEngineIo = (search || '').includes('EIO=');

    if (isSocketPath || looksLikeEngineIo) {
      // Ensure engine.io path aligns with configured io path
      // @ts-ignore
      req.url = '/socket.io' + (new URL(req.url, 'http://localhost').search || '');
      io.engine.handleRequest(req, res);
      return;
    }

    res.status(404).end();
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}