import { io, Socket } from 'socket.io-client';
import { RetroStore } from '../store/RetroStore';
import { Room, RoomState, User, Card, CardComment, CardReaction, FacilitatorAnnouncement, DiscussionBurst, DiscussionHand, DiscussionNavigationState, Phase, PhaseTimerState, ChatMessage, Mood, RetroRatingState, RoomFeatures, SprintVipState, ArkanoidScoreEntry, WhiteboardStroke, CreateRoomOptions, ColumnColorId } from '../types';
import { getApiBase } from '../utils/apiBase';
import { log } from '../utils/logger';
import { classifyServerError, mapServerError, SessionError } from '../utils/errors';
import { readStoredSession, TabSession } from './session';

type ResumeKind = 'hide' | 'online' | 'bfcache';

export class SocketService {
  private socket: Socket;
  private store: RetroStore;
  private isRestoringSession = false;
  private restorePromise: Promise<void> | null = null;
  private restoredSocketId: string | null = null;
  private sessionSyncRequired = false;
  private lastSessionSyncAt = 0;
  private hiddenAt = 0;
  private resumeTimer: number | null = null;
  private overlayTimer: number | null = null;
  private pendingResume: ResumeKind | null = null;
  private connectErrorStreak = 0;
  private static readonly SHORT_AWAY_MS = 15000;
  private static readonly RESUME_DEBOUNCE_MS = 300;
  private static readonly RESTORE_TIMEOUT_MS = 5000;
  private static readonly OVERLAY_DELAY_MS = 1500;

  constructor(store: RetroStore) {
    log.debug('Initializing socket connection...');
    this.store = store;

    const apiBase = getApiBase();
    const serverUrl = apiBase || window.location.origin;

    this.socket = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
      autoConnect: false,
      auth: (callback) => {
        callback({ token: this.store.authProfile?.token || '' });
      }
    });

    this.store.setSocket(this.socket);

    this.socket.on('connect', () => {
      log.debug('Socket connected:', this.socket.id);
      this.connectErrorStreak = 0;
      if (this.socket.recovered && this.store.canRenderBoard) {
        this.restoredSocketId = this.socket.id ?? null;
        this.sessionSyncRequired = false;
        this.clearReconnecting();
        return;
      }
      void this.attemptSessionRestore();
    });

    this.socket.io.on('reconnect', () => {
      log.debug('Socket reconnected');
      this.sessionSyncRequired = true;
      this.restoredSocketId = null;
    });

    this.socket.on('connect_error', () => {
      this.connectErrorStreak += 1;
      if (this.connectErrorStreak < 3) return;
      this.store.setConnectionStatus('offline');
      this.store.setError('Не удалось подключиться к серверу. Попробуйте ещё раз.');
    });

    this.socket.on('disconnect', (reason) => {
      log.debug('Socket disconnected:', reason);
      if (reason === 'io client disconnect') return;

      this.store.flushBoardState();
      this.sessionSyncRequired = true;
      this.restoredSocketId = null;
      this.store.setConnectionStatus('reconnecting');
      if (!this.store.canRenderBoard) {
        this.store.setReconnecting(true);
      }
    });

    this.bindLifecycleHandlers();
    this.setupListeners();
    log.debug('Starting initial connection...');
    this.socket.connect();
  }

  private activeSession(): TabSession | null {
    const roomId = this.store.room?.id;
    const username = this.store.currentUser?.name || this.store.authProfile?.name;
    const userId = this.store.currentUser?.id || readStoredSession()?.userId;
    if (roomId && username && userId) {
      return { roomId, userId, username };
    }
    return readStoredSession();
  }

  private applyJoined({ room, state, userId }: { room: Room; state: RoomState; userId?: string }): void {
    const authName = this.store.authProfile?.name;
    const user = (userId ? room.users.find((entry) => entry.id === userId) : undefined)
      || (authName ? room.users.find((entry) => entry.name === authName) : undefined);

    if (user) {
      this.store.setCurrentUser({
        id: user.id,
        name: user.name,
        roomId: room.id,
        role: user.role,
        mood: user.mood,
        isReady: user.isReady
      });
    }

    this.store.setRoom(room);
    this.store.updateState(state);
    this.store.setRejoinRequired(false);
    this.store.setError(null);
    this.clearReconnecting();
    this.sessionSyncRequired = false;
    this.lastSessionSyncAt = Date.now();
    this.restoredSocketId = this.socket.id ?? null;
  }

  private markReconnecting(): void {
    if (!this.store.canRenderBoard) {
      this.store.setConnectionStatus('reconnecting');
      this.store.setReconnecting(true);
      return;
    }
    if (this.overlayTimer != null) return;
    this.overlayTimer = window.setTimeout(() => {
      this.overlayTimer = null;
      if (this.restoredSocketId === this.socket.id && !this.sessionSyncRequired && this.socket.connected) return;
      this.store.setConnectionStatus('reconnecting');
      this.store.setReconnecting(true);
    }, SocketService.OVERLAY_DELAY_MS);
  }

  private clearReconnecting(): void {
    if (this.overlayTimer != null) {
      window.clearTimeout(this.overlayTimer);
      this.overlayTimer = null;
    }
    this.store.setReconnecting(false);
    this.store.setConnectionStatus('online');
  }

  private forceReconnect(): void {
    this.sessionSyncRequired = true;
    this.restoredSocketId = null;
    this.markReconnecting();
    if (this.socket.connected) {
      this.socket.disconnect();
    }
    this.socket.connect();
  }

  private leaveRoomLocally(message: string): void {
    this.sessionSyncRequired = false;
    this.store.setRejoinRequired(false);
    this.store.setError(message);
    this.store.setRoom(null);
    this.clearReconnecting();
  }

  private setupListeners(): void {
    this.socket.on('error', (error: string) => {
      log.debug('Server error:', error);
      this.store.setError(mapServerError(error));
    });

    this.socket.on('kicked', () => {
      this.leaveRoomLocally('Вас исключили из комнаты');
    });

    this.socket.on('user-kicked', () => {
      this.leaveRoomLocally('Вы были исключены из комнаты администратором');
    });

    this.socket.on('room-deleted', () => {
      this.leaveRoomLocally('Комната была удалена администратором');
    });

    this.socket.on('room-joined', ({ room, state, userId }: { room: Room; state: RoomState; userId: string }) => {
      log.debug('Room joined:', room.id, userId);
      this.applyJoined({ room, state, userId });
    });

    this.socket.on('state-updated', (state: RoomState) => {
      this.store.updateState(state);
    });

    this.socket.on('user-joined', (user: User) => {
      this.store.addUser(user);
    });

    this.socket.on('user-left', (user: User) => {
      this.store.removeUser(user.id);
    });

    this.socket.on('card-added', (card: Card) => {
      this.store.addCard(card);
    });

    this.socket.on('card-updated', (card: Card) => {
      this.store.updateCard(card);
    });

    this.socket.on('card-deleted', (cardId: string) => {
      this.store.deleteCard(cardId);
    });

    this.socket.on('cards-cleared', () => {
      this.store.clearAllCards();
    });

    this.socket.on('card-moved', ({ cardId, column, originColumn }: { cardId: string; column: number; originColumn?: number }) => {
      this.store.moveCard(cardId, column, originColumn);
    });

    this.socket.on('card-voted', ({ cardId, likes, dislikes }: { cardId: string; likes: string[]; dislikes: string[] }) => {
      this.store.updateVotes(cardId, likes, dislikes);
      this.store.clearVoteError();
    });

    this.socket.on('card-comment-added', ({ cardId, comment }: { cardId: string; comment: CardComment }) => {
      this.store.addCardComment(cardId, comment);
    });

    this.socket.on('card-comment-updated', ({ cardId, comment }: { cardId: string; comment: CardComment }) => {
      this.store.updateCardComment(cardId, comment);
    });

    this.socket.on('card-reaction-updated', ({ cardId, reactions }: { cardId: string; reactions: CardReaction[] }) => {
      this.store.setCardReactions(cardId, reactions);
    });

    this.socket.on('vote-error', ({ cardId, message }: { cardId: string; message: string }) => {
      this.store.setVoteError(cardId, message);
    });

    this.socket.on('phase-changed', ({ phase, cards }: { phase: Phase; cards: Card[] }) => {
      this.store.setPhase(phase);
      this.store.setCards(cards);
    });

    this.socket.on('timer-updated', (timer: PhaseTimerState) => {
      this.store.setPhaseTimer(timer);
    });

    this.socket.on('chat-history', ({ messages }: { messages: ChatMessage[] }) => {
      this.store.setChatHistory(messages);
    });

    this.socket.on('chat-message', (message: ChatMessage) => {
      this.store.addChatMessage(message);
    });

    this.socket.on('whiteboard-history', ({ strokes }: { strokes: WhiteboardStroke[] }) => {
      this.store.setWhiteboardHistory(strokes);
    });

    this.socket.on('whiteboard-stroke', (stroke: WhiteboardStroke) => {
      this.store.addWhiteboardStroke(stroke);
    });

    this.socket.on('whiteboard-cleared', () => {
      this.store.clearWhiteboard();
    });

    this.socket.on('retro-rating-state', (rating: RetroRatingState) => {
      this.store.setRetroRating(rating);
    });

    this.socket.on('facilitator-selected', (announcement: FacilitatorAnnouncement | null) => {
      this.store.setFacilitatorAnnouncement(announcement);
    });

    this.socket.on('discussion-navigation', (state: DiscussionNavigationState) => {
      this.store.setDiscussionNavigation(state);
    });

    this.socket.on('discussion-hands', ({ hands }: { hands?: DiscussionHand[] }) => {
      this.store.setDiscussionHands(hands || []);
    });

    this.socket.on('discussion-burst', (burst: DiscussionBurst) => {
      this.store.addDiscussionBurst(burst);
    });

    this.socket.on('column-titles-updated', ({ titles }: { titles: string[] }) => {
      this.store.setColumnTitles(titles);
    });

    this.socket.on('column-colors-updated', ({ colors }: { colors: ColumnColorId[] }) => {
      this.store.setColumnColors(colors);
    });

    this.socket.on('room-features-updated', ({ features }: { features: RoomFeatures }) => {
      this.store.setRoomFeatures(features);
    });

    this.socket.on('room-background-updated', ({ backgroundImage }: { backgroundImage: string }) => {
      this.store.setRoomFeatures({
        ...this.store.roomFeatures,
        backgroundImage: backgroundImage || ''
      });
    });

    this.socket.on('sprint-vip-state', (state: SprintVipState) => {
      this.store.setSprintVip(state);
    });

    this.socket.on('arkanoid-scores', ({ scores }: { scores?: ArkanoidScoreEntry[] }) => {
      this.store.setArkanoidScores(scores || []);
    });
  }

  private bindLifecycleHandlers(): void {
    const scheduleResume = (kind: ResumeKind) => {
      if (kind === 'online' || kind === 'bfcache') {
        this.pendingResume = kind;
      } else if (!this.pendingResume) {
        this.pendingResume = 'hide';
      }
      if (this.resumeTimer != null) window.clearTimeout(this.resumeTimer);
      this.resumeTimer = window.setTimeout(() => {
        this.resumeTimer = null;
        void this.handleResume();
      }, SocketService.RESUME_DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now();
        this.store.flushBoardState();
        return;
      }
      scheduleResume('hide');
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) scheduleResume('bfcache');
    });

    window.addEventListener('focus', () => {
      if (document.visibilityState !== 'visible' || !this.hiddenAt) return;
      scheduleResume('hide');
    });

    window.addEventListener('offline', () => {
      this.store.setConnectionStatus('offline');
    });

    window.addEventListener('online', () => {
      scheduleResume('online');
    });

    window.addEventListener('storage', (event) => {
      if (event.key === 'authProfile' && !event.newValue) {
        this.store.clearAuthProfile();
      }
    });
  }

  private async handleResume(): Promise<void> {
    const kind = this.pendingResume;
    this.pendingResume = null;
    const away = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
    this.hiddenAt = 0;

    const token = this.store.authProfile?.token;
    const session = this.activeSession();
    if (!session || !token) return;

    if (!this.store.canRenderBoard) {
      this.store.hydrateBoardFromCache();
    }

    if (!this.socket.connected || kind === 'online' || kind === 'bfcache') {
      if (!this.socket.connected) {
        this.forceReconnect();
        return;
      }
    }

    if (this.socket.connected && kind === 'hide' && away < SocketService.SHORT_AWAY_MS) {
      return;
    }

    this.sessionSyncRequired = true;
    await this.attemptSessionRestore();
  }

  private async attemptSessionRestore(): Promise<void> {
    const session = this.activeSession();
    const token = this.store.authProfile?.token;
    if (!session || !token) return;

    const now = Date.now();
    const thisSocketNeedsRestore = this.restoredSocketId !== this.socket.id;
    if (
      !thisSocketNeedsRestore &&
      !this.sessionSyncRequired &&
      now - this.lastSessionSyncAt < 1500
    ) {
      return;
    }

    if (!this.socket.connected) {
      this.markReconnecting();
      this.socket.connect();
      return;
    }

    if (this.isRestoringSession) {
      return this.restorePromise ?? Promise.resolve();
    }

    this.isRestoringSession = true;
    this.restorePromise = this.runSessionRestore(session, token);
    try {
      await this.restorePromise;
    } finally {
      this.isRestoringSession = false;
      this.restorePromise = null;
    }
  }

  private async runSessionRestore(session: TabSession, token: string): Promise<void> {
    this.markReconnecting();
    try {
      await this.restoreSession(session.roomId, session.userId, session.username, token);
      this.clearReconnecting();
    } catch (error) {
      const code = error instanceof SessionError ? error.code : 'other';
      if (code === 'timeout') {
        this.sessionSyncRequired = true;
        window.setTimeout(() => this.forceReconnect(), 0);
        return;
      }
      if (code !== 'expired') {
        this.sessionSyncRequired = true;
        if (!this.store.canRenderBoard) {
          this.store.setConnectionStatus('offline');
        }
        return;
      }

      try {
        await this.joinRoom(session.roomId, '', session.username, token);
        this.clearReconnecting();
      } catch (joinError) {
        const joinCode = joinError instanceof SessionError ? joinError.code : 'other';
        if (joinCode === 'password') {
          this.store.setError(null);
          this.store.setRejoinRequired(true);
          this.clearReconnecting();
          return;
        }
        if (joinCode === 'auth') {
          this.store.clearAuthProfile();
          return;
        }
        this.sessionSyncRequired = true;
        if (!this.store.room) {
          this.store.clearSession();
          this.store.setReconnecting(false);
        } else {
          this.clearReconnecting();
        }
      }
    }
  }

  private ensureConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.socket.connected) {
        resolve();
        return;
      }

      let attemptCount = 0;
      const maxAttempts = 3;
      const attemptConnection = () => {
        if (attemptCount >= maxAttempts) {
          reject(new SessionError('Не удалось подключиться к серверу', 'other'));
          return;
        }

        attemptCount += 1;
        const timeout = window.setTimeout(() => {
          this.socket.off('connect', handleConnect);
          this.socket.off('connect_error', handleError);
          if (attemptCount < maxAttempts) {
            attemptConnection();
          } else {
            reject(new SessionError('Не удалось подключиться к серверу', 'timeout'));
          }
        }, 5000);

        const handleConnect = () => {
          window.clearTimeout(timeout);
          this.socket.off('connect_error', handleError);
          resolve();
        };

        const handleError = () => {
          window.clearTimeout(timeout);
          this.socket.off('connect', handleConnect);
          if (attemptCount < maxAttempts) {
            window.setTimeout(attemptConnection, 1000);
          } else {
            reject(new SessionError('Не удалось подключиться к серверу', 'other'));
          }
        };

        this.socket.once('connect', handleConnect);
        this.socket.once('connect_error', handleError);
        if (!this.socket.connected) {
          this.socket.connect();
        }
      };

      attemptConnection();
    });
  }

  private waitForRoom(roomId: string, timeoutMs: number, listenForExpired: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new SessionError('timeout', 'timeout'));
      }, timeoutMs);

      const handleSuccess = ({ room }: { room: Room }) => {
        if (room?.id !== roomId) return;
        cleanup();
        resolve();
      };

      const handleExpired = () => {
        cleanup();
        reject(new SessionError('session-expired', 'expired'));
      };

      const handleError = (error: string) => {
        cleanup();
        const code = classifyServerError(error);
        reject(new SessionError(mapServerError(error), code === 'other' ? 'other' : code));
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        this.socket.off('room-joined', handleSuccess);
        this.socket.off('session-expired', handleExpired);
        if (!listenForExpired) this.socket.off('error', handleError);
      };

      this.socket.on('room-joined', handleSuccess);
      if (listenForExpired) {
        this.socket.once('session-expired', handleExpired);
      } else {
        this.socket.once('error', handleError);
      }
    });
  }

  async createRoom(roomId: string, password: string | undefined, username: string, token: string, options?: CreateRoomOptions): Promise<void> {
    log.debug('Attempting to create room:', roomId);
    try {
      await this.ensureConnection();
      const pending = this.waitForRoom(roomId, 20000, false);
      this.socket.emit('create-room', { roomId, password, username, token, ...options });
      await pending;
    } catch (error) {
      log.error('Failed to create room:', error);
      if (error instanceof SessionError) throw error;
      throw new SessionError('Не удалось подключиться к серверу', 'other');
    }
  }

  async joinRoom(roomId: string, password: string, username: string, token: string): Promise<void> {
    log.debug('Attempting to join room:', roomId);
    try {
      await this.ensureConnection();
      const pending = this.waitForRoom(roomId, 10000, false);
      this.socket.emit('join-room', { roomId, password, username, token });
      await pending;
    } catch (error) {
      log.error('Failed to join room:', error);
      if (error instanceof SessionError) throw error;
      throw new SessionError('Не удалось подключиться к серверу', 'other');
    }
  }

  addCard(text: string, type: 'liked' | 'disliked' | 'suggestion', column: number, imageUrl?: string): void {
    const currentUser = this.store.currentUser;
    if (!currentUser) return;
    if (!this.store.canAddCards(column)) return;
    if (this.store.isCardLimitReached) {
      this.store.setError(this.store.cardLimitMessage);
      return;
    }
    this.socket.emit('add-card', { text, type, column, imageUrl });
  }

  updateCard(cardId: string, text: string, imageUrl?: string): void {
    if (!this.store.currentUser) return;
    this.socket.emit('update-card', { cardId, text, imageUrl });
  }

  deleteCard(cardId: string): void {
    if (!this.store.currentUser) return;
    this.socket.emit('delete-card', { cardId });
  }

  deleteAllCards(): void {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('delete-all-cards');
  }

  mergeCards(targetCardId: string, sourceCardId: string): void {
    if (!this.store.currentUser || this.store.currentUser.role !== 'admin') return;
    if (targetCardId === sourceCardId) return;
    this.socket.emit('merge-cards', { targetCardId, sourceCardId });
  }

  moveCard(cardId: string, column: number): void {
    this.socket.emit('move-card', { cardId, column });
  }

  voteCard(cardId: string, voteType: 'like' | 'dislike'): void {
    this.socket.emit('vote-card', { cardId, voteType });
  }

  addCardComment(cardId: string, text: string): void {
    this.socket.emit('add-card-comment', { cardId, text });
  }

  updateCardComment(cardId: string, commentId: string, text: string): void {
    this.socket.emit('update-card-comment', { cardId, commentId, text });
  }

  toggleCardReaction(cardId: string, emoji: string): void {
    this.socket.emit('toggle-card-reaction', { cardId, emoji });
  }

  sendDiscussionBurst(emoji: string): void {
    this.socket.emit('discussion-burst', { emoji });
  }

  toggleDiscussionHand(): void {
    this.socket.emit('toggle-discussion-hand');
  }

  setCardAuthorReveal(cardId: string, revealed: boolean): void {
    this.socket.emit('set-card-author-reveal', { cardId, revealed });
  }

  async changePhase(phase: Phase): Promise<void> {
    this.socket.emit('change-phase', { phase });
  }

  async updateReadyState(isReady: boolean): Promise<void> {
    try {
      await this.ensureConnection();
    } catch (error) {
      log.error('Failed to connect before ready state update:', error);
      return;
    }
    this.socket.emit('update-ready-state', {
      isReady,
      token: this.store.authProfile?.token,
      roomId: this.store.room?.id
    });
  }

  setPhaseTimer(durationSeconds: number): void {
    this.socket.emit('set-phase-timer', { durationSeconds });
  }

  resetPhaseTimer(): void {
    this.socket.emit('reset-phase-timer');
  }

  sendChatMessage(text: string): void {
    this.socket.emit('send-chat-message', { text });
  }

  setUserMood(mood: Mood): void {
    this.socket.emit('set-user-mood', { mood });
  }

  submitArkanoidScore(score: number, cardsBroken: number): void {
    if (!this.socket.connected || score < 0) return;
    this.socket.emit('arkanoid-score', { score, cardsBroken });
  }

  voteSprintVip(userName: string): void {
    const myName = this.store.currentUser?.name;
    if (!myName || userName === myName) return;

    const currentVote = this.store.sprintVip.myVote;
    const nextVote = currentVote === userName ? undefined : userName;
    this.store.setSprintVip({
      ...this.store.sprintVip,
      myVote: nextVote
    });
    this.socket.emit('vote-sprint-vip', { userName });
  }

  sendWhiteboardStroke(stroke: WhiteboardStroke): void {
    this.socket.emit('whiteboard-stroke', stroke);
  }

  clearWhiteboard(): void {
    this.socket.emit('clear-whiteboard');
  }

  submitRetroRating(value: 1 | 2 | 3 | 4 | 5): void {
    this.socket.emit('submit-retro-rating', { value });
  }

  showRetroRatingResults(): void {
    this.socket.emit('show-retro-rating-results');
  }

  setDiscussionNavigation(state: DiscussionNavigationState): void {
    this.store.setDiscussionNavigation(state);
    this.socket.emit('set-discussion-navigation', state);
  }

  setColumnTitles(titles: string[]): void {
    this.socket.emit('set-column-titles', { titles });
  }

  setColumnColors(colors: ColumnColorId[]): void {
    this.socket.emit('set-column-colors', { colors });
  }

  setRoomFeatures(features: RoomFeatures): void {
    if (!this.socket || !this.store.isAdmin) return;
    const { backgroundImage: _backgroundImage, ...featuresWithoutBackground } = features;
    this.socket.emit('set-room-features', { features: featuresWithoutBackground });
  }

  setRoomBackground(backgroundImage: string): void {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('set-room-background', { backgroundImage });
  }

  async restoreSession(roomId: string, userId: string, username: string, token?: string): Promise<void> {
    log.debug('Attempting to restore session:', { roomId, userId });
    try {
      await this.ensureConnection();
      const pending = this.waitForRoom(roomId, SocketService.RESTORE_TIMEOUT_MS, true);
      this.socket.emit('restore-session', { roomId, userId, username, token });
      await pending;
    } catch (error) {
      log.error('Failed to restore session:', error);
      if (error instanceof SessionError) throw error;
      throw new SessionError('Не удалось подключиться к серверу', 'other');
    }
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  deleteRoom() {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('delete-room');
  }

  kickUser(userId: string) {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('kick-user', { userId });
  }

  transferRoomAdmin(userId: string) {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('transfer-room-admin', { userId });
  }

  leaveRoom() {
    if (!this.socket) return;
    this.sessionSyncRequired = false;
    this.socket.emit('leave-room');
    this.store.clearSession();
    this.store.setCurrentUser(null);
    this.store.setRoom(null);
  }
}
