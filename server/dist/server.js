"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const RoomService_1 = require("./services/RoomService");
const TeamService_1 = require("./services/TeamService");
const AccountService_1 = require("./services/AccountService");
const jwt_1 = require("./config/jwt");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./config/database");
dotenv_1.default.config();
// Connect to Postgres
(0, database_1.connectDB)().catch((err) => {
    console.error('PostgreSQL connection error:', err);
    if (process.env.NODE_ENV === 'production') {
        console.error('Server will keep running, but database-backed features may fail until PostgreSQL is available.');
        return;
    }
    process.exit(1);
});
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const rooms = new Map();
const roomStates = new Map();
// Настраиваем CORS для Express с учетом Vercel
app.use((0, cors_1.default)({
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
app.use(express_1.default.json());
// Serve static files from the React app
const clientBuildPath = path_1.default.join(__dirname, '../../../client/build');
console.log('Client build path:', clientBuildPath);
app.use(express_1.default.static(clientBuildPath));
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
app.post('/api/clear-database', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield RoomService_1.RoomService.clearDatabase();
        res.json({ message: 'Database cleared successfully' });
    }
    catch (error) {
        console.error('Error clearing database:', error);
        res.status(500).json({ error: 'Failed to clear database' });
    }
}));
// Get available rooms
app.get('/api/rooms', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TeamService_1.TeamService.ensureBuiltinTeam();
        const rooms = yield RoomService_1.RoomService.getAllRooms(TeamService_1.BUILTIN_TEAM_ID);
        res.json(rooms.map(room => ({
            id: room.id,
            teamId: room.teamId,
            usersCount: room.users.length,
            phase: room.phase,
            owner: room.owner,
            createdAt: room.createdAt
        })));
    }
    catch (error) {
        console.error('Error getting rooms:', error);
        res.status(500).json({ error: 'Failed to get rooms' });
    }
}));
app.get('/api/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teams = yield TeamService_1.TeamService.getAllTeams();
        res.json(teams);
    }
    catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({ error: 'Failed to get teams' });
    }
}));
app.post('/api/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : undefined;
    const auth = (0, jwt_1.verifyAuthToken)(token);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
        return;
    }
    const { name, password, members, scrumMasterName } = req.body;
    if (!(name === null || name === void 0 ? void 0 : name.trim()) || !(password === null || password === void 0 ? void 0 : password.trim())) {
        res.status(400).json({ error: 'Team name and password are required' });
        return;
    }
    try {
        const team = yield TeamService_1.TeamService.createTeam({
            name,
            password,
            owner: auth.name,
            members: normalizeNameList(members),
            scrumMasterName
        });
        res.status(201).json(team);
    }
    catch (error) {
        console.error('Error creating team:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create team' });
    }
}));
app.post('/api/teams/:teamId/join', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : undefined;
    const auth = (0, jwt_1.verifyAuthToken)(token);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
        return;
    }
    const { password } = req.body;
    const isFixedBuiltinJoin = req.params.teamId === TeamService_1.BUILTIN_TEAM_ID && auth.type === 'fixed';
    if (!isFixedBuiltinJoin && !(password === null || password === void 0 ? void 0 : password.trim())) {
        res.status(400).json({ error: 'Team password is required' });
        return;
    }
    try {
        const team = isFixedBuiltinJoin
            ? yield TeamService_1.TeamService.joinBuiltinTeamForFixedUser(auth.name)
            : yield TeamService_1.TeamService.joinTeam(req.params.teamId, password, auth.name);
        res.json(team);
    }
    catch (error) {
        console.error('Error joining team:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to join team' });
    }
}));
app.get('/api/teams/:teamId/members', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const members = yield TeamService_1.TeamService.getTeamRosterNames(req.params.teamId);
        res.json({ members });
    }
    catch (error) {
        console.error('Error getting team members:', error);
        res.status(500).json({ error: 'Failed to get team members' });
    }
}));
app.get('/api/teams/:teamId/rooms', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const team = yield TeamService_1.TeamService.getTeam(req.params.teamId);
        if (!team) {
            res.status(404).json({ error: 'Team not found' });
            return;
        }
        const rooms = yield RoomService_1.RoomService.getAllRooms(req.params.teamId);
        res.json(rooms.map(room => ({
            id: room.id,
            teamId: room.teamId,
            usersCount: room.users.length,
            phase: room.phase,
            owner: room.owner,
            createdAt: room.createdAt
        })));
    }
    catch (error) {
        console.error('Error getting team rooms:', error);
        res.status(500).json({ error: 'Failed to get team rooms' });
    }
}));
app.delete('/api/rooms/:roomId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomId = req.params.roomId;
    const authHeader = req.headers.authorization;
    const token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : undefined;
    const auth = (0, jwt_1.verifyAuthToken)(token);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
        return;
    }
    try {
        const room = yield RoomService_1.RoomService.getRoom(roomId);
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }
        if (room.owner !== auth.name) {
            res.status(403).json({ error: 'Only room creator can delete the room' });
            return;
        }
        yield RoomService_1.RoomService.deleteRoom(roomId);
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
    }
    catch (error) {
        console.error('Error deleting room via API:', error);
        res.status(500).json({ error: 'Failed to delete room' });
    }
}));
app.get('/api/auth/fixed-users', (req, res) => {
    res.json({ users: AccountService_1.AccountService.getFixedUsers() });
});
const buildAuthResponse = (profile) => {
    const { token, expiresAt } = (0, jwt_1.signAuthToken)(profile.name, profile.type);
    return {
        profile: Object.assign(Object.assign({}, profile), { token,
            expiresAt })
    };
};
app.post('/api/auth/fixed-login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, password } = req.body;
    if (!name || !password) {
        res.status(400).json({ error: 'Name and password are required' });
        return;
    }
    try {
        const result = yield AccountService_1.AccountService.fixedLogin(name, password);
        res.json(Object.assign(Object.assign({}, buildAuthResponse(result.profile)), { isFirstLogin: result.isFirstLogin }));
    }
    catch (error) {
        console.error('Fixed login error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login' });
    }
}));
app.post('/api/auth/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, password } = req.body;
    if (!name || !password) {
        res.status(400).json({ error: 'Name and password are required' });
        return;
    }
    try {
        const profile = yield AccountService_1.AccountService.login(name, password);
        res.json(buildAuthResponse(profile));
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login' });
    }
}));
app.post('/api/auth/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, password } = req.body;
    if (!name || !password) {
        res.status(400).json({ error: 'Name and password are required' });
        return;
    }
    try {
        const profile = yield AccountService_1.AccountService.register(name, password);
        res.json(buildAuthResponse(profile));
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to register' });
    }
}));
app.post('/api/auth/guest', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    try {
        const profile = AccountService_1.AccountService.guestLogin(name);
        res.json(buildAuthResponse(profile));
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login as guest' });
    }
});
// Настраиваем Socket.IO с учетом Vercel
const io = new socket_io_1.Server(httpServer, {
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
const getSortedCards = (cards) => {
    return [...cards].sort((a, b) => { var _a, _b, _c, _d; return ((((_a = b.likes) === null || _a === void 0 ? void 0 : _a.length) || 0) - (((_b = b.dislikes) === null || _b === void 0 ? void 0 : _b.length) || 0)) - ((((_c = a.likes) === null || _c === void 0 ? void 0 : _c.length) || 0) - (((_d = a.dislikes) === null || _d === void 0 ? void 0 : _d.length) || 0)); });
};
const buildDiscussionNavigation = (cards) => ({
    unviewedCardIds: getSortedCards(cards).map((card) => card.id),
    viewedCardIds: []
});
const ensureDiscussionNavigation = (roomId, room) => {
    if (room.phase !== 'discussion')
        return null;
    const existing = roomDiscussionNavigation.get(roomId);
    if (existing)
        return existing;
    const initial = buildDiscussionNavigation(room.cards);
    roomDiscussionNavigation.set(roomId, initial);
    return initial;
};
const emitDiscussionNavigationToSocket = (socket, roomId, room) => {
    const state = room ? ensureDiscussionNavigation(roomId, room) : roomDiscussionNavigation.get(roomId);
    if (state) {
        socket.emit('discussion-navigation', state);
    }
};
const canControlDiscussionNavigation = (room, userName, userRole) => {
    if (userRole === 'admin' || room.owner === userName) {
        return true;
    }
    const facilitator = roomFacilitators.get(room.id);
    return (facilitator === null || facilitator === void 0 ? void 0 : facilitator.userName) === userName;
};
const normalizeDiscussionNavigation = (room, state) => {
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
const getCardTypeByColumn = (column) => {
    if (column === 1)
        return 'disliked';
    if (column === 2)
        return 'suggestion';
    return 'liked';
};
const normalizeImageUrl = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    if (/^https?:\/\//i.test(trimmed))
        return trimmed;
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed))
        return trimmed;
    return undefined;
};
const normalizeMood = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const allowed = ['great', 'good', 'neutral', 'bad', 'awful'];
    return allowed.includes(value) ? value : undefined;
};
const normalizeNameList = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((name) => typeof name === 'string')
        .map((name) => name.trim())
        .filter(Boolean);
};
// Connection monitoring
let connectionCount = 0;
const roomTimers = new Map();
const roomChats = new Map();
const roomWhiteboards = new Map();
const roomRetroRatings = new Map();
const roomFacilitators = new Map();
const roomDiscussionNavigation = new Map();
const roomSprintVipVotes = new Map();
const getRemainingSeconds = (endAt) => {
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
};
const emitTimerResetToRoom = (roomId) => {
    io.to(roomId).emit('timer-updated', {
        durationSeconds: 0,
        remainingSeconds: 0,
        running: false
    });
};
const emitTimerToRoom = (roomId, session) => {
    io.to(roomId).emit('timer-updated', {
        phase: session.phase,
        durationSeconds: session.durationSeconds,
        remainingSeconds: getRemainingSeconds(session.endAt),
        running: true
    });
};
const emitTimerToSocket = (socket, roomId) => {
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
const clearRoomTimer = (roomId, emitReset = true) => {
    const session = roomTimers.get(roomId);
    if (session) {
        clearInterval(session.interval);
        roomTimers.delete(roomId);
    }
    if (emitReset) {
        emitTimerResetToRoom(roomId);
    }
};
const appendChatMessage = (roomId, message) => {
    const history = roomChats.get(roomId) || [];
    const next = [...history, message].slice(-200);
    roomChats.set(roomId, next);
    return next;
};
const normalizeWhiteboardStroke = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const raw = value;
    if (typeof raw.id !== 'string' ||
        typeof raw.userId !== 'string' ||
        typeof raw.color !== 'string' ||
        typeof raw.width !== 'number' ||
        (raw.tool !== 'pen' && raw.tool !== 'eraser') ||
        !Array.isArray(raw.points)) {
        return null;
    }
    const points = raw.points
        .filter((point) => !!point && typeof point.x === 'number' && typeof point.y === 'number')
        .slice(0, 1000);
    if (points.length < 2)
        return null;
    return {
        id: raw.id.slice(0, 100),
        userId: raw.userId.slice(0, 100),
        color: raw.color.slice(0, 30),
        width: Math.max(1, Math.min(40, raw.width)),
        tool: raw.tool,
        points
    };
};
const getRetroRatingState = (roomId) => {
    const existing = roomRetroRatings.get(roomId);
    if (existing)
        return existing;
    const created = { votes: new Map(), resultsVisible: false };
    roomRetroRatings.set(roomId, created);
    return created;
};
const buildRetroRatingPayload = (room, userId) => {
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
const emitRetroRatingStateToRoom = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const room = yield RoomService_1.RoomService.getRoom(roomId);
    if (!room)
        return;
    const sockets = yield io.in(roomId).fetchSockets();
    sockets.forEach((connectedSocket) => {
        const userId = typeof connectedSocket.data.userId === 'string' ? connectedSocket.data.userId : connectedSocket.id;
        connectedSocket.emit('retro-rating-state', buildRetroRatingPayload(room, userId));
    });
});
const emitRetroRatingStateToSocket = (socket, room) => {
    const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
    socket.emit('retro-rating-state', buildRetroRatingPayload(room, userId));
};
const selectRandomFacilitator = (room) => {
    if (room.users.length === 0)
        return null;
    const selectedUser = room.users[Math.floor(Math.random() * room.users.length)];
    return {
        userId: selectedUser.id,
        userName: selectedUser.name,
        selectedAt: Date.now()
    };
};
const buildSprintVipState = (room) => {
    const votes = roomSprintVipVotes.get(room.id);
    if (!votes)
        return { voteCount: 0 };
    const activeNames = new Set(room.users.map((user) => user.name));
    const counts = new Map();
    votes.forEach((votedUserName) => {
        if (!activeNames.has(votedUserName))
            return;
        counts.set(votedUserName, (counts.get(votedUserName) || 0) + 1);
    });
    let vipUserName;
    let voteCount = 0;
    counts.forEach((count, userName) => {
        if (count > voteCount) {
            vipUserName = userName;
            voteCount = count;
        }
    });
    return { vipUserName, voteCount };
};
const buildPersonalSprintVipState = (room, userName) => {
    const votes = roomSprintVipVotes.get(room.id);
    const myVote = userName && votes ? votes.get(userName) : undefined;
    return Object.assign(Object.assign({}, buildSprintVipState(room)), { myVote });
};
const resolveRoomUserForSocket = (room, connectedSocket) => {
    const trackedUserName = typeof connectedSocket.data.userName === 'string' ? connectedSocket.data.userName : undefined;
    if (trackedUserName) {
        const byName = room.users.find((roomUser) => roomUser.name === trackedUserName);
        if (byName)
            return byName;
    }
    const trackedUserId = typeof connectedSocket.data.userId === 'string' ? connectedSocket.data.userId : connectedSocket.id;
    return room.users.find((roomUser) => roomUser.id === trackedUserId || roomUser.id === connectedSocket.id);
};
const resolveVoterNameForSocket = (room, connectedSocket) => {
    var _a;
    if (typeof connectedSocket.data.userName === 'string') {
        return connectedSocket.data.userName;
    }
    return (_a = resolveRoomUserForSocket(room, connectedSocket)) === null || _a === void 0 ? void 0 : _a.name;
};
const emitSprintVipStateToRoom = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const room = yield RoomService_1.RoomService.getRoom(roomId);
    if (!room)
        return;
    const votes = roomSprintVipVotes.get(roomId);
    const sockets = yield io.in(roomId).fetchSockets();
    const base = buildSprintVipState(room);
    for (const remoteSocket of sockets) {
        const voterName = resolveVoterNameForSocket(room, remoteSocket);
        const myVote = voterName && votes ? votes.get(voterName) : undefined;
        remoteSocket.emit('sprint-vip-state', Object.assign(Object.assign({}, base), { myVote }));
    }
});
const emitSprintVipStateToSocket = (socket, room) => {
    const voterName = resolveVoterNameForSocket(room, socket);
    socket.emit('sprint-vip-state', buildPersonalSprintVipState(room, voterName));
};
io.on('connection', (socket) => {
    connectionCount++;
    console.log(`Client connected (${connectionCount} total):`, socket.id);
    console.log('Connection details:', {
        transport: socket.conn.transport.name,
        remoteAddress: socket.handshake.address,
        timestamp: new Date().toISOString()
    });
    let currentUser = null;
    socket.on('restore-session', ({ roomId, userId, token }) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('Attempting to restore session:', { roomId, userId });
        const auth = (0, jwt_1.verifyAuthToken)(token);
        if (!auth) {
            socket.emit('session-expired');
            return;
        }
        try {
            const { room, user } = yield RoomService_1.RoomService.restoreSession(roomId, userId, socket.id);
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
            socket.data.userId = user.id;
            socket.data.userName = user.name;
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
            emitRetroRatingStateToSocket(socket, room);
            emitSprintVipStateToSocket(socket, room);
            emitDiscussionNavigationToSocket(socket, roomId, room);
        }
        catch (error) {
            console.error('Error restoring session:', error);
            socket.emit('session-expired');
        }
    }));
    socket.on('create-room', ({ roomId, password, username, token, teamId }) => __awaiter(void 0, void 0, void 0, function* () {
        const auth = (0, jwt_1.verifyAuthToken)(token);
        if (!auth) {
            socket.emit('error', 'Unauthorized: token is invalid or expired');
            return;
        }
        if (username && auth.name !== username) {
            socket.emit('error', 'Unauthorized: token does not match user');
            return;
        }
        const effectiveUsername = auth.name;
        const normalizedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : TeamService_1.BUILTIN_TEAM_ID;
        console.log('Attempting to create room:', {
            roomId,
            username: effectiveUsername,
            teamId: normalizedTeamId
        });
        try {
            const teamRole = yield TeamService_1.TeamService.getUserRole(normalizedTeamId, effectiveUsername);
            if (!teamRole) {
                socket.emit('error', 'Join the team before creating a room');
                return;
            }
            const existingRoom = yield RoomService_1.RoomService.getRoom(roomId);
            if (existingRoom) {
                console.log('Room already exists:', roomId);
                socket.emit('error', 'Room already exists');
                return;
            }
            const room = yield RoomService_1.RoomService.createRoom(roomId, password, socket.id, effectiveUsername, {
                teamId: normalizedTeamId,
                userRole: teamRole
            });
            socket.join(roomId);
            socket.data.userId = socket.id;
            socket.data.userName = effectiveUsername;
            currentUser = room.users.find((user) => user.id === socket.id) || {
                id: socket.id,
                name: effectiveUsername,
                roomId,
                role: 'user'
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
            emitRetroRatingStateToSocket(socket, room);
            emitSprintVipStateToSocket(socket, room);
        }
        catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error', 'Failed to create room');
        }
    }));
    socket.on('join-room', ({ roomId, password, username, token }) => __awaiter(void 0, void 0, void 0, function* () {
        const auth = (0, jwt_1.verifyAuthToken)(token);
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
            const isValid = yield RoomService_1.RoomService.validatePassword(roomId, password);
            if (!isValid) {
                console.log('Invalid password for room:', roomId);
                socket.emit('error', 'Invalid password');
                return;
            }
            const existingRoom = yield RoomService_1.RoomService.getRoom(roomId);
            if (!existingRoom) {
                socket.emit('error', 'Room not found');
                return;
            }
            const teamRole = existingRoom.teamId
                ? yield TeamService_1.TeamService.getUserRole(existingRoom.teamId, effectiveUsername)
                : null;
            if (existingRoom.teamId && !teamRole) {
                socket.emit('error', 'Join the team before joining a room');
                return;
            }
            // Check for existing user first
            const existingUser = yield RoomService_1.RoomService.findExistingUser(roomId, effectiveUsername);
            const user = {
                id: socket.id,
                name: effectiveUsername,
                roomId,
                role: teamRole || 'user'
            };
            // If user exists, we'll reuse their original ID for card ownership
            if (existingUser) {
                console.log('User rejoining room:', { roomId, username: effectiveUsername });
                user.id = existingUser.id;
            }
            const room = yield RoomService_1.RoomService.addUser(roomId, user);
            if (!room) {
                socket.emit('error', 'Room not found');
                return;
            }
            const joinedUser = room.users.find((roomUser) => roomUser.name === effectiveUsername);
            socket.join(roomId);
            currentUser = joinedUser
                ? Object.assign(Object.assign({}, joinedUser), { roomId }) : user;
            socket.data.userId = currentUser.id;
            socket.data.userName = effectiveUsername;
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
            }
            else {
                socket.to(roomId).emit('state-updated', {
                    cards: room.cards,
                    phase: room.phase,
                    users: room.users
                });
            }
            yield emitRetroRatingStateToRoom(roomId);
            yield emitSprintVipStateToRoom(roomId);
        }
        catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', 'Failed to join room');
        }
    }));
    socket.on('add-card', ({ text, type, column, imageUrl }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!currentUser)
            return;
        try {
            console.log('Received add-card event:', { text, type, column, imageUrl, userId: currentUser.id });
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || room.phase !== 'creation')
                return;
            const safeImageUrl = normalizeImageUrl(imageUrl);
            const card = {
                id: Date.now().toString(),
                text,
                type,
                createdBy: currentUser.name,
                likes: [],
                dislikes: [],
                column,
                imageUrl: safeImageUrl
            };
            const updatedRoom = yield RoomService_1.RoomService.addCard(currentUser.roomId, card);
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
        }
        catch (error) {
            console.error('Error adding card:', error);
            socket.emit('error', 'Failed to add card');
        }
    }));
    socket.on('update-card', ({ cardId, text, imageUrl }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!currentUser)
            return;
        const currentUserName = currentUser.name;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || (room.phase !== 'creation' && room.phase !== 'discussion'))
                return;
            const card = room.cards.find(c => c.id === cardId);
            if (!card)
                return;
            const isAdmin = room.users.some((user) => user.name === currentUserName && user.role === 'admin');
            if (!isAdmin && card.createdBy !== currentUserName)
                return;
            const updates = {};
            if (typeof text === 'string') {
                updates.text = text;
            }
            if (typeof imageUrl !== 'undefined') {
                updates.imageUrl = normalizeImageUrl(imageUrl);
            }
            if (Object.keys(updates).length === 0)
                return;
            const updatedRoom = yield RoomService_1.RoomService.updateCard(currentUser.roomId, cardId, updates);
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
        }
        catch (error) {
            console.error('Error updating card:', error);
            socket.emit('error', 'Failed to update card');
        }
    }));
    socket.on('delete-card', ({ cardId }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!currentUser)
            return;
        const currentUserName = currentUser.name;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || (room.phase !== 'creation' && room.phase !== 'discussion'))
                return;
            const card = room.cards.find(c => c.id === cardId);
            if (!card)
                return;
            const isAdmin = room.users.some((user) => user.name === currentUserName && user.role === 'admin');
            if (!isAdmin && card.createdBy !== currentUserName)
                return;
            const updatedRoom = yield RoomService_1.RoomService.deleteCard(currentUser.roomId, cardId);
            if (updatedRoom) {
                io.to(currentUser.roomId).emit('card-deleted', cardId);
                io.to(currentUser.roomId).emit('state-updated', {
                    cards: updatedRoom.cards,
                    phase: updatedRoom.phase,
                    users: updatedRoom.users
                });
            }
        }
        catch (error) {
            console.error('Error deleting card:', error);
            socket.emit('error', 'Failed to delete card');
        }
    }));
    socket.on('move-card', ({ cardId, column }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!currentUser)
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || room.phase !== 'creation')
                return;
            const card = room.cards.find((currentCard) => currentCard.id === cardId);
            if (!card)
                return;
            const nextType = getCardTypeByColumn(column);
            const updatedRoom = yield RoomService_1.RoomService.updateCard(currentUser.roomId, cardId, { column, type: nextType });
            if (!updatedRoom)
                return;
            io.to(currentUser.roomId).emit('card-moved', { cardId, column });
            io.to(currentUser.roomId).emit('state-updated', {
                cards: updatedRoom.cards,
                phase: updatedRoom.phase,
                users: updatedRoom.users
            });
        }
        catch (error) {
            console.error('Error moving card:', error);
            socket.emit('error', 'Failed to move card');
        }
    }));
    socket.on('vote-card', ({ cardId, voteType }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!currentUser)
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || room.phase !== 'voting')
                return;
            const card = room.cards.find(c => c.id === cardId);
            if (!card)
                return;
            const updatedRoom = yield RoomService_1.RoomService.updateCardVotes(currentUser.roomId, cardId, currentUser.id, voteType);
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
        }
        catch (error) {
            console.error('Error voting for card:', error);
            const message = error instanceof Error ? error.message : 'Failed to vote for card';
            if (error instanceof Error && message.includes('не более 3')) {
                socket.emit('vote-error', { cardId, message });
                return;
            }
            socket.emit('error', message);
        }
    }));
    socket.on('update-ready-state', ({ isReady }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        console.log('Received ready state update:', {
            userId: currentUser.id,
            userName: currentUser.name,
            isReady
        });
        try {
            const room = yield RoomService_1.RoomService.updateUserReadyState(currentUser.roomId, currentUser.id, isReady);
            if (room) {
                io.to(currentUser.roomId).emit('state-updated', {
                    cards: room.cards,
                    phase: room.phase,
                    users: room.users
                });
            }
        }
        catch (error) {
            console.error('Error updating ready state:', error);
        }
    }));
    socket.on('vote-sprint-vip', ({ userName }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room)
                return;
            const targetName = typeof userName === 'string' ? userName.trim() : '';
            const votes = roomSprintVipVotes.get(currentUser.roomId) || new Map();
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
            }
            else {
                votes.set(currentUser.name, targetName);
            }
            roomSprintVipVotes.set(currentUser.roomId, votes);
            yield emitSprintVipStateToRoom(currentUser.roomId);
        }
        catch (error) {
            console.error('Error voting sprint VIP:', error);
            socket.emit('error', 'Не удалось проголосовать за VIP спринта');
        }
    }));
    socket.on('set-user-mood', ({ mood }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        const safeMood = normalizeMood(mood);
        if (!safeMood) {
            socket.emit('error', 'Invalid mood');
            return;
        }
        try {
            const room = yield RoomService_1.RoomService.updateUserMood(currentUser.roomId, currentUser.id, safeMood);
            if (!room)
                return;
            currentUser = Object.assign(Object.assign({}, currentUser), { mood: safeMood });
            io.to(currentUser.roomId).emit('state-updated', {
                cards: room.cards,
                phase: room.phase,
                users: room.users
            });
        }
        catch (error) {
            console.error('Error updating user mood:', error);
            socket.emit('error', 'Failed to update user mood');
        }
    }));
    socket.on('change-phase', ({ phase }) => __awaiter(void 0, void 0, void 0, function* () {
        const allowedPhases = ['creation', 'voting', 'discussion', 'rating'];
        if (!allowedPhases.includes(phase)) {
            socket.emit('error', 'Invalid phase');
            return;
        }
        let actor = currentUser;
        if (!(actor === null || actor === void 0 ? void 0 : actor.roomId)) {
            const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
            const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
            const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
            if (roomId && userName) {
                const room = yield RoomService_1.RoomService.getRoom(roomId);
                const user = room === null || room === void 0 ? void 0 : room.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
                if (user) {
                    actor = Object.assign(Object.assign({}, user), { roomId });
                    currentUser = actor;
                }
            }
        }
        if (!(actor === null || actor === void 0 ? void 0 : actor.roomId)) {
            socket.emit('error', 'Не удалось сменить этап: сессия не восстановлена');
            return;
        }
        console.log('Phase change requested:', {
            userId: actor.id,
            userName: actor.name,
            phase
        });
        try {
            const previousRoom = yield RoomService_1.RoomService.getRoom(actor.roomId);
            const updatedRoom = yield RoomService_1.RoomService.updatePhase(actor.roomId, phase, actor.id, actor.name);
            if (!updatedRoom) {
                socket.emit('error', 'Failed to change phase');
                return;
            }
            let sortedCards = updatedRoom.cards;
            if (phase === 'discussion') {
                console.log('Sorting cards for discussion phase');
                sortedCards = getSortedCards(updatedRoom.cards);
            }
            const roomWithResetStates = yield RoomService_1.RoomService.resetUsersReadyState(actor.roomId);
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
            }
            else {
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
            if ((previousRoom === null || previousRoom === void 0 ? void 0 : previousRoom.phase) === 'creation' && roomState.phase !== 'creation') {
                const facilitator = selectRandomFacilitator(roomState);
                if (facilitator) {
                    roomFacilitators.set(actor.roomId, facilitator);
                    io.to(actor.roomId).emit('facilitator-selected', facilitator);
                }
            }
            yield emitRetroRatingStateToRoom(actor.roomId);
        }
        catch (error) {
            console.error('Error changing phase:', error);
            socket.emit('error', 'Failed to change phase');
        }
    }));
    socket.on('set-column-titles', ({ titles }) => __awaiter(void 0, void 0, void 0, function* () {
        let actor = currentUser;
        if (!(actor === null || actor === void 0 ? void 0 : actor.roomId)) {
            const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
            const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
            const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
            if (roomId && userName) {
                const room = yield RoomService_1.RoomService.getRoom(roomId);
                const user = room === null || room === void 0 ? void 0 : room.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
                if (user) {
                    actor = Object.assign(Object.assign({}, user), { roomId });
                    currentUser = actor;
                }
            }
        }
        if (!(actor === null || actor === void 0 ? void 0 : actor.roomId))
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(actor.roomId);
            if (!room)
                return;
            if (!canControlDiscussionNavigation(room, actor.name, actor.role))
                return;
            if (!Array.isArray(titles))
                return;
            const updatedRoom = yield RoomService_1.RoomService.updateColumnTitles(actor.roomId, titles);
            if (!(updatedRoom === null || updatedRoom === void 0 ? void 0 : updatedRoom.columnTitles))
                return;
            io.to(actor.roomId).emit('column-titles-updated', { titles: updatedRoom.columnTitles });
        }
        catch (error) {
            console.error('Error updating column titles:', error);
        }
    }));
    socket.on('set-discussion-navigation', ({ unviewedCardIds, viewedCardIds }) => __awaiter(void 0, void 0, void 0, function* () {
        let actor = currentUser;
        if (!(actor === null || actor === void 0 ? void 0 : actor.roomId)) {
            const roomId = [...socket.rooms].find((roomName) => roomName !== socket.id);
            const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
            const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
            if (roomId && userName) {
                const room = yield RoomService_1.RoomService.getRoom(roomId);
                const user = room === null || room === void 0 ? void 0 : room.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
                if (user) {
                    actor = Object.assign(Object.assign({}, user), { roomId });
                    currentUser = actor;
                }
            }
        }
        if (!(actor === null || actor === void 0 ? void 0 : actor.roomId))
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(actor.roomId);
            if (!room || room.phase !== 'discussion')
                return;
            if (!canControlDiscussionNavigation(room, actor.name, actor.role))
                return;
            const normalized = normalizeDiscussionNavigation(room, {
                unviewedCardIds: Array.isArray(unviewedCardIds)
                    ? unviewedCardIds.filter((id) => typeof id === 'string')
                    : [],
                viewedCardIds: Array.isArray(viewedCardIds)
                    ? viewedCardIds.filter((id) => typeof id === 'string')
                    : []
            });
            if (!normalized)
                return;
            roomDiscussionNavigation.set(actor.roomId, normalized);
            io.to(actor.roomId).emit('discussion-navigation', normalized);
        }
        catch (error) {
            console.error('Error updating discussion navigation:', error);
        }
    }));
    socket.on('submit-retro-rating', ({ value }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        if (![1, 2, 3, 4, 5].includes(value)) {
            socket.emit('error', 'Invalid retro rating');
            return;
        }
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || room.phase !== 'rating')
                return;
            const ratingState = getRetroRatingState(currentUser.roomId);
            if (!ratingState.votes.has(currentUser.id)) {
                ratingState.votes.set(currentUser.id, value);
            }
            yield emitRetroRatingStateToRoom(currentUser.roomId);
        }
        catch (error) {
            console.error('Error submitting retro rating:', error);
            socket.emit('error', 'Failed to submit retro rating');
        }
    }));
    socket.on('show-retro-rating-results', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room || room.phase !== 'rating')
                return;
            const isAdmin = room.users.some((user) => user.name === (currentUser === null || currentUser === void 0 ? void 0 : currentUser.name) && user.role === 'admin');
            const ratingState = getRetroRatingState(currentUser.roomId);
            if (!isAdmin || ratingState.votes.size < room.users.length) {
                socket.emit('error', 'Results are available after all participants vote');
                return;
            }
            ratingState.resultsVisible = true;
            yield emitRetroRatingStateToRoom(currentUser.roomId);
        }
        catch (error) {
            console.error('Error showing retro rating results:', error);
            socket.emit('error', 'Failed to show retro rating results');
        }
    }));
    socket.on('set-phase-timer', ({ durationSeconds }) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        const allowedDurations = [60, 180, 300, 600, 900];
        if (!allowedDurations.includes(durationSeconds)) {
            socket.emit('error', 'Invalid timer duration');
            return;
        }
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room)
                return;
            const isAdmin = room.users.some((user) => user.name === (currentUser === null || currentUser === void 0 ? void 0 : currentUser.name) && user.role === 'admin');
            if (!isAdmin) {
                socket.emit('error', 'Only admin can start timer');
                return;
            }
            clearRoomTimer(currentUser.roomId, false);
            const endAt = Date.now() + durationSeconds * 1000;
            const session = {
                phase: room.phase,
                durationSeconds,
                endAt,
                interval: setInterval(() => {
                    const activeSession = roomTimers.get(room.id);
                    if (!activeSession)
                        return;
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
        }
        catch (error) {
            console.error('Error setting phase timer:', error);
            socket.emit('error', 'Failed to start timer');
        }
    }));
    socket.on('reset-phase-timer', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room)
                return;
            const isAdmin = room.users.some((user) => user.name === (currentUser === null || currentUser === void 0 ? void 0 : currentUser.name) && user.role === 'admin');
            if (!isAdmin) {
                socket.emit('error', 'Only admin can reset timer');
                return;
            }
            clearRoomTimer(currentUser.roomId, true);
        }
        catch (error) {
            console.error('Error resetting phase timer:', error);
            socket.emit('error', 'Failed to reset timer');
        }
    }));
    socket.on('send-chat-message', ({ text }) => {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        const normalized = typeof text === 'string' ? text.trim() : '';
        if (!normalized)
            return;
        const message = {
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
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        const stroke = normalizeWhiteboardStroke(payload);
        if (!stroke)
            return;
        const current = roomWhiteboards.get(currentUser.roomId) || [];
        const next = [...current, stroke].slice(-5000);
        roomWhiteboards.set(currentUser.roomId, next);
        io.to(currentUser.roomId).emit('whiteboard-stroke', stroke);
    });
    socket.on('clear-whiteboard', () => {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId))
            return;
        roomWhiteboards.set(currentUser.roomId, []);
        io.to(currentUser.roomId).emit('whiteboard-cleared');
    });
    socket.on('delete-room', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.roomId)) {
            socket.emit('error', 'Room not found');
            return;
        }
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
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
            yield RoomService_1.RoomService.deleteRoom(roomId);
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
        }
        catch (error) {
            console.error('Error deleting room:', error);
            socket.emit('error', 'Failed to delete room');
        }
    }));
    socket.on('disconnect', (reason) => __awaiter(void 0, void 0, void 0, function* () {
        connectionCount--;
        console.log(`Client disconnected (${connectionCount} total):`, socket.id);
        console.log('Disconnect reason:', reason);
        if (!currentUser)
            return;
        try {
            const room = yield RoomService_1.RoomService.getRoom(currentUser.roomId);
            if (!room)
                return;
            const updatedRoom = yield RoomService_1.RoomService.removeUser(currentUser.roomId, currentUser.id);
            if (!updatedRoom)
                return;
            getRetroRatingState(currentUser.roomId).votes.delete(currentUser.id);
            const vipVotes = roomSprintVipVotes.get(currentUser.roomId);
            if (vipVotes) {
                vipVotes.delete(currentUser.name);
                vipVotes.forEach((votedUserName, voterName) => {
                    if (votedUserName === (currentUser === null || currentUser === void 0 ? void 0 : currentUser.name)) {
                        vipVotes.delete(voterName);
                    }
                });
            }
            if (updatedRoom.users.length === 0) {
                // If the room is empty, we might want to keep it for some time before deletion
                // For now, we'll keep the room in the database
                roomSprintVipVotes.delete(currentUser.roomId);
                console.log('Room is empty:', currentUser.roomId);
            }
            else {
                socket.to(currentUser.roomId).emit('user-left', currentUser);
                socket.to(currentUser.roomId).emit('state-updated', {
                    cards: updatedRoom.cards,
                    phase: updatedRoom.phase,
                    users: updatedRoom.users
                });
                yield emitRetroRatingStateToRoom(currentUser.roomId);
                yield emitSprintVipStateToRoom(currentUser.roomId);
            }
        }
        catch (error) {
            console.error('Error handling disconnect:', error);
        }
    }));
    socket.on('error', (error) => {
        console.error('Socket error for client:', socket.id, error);
    });
});
// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    console.log('Serving index.html for path:', req.path);
    res.sendFile(path_1.default.join(clientBuildPath, 'index.html'));
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
