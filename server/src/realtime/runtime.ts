import '../config/env';
import crypto from 'crypto';
import { Server, Socket } from 'socket.io';
import {
  Room,
  User,
  Card,
  Mood,
  Phase,
  RetroTemplate,
  ChatMessage,
  DiscussionNavigationState,
  FacilitatorAnnouncement,
  SprintVipState,
  WhiteboardPoint,
  WhiteboardStroke
} from '../types';
import { normalizeRoomFeatures } from '../utils/roomFeatures';
import { RoomCache } from '../services/RoomCache';
import { RoomService } from '../services/RoomService';
import { readRoomRuntime, StoredRoomRuntime, writeRoomRuntime } from '../services/RoomRuntimeStore';
import { logger } from '../utils/logger';
import { clearRoomVersion } from './roomSync';

export let io: Server = undefined as unknown as Server;
export const bindIo = (server: Server): void => {
  io = server;
};

const MAX_ROOM_PASSWORD_FAILURES = 5;
const ROOM_PASSWORD_LOCK_MS = 60_000;

type RoomPasswordAttempt = {
  failures: number;
  lockedUntil: number;
};

const roomPasswordAttempts = new Map<string, RoomPasswordAttempt>();

export const roomPasswordRetryAfterMs = (socketId: string): number => {
  const attempt = roomPasswordAttempts.get(socketId);
  if (!attempt) return 0;
  return Math.max(0, attempt.lockedUntil - Date.now());
};

export const registerInvalidRoomPassword = (socketId: string): number => {
  const now = Date.now();
  const attempt = roomPasswordAttempts.get(socketId) ?? { failures: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > now) {
    return attempt.lockedUntil - now;
  }
  attempt.failures += 1;
  if (attempt.failures >= MAX_ROOM_PASSWORD_FAILURES) {
    attempt.failures = 0;
    attempt.lockedUntil = now + ROOM_PASSWORD_LOCK_MS;
  }
  roomPasswordAttempts.set(socketId, attempt);
  return Math.max(0, attempt.lockedUntil - now);
};

export const clearRoomPasswordAttempts = (socketId: string): void => {
  roomPasswordAttempts.delete(socketId);
};

// Helper function to get sorted cards by votes
export const getSortedCards = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => ((b.likes?.length || 0) + (b.dislikes?.length || 0)) - ((a.likes?.length || 0) + (a.dislikes?.length || 0)));
};

export const buildDiscussionNavigation = (cards: Card[]): DiscussionNavigationState => ({
  unviewedCardIds: getSortedCards(cards).map((card) => card.id),
  viewedCardIds: []
});

export const ensureDiscussionNavigation = (roomId: string, room: Room): DiscussionNavigationState | null => {
  if (room.phase !== 'discussion') return null;
  const existing = roomDiscussionNavigation.get(roomId);
  if (existing) return existing;

  const initial = buildDiscussionNavigation(room.cards);
  roomDiscussionNavigation.set(roomId, initial);
  return initial;
};

export const discussionHandsPayload = (roomId: string) => ({
  hands: Array.from(roomRaisedHands.get(roomId)?.keys() ?? []).map((userName) => ({ userName }))
});

export const emitDiscussionHands = (roomId: string): void => {
  io.to(roomId).emit('discussion-hands', discussionHandsPayload(roomId));
};

export const emitDiscussionHandsToSocket = (socket: Socket, roomId: string): void => {
  socket.emit('discussion-hands', discussionHandsPayload(roomId));
};

export const clearRaisedHand = (roomId: string, userName: string): boolean => {
  const hands = roomRaisedHands.get(roomId);
  if (!hands?.delete(userName)) return false;
  if (hands.size === 0) roomRaisedHands.delete(roomId);
  return true;
};

export const allowDiscussionBurst = (roomId: string, userName: string): boolean => {
  const now = Date.now();
  let byUser = discussionBurstTimestamps.get(roomId);
  if (!byUser) {
    byUser = new Map();
    discussionBurstTimestamps.set(roomId, byUser);
  }
  const recent = (byUser.get(userName) || []).filter((timestamp) => now - timestamp < 1000);
  if (recent.length >= 4) {
    byUser.set(userName, recent);
    return false;
  }
  recent.push(now);
  byUser.set(userName, recent);
  return true;
};

export const emitDiscussionBurst = (roomId: string, emoji: string, userName: string): void => {
  io.to(roomId).emit('discussion-burst', {
    id: crypto.randomUUID(),
    emoji,
    userName
  });
};

export const emitDiscussionNavigationToSocket = (socket: Socket, roomId: string, room?: Room): void => {
  const state = room ? ensureDiscussionNavigation(roomId, room) : roomDiscussionNavigation.get(roomId);
  if (state) {
    socket.emit('discussion-navigation', state);
  }
};

export const refreshFacilitatorSocketId = (
  roomId: string,
  userName: string,
  socketId: string
): FacilitatorAnnouncement | null => {
  const facilitator = roomFacilitators.get(roomId);
  if (!facilitator || facilitator.userName !== userName) return facilitator ?? null;
  if (facilitator.userId === socketId) return facilitator;

  const updated: FacilitatorAnnouncement = {
    ...facilitator,
    userId: socketId
  };
  rememberRoomFacilitator(roomId, updated);
  return updated;
};

export const rememberRoomFacilitator = (roomId: string, facilitator: FacilitatorAnnouncement): void => {
  roomFacilitators.set(roomId, facilitator);
  roomLastFacilitators.set(roomId, facilitator);
};

export const emitFacilitatorToSocket = (socket: Socket, roomId: string, room?: Room): void => {
  const inDiscussion = !room || room.phase === 'discussion';
  const facilitatorEnabled = !room || getRoomFeatures(room).facilitatorEnabled;
  if (inDiscussion && !facilitatorEnabled) return;

  const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
  const facilitator = inDiscussion
    ? (userName ? refreshFacilitatorSocketId(roomId, userName, socket.id) : roomFacilitators.get(roomId))
    : (roomLastFacilitators.get(roomId) ?? roomFacilitators.get(roomId));
  if (facilitator) {
    socket.emit('facilitator-selected', facilitator);
  }
};

export const canControlDiscussionNavigation = (
  room: Room,
  userName: string,
  userRole: User['role'],
  roomId = room.id
): boolean => {
  const facilitator = roomFacilitators.get(roomId);
  if (facilitator?.userName === userName) {
    return true;
  }
  return userRole === 'admin' || room.owner === userName;
};

export const normalizeDiscussionNavigation = (
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

export const canInteractWithCardSocial = (phase: Phase): boolean =>
  phase === 'creation' || phase === 'voting' || phase === 'discussion' || phase === 'roadmap';

export const getRoomFeatures = (room: Room) => normalizeRoomFeatures(room.features);

export const isNegativeColumn = (template: RetroTemplate, column: number): boolean =>
  template.columns[column]?.kind === 'negative';

export const isRoadmapColumn = (template: RetroTemplate, column: number): boolean => {
  const roadmapLength = template.roadmapColumns?.length ?? 0;
  return column >= template.columns.length && column < template.columns.length + roadmapLength;
};

export const normalizeMood = (value: unknown): Mood | undefined => {
  if (typeof value !== 'string') return undefined;
  const allowed: Mood[] = ['great', 'good', 'neutral', 'bad', 'awful'];
  return allowed.includes(value as Mood) ? (value as Mood) : undefined;
};

export const normalizeNameList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean);
};

// Connection monitoring
export let connectionCount = 0;

export const adjustConnectionCount = (delta: number): number => {
  connectionCount += delta;
  return connectionCount;
};
export interface RoomTimerSession {
  phase: Phase;
  durationSeconds: number;
  endAt: number;
  timeout: NodeJS.Timeout;
}

export interface RetroRatingRoomState {
  votes: Map<string, 1 | 2 | 3 | 4 | 5>;
  resultsVisible: boolean;
}

export const roomTimers = new Map<string, RoomTimerSession>();
export const roomChats = new Map<string, ChatMessage[]>();
export const roomWhiteboards = new Map<string, WhiteboardStroke[]>();
export const roomRetroRatings = new Map<string, RetroRatingRoomState>();
export const roomFacilitators = new Map<string, FacilitatorAnnouncement>();
export const roomLastFacilitators = new Map<string, FacilitatorAnnouncement>();
export const roomDiscussionNavigation = new Map<string, DiscussionNavigationState>();
export const roomRaisedHands = new Map<string, Map<string, string>>();
export const discussionBurstTimestamps = new Map<string, Map<string, number[]>>();
export const roomSprintVipVotes = new Map<string, Map<string, string>>();
export const roomArkanoidScores = new Map<string, Map<string, { userName: string; score: number; cardsBroken: number }>>();
export const roomUserSocketPresence = new Map<string, Map<string, Set<string>>>();
export const pendingUserDepartures = new Map<string, ReturnType<typeof setTimeout>>();
export const USER_DISCONNECT_GRACE_MS = Math.max(
  0,
  Number(process.env.USER_DISCONNECT_GRACE_MS) || 5 * 60 * 1000
);

export const userPresenceKey = (roomId: string, userName: string): string => `${roomId}:${userName}`;

export const hasRoomPresence = (roomId: string, userName: string): boolean => {
  return (roomUserSocketPresence.get(roomId)?.get(userName)?.size ?? 0) > 0;
};

export const getPresentUserNames = (roomId: string): string[] => {
  const roomMap = roomUserSocketPresence.get(roomId);
  if (!roomMap) return [];
  return [...roomMap.entries()]
    .filter(([, sockets]) => sockets.size > 0)
    .map(([name]) => name);
};

export const cancelPendingUserDeparture = (roomId: string, userName: string): void => {
  const key = userPresenceKey(roomId, userName);
  const timeout = pendingUserDepartures.get(key);
  if (!timeout) return;
  clearTimeout(timeout);
  pendingUserDepartures.delete(key);
};

export const cancelPendingDeparturesForRoom = (roomId: string): void => {
  const prefix = `${roomId}:`;
  for (const [key, timeout] of pendingUserDepartures) {
    if (!key.startsWith(prefix)) continue;
    clearTimeout(timeout);
    pendingUserDepartures.delete(key);
  }
};

export const addRoomPresence = (roomId: string, userName: string, socketId: string): void => {
  cancelPendingUserDeparture(roomId, userName);
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

export const removeRoomPresence = (roomId: string, userName: string, socketId: string): boolean => {
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

export const getRemainingSeconds = (endAt: number): number => {
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
};

const timerPayload = (session: RoomTimerSession) => ({
  phase: session.phase,
  durationSeconds: session.durationSeconds,
  remainingSeconds: getRemainingSeconds(session.endAt),
  running: true,
  endAt: session.endAt
});

export const emitTimerResetToRoom = (roomId: string): void => {
  io.to(roomId).emit('timer-updated', {
    durationSeconds: 0,
    remainingSeconds: 0,
    running: false
  });
};

export const emitTimerToRoom = (roomId: string, session: RoomTimerSession): void => {
  io.to(roomId).emit('timer-updated', timerPayload(session));
};

export const emitTimerToSocket = (socket: Socket, roomId: string): void => {
  const session = roomTimers.get(roomId);
  if (!session) {
    socket.emit('timer-updated', {
      durationSeconds: 0,
      remainingSeconds: 0,
      running: false
    });
    return;
  }

  socket.emit('timer-updated', timerPayload(session));
};

export const clearRoomTimer = (roomId: string, emitReset = true, persist = true): void => {
  const session = roomTimers.get(roomId);
  if (session) {
    clearTimeout(session.timeout);
    roomTimers.delete(roomId);
  }
  if (emitReset) {
    emitTimerResetToRoom(roomId);
  }
  if (persist) void persistRoomEphemeral(roomId);
};

export const startRoomTimer = (
  roomId: string,
  phase: Phase,
  durationSeconds: number,
  endAt: number
): void => {
  clearRoomTimer(roomId, false, false);
  const timeout = setTimeout(() => {
    const active = roomTimers.get(roomId);
    if (!active || active.endAt !== endAt) return;
    io.to(roomId).emit('timer-updated', {
      phase: active.phase,
      durationSeconds: active.durationSeconds,
      remainingSeconds: 0,
      running: false,
      endAt: active.endAt
    });
    clearTimeout(active.timeout);
    roomTimers.delete(roomId);
    void persistRoomEphemeral(roomId);
  }, Math.max(0, endAt - Date.now()));
  const session: RoomTimerSession = { phase, durationSeconds, endAt, timeout };
  roomTimers.set(roomId, session);
  emitTimerToRoom(roomId, session);
  void persistRoomEphemeral(roomId);
};

const roomHydrations = new Map<string, Promise<void>>();

export const persistRoomEphemeral = async (roomId: string): Promise<void> => {
  const timer = roomTimers.get(roomId);
  const rating = roomRetroRatings.get(roomId);
  const facilitator = roomLastFacilitators.get(roomId) ?? roomFacilitators.get(roomId);
  const discussion = roomDiscussionNavigation.get(roomId);
  const state: StoredRoomRuntime = {
    timer: timer
      ? { phase: timer.phase, durationSeconds: timer.durationSeconds, endAt: timer.endAt }
      : null,
    rating: rating
      ? { votes: Array.from(rating.votes.entries()), resultsVisible: rating.resultsVisible }
      : null,
    facilitator: facilitator ?? null,
    discussion: discussion ?? null
  };
  await writeRoomRuntime(roomId, state);
};

export const hydrateRoomEphemeral = (roomId: string): Promise<void> => {
  const existing = roomHydrations.get(roomId);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const stored = await readRoomRuntime(roomId);
      if (stored.rating && !roomRetroRatings.has(roomId)) {
        roomRetroRatings.set(roomId, {
          votes: new Map(stored.rating.votes),
          resultsVisible: stored.rating.resultsVisible
        });
      }
      if (stored.facilitator && !roomLastFacilitators.has(roomId)) {
        roomLastFacilitators.set(roomId, stored.facilitator);
      }
      if (stored.facilitator && !roomFacilitators.has(roomId)) {
        roomFacilitators.set(roomId, stored.facilitator);
      }
      if (stored.discussion && !roomDiscussionNavigation.has(roomId)) {
        roomDiscussionNavigation.set(roomId, stored.discussion);
      }
      if (stored.timer && stored.timer.endAt > Date.now() && !roomTimers.has(roomId)) {
        startRoomTimer(roomId, stored.timer.phase, stored.timer.durationSeconds, stored.timer.endAt);
      }
    } catch (error) {
      roomHydrations.delete(roomId);
      logger.error({ err: error, roomId }, 'failed to hydrate room runtime');
    }
  })();

  roomHydrations.set(roomId, pending);
  return pending;
};

export const appendChatMessage = (roomId: string, message: ChatMessage): ChatMessage[] => {
  const history = roomChats.get(roomId) || [];
  const next = [...history, message].slice(-200);
  roomChats.set(roomId, next);
  return next;
};

export const normalizeWhiteboardStroke = (value: unknown): WhiteboardStroke | null => {
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

export const getRetroRatingState = (roomId: string): RetroRatingRoomState => {
  const existing = roomRetroRatings.get(roomId);
  if (existing) return existing;
  const created: RetroRatingRoomState = { votes: new Map(), resultsVisible: false };
  roomRetroRatings.set(roomId, created);
  return created;
};

export const buildRetroRatingPayload = (room: Room, userId?: string) => {
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

export const emitRetroRatingStateToRoom = async (roomId: string): Promise<void> => {
  const room = await RoomService.getRoom(roomId);
  if (!room) return;
  const sockets = await io.in(roomId).fetchSockets();
  sockets.forEach((connectedSocket) => {
    const userId = typeof connectedSocket.data.userId === 'string' ? connectedSocket.data.userId : connectedSocket.id;
    connectedSocket.emit('retro-rating-state', buildRetroRatingPayload(room, userId));
  });
};

export const emitRetroRatingStateToSocket = (socket: Socket, room: Room): void => {
  const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;
  socket.emit('retro-rating-state', buildRetroRatingPayload(room, userId));
};

export const selectRandomFacilitator = (room: Room): FacilitatorAnnouncement | null => {
  if (room.users.length === 0) return null;
  const selectedUser = room.users[Math.floor(Math.random() * room.users.length)];
  return {
    userId: selectedUser.id,
    userName: selectedUser.name,
    selectedAt: Date.now()
  };
};

export const buildSprintVipState = (room: Room): SprintVipState => {
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

export const buildPersonalSprintVipState = (room: Room, userName?: string): SprintVipState => {
  const votes = roomSprintVipVotes.get(room.id);
  const myVote = userName && votes ? votes.get(userName) : undefined;
  return {
    ...buildSprintVipState(room),
    myVote
  };
};

export const resolveRoomUserForSocket = (
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

export const resolveVoterNameForSocket = (
  room: Room,
  connectedSocket: { id: string; data: Record<string, unknown> }
): string | undefined => {
  if (typeof connectedSocket.data.userName === 'string') {
    return connectedSocket.data.userName;
  }
  return resolveRoomUserForSocket(room, connectedSocket)?.name;
};

export const emitSprintVipStateToRoom = async (roomId: string): Promise<void> => {
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

export const emitSprintVipStateToSocket = (socket: Socket, room: Room): void => {
  const voterName = resolveVoterNameForSocket(room, socket);
  socket.emit('sprint-vip-state', buildPersonalSprintVipState(room, voterName));
};

export const arkanoidScoresPayload = (roomId: string) => ({
  scores: Array.from(roomArkanoidScores.get(roomId)?.values() || [])
});

export const emitArkanoidScoresToRoom = (roomId: string): void => {
  io.to(roomId).emit('arkanoid-scores', arkanoidScoresPayload(roomId));
};

export const emitArkanoidScoresToSocket = (target: Socket, roomId: string): void => {
  target.emit('arkanoid-scores', arkanoidScoresPayload(roomId));
};

export const persistUserLeave = async (
  user: User,
  roomId: string,
  options: { requireAbsent?: boolean } = {}
): Promise<Room | null> => {
  if (options.requireAbsent && hasRoomPresence(roomId, user.name)) {
    return null;
  }

  const room = await RoomService.getRoom(roomId);
  if (!room) return null;

  const userInRoom = room.users.find((roomUser) => roomUser.name === user.name)
    ?? room.users.find((roomUser) => roomUser.id === user.id);
  if (!userInRoom) return room;

  const userIdForCleanup = userInRoom.id;
  const updatedRoom = await RoomService.removeUser(
    roomId,
    userIdForCleanup,
    user.name,
    getPresentUserNames(roomId)
  );
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

  if (clearRaisedHand(roomId, user.name)) {
    emitDiscussionHands(roomId);
  }

  if (updatedRoom.users.length === 0) {
    roomSprintVipVotes.delete(roomId);
    roomArkanoidScores.delete(roomId);
    roomUserSocketPresence.delete(roomId);
    roomRaisedHands.delete(roomId);
    discussionBurstTimestamps.delete(roomId);
    cancelPendingDeparturesForRoom(roomId);
    RoomCache.invalidate(roomId);
    logger.info({ roomId }, 'room is empty');
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

export const handleUserLeavingRoom = async (socket: Socket, user: User): Promise<Room | null> => {
  const roomId = user.roomId || (typeof socket.data.roomId === 'string' ? socket.data.roomId : '');
  if (!roomId) return null;

  cancelPendingUserDeparture(roomId, user.name);
  const shouldRemoveFromRoom = removeRoomPresence(roomId, user.name, socket.id);

  socket.leave(roomId);
  delete socket.data.userId;
  delete socket.data.userName;

  if (!shouldRemoveFromRoom) {
    return null;
  }

  return persistUserLeave(user, roomId);
};

export const schedulePendingUserDeparture = (user: User, roomId: string): void => {
  cancelPendingUserDeparture(roomId, user.name);
  const key = userPresenceKey(roomId, user.name);
  const timeout = setTimeout(() => {
    pendingUserDepartures.delete(key);
    if (hasRoomPresence(roomId, user.name)) {
      return;
    }
    logger.info({
      roomId,
      userName: user.name,
      graceMs: USER_DISCONNECT_GRACE_MS
    }, 'disconnect grace elapsed, removing user from room');
    void persistUserLeave(user, roomId, { requireAbsent: true });
  }, USER_DISCONNECT_GRACE_MS);
  pendingUserDepartures.set(key, timeout);
};

export const handleUserDisconnect = (socket: Socket, user: User): void => {
  const roomId = user.roomId || (typeof socket.data.roomId === 'string' ? socket.data.roomId : '');
  if (!roomId) return;

  removeRoomPresence(roomId, user.name, socket.id);
  // Browsers often drop the socket when a tab is backgrounded. Keep membership
  // and admin role for a grace period so the same person can come back.
  if (hasRoomPresence(roomId, user.name)) {
    cancelPendingUserDeparture(roomId, user.name);
    return;
  }
  schedulePendingUserDeparture({ ...user, roomId }, roomId);
};

export const resolveSocketActor = async (socket: Socket, currentUser: User | null): Promise<User | null> => {
  if (currentUser?.roomId && currentUser.name) {
    return currentUser;
  }

  const roomId = typeof socket.data.roomId === 'string'
    ? socket.data.roomId
    : [...socket.rooms].find((roomName) => roomName !== socket.id);
  const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
  const userId = typeof socket.data.userId === 'string' ? socket.data.userId : socket.id;

  if (!roomId || !userName) {
    return currentUser?.roomId ? currentUser : null;
  }

  const room = await RoomService.getRoom(roomId);
  const user = room?.users.find((roomUser) => roomUser.name === userName || roomUser.id === userId);
  if (!user) return null;

  return { ...user, roomId };
};

export function clearRoomRuntimeState(roomId: string, emitTimerReset = false): void {
  clearRoomTimer(roomId, emitTimerReset, false);
  roomChats.delete(roomId);
  roomWhiteboards.delete(roomId);
  roomRetroRatings.delete(roomId);
  roomFacilitators.delete(roomId);
  roomLastFacilitators.delete(roomId);
  roomDiscussionNavigation.delete(roomId);
  roomRaisedHands.delete(roomId);
  discussionBurstTimestamps.delete(roomId);
  roomSprintVipVotes.delete(roomId);
  roomArkanoidScores.delete(roomId);
  cancelPendingDeparturesForRoom(roomId);
  roomHydrations.delete(roomId);
  clearRoomVersion(roomId);
  void persistRoomEphemeral(roomId);
}
