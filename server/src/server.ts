import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { Room, User, Card, RoomState, Mood, Phase, RoomFeatures } from './types';
import { normalizeRoomFeatures } from './utils/roomFeatures';
import bcrypt from 'bcryptjs';
import { RoomService } from './services/RoomService';
import { BUILTIN_TEAM_ID, TeamService } from './services/TeamService';
import { AccountService } from './services/AccountService';
import { signAuthToken, verifyAuthToken } from './config/jwt';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';

dotenv.config();

// Connect to Postgres
connectDB().catch((err) => {
  console.error('PostgreSQL connection error:', err);
  if (process.env.NODE_ENV === 'production') {
    console.error('Server will keep running, but database-backed features may fail until PostgreSQL is available.');
    return;
  }
  process.exit(1);
});

const app = express();
const httpServer = createServer(app);
const rooms = new Map<string, Room>();
const roomStates = new Map<string, RoomState>();

// Настраиваем CORS для Express с учетом Vercel
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://sorryangelina.ru',
        'https://www.sorryangelina.ru',
        'https://sorryangelina.vercel.app',
        'https://sorryangelina-git-main-borisgadaborshevs-projects.vercel.app'
      ]
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
    await TeamService.ensureBuiltinTeam();
    const rooms = await RoomService.getAvailableRoomSummaries(BUILTIN_TEAM_ID);
    res.json(rooms);
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await TeamService.getAllTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error getting teams:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

app.post('/api/teams', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const auth = verifyAuthToken(token);

  if (!auth) {
    res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
    return;
  }

  const { name, password, members, scrumMasterName } = req.body as {
    name?: string;
    password?: string;
    members?: string[];
    scrumMasterName?: string;
  };

  if (!name?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Team name and password are required' });
    return;
  }

  try {
    const team = await TeamService.createTeam({
      name,
      password,
      owner: auth.name,
      members: normalizeNameList(members),
      scrumMasterName
    });
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create team' });
  }
});

app.post('/api/teams/:teamId/join', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const auth = verifyAuthToken(token);

  if (!auth) {
    res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
    return;
  }

  const { password } = req.body as { password?: string };
  const isFixedBuiltinJoin = req.params.teamId === BUILTIN_TEAM_ID && auth.type === 'fixed';

  if (!isFixedBuiltinJoin && !password?.trim()) {
    res.status(400).json({ error: 'Team password is required' });
    return;
  }

  try {
    const team = isFixedBuiltinJoin
      ? await TeamService.joinBuiltinTeamForFixedUser(auth.name)
      : await TeamService.joinTeam(req.params.teamId, password!, auth.name);
    res.json(team);
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to join team' });
  }
});

app.get('/api/teams/:teamId/members', async (req, res) => {
  try {
    const members = await TeamService.getTeamRosterNames(req.params.teamId);
    res.json({ members });
  } catch (error) {
    console.error('Error getting team members:', error);
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

app.get('/api/teams/:teamId/rooms', async (req, res) => {
  try {
    const team = await TeamService.getTeam(req.params.teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const rooms = await RoomService.getAvailableRoomSummaries(req.params.teamId);
    res.json(rooms);
  } catch (error) {
    console.error('Error getting team rooms:', error);
    res.status(500).json({ error: 'Failed to get team rooms' });
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
    roomRetroRatings.delete(roomId);
    roomFacilitators.delete(roomId);
    roomDiscussionNavigation.delete(roomId);
    roomSprintVipVotes.delete(roomId);

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

const buildDiscussionNavigation = (cards: Card[]): DiscussionNavigationState => ({
  unviewedCardIds: getSortedCards(cards).map((card) => card.id),
  viewedCardIds: []
});

const ensureDiscussionNavigation = (roomId: string, room: Room): DiscussionNavigationState | null => {
  if (room.phase !== 'discussion') return null;
  const existing = roomDiscussionNavigation.get(roomId);
  if (existing) return existing;

  const initial = buildDiscussionNavigation(room.cards);
  roomDiscussionNavigation.set(roomId, initial);
  return initial;
};

const emitDiscussionNavigationToSocket = (socket: Socket, roomId: string, room?: Room): void => {
  const state = room ? ensureDiscussionNavigation(roomId, room) : roomDiscussionNavigation.get(roomId);
  if (state) {
    socket.emit('discussion-navigation', state);
  }
};

const canControlDiscussionNavigation = (
  room: Room,
  userName: string,
  userRole: User['role']
): boolean => {
  if (userRole === 'admin' || room.owner === userName) {
    return true;
  }
  const facilitator = roomFacilitators.get(room.id);
  return facilitator?.userName === userName;
};

const normalizeDiscussionNavigation = (
  room: Room,
  state: DiscussionNavigationState
): DiscussionNavigationState | null => {
  const availableIds = new Set(room.cards.map((card) => card.id));
  const unviewedCardIds = state.unviewedCardIds.filter((id) => availableIds.has(id));
  const viewedCardIds = state.viewedCardIds.filter((id) => availableIds.has(id));
  const knownIds = new Set([...unviewedCardIds, ...viewedCardIds]);
  const appended = room.cards
    .map((card) => card.id)
    .filter((id) => !knownIds.has(id));

  if (unviewedCardIds.length + viewedCardIds.length + appended.length === 0) {
    return null;
  }

  return {
    unviewedCardIds: [...unviewedCardIds, ...appended],
    viewedCardIds
  };
};

const canInteractWithCardSocial = (phase: Phase): boolean =>
  phase === 'creation' || phase === 'voting' || phase === 'discussion';

const getRoomFeatures = (room: Room) => normalizeRoomFeatures(room.features);

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

const normalizeNameList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean);
};

// Connection monitoring
let connectionCount = 0;
interface RoomTimerSession {
  phase: Phase;
  durationSeconds: number;
  endAt: number;
  interval: NodeJS.Timeout;
}

interface RetroRatingRoomState {
  votes: Map<string, 1 | 2 | 3 | 4 | 5>;
  resultsVisible: boolean;
}

interface FacilitatorAnnouncement {
  userId: string;
  userName: string;
  selectedAt: number;
}

interface DiscussionNavigationState {
  unviewedCardIds: string[];
  viewedCardIds: string[];
}

interface SprintVipState {
  vipUserName?: string;
  voteCount: number;
  myVote?: string;
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
const roomRetroRatings = new Map<string, RetroRatingRoomState>();
const roomFacilitators = new Map<string, FacilitatorAnnouncement>();
const roomDiscussionNavigation = new Map<string, DiscussionNavigationState>();
const roomSprintVipVotes = new Map<string, Map<string, string>>();
const roomUserSocketPresence = new Map<string, Map<string, Set<string>>>();

const addRoomPresence = (roomId: string, userName: string, socketId: string): void => {
  let roomMap = roomUserSocketPresence.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    roomUserSocketPresence.set(roomId, roomMap);
  }
  let sockets = roomMap.get(userName);
  if (!sockets) {
    sockets = new Set();
    roomMap.set(userName, sockets);
  }
  sockets.add(socketId);
};

const removeRoomPresence = (roomId: string, userName: string, socketId: string): boolean => {
  const roomMap = roomUserSocketPresence.get(roomId);
  if (!roomMap) {
    return true;
  }
  const sockets = roomMap.get(userName);
  if (!sockets) {
    return true;
  }
  sockets.delete(socketId);
  if (sockets.size === 0) {
    roomMap.delete(userName);
    if (roomMap.size === 0) {
      roomUserSocketPresence.delete(roomId);
    }
    return true;
  }
  return false;
};

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

const getRetroRatingState = (roomId: string): RetroRatingRoomState => {
  const existing = roomRetroRatings.get(roomId);
  if (existing) return existing;
  const created: RetroRatingRoomState = { votes: new Map(), resultsVisible: false };
  roomRetroRatings.set(roomId, created);
  return created;
};

const buildRetroRatingPayload = (room: Room, userId?: string) => {
  const ratingState = getRetroRatingState(room.id);
  const values = Array.from(ratingState.votes.values());
  const distribution = {
    1: values.filter((value) => value === 1).length,
    2: values.filter((value) => value === 2).length,
    3: values.filter((value) => value === 3).length,
    4: values.filter((value) => value === 4).length,
    5: values.filter((value) => value === 5).length
  };
  const average = values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;

  return {
    hasVoted: userId ? ratingState.votes.has(userId) : false,
    votesCount: ratingState.votes.size,
    totalCount: room.users.length,
    resultsVisible: ratingState.resultsVisible,
    average: ratingState.resultsVisible ? average : undefined,
    distribution: ratingState.resultsVisible ? distribution : undefined
  };
};

const emitRetroRatingStateToRoom = async (roomId: string): Promise<void> => {
  const room = await RoomService.getRoom(roomId);
  if (!room) return;
  const sockets = await io.in(roomId).fetchSockets();
  sockets.forEach((connectedSocket) => {
    const userId = typeof connectedSocket.data.userId === 'string' ? connectedSocket.data.userId : connectedSocket.id;
    connectedSocket.emit('retro-rating-state', buildRetroRatingPayload(room, userId));
  });
};

const emitRetroRatingStateToSocket = (socket: Socket, room: Room): void => {
  const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
  socket.emit('retro-rating-state', buildRetroRatingPayload(room, userId));
};

const selectRandomFacilitator = (room: Room): FacilitatorAnnouncement | null => {
  if (room.users.length === 0) return null;
  const selectedUser = room.users[Math.floor(Math.random() * room.users.length)];
  return {
    userId: selectedUser.id,
    userName: selectedUser.name,
    selectedAt: Date.now()
  };
};

const buildSprintVipState = (room: Room): SprintVipState => {
  const votes = roomSprintVipVotes.get(room.id);
  if (!votes) return { voteCount: 0 };

  const activeNames = new Set(room.users.map((user) => user.name));
  const counts = new Map<string, number>();
  votes.forEach((votedUserName) => {
    if (!activeNames.has(votedUserName)) return;
    counts.set(votedUserName, (counts.get(votedUserName) || 0) + 1);
  });

  let vipUserName: string | undefined;
  let voteCount = 0;
  counts.forEach((count, userName) => {
    if (count > voteCount) {
      vipUserName = userName;
      voteCount = count;
    }
  });

  return { vipUserName, voteCount };
};

const buildPersonalSprintVipState = (room: Room, userName?: string): SprintVipState => {
  const votes = roomSprintVipVotes.get(room.id);
  const myVote = userName && votes ? votes.get(userName) : undefined;
  return {
    ...buildSprintVipState(room),
    myVote
  };
};

const resolveRoomUserForSocket = (
  room: Room,
  connectedSocket: { id: string; data: Record<string, unknown> }
): User | undefined => {
  const trackedUserName =
    typeof connectedSocket.data.userName === 'string' ? connectedSocket.data.userName : undefined;
  if (trackedUserName) {
    const byName = room.users.find((roomUser) => roomUser.name === trackedUserName);
    if (byName) return byName;
  }

  const trackedUserId =
    typeof connectedSocket.data.userId === 'string' ? connectedSocket.data.userId : connectedSocket.id;
  return room.users.find(
    (roomUser) => roomUser.id === trackedUserId || roomUser.id === connectedSocket.id
  );
};

const resolveVoterNameForSocket = (
  room: Room,
  connectedSocket: { id: string; data: Record<string, unknown> }
): string | undefined => {
  if (typeof connectedSocket.data.userName === 'string') {
    return connectedSocket.data.userName;
  }
  return resolveRoomUserForSocket(room, connectedSocket)?.name;
};

const emitSprintVipStateToRoom = async (roomId: string): Promise<void> => {
  const room = await RoomService.getRoom(roomId);
  if (!room) return;
  const votes = roomSprintVipVotes.get(roomId);
  const sockets = await io.in(roomId).fetchSockets();
  const base = buildSprintVipState(room);

  for (const remoteSocket of sockets) {
    const voterName = resolveVoterNameForSocket(room, remoteSocket);
    const myVote = voterName && votes ? votes.get(voterName) : undefined;
    remoteSocket.emit('sprint-vip-state', { ...base, myVote });
  }
};

const emitSprintVipStateToSocket = (socket: Socket, room: Room): void => {
  const voterName = resolveVoterNameForSocket(room, socket);
  socket.emit('sprint-vip-state', buildPersonalSprintVipState(room, voterName));
};

const handleUserLeavingRoom = async (socket: Socket, user: User): Promise<Room | null> => {
  const roomId = user.roomId || (typeof socket.data.roomId === 'string' ? socket.data.roomId : '');
  if (!roomId) return null;

  const shouldRemoveFromRoom = removeRoomPresence(roomId, user.name, socket.id);

  socket.leave(roomId);
  delete socket.data.userId;
  delete socket.data.userName;

  if (!shouldRemoveFromRoom) {
    return null;
  }

  const room = await RoomService.getRoom(roomId);
  if (!room) return null;

  const userInRoom = room.users.find((roomUser) => roomUser.name === user.name)
    ?? room.users.find((roomUser) => roomUser.id === user.id);
  const userIdForCleanup = userInRoom?.id ?? user.id;

  const updatedRoom = await RoomService.removeUser(roomId, userIdForCleanup, user.name);
  if (!updatedRoom) return null;

  getRetroRatingState(roomId).votes.delete(userIdForCleanup);
  const vipVotes = roomSprintVipVotes.get(roomId);
  if (vipVotes) {
    vipVotes.delete(user.name);
    vipVotes.forEach((votedUserName, voterName) => {
      if (votedUserName === user.name) {
        vipVotes.delete(voterName);
      }
    });
  }

  if (updatedRoom.users.length === 0) {
    roomSprintVipVotes.delete(roomId);
    roomUserSocketPresence.delete(roomId);
    console.log('Room is empty:', roomId);
  } else {
    io.to(roomId).emit('user-left', user);
    io.to(roomId).emit('state-updated', {
      cards: updatedRoom.cards,
      phase: updatedRoom.phase,
      users: updatedRoom.users
    });
    await emitRetroRatingStateToRoom(roomId);
    await emitSprintVipStateToRoom(roomId);
  }

  return updatedRoom;
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

  socket.on('restore-session', async ({ roomId, userId, username, token }) => {
    console.log('Attempting to restore session:', { roomId, userId, username });
    const auth = verifyAuthToken(token);
    if (!auth) {
      socket.emit('session-expired');
      return;
    }

    try {
      const { room, user } = await RoomService.restoreSession(
        roomId,
        userId,
        socket.id,
        username || auth.name
      );
      
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
      currentUser = { ...user, roomId };
      socket.data.userId = currentUser.id;
      socket.data.userName = currentUser.name;
      socket.data.roomId = roomId;
      addRoomPresence(roomId, user.name, socket.id);
      
      console.log('Session restored successfully:', { roomId, userId: currentUser.id });
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: currentUser.id
      });
      socket.to(roomId).emit('state-updated', {
        cards: room.cards,
        phase: room.phase,
        users: room.users
      });
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
      emitRetroRatingStateToSocket(socket, room);
      emitSprintVipStateToSocket(socket, room);
      emitDiscussionNavigationToSocket(socket, roomId, room);
    } catch (error) {
      console.error('Error restoring session:', error);
      socket.emit('session-expired');
    }
  });

  socket.on('create-room', async ({ roomId, password, username, token, teamId }) => {
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
    const normalizedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : BUILTIN_TEAM_ID;
    console.log('Attempting to create room:', {
      roomId,
      username: effectiveUsername,
      teamId: normalizedTeamId
    });
    
    try {
      const teamRole = await TeamService.getUserRole(normalizedTeamId, effectiveUsername);
      if (!teamRole) {
        socket.emit('error', 'Join the team before creating a room');
        return;
      }

      const existingRoom = await RoomService.getRoom(roomId);
      if (existingRoom) {
        console.log('Room already exists:', roomId);
        socket.emit('error', 'Room already exists');
        return;
      }

      const room = await RoomService.createRoom(roomId, password, socket.id, effectiveUsername, {
        teamId: normalizedTeamId
      });
      socket.join(roomId);
      socket.data.userId = socket.id;
      socket.data.userName = effectiveUsername;
      socket.data.roomId = roomId;
      currentUser = room.users.find((user) => user.id === socket.id) || {
        id: socket.id,
        name: effectiveUsername,
        roomId,
        role: 'user'
      };
      addRoomPresence(roomId, effectiveUsername, socket.id);
      
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
      emitRetroRatingStateToSocket(socket, room);
      emitSprintVipStateToSocket(socket, room);
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

      const existingRoom = await RoomService.getRoom(roomId);
      if (!existingRoom) {
        socket.emit('error', 'Room not found');
        return;
      }
      const teamRole = existingRoom.teamId
        ? await TeamService.getUserRole(existingRoom.teamId, effectiveUsername)
        : null;
      if (existingRoom.teamId && !teamRole) {
        socket.emit('error', 'Join the team before joining a room');
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

      if (existingUser) {
        console.log('User rejoining room:', { roomId, username: effectiveUsername });
        user.role = existingUser.role || 'user';
      }

      await RoomService.addUser(roomId, user);

      const room = await RoomService.getRoom(roomId);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      const joinedUser = room.users.find((roomUser) => roomUser.name === effectiveUsername);

      socket.join(roomId);
      currentUser = joinedUser
        ? { ...joinedUser, roomId }
        : user;
      socket.data.userId = currentUser.id;
      socket.data.userName = effectiveUsername;
      socket.data.roomId = roomId;
      addRoomPresence(roomId, effectiveUsername, socket.id);
      
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
      emitRetroRatingStateToSocket(socket, room);
      emitSprintVipStateToSocket(socket, room);
      emitDiscussionNavigationToSocket(socket, roomId, room);
      if (!existingUser) {
        socket.to(roomId).emit('user-joined', user);
      } else {
        socket.to(roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
      }
      await emitRetroRatingStateToRoom(roomId);
      await emitSprintVipStateToRoom(roomId);
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

      const features = getRoomFeatures(room);
      const safeImageUrl = features.mediaEnabled ? normalizeImageUrl(imageUrl) : undefined;

      const card: Card = {
        id: Date.now().toString(),
        text,
        type,
        createdBy: currentUser.name,
        likes: [],
        dislikes: [],
        column,
        imageUrl: safeImageUrl,
        comments: [],
        reactions: []
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

      const features = getRoomFeatures(room);
      if (!features.cardEditingEnabled) return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;
      const isAdmin = room.users.some((user) => user.name === currentUserName && user.role === 'admin');
      if (!isAdmin && card.createdBy !== currentUserName) return;

      const updates: Partial<Card> = {};
      if (typeof text === 'string') {
        updates.text = text;
      }
      if (typeof imageUrl !== 'undefined') {
        updates.imageUrl = features.mediaEnabled ? normalizeImageUrl(imageUrl) : undefined;
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
      if (!getRoomFeatures(room).cardEditingEnabled) return;

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

  socket.on('add-card-comment', async ({ cardId, text }) => {
    if (!currentUser) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || !canInteractWithCardSocial(room.phase)) return;
      if (!getRoomFeatures(room).commentsEnabled) return;
      if (typeof cardId !== 'string' || typeof text !== 'string') return;

      const result = await RoomService.addCardComment(
        currentUser.roomId,
        cardId,
        currentUser.id,
        currentUser.name,
        text
      );
      if (!result) return;

      io.to(currentUser.roomId).emit('card-comment-added', {
        cardId,
        comment: result.comment
      });
    } catch (error) {
      console.error('Error adding card comment:', error);
      socket.emit('error', 'Failed to add card comment');
    }
  });

  socket.on('toggle-card-reaction', async ({ cardId, emoji }) => {
    if (!currentUser) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || !canInteractWithCardSocial(room.phase)) return;
      if (!getRoomFeatures(room).reactionsEnabled) return;
      if (typeof cardId !== 'string' || typeof emoji !== 'string') return;

      const updatedCard = await RoomService.toggleCardReaction(
        currentUser.roomId,
        cardId,
        currentUser.id,
        currentUser.name,
        emoji
      );
      if (!updatedCard) return;

      io.to(currentUser.roomId).emit('card-reaction-updated', {
        cardId,
        reactions: updatedCard.reactions || []
      });
    } catch (error) {
      console.error('Error toggling card reaction:', error);
      socket.emit('error', 'Failed to toggle card reaction');
    }
  });

  socket.on('move-card', async ({ cardId, column }) => {
    if (!currentUser) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || room.phase !== 'creation') return;
      if (!getRoomFeatures(room).moveCardsEnabled) return;

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

      const features = getRoomFeatures(room);
      if (voteType === 'dislike' && !features.dislikesEnabled) return;

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
      if (error instanceof Error && message.includes('не более')) {
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

  socket.on('vote-sprint-vip', async ({ userName }) => {
    if (!currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room) return;
      if (!getRoomFeatures(room).sprintVipEnabled) return;

      const targetName = typeof userName === 'string' ? userName.trim() : '';
      const votes = roomSprintVipVotes.get(currentUser.roomId) || new Map<string, string>();
      const currentVote = votes.get(currentUser.name);

      if (!targetName || targetName === currentUser.name) {
        return;
      }

      if (!room.users.some((user) => user.name === targetName)) {
        socket.emit('error', 'Участник не найден');
        return;
      }

      if (currentVote === targetName) {
        votes.delete(currentUser.name);
      } else {
        votes.set(currentUser.name, targetName);
      }

      roomSprintVipVotes.set(currentUser.roomId, votes);
      await emitSprintVipStateToRoom(currentUser.roomId);
    } catch (error) {
      console.error('Error voting sprint VIP:', error);
      socket.emit('error', 'Не удалось проголосовать за VIP спринта');
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
    const allowedPhases: Phase[] = ['creation', 'voting', 'discussion', 'rating'];
    if (!allowedPhases.includes(phase)) {
      socket.emit('error', 'Invalid phase');
      return;
    }

    let actor = currentUser;
    if (!actor?.roomId) {
      const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
      const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
      const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
      if (roomId && userName) {
        const room = await RoomService.getRoom(roomId);
        const user = room?.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
        if (user) {
          actor = { ...user, roomId };
          currentUser = actor;
        }
      }
    }

    if (!actor?.roomId) {
      socket.emit('error', 'Не удалось сменить этап: сессия не восстановлена');
      return;
    }

    if (phase === 'rating') {
      const roomForFeatures = await RoomService.getRoom(actor.roomId);
      if (roomForFeatures && !getRoomFeatures(roomForFeatures).retroRatingEnabled) {
        socket.emit('error', 'Оценка ретро отключена в настройках комнаты');
        return;
      }
    }

    console.log('Phase change requested:', {
      userId: actor.id,
      userName: actor.name,
      phase
    });

    try {
      const previousRoom = await RoomService.getRoom(actor.roomId);
      const updatedRoom = await RoomService.updatePhase(actor.roomId, phase, actor.id, actor.name);
      if (!updatedRoom) {
        socket.emit('error', 'Failed to change phase');
        return;
      }

      let sortedCards = updatedRoom.cards;
      if (phase === 'discussion') {
        console.log('Sorting cards for discussion phase');
        sortedCards = getSortedCards(updatedRoom.cards);
      }

      const roomWithResetStates = await RoomService.resetUsersReadyState(actor.roomId);
      const roomState = roomWithResetStates || updatedRoom;

      clearRoomTimer(actor.roomId, true);
      if (roomState.phase === 'creation') {
        roomFacilitators.delete(actor.roomId);
        roomDiscussionNavigation.delete(actor.roomId);
      }
      if (roomState.phase === 'rating') {
        roomRetroRatings.set(actor.roomId, { votes: new Map(), resultsVisible: false });
      }
      if (roomState.phase === 'discussion') {
        const navigationState = buildDiscussionNavigation(sortedCards);
        roomDiscussionNavigation.set(actor.roomId, navigationState);
        io.to(actor.roomId).emit('discussion-navigation', navigationState);
      } else {
        roomDiscussionNavigation.delete(actor.roomId);
      }

      io.to(actor.roomId).emit('phase-changed', {
        phase: roomState.phase,
        cards: sortedCards
      });
      io.to(actor.roomId).emit('state-updated', {
        cards: sortedCards,
        phase: roomState.phase,
        users: roomState.users
      });

      if (previousRoom?.phase === 'creation' && roomState.phase !== 'creation') {
        const facilitator = selectRandomFacilitator(roomState);
        if (facilitator) {
          roomFacilitators.set(actor.roomId, facilitator);
          io.to(actor.roomId).emit('facilitator-selected', facilitator);
        }
      }
      await emitRetroRatingStateToRoom(actor.roomId);
    } catch (error) {
      console.error('Error changing phase:', error);
      socket.emit('error', 'Failed to change phase');
    }
  });

  socket.on('set-column-titles', async ({ titles }) => {
    let actor = currentUser;
    if (!actor?.roomId) {
      const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
      const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
      const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
      if (roomId && userName) {
        const room = await RoomService.getRoom(roomId);
        const user = room?.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
        if (user) {
          actor = { ...user, roomId };
          currentUser = actor;
        }
      }
    }

    if (!actor?.roomId) return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room) return;
      if (!canControlDiscussionNavigation(room, actor.name, actor.role)) return;
      if (!Array.isArray(titles)) return;

      const updatedRoom = await RoomService.updateColumnTitles(actor.roomId, titles);
      if (!updatedRoom?.columnTitles) return;

      io.to(actor.roomId).emit('column-titles-updated', { titles: updatedRoom.columnTitles });
    } catch (error) {
      console.error('Error updating column titles:', error);
    }
  });

  socket.on('set-discussion-navigation', async ({ unviewedCardIds, viewedCardIds }) => {
    let actor = currentUser;
    if (!actor?.roomId) {
      const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
      const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
      const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
      if (roomId && userName) {
        const room = await RoomService.getRoom(roomId);
        const user = room?.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
        if (user) {
          actor = { ...user, roomId };
          currentUser = actor;
        }
      }
    }

    if (!actor?.roomId) return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room || room.phase !== 'discussion') return;
      if (!canControlDiscussionNavigation(room, actor.name, actor.role)) return;

      const normalized = normalizeDiscussionNavigation(room, {
        unviewedCardIds: Array.isArray(unviewedCardIds)
          ? unviewedCardIds.filter((id): id is string => typeof id === 'string')
          : [],
        viewedCardIds: Array.isArray(viewedCardIds)
          ? viewedCardIds.filter((id): id is string => typeof id === 'string')
          : []
      });
      if (!normalized) return;

      roomDiscussionNavigation.set(actor.roomId, normalized);
      io.to(actor.roomId).emit('discussion-navigation', normalized);
    } catch (error) {
      console.error('Error updating discussion navigation:', error);
    }
  });

  socket.on('submit-retro-rating', async ({ value }) => {
    if (!currentUser?.roomId) return;
    if (![1, 2, 3, 4, 5].includes(value)) {
      socket.emit('error', 'Invalid retro rating');
      return;
    }

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || room.phase !== 'rating') return;
      if (!getRoomFeatures(room).retroRatingEnabled) return;

      const ratingState = getRetroRatingState(currentUser.roomId);
      if (!ratingState.votes.has(currentUser.id)) {
        ratingState.votes.set(currentUser.id, value);
      }
      await emitRetroRatingStateToRoom(currentUser.roomId);
    } catch (error) {
      console.error('Error submitting retro rating:', error);
      socket.emit('error', 'Failed to submit retro rating');
    }
  });

  socket.on('show-retro-rating-results', async () => {
    if (!currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room || room.phase !== 'rating') return;
      if (!getRoomFeatures(room).retroRatingEnabled) return;

      const isAdmin = room.users.some(
        (user) => user.name === currentUser?.name && user.role === 'admin'
      );
      const ratingState = getRetroRatingState(currentUser.roomId);
      if (!isAdmin || ratingState.votes.size < room.users.length) {
        socket.emit('error', 'Results are available after all participants vote');
        return;
      }

      ratingState.resultsVisible = true;
      await emitRetroRatingStateToRoom(currentUser.roomId);
    } catch (error) {
      console.error('Error showing retro rating results:', error);
      socket.emit('error', 'Failed to show retro rating results');
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

  socket.on('send-chat-message', async ({ text }) => {
    if (!currentUser?.roomId) return;
    const room = await RoomService.getRoom(currentUser.roomId);
    if (!room || !getRoomFeatures(room).chatEnabled) return;
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

  socket.on('whiteboard-stroke', async (payload) => {
    if (!currentUser?.roomId) return;
    const room = await RoomService.getRoom(currentUser.roomId);
    if (!room || !getRoomFeatures(room).drawingEnabled) return;
    const stroke = normalizeWhiteboardStroke(payload);
    if (!stroke) return;
    const current = roomWhiteboards.get(currentUser.roomId) || [];
    const next = [...current, stroke].slice(-5000);
    roomWhiteboards.set(currentUser.roomId, next);
    io.to(currentUser.roomId).emit('whiteboard-stroke', stroke);
  });

  socket.on('clear-whiteboard', async () => {
    if (!currentUser?.roomId) return;
    const room = await RoomService.getRoom(currentUser.roomId);
    if (!room || !getRoomFeatures(room).drawingEnabled) return;
    roomWhiteboards.set(currentUser.roomId, []);
    io.to(currentUser.roomId).emit('whiteboard-cleared');
  });

  socket.on('set-room-features', async ({ features }) => {
    let actor = currentUser;
    if (!actor?.roomId) {
      const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
      const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
      const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
      if (roomId && userName) {
        const room = await RoomService.getRoom(roomId);
        const user = room?.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
        if (user) {
          actor = { ...user, roomId };
          currentUser = actor;
        }
      }
    }

    if (!actor?.roomId || !features || typeof features !== 'object') return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room) return;
      if (!canControlDiscussionNavigation(room, actor.name, actor.role)) return;

      const updatedRoom = await RoomService.updateRoomFeatures(actor.roomId, features as Partial<RoomFeatures>);
      if (!updatedRoom?.features) return;

      io.to(actor.roomId).emit('room-features-updated', { features: updatedRoom.features });
    } catch (error) {
      console.error('Error updating room features:', error);
    }
  });

  socket.on('transfer-room-admin', async ({ userId }) => {
    if (!currentUser?.roomId || typeof userId !== 'string') return;

    try {
      const updatedRoom = await RoomService.transferRoomAdmin(
        currentUser.roomId,
        currentUser.id,
        userId,
        currentUser.name
      );
      if (!updatedRoom) {
        socket.emit('error', 'Не удалось передать права администратора');
        return;
      }

      io.to(currentUser.roomId).emit('state-updated', {
        cards: updatedRoom.cards,
        phase: updatedRoom.phase,
        users: updatedRoom.users
      });
    } catch (error) {
      console.error('Error transferring room admin:', error);
      socket.emit('error', 'Не удалось передать права администратора');
    }
  });

  socket.on('kick-user', async ({ userId }) => {
    if (!currentUser?.roomId || typeof userId !== 'string' || userId === currentUser.id) return;

    try {
      const room = await RoomService.getRoom(currentUser.roomId);
      if (!room) return;

      const actor = room.users.find((user) => user.id === currentUser?.id || user.name === currentUser?.name);
      if (!actor || actor.role !== 'admin') {
        socket.emit('error', 'Только администратор может исключать участников');
        return;
      }

      const roomId = currentUser.roomId;
      const updatedRoom = await RoomService.removeUser(roomId, userId);
      if (!updatedRoom) return;

      const socketsInRoom = await io.in(roomId).fetchSockets();
      for (const roomSocket of socketsInRoom) {
        if (roomSocket.data.userId === userId) {
          roomSocket.emit('kicked');
          roomSocket.leave(roomId);
        }
      }

      io.to(roomId).emit('state-updated', {
        cards: updatedRoom.cards,
        phase: updatedRoom.phase,
        users: updatedRoom.users
      });
      await emitRetroRatingStateToRoom(roomId);
      await emitSprintVipStateToRoom(roomId);
    } catch (error) {
      console.error('Error kicking user:', error);
      socket.emit('error', 'Не удалось исключить участника');
    }
  });

  socket.on('leave-room', async () => {
    if (!currentUser?.roomId) return;

    try {
      const leavingUser = currentUser;
      currentUser = null;
      await handleUserLeavingRoom(socket, leavingUser);
      socket.emit('left-room');
    } catch (error) {
      console.error('Error handling leave-room:', error);
    }
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
      roomRetroRatings.delete(roomId);
      roomFacilitators.delete(roomId);
      roomDiscussionNavigation.delete(roomId);
      roomSprintVipVotes.delete(roomId);

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
      const leavingUser = currentUser;
      currentUser = null;
      await handleUserLeavingRoom(socket, leavingUser);
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