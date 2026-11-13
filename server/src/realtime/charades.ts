import {
  CharadesState,
  isCharadesWarmup,
  isCorrectCharadesGuess,
  Room
} from '../types';
import { pickCharadesWord } from '../services/CharadesWords';
import { RoomService } from '../services/RoomService';
import { logger } from '../utils/logger';
import { io, persistRoomEphemeral, roomWhiteboards } from './runtime';

export interface CharadesRoomState {
  drawerName: string | null;
  word: string | null;
  status: 'waiting' | 'playing' | 'guessed';
  winnerName: string | null;
  lastWord: string | null;
  round: number;
  usedWords: string[];
  scores: Map<string, number>;
  previousDrawer: string | null;
}

export interface StoredCharades {
  drawerName: string | null;
  word: string | null;
  status: CharadesRoomState['status'];
  winnerName: string | null;
  lastWord: string | null;
  round: number;
  usedWords: string[];
  scores: Array<[string, number]>;
  previousDrawer: string | null;
}

const roomCharades = new Map<string, CharadesRoomState>();
const nextRoundTimers = new Map<string, NodeJS.Timeout>();
const roundLocks = new Map<string, Promise<void>>();

const emptyCharades = (): CharadesRoomState => ({
  drawerName: null,
  word: null,
  status: 'waiting',
  winnerName: null,
  lastWord: null,
  round: 0,
  usedWords: [],
  scores: new Map(),
  previousDrawer: null
});

export const getCharadesRoomState = (roomId: string): CharadesRoomState => {
  const existing = roomCharades.get(roomId);
  if (existing) return existing;
  const created = emptyCharades();
  roomCharades.set(roomId, created);
  return created;
};

export const serializeCharades = (roomId: string): StoredCharades | undefined => {
  const game = roomCharades.get(roomId);
  if (!game) return undefined;
  return {
    drawerName: game.drawerName,
    word: game.word,
    status: game.status,
    winnerName: game.winnerName,
    lastWord: game.lastWord,
    round: game.round,
    usedWords: game.usedWords,
    scores: Array.from(game.scores.entries()),
    previousDrawer: game.previousDrawer
  };
};

export const restoreCharades = (roomId: string, stored?: StoredCharades | null): void => {
  if (!stored || roomCharades.has(roomId)) return;
  roomCharades.set(roomId, {
    drawerName: stored.drawerName,
    word: stored.word,
    status: stored.status,
    winnerName: stored.winnerName,
    lastWord: stored.lastWord,
    round: stored.round,
    usedWords: stored.usedWords || [],
    scores: new Map(stored.scores || []),
    previousDrawer: stored.previousDrawer
  });
};

export const clearCharades = (roomId: string): void => {
  const timer = nextRoundTimers.get(roomId);
  if (timer) clearTimeout(timer);
  nextRoundTimers.delete(roomId);
  roomCharades.delete(roomId);
  roundLocks.delete(roomId);
};

const isCharadesPhase = (room: Room): boolean =>
  room.phase === 'warmup' && isCharadesWarmup(room.warmupQuestions);

export const roomUsesCharades = (room: Room): boolean => isCharadesWarmup(room.warmupQuestions);

const buildPayload = (game: CharadesRoomState, viewerName?: string): CharadesState => ({
  active: true,
  status: game.status,
  drawerName: game.drawerName,
  word: viewerName && game.drawerName === viewerName ? (game.word ?? undefined) : undefined,
  winnerName: game.winnerName ?? undefined,
  lastWord: game.status === 'guessed' ? (game.lastWord ?? undefined) : undefined,
  round: game.round,
  scores: Array.from(game.scores.entries())
    .map(([userName, score]) => ({ userName, score }))
    .sort((left, right) => right.score - left.score || left.userName.localeCompare(right.userName, 'ru'))
});

export const emitCharadesStateToRoom = async (roomId: string): Promise<void> => {
  const game = getCharadesRoomState(roomId);
  const sockets = await io.in(roomId).fetchSockets();
  sockets.forEach((connectedSocket) => {
    const userName = typeof connectedSocket.data.userName === 'string' ? connectedSocket.data.userName : undefined;
    connectedSocket.emit('charades-state', buildPayload(game, userName));
  });
};

export const emitCharadesStateToSocket = (socket: { data: { userName?: unknown }; emit: (event: string, payload: CharadesState) => void }, roomId: string): void => {
  const game = getCharadesRoomState(roomId);
  const userName = typeof socket.data.userName === 'string' ? socket.data.userName : undefined;
  socket.emit('charades-state', buildPayload(game, userName));
};

const clearBoard = (roomId: string): void => {
  roomWhiteboards.set(roomId, []);
  io.to(roomId).emit('whiteboard-cleared');
};

const pickDrawer = (room: Room, previousDrawer: string | null): string | null => {
  if (room.users.length === 0) return null;
  const others = previousDrawer
    ? room.users.filter((user) => user.name !== previousDrawer)
    : room.users;
  const pool = others.length > 0 ? others : room.users;
  return pool[Math.floor(Math.random() * pool.length)].name;
};

const startRound = async (room: Room): Promise<void> => {
  const game = getCharadesRoomState(room.id);
  if (room.users.length < 2) {
    game.status = 'waiting';
    game.drawerName = null;
    game.word = null;
    game.winnerName = null;
    await persistRoomEphemeral(room.id);
    await emitCharadesStateToRoom(room.id);
    return;
  }

  const drawerName = pickDrawer(room, game.previousDrawer);
  if (!drawerName) {
    game.status = 'waiting';
    await persistRoomEphemeral(room.id);
    await emitCharadesStateToRoom(room.id);
    return;
  }

  const guessedCount = [...game.scores.values()].reduce((sum, score) => sum + score, 0);
  const word = await pickCharadesWord(game.usedWords, guessedCount);
  game.drawerName = drawerName;
  game.previousDrawer = drawerName;
  game.word = word;
  game.status = 'playing';
  game.winnerName = null;
  game.lastWord = null;
  game.round += 1;
  game.usedWords = [...game.usedWords, word].slice(-80);
  clearBoard(room.id);
  await persistRoomEphemeral(room.id);
  await emitCharadesStateToRoom(room.id);
};

export const ensureCharadesPlaying = async (roomId: string): Promise<void> => {
  const pending = roundLocks.get(roomId);
  if (pending) {
    await pending;
    return;
  }

  const task = (async () => {
    const room = await RoomService.getRoom(roomId);
    if (!room || !isCharadesPhase(room)) return;
    const game = getCharadesRoomState(roomId);
    if (game.status === 'guessed') return;
    if (game.status === 'playing' && game.drawerName && game.word) {
      if (!room.users.some((user) => user.name === game.drawerName)) {
        await startRound(room);
        return;
      }
      await emitCharadesStateToRoom(roomId);
      return;
    }
    await startRound(room);
  })();

  roundLocks.set(roomId, task);
  try {
    await task;
  } catch (error) {
    logger.error({ err: error, roomId }, 'failed to start charades round');
  } finally {
    if (roundLocks.get(roomId) === task) roundLocks.delete(roomId);
  }
};

const scheduleNextRound = (roomId: string): void => {
  const existing = nextRoundTimers.get(roomId);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => {
    nextRoundTimers.delete(roomId);
    void (async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room || !isCharadesPhase(room)) return;
      await startRound(room);
    })();
  }, 2800);
  nextRoundTimers.set(roomId, timeout);
};

export const tryCharadesGuess = async (room: Room, userName: string, text: string): Promise<void> => {
  if (!isCharadesPhase(room)) return;
  const game = getCharadesRoomState(room.id);
  if (game.status !== 'playing' || !game.word || !game.drawerName) return;
  if (userName === game.drawerName) return;
  if (!isCorrectCharadesGuess(text, game.word)) return;

  game.status = 'guessed';
  game.winnerName = userName;
  game.lastWord = game.word;
  game.scores.set(userName, (game.scores.get(userName) || 0) + 1);
  game.word = null;
  await persistRoomEphemeral(room.id);
  await emitCharadesStateToRoom(room.id);
  scheduleNextRound(room.id);
};

export const roomAllowsCharadesChat = (room: Room): boolean => isCharadesPhase(room);
export const roomAllowsCharadesDraw = (room: Room): boolean => isCharadesPhase(room);

export const canDrawCharadesStroke = (room: Room, userName: string): boolean => {
  if (!isCharadesPhase(room)) return false;
  const game = getCharadesRoomState(room.id);
  return game.status === 'playing' && game.drawerName === userName;
};
