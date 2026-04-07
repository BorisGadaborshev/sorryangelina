import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { Room, User, Card, RoomState, Mood } from './types';
import bcrypt from 'bcryptjs';
import { RoomService } from './services/RoomService';
import { AccountService } from './services/AccountService';
import { signAuthToken, verifyAuthToken } from './config/jwt';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';

dotenv.config();

// Connect to Postgres
connectDB().catch((err) => {
  console.error('PostgreSQL connection error:', err);
  process.exit(1);
});

const app = express();
const httpServer = createServer(app);
const rooms = new Map<string, Room>();
const roomStates = new Map<string, RoomState>();

// Настраиваем CORS для Express с учетом Vercel
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://sorryangelina.vercel.app', 'https://sorryangelina-git-main-borisgadaborshevs-projects.vercel.app']
    : "http://localhost:3000",
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Serve static files from the React app
const clientBuildPath = path.join(__dirname, '../../../client/build');
console.log('Client build path:', clientBuildPath);
app.use(express.static(clientBuildPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connections: connectionCount,
    uptime: process.uptime()
  });
});

// Clear database endpoint
app.post('/api/clear-database', async (req, res) => {
  try {
    await RoomService.clearDatabase();
    res.json({ message: 'Database cleared successfully' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database' });
  }
});

// Get available rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await RoomService.getAllRooms();
    res.json(rooms.map(room => ({
      id: room.id,
      usersCount: room.users.length,
      phase: room.phase,
      owner: room.owner,
      createdAt: room.createdAt
    })));
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

app.delete('/api/rooms/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const auth = verifyAuthToken(token);

  if (!auth) {
    res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
    return;
  }

  try {
    const room = await RoomService.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.owner !== auth.name) {
      res.status(403).json({ error: 'Only room creator can delete the room' });
      return;
    }

    await RoomService.deleteRoom(roomId);
    rooms.delete(roomId);
    roomStates.delete(roomId);
    clearRoomTimer(roomId, false);
    roomChats.delete(roomId);
    roomWhiteboards.delete(roomId);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room via API:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

app.get('/api/auth/fixed-users', (req, res) => {
  res.json({ users: AccountService.getFixedUsers() });
});

const buildAuthResponse = (profile: { name: string; type: 'fixed' | 'registered' | 'guest' }) => {
  const { token, expiresAt } = signAuthToken(profile.name, profile.type);
  return {
    profile: {
      ...profile,
      token,
      expiresAt
    }
  };
};

app.post('/api/auth/fixed-login', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: 'Name and password are required' });
    return;
  }

  try {
    const result = await AccountService.fixedLogin(name, password);
    res.json({
      ...buildAuthResponse(result.profile),
      isFirstLogin: result.isFirstLogin
    });
  } catch (error) {
    console.error('Fixed login error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: 'Name and password are required' });
    return;
  }

  try {
    const profile = await AccountService.login(name, password);
    res.json(buildAuthResponse(profile));
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: 'Name and password are required' });
    return;
  }

  try {
    const profile = await AccountService.register(name, password);
    res.json(buildAuthResponse(profile));
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to register' });
  }
});

app.post('/api/auth/guest', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  try {
    const profile = AccountService.guestLogin(name);
    res.json(buildAuthResponse(profile));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login as guest' });
  }
});

// Настраиваем Socket.IO с учетом Vercel
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? "https://sorryangelina.vercel.app"
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io",
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  upgradeTimeout: 10000,
  allowEIO3: true
});

// Add connection error handling
io.engine.on("connection_error", (err) => {
  console.log('Connection error:', err);
});

// Helper function to get sorted cards by votes
const getSortedCards = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => ((b.likes?.length || 0) - (b.dislikes?.length || 0)) - ((a.likes?.length || 0) - (a.dislikes?.length || 0)));
};

const getCardTypeByColumn = (column: number): Card['type'] => {
  if (column === 1) return 'disliked';
  if (column === 2) return 'suggestion';
  return 'liked';
};

const normalizeImageUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed)) return trimmed;
  return undefined;
};

const normalizeMood = (value: unknown): Mood | undefined => {
  if (typeof value !== 'string') return undefined;
  const allowed: Mood[] = ['great', 'good', 'neutral', 'bad', 'awful'];
  return allowed.includes(value as Mood) ? (value as Mood) : undefined;
};

// Connection monitoring
let connectionCount = 0;
type PhaseType = 'creation' | 'voting' | 'discussion';

interface RoomTimerSession {
  phase: PhaseType;
  durationSeconds: number;
  endAt: number;
  interval: NodeJS.Timeout;
}

interface ChatMessage {
  id: string;
  roomId: string;
  userName: string;
  text: string;
  timestamp: number;
}

interface WhiteboardPoint {
  x: number;
  y: number;
}

interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  points: WhiteboardPoint[];
}

const roomTimers = new Map<string, RoomTimerSession>();
const roomChats = new Map<string, ChatMessage[]>();
const roomWhiteboards = new Map<string, WhiteboardStroke[]>();

const getRemainingSeconds = (endAt: number): number => {
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
};

const emitTimerResetToRoom = (roomId: string): void => {
  io.to(roomId).emit('timer-updated', {
    durationSeconds: 0,
    remainingSeconds: 0,
    running: false
  });
};

const emitTimerToRoom = (roomId: string, session: RoomTimerSession): void => {
  io.to(roomId).emit('timer-updated', {
    phase: session.phase,
    durationSeconds: session.durationSeconds,
    remainingSeconds: getRemainingSeconds(session.endAt),
    running: true
  });
};

const emitTimerToSocket = (socket: Socket, roomId: string): void => {
  const session = roomTimers.get(roomId);
  if (!session) {
    socket.emit('timer-updated', {
      durationSeconds: 0,
      remainingSeconds: 0,
      running: false
    });
    return;
  }

  socket.emit('timer-updated', {
    phase: session.phase,
    durationSeconds: session.durationSeconds,
    remainingSeconds: getRemainingSeconds(session.endAt),
    running: true
  });
};

const clearRoomTimer = (roomId: string, emitReset = true): void => {
  const session = roomTimers.get(roomId);
  if (session) {
    clearInterval(session.interval);
    roomTimers.delete(roomId);
  }
  if (emitReset) {
    emitTimerResetToRoom(roomId);
  }
};

const appendChatMessage = (roomId: string, message: ChatMessage): ChatMessage[] => {
  const history = roomChats.get(roomId) || [];
  const next = [...history, message].slice(-200);
  roomChats.set(roomId, next);
  return next;
};

const normalizeWhiteboardStroke = (value: unknown): WhiteboardStroke | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<WhiteboardStroke>;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.userId !== 'string' ||
    typeof raw.color !== 'string' ||
    typeof raw.width !== 'number' ||
    (raw.tool !== 'pen' && raw.tool !== 'eraser') ||
    !Array.isArray(raw.points)
  ) {
    return null;
  }
  const points = raw.points
    .filter((point): point is WhiteboardPoint => !!point && typeof point.x === 'number' && typeof point.y === 'number')
    .slice(0, 1000);
  if (points.length < 2) return null;
  return {
    id: raw.id.slice(0, 100),
    userId: raw.userId.slice(0, 100),
    color: raw.color.slice(0, 30),
    width: Math.max(1, Math.min(40, raw.width)),
    tool: raw.tool,
    points
  };
};

io.on('connection', (socket) => {
  connectionCount++;
  console.log(`Client connected (${connectionCount} total):`, socket.id);
  console.log('Connection details:', {
    transport: socket.conn.transport.name,
    remoteAddress: socket.handshake.address,
    timestamp: new Date().toISOString()
  });
  
  let currentUser: User | null = null;

  socket.on('restore-session', async ({ roomId, userId, token }) => {
    console.log('Attempting to restore session:', { roomId, userId });
    const auth = verifyAuthToken(token);
    if (!auth) {
      socket.emit('session-expired');
      return;
    }
    
    try {
      const { room, user } = await RoomService.restoreSession(roomId, userId, socket.id);
      
      if (!room || !user) {
        console.log('Failed to restore session:', { roomId, userId });
        socket.emit('session-expired');
        return;
      }
      if (user.name !== auth.name) {
        socket.emit('session-expired');
        return;
      }

      socket.join(roomId);
      currentUser = user;
      
      console.log('Session restored successfully:', { roomId, userId });
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        } 
      });
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
    } catch (error) {
      console.error('Error restoring session:', error);
      socket.emit('session-expired');
    }
  });

  socket.on('create-room', async ({ roomId, password, username, token }) => {
    const auth = verifyAuthToken(token);
    if (!auth) {
      socket.emit('error', 'Unauthorized: token is invalid or expired');
      return;
    }
    if (username && auth.name !== username) {
      socket.emit('error', 'Unauthorized: token does not match user');
      return;
    }
    const effectiveUsername = auth.name;
    console.log('Attempting to create room:', { roomId, username: effectiveUsername });
    
    try {
      const existingRoom = await RoomService.getRoom(roomId);
      if (existingRoom) {
        console.log('Room already exists:', roomId);
        socket.emit('error', 'Room already exists');
        return;
      }

      const room = await RoomService.createRoom(roomId, password, socket.id, effectiveUsername);
      socket.join(roomId);
      currentUser = { 
        id: socket.id, 
        name: effectiveUsername, 
        roomId,
        role: 'admin'
      };
      
      console.log('Room created successfully:', roomId);
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: socket.id
      });
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room');
    }
  });

  socket.on('join-room', async ({ roomId, password, username, token }) => {
    const auth = verifyAuthToken(token);
    if (!auth) {
      socket.emit('error', 'Unauthorized: token is invalid or expired');
      return;
    }
    if (username && auth.name !== username) {
      socket.emit('error', 'Unauthorized: token does not match user');
      return;
    }
    const effectiveUsername = auth.name;
    console.log('Attempting to join room:', { roomId, username: effectiveUsername });
    
    try {
      const isValid = await RoomService.validatePassword(roomId, password);
      if (!isValid) {
        console.log('Invalid password for room:', roomId);
        socket.emit('error', 'Invalid password');
        return;
      }

      // Check for existing user first
      const existingUser = await RoomService.findExistingUser(roomId, effectiveUsername);
      const user: User = {
        id: socket.id,
        name: effectiveUsername,
        roomId,
        role: 'user'
      };

      // If user exists, we'll reuse their original ID for card ownership
      if (existingUser) {
        console.log('User rejoining room:', { roomId, username: effectiveUsername });
        user.id = existingUser.id;
      }

      const room = await RoomService.addUser(roomId, user);
      
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      socket.join(roomId);
      currentUser = user;
      
      console.log('User joined room successfully:', { roomId, username: effectiveUsername, isRejoin: !!existingUser });
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: user.id
      });
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
      if (!existingUser) {
        socket.to(roomId).emit('user-joined', user);
      } else {
        socket.to(roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('add-card', async ({ text, type, column, imageUrl }) => {
    if (!currentUser) return;

    try {
      console.log('Received add-card event:', { text, type, column, imageUrl, userId: currentUser.id });
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || room.phase !== 'creation') return;

      const safeImageUrl = normalizeImageUrl(imageUrl);

      const card: Card = {
        id: Date.now().toString(),
        text,
        type,
        createdBy: currentUser.name,
        likes: [],
        dislikes: [],
        column,
        imageUrl: safeImageUrl
      };

      const updatedRoom = await RoomService.addCard(currentUser.roomId, card);
      if (updatedRoom) {
        // Обновляем состояние в памяти
        const roomState = roomStates.get(currentUser.roomId);
        if (roomState) {
          roomState.cards.push(card);
        }
        rooms.set(currentUser.roomId, updatedRoom);
        
        // Отправляем обновление всем клиентам в комнате
        console.log('Broadcasting card-added to room:', currentUser.roomId);
        io.to(currentUser.roomId).emit('card-added', card);
        io.to(currentUser.roomId).emit('state-updated', {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        });
      }
    } catch (error) {
      console.error('Error adding card:', error);
      socket.emit('error', 'Failed to add card');
    }
  });

  socket.on('update-card', async ({ cardId, text, imageUrl }) => {
    if (!currentUser) return;
    const currentUserName = currentUser.name;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || (room.phase !== 'creation' && room.phase !== 'discussion')) return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;
      const isAdmin = room.users.some((user) => user.name === currentUserName && user.role === 'admin');
      if (!isAdmin && card.createdBy !== currentUserName) return;

      const updates: Partial<Card> = {};
      if (typeof text === 'string') {
        updates.text = text;
      }
      if (typeof imageUrl !== 'undefined') {
        updates.imageUrl = normalizeImageUrl(imageUrl);
      }
      if (Object.keys(updates).length === 0) return;

      const updatedRoom = await RoomService.updateCard(currentUser.roomId, cardId, updates);
      if (updatedRoom) {
        const updatedCard = updatedRoom.cards.find((currentCard) => currentCard.id === cardId);
        if (updatedCard) {
          io.to(currentUser.roomId).emit('card-updated', updatedCard);
        }
        io.to(currentUser.roomId).emit('state-updated', {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        });
      }
    } catch (error) {
      console.error('Error updating card:', error);
      socket.emit('error', 'Failed to update card');
    }
  });

  socket.on('delete-card', async ({ cardId }) => {
    if (!currentUser) return;
    const currentUserName = currentUser.name;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || (room.phase !== 'creation' && room.phase !== 'discussion')) return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;
      const isAdmin = room.users.some((user) => user.name === currentUserName && user.role === 'admin');
      if (!isAdmin && card.createdBy !== currentUserName) return;

      const updatedRoom = await RoomService.deleteCard(currentUser.roomId, cardId);
      if (updatedRoom) {
        io.to(currentUser.roomId).emit('card-deleted', cardId);
        io.to(currentUser.roomId).emit('state-updated', {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        });
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      socket.emit('error', 'Failed to delete card');
    }
  });

  socket.on('move-card', async ({ cardId, column }) => {
    if (!currentUser) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || room.phase !== 'creation') return;

      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card) return;

      const nextType = getCardTypeByColumn(column);
      const updatedRoom = await RoomService.updateCard(currentUser.roomId, cardId, { column, type: nextType });
      if (!updatedRoom) return;

      io.to(currentUser.roomId).emit('card-moved', { cardId, column });
      io.to(currentUser.roomId).emit('state-updated', {
        cards: updatedRoom.cards,
        phase: updatedRoom.phase,
        users: updatedRoom.users
      });
    } catch (error) {
      console.error('Error moving card:', error);
      socket.emit('error', 'Failed to move card');
    }
  });

  socket.on('vote-card', async ({ cardId, voteType }) => {
    if (!currentUser) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || room.phase !== 'voting') return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;

      const updatedRoom = await RoomService.updateCardVotes(currentUser.roomId, cardId, currentUser.id, voteType);
      if (updatedRoom) {
        const updatedCard = updatedRoom.cards.find(c => c.id === cardId);
        if (updatedCard) {
          io.to(currentUser.roomId).emit('card-voted', { 
            cardId, 
            likes: updatedCard.likes,
            dislikes: updatedCard.dislikes
          });
          io.to(currentUser.roomId).emit('state-updated', {
            cards: updatedRoom.cards,
            phase: updatedRoom.phase,
            users: updatedRoom.users
          });
        }
      }
    } catch (error) {
      console.error('Error voting for card:', error);
      const message = error instanceof Error ? error.message : 'Failed to vote for card';
      if (error instanceof Error && message.includes('не более 3')) {
        socket.emit('vote-error', { cardId, message });
        return;
      }
      socket.emit('error', message);
    }
  });

  socket.on('update-ready-state', async ({ isReady }) => {
    if (!currentUser?.roomId) return;

    console.log('Received ready state update:', {
      userId: currentUser.id,
      userName: currentUser.name,
      isReady
    });

    try {
      const room = await RoomService.updateUserReadyState(currentUser.roomId, currentUser.id, isReady);
      if (room) {
        io.to(currentUser.roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
      }
    } catch (error) {
      console.error('Error updating ready state:', error);
    }
  });

  socket.on('set-user-mood', async ({ mood }) => {
    if (!currentUser?.roomId) return;
    const safeMood = normalizeMood(mood);
    if (!safeMood) {
      socket.emit('error', 'Invalid mood');
      return;
    }

    try {
      const room = await RoomService.updateUserMood(currentUser.roomId, currentUser.id, safeMood);
      if (!room) return;
      currentUser = {
        ...currentUser,
        mood: safeMood
      };
      io.to(currentUser.roomId).emit('state-updated', {
        cards: room.cards,
        phase: room.phase,
        users: room.users
      });
    } catch (error) {
      console.error('Error updating user mood:', error);
      socket.emit('error', 'Failed to update user mood');
    }
  });

  socket.on('change-phase', async ({ phase }) => {
    if (!currentUser?.roomId) return;

    console.log('Phase change requested:', {
      userId: currentUser.id,
      userName: currentUser.name,
      phase
    });

    try {
      // Сначала меняем фазу
      const updatedRoom = await RoomService.updatePhase(currentUser.roomId, phase as 'creation' | 'voting' | 'discussion', currentUser.id);
      if (!updatedRoom) {
        socket.emit('error', 'Failed to change phase');
        return;
      }

      // Если фаза обсуждения, сортируем карточки по голосам
      let sortedCards = updatedRoom.cards;
      if (phase === 'discussion') {
        console.log('Sorting cards for discussion phase');
        sortedCards = getSortedCards(updatedRoom.cards);
        console.log('Sorted cards:', sortedCards.map(c => ({
          id: c.id,
          text: c.text,
          likes: c.likes?.length || 0,
          dislikes: c.dislikes?.length || 0,
          score: (c.likes?.length || 0) - (c.dislikes?.length || 0)
        })));
      }

      // После смены фазы сбрасываем состояния готовности всех пользователей
      const roomWithResetStates = await RoomService.resetUsersReadyState(currentUser.roomId);
      if (roomWithResetStates) {
        clearRoomTimer(currentUser.roomId, true);
        // Отправляем оба события для обновления UI
        io.to(currentUser.roomId).emit('phase-changed', { 
          phase: roomWithResetStates.phase, 
          cards: sortedCards 
        });
        io.to(currentUser.roomId).emit('state-updated', {
          cards: sortedCards,
          phase: roomWithResetStates.phase,
          users: roomWithResetStates.users
        });
      }
    } catch (error) {
      console.error('Error changing phase:', error);
      socket.emit('error', 'Failed to change phase');
    }
  });

  socket.on('set-phase-timer', async ({ durationSeconds }) => {
    if (!currentUser?.roomId) return;

    const allowedDurations = [60, 180, 300, 600, 900];
    if (!allowedDurations.includes(durationSeconds)) {
      socket.emit('error', 'Invalid timer duration');
      return;
    }

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room) return;

      const isAdmin = room.users.some(
        (user) => user.name === currentUser?.name && user.role === 'admin'
      );
      if (!isAdmin) {
        socket.emit('error', 'Only admin can start timer');
        return;
      }

      clearRoomTimer(currentUser.roomId, false);

      const endAt = Date.now() + durationSeconds * 1000;
      const session: RoomTimerSession = {
        phase: room.phase,
        durationSeconds,
        endAt,
        interval: setInterval(() => {
          const activeSession = roomTimers.get(room.id);
          if (!activeSession) return;

          const remainingSeconds = getRemainingSeconds(activeSession.endAt);
          if (remainingSeconds <= 0) {
            io.to(room.id).emit('timer-updated', {
              phase: activeSession.phase,
              durationSeconds: activeSession.durationSeconds,
              remainingSeconds: 0,
              running: false
            });
            clearRoomTimer(room.id, false);
            return;
          }

          emitTimerToRoom(room.id, activeSession);
        }, 1000)
      };

      roomTimers.set(currentUser.roomId, session);
      emitTimerToRoom(currentUser.roomId, session);
    } catch (error) {
      console.error('Error setting phase timer:', error);
      socket.emit('error', 'Failed to start timer');
    }
  });

  socket.on('reset-phase-timer', async () => {
    if (!currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room) return;

      const isAdmin = room.users.some(
        (user) => user.name === currentUser?.name && user.role === 'admin'
      );
      if (!isAdmin) {
        socket.emit('error', 'Only admin can reset timer');
        return;
      }

      clearRoomTimer(currentUser.roomId, true);
    } catch (error) {
      console.error('Error resetting phase timer:', error);
      socket.emit('error', 'Failed to reset timer');
    }
  });

  socket.on('send-chat-message', ({ text }) => {
    if (!currentUser?.roomId) return;
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId: currentUser.roomId,
      userName: currentUser.name,
      text: normalized.slice(0, 500),
      timestamp: Date.now()
    };

    appendChatMessage(currentUser.roomId, message);
    io.to(currentUser.roomId).emit('chat-message', message);
  });

  socket.on('whiteboard-stroke', (payload) => {
    if (!currentUser?.roomId) return;
    const stroke = normalizeWhiteboardStroke(payload);
    if (!stroke) return;
    const current = roomWhiteboards.get(currentUser.roomId) || [];
    const next = [...current, stroke].slice(-5000);
    roomWhiteboards.set(currentUser.roomId, next);
    io.to(currentUser.roomId).emit('whiteboard-stroke', stroke);
  });

  socket.on('clear-whiteboard', () => {
    if (!currentUser?.roomId) return;
    roomWhiteboards.set(currentUser.roomId, []);
    io.to(currentUser.roomId).emit('whiteboard-cleared');
  });

  socket.on('delete-room', async () => {
    if (!currentUser?.roomId) {
      socket.emit('error', 'Room not found');
      return;
    }

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      const isOwner = room.owner === currentUser.name;
      if (!isOwner) {
        socket.emit('error', 'Only room creator can delete the room');
        return;
      }

      const roomId = currentUser.roomId;
      await RoomService.deleteRoom(roomId);
      rooms.delete(roomId);
      roomStates.delete(roomId);
      clearRoomTimer(roomId, false);
      roomChats.delete(roomId);
      roomWhiteboards.delete(roomId);

      io.to(roomId).emit('room-deleted');
      io.in(roomId).socketsLeave(roomId);
      currentUser = null;
    } catch (error) {
      console.error('Error deleting room:', error);
      socket.emit('error', 'Failed to delete room');
    }
  });

  socket.on('disconnect', async (reason) => {
    connectionCount--;
    console.log(`Client disconnected (${connectionCount} total):`, socket.id);
    console.log('Disconnect reason:', reason);
    
    if (!currentUser) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room) return;

      const updatedRoom = await RoomService.removeUser(currentUser.roomId, currentUser.id);
      if (!updatedRoom) return;

      if (updatedRoom.users.length === 0) {
        // If the room is empty, we might want to keep it for some time before deletion
        // For now, we'll keep the room in the database
        console.log('Room is empty:', currentUser.roomId);
      } else {
        socket.to(currentUser.roomId).emit('user-left', currentUser);
        socket.to(currentUser.roomId).emit('state-updated', {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error for client:', socket.id, error);
  });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  console.log('Serving index.html for path:', req.path);
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 