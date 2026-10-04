import { computed, IComputedValue, makeAutoObservable, runInAction } from 'mobx';
import { ArkanoidScoreEntry, AuthProfile, Card, CardComment, CardReaction, ChatMessage, ColumnColorId, ColumnKind, DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_TITLES, DEFAULT_ROOM_FEATURES, DiscussionBurst, DiscussionHand, DiscussionNavigationState, FacilitatorAnnouncement, Mood, Phase, PhaseTimerState, RetroRatingState, RetroTemplate, RetroTemplateId, Room, RoomFeatures, RoomState, SprintVipState, Team, User, WhiteboardStroke, getCardTypeByColumn, getColumnCount, getRetroTemplate, getTemplateColumn, normalizeColumnColors } from '../types';
import { Socket } from 'socket.io-client';
import { SocketService } from '../services/socket';
import { clearStoredSession, readStoredSession, writeTabSession } from '../services/session';
import { log } from '../utils/logger';

const BOARD_STATE_KEY = 'retroBoardState';
const ARKANOID_STATS_KEY_PREFIX = 'arkanoidBest:';
export const ARKANOID_HITS_TO_BREAK = 3;
export const ARKANOID_POINTS_PER_HIT = 10;
const USER_MOOD_KEY_PREFIX = 'retroUserMood:';
const FACILITATOR_SEEN_KEY_PREFIX = 'facilitatorSeen:';
const VALID_MOODS: Mood[] = ['great', 'good', 'neutral', 'bad', 'awful'];

interface PersistedBoardState {
  roomId: string;
  room: Room;
  phase: Phase;
  cards: Card[];
  users: User[];
  columnTitles: string[];
  columnColors: ColumnColorId[];
  template?: RetroTemplateId;
  roomFeatures: RoomFeatures;
  currentUser: User | null;
}

export type ConnectionStatus = 'online' | 'reconnecting' | 'offline';

const EMPTY_COLUMN_CARDS: Card[] = [];

export class RetroStore {
  socket: Socket | null = null;
  socketService: SocketService | null = null;
  currentUser: User | null = null;
  authProfile: AuthProfile | null = null;
  selectedTeam: Team | null = null;
  room: Room | null = null;
  cards: Card[] = [];
  phase: Phase = 'creation';
  users: User[] = [];
  error: string | null = null;
  isReconnecting = false;
  connectionStatus: ConnectionStatus = 'online';
  rejoinRequired = false;
  voteError: { cardId: string; message: string } | null = null;
  phaseTimer: PhaseTimerState = { durationSeconds: 0, remainingSeconds: 0, running: false };
  chatMessages: ChatMessage[] = [];
  whiteboardStrokes: WhiteboardStroke[] = [];
  facilitatorAnnouncement: FacilitatorAnnouncement | null = null;
  isFacilitatorDialogOpen = false;
  discussionNavigation: DiscussionNavigationState | null = null;
  discussionHands: string[] = [];
  discussionBursts: DiscussionBurst[] = [];
  template: RetroTemplateId = 'classic';
  columnTitles: string[] = [...DEFAULT_COLUMN_TITLES];
  columnColors: ColumnColorId[] = [...DEFAULT_COLUMN_COLORS];
  roomFeatures: RoomFeatures = { ...DEFAULT_ROOM_FEATURES };
  sprintVip: SprintVipState = { voteCount: 0 };
  retroRating: RetroRatingState = {
    hasVoted: false,
    votesCount: 0,
    totalCount: 0,
    resultsVisible: false
  };
  arkanoidActive = false;
  arkanoidHits = new Map<string, number>();
  arkanoidScore = 0;
  arkanoidCardsBroken = 0;
  arkanoidBestScore = 0;
  arkanoidBestCardsBroken = 0;
  arkanoidHasPlayed = false;
  arkanoidScores: ArkanoidScoreEntry[] = [];
  private arkanoidStatsKey: string | null = null;
  private boardPersistTimer: number | null = null;
  private columnCardsCache = new Map<number, IComputedValue<Card[]>>();

  constructor() {
    makeAutoObservable(this, {
      columnCardsCache: false,
      boardPersistTimer: false,
      cardsInColumn: false
    } as object, { autoBind: true });
    this.tryRestoreAuth();
    this.tryRestoreSelectedTeam();
    this.tryRestoreBoardState();
    this.socketService = new SocketService(this);

    window.addEventListener('beforeunload', () => {
      if (this.currentUser && this.room) {
        this.saveSession(this.currentUser.id, this.room.id, this.currentUser.name);
        this.flushBoardState();
      }
    });
  }

  get hasBoardSession(): boolean {
    if (this.room) return true;
    if (!this.authProfile) return false;
    return Boolean(readStoredSession());
  }

  get canRenderBoard(): boolean {
    return Boolean(this.room && this.currentUser);
  }

  get hasCachedBoardState(): boolean {
    return Boolean(
      sessionStorage.getItem(BOARD_STATE_KEY) || localStorage.getItem(BOARD_STATE_KEY)
    );
  }

  setReconnecting(value: boolean) {
    runInAction(() => {
      this.isReconnecting = value;
    });
  }

  setConnectionStatus(status: ConnectionStatus) {
    runInAction(() => {
      this.connectionStatus = status;
    });
  }

  setRejoinRequired(value: boolean) {
    runInAction(() => {
      this.rejoinRequired = value;
    });
  }

  persistBoardState() {
    if (this.boardPersistTimer != null) return;
    this.boardPersistTimer = window.setTimeout(() => {
      this.boardPersistTimer = null;
      this.flushBoardState();
    }, 1500);
  }

  flushBoardState() {
    if (this.boardPersistTimer != null) {
      window.clearTimeout(this.boardPersistTimer);
      this.boardPersistTimer = null;
    }
    const roomId = this.room?.id ?? readStoredSession()?.roomId;
    if (!roomId || !this.room) return;

    const snapshot: PersistedBoardState = {
      roomId,
      room: this.room,
      phase: this.phase,
      cards: this.cards.map((card) => (
        card.imageUrl?.startsWith('data:') ? { ...card, imageUrl: undefined } : card
      )),
      users: this.users,
      columnTitles: this.columnTitles,
      columnColors: this.columnColors,
      template: this.template,
      roomFeatures: {
        ...this.roomFeatures,
        backgroundImage: this.roomFeatures.backgroundImage?.startsWith('data:') ? '' : this.roomFeatures.backgroundImage
      },
      currentUser: this.currentUser,
    };

    const serialized = JSON.stringify(snapshot);
    sessionStorage.setItem(BOARD_STATE_KEY, serialized);
    try {
      localStorage.setItem(BOARD_STATE_KEY, serialized);
    } catch {
      // Ignore quota errors for large boards.
    }
  }

  hydrateBoardFromCache(): boolean {
    if (this.room) {
      return this.canRenderBoard;
    }
    this.tryRestoreBoardState();
    return this.canRenderBoard;
  }

  private tryRestoreBoardState() {
    const roomId = readStoredSession()?.roomId ?? null;
    const raw = sessionStorage.getItem(BOARD_STATE_KEY) ?? localStorage.getItem(BOARD_STATE_KEY);
    if (!roomId || !raw || this.room) return;

    try {
      const parsed = JSON.parse(raw) as PersistedBoardState;
      if (parsed.roomId !== roomId || !parsed.room) return;

      runInAction(() => {
        this.room = parsed.room;
        this.phase = parsed.phase ?? 'creation';
        this.cards = parsed.cards ?? [];
        this.users = this.normalizeUsers(parsed.users ?? []);
        this.applyBoardColumns(parsed.template ?? parsed.room.template, parsed.columnTitles, parsed.columnColors);
        this.roomFeatures = parsed.roomFeatures
          ? { ...DEFAULT_ROOM_FEATURES, ...parsed.roomFeatures }
          : { ...DEFAULT_ROOM_FEATURES };
        this.currentUser = parsed.currentUser;
        this.ensureArkanoidStats();
      });
    } catch {
      sessionStorage.removeItem(BOARD_STATE_KEY);
      localStorage.removeItem(BOARD_STATE_KEY);
    }
  }

  private clearBoardState() {
    sessionStorage.removeItem(BOARD_STATE_KEY);
    localStorage.removeItem(BOARD_STATE_KEY);
  }

  private saveSession(userId: string, roomId: string, username: string) {
    writeTabSession({ userId, roomId, username });
  }

  clearSession() {
    clearStoredSession();
    this.clearBoardState();
  }

  private userMoodStorageKey(roomId: string, username: string): string {
    return `${USER_MOOD_KEY_PREFIX}${roomId}:${username}`;
  }

  private facilitatorSeenStorageKey(roomId: string): string {
    return `${FACILITATOR_SEEN_KEY_PREFIX}${roomId}`;
  }

  private getSeenFacilitatorSelectedAt(roomId: string): number | null {
    const raw = localStorage.getItem(this.facilitatorSeenStorageKey(roomId));
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  private markFacilitatorSeen(roomId: string, selectedAt: number) {
    localStorage.setItem(this.facilitatorSeenStorageKey(roomId), String(selectedAt));
  }

  getSavedUserMood(roomId: string, username: string): Mood | null {
    const raw = localStorage.getItem(this.userMoodStorageKey(roomId, username));
    return VALID_MOODS.includes(raw as Mood) ? (raw as Mood) : null;
  }

  saveUserMood(roomId: string, username: string, mood: Mood) {
    localStorage.setItem(this.userMoodStorageKey(roomId, username), mood);
  }

  private saveAuth(profile: AuthProfile) {
    localStorage.setItem('authProfile', JSON.stringify(profile));
  }

  private tryRestoreAuth() {
    const raw = localStorage.getItem('authProfile');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as AuthProfile;
      if (parsed?.name && parsed?.type && parsed?.token && parsed?.expiresAt) {
        if (parsed.expiresAt <= Date.now()) {
          localStorage.removeItem('authProfile');
          return;
        }
        this.authProfile = parsed;
      }
    } catch (error) {
      localStorage.removeItem('authProfile');
    }
  }

  private tryRestoreSelectedTeam() {
    const raw = localStorage.getItem('selectedTeam');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Team;
      if (parsed?.id && parsed?.name) {
        this.selectedTeam = parsed;
      }
    } catch (error) {
      localStorage.removeItem('selectedTeam');
    }
  }

  setSocket(socket: Socket) {
    log.debug('Setting socket:', socket.id);
    runInAction(() => {
      this.socket = socket;
    });
  }

  setError(error: string | null) {
    log.debug('Setting error:', error);
    runInAction(() => {
      this.error = error;
    });
  }

  setVoteError(cardId: string, message: string) {
    runInAction(() => {
      this.voteError = { cardId, message };
    });
  }

  clearVoteError() {
    runInAction(() => {
      this.voteError = null;
    });
  }

  setPhaseTimer(timer: PhaseTimerState) {
    runInAction(() => {
      this.phaseTimer = timer;
    });
  }

  setChatHistory(messages: ChatMessage[]) {
    runInAction(() => {
      this.chatMessages = messages;
    });
  }

  addChatMessage(message: ChatMessage) {
    runInAction(() => {
      this.chatMessages.push(message);
      if (this.chatMessages.length > 200) {
        this.chatMessages = this.chatMessages.slice(-200);
      }
    });
  }

  setWhiteboardHistory(strokes: WhiteboardStroke[]) {
    runInAction(() => {
      this.whiteboardStrokes = strokes;
    });
  }

  addWhiteboardStroke(stroke: WhiteboardStroke) {
    runInAction(() => {
      if (this.whiteboardStrokes.some((current) => current.id === stroke.id)) {
        return;
      }
      this.whiteboardStrokes.push(stroke);
      if (this.whiteboardStrokes.length > 5000) {
        this.whiteboardStrokes = this.whiteboardStrokes.slice(-5000);
      }
    });
  }

  clearWhiteboard() {
    runInAction(() => {
      this.whiteboardStrokes = [];
    });
  }

  setRetroRating(rating: RetroRatingState) {
    runInAction(() => {
      this.retroRating = rating;
    });
  }

  setFacilitatorAnnouncement(announcement: FacilitatorAnnouncement | null) {
    runInAction(() => {
      this.facilitatorAnnouncement = announcement;
      if (!announcement) {
        this.isFacilitatorDialogOpen = false;
        return;
      }

      const roomId = this.room?.id ?? readStoredSession()?.roomId;
      const alreadySeen = roomId
        ? this.getSeenFacilitatorSelectedAt(roomId) === announcement.selectedAt
        : false;
      this.isFacilitatorDialogOpen = !alreadySeen;
    });
  }

  dismissFacilitatorDialog() {
    const announcement = this.facilitatorAnnouncement;
    const roomId = this.room?.id ?? readStoredSession()?.roomId;
    if (announcement && roomId) {
      this.markFacilitatorSeen(roomId, announcement.selectedAt);
    }
    runInAction(() => {
      this.isFacilitatorDialogOpen = false;
    });
  }

  setDiscussionNavigation(state: DiscussionNavigationState | null) {
    runInAction(() => {
      this.discussionNavigation = state;
    });
  }

  setDiscussionHands(hands: DiscussionHand[]) {
    runInAction(() => {
      this.discussionHands = hands
        .map((hand) => hand.userName?.trim())
        .filter((name): name is string => Boolean(name));
    });
  }

  addDiscussionBurst(burst: DiscussionBurst) {
    if (!burst?.id || !burst.emoji) return;
    runInAction(() => {
      this.discussionBursts = [...this.discussionBursts, burst].slice(-40);
    });
  }

  setSprintVip(state: SprintVipState) {
    runInAction(() => {
      this.sprintVip = state;
    });
  }

  setAuthProfile(profile: AuthProfile | null) {
    runInAction(() => {
      this.authProfile = profile;
      if (profile) {
        this.saveAuth(profile);
      } else {
        localStorage.removeItem('authProfile');
      }
    });
  }

  clearAuthProfile() {
    this.setRejoinRequired(false);
    this.setAuthProfile(null);
    this.setSelectedTeam(null);
    this.setRoom(null);
    this.setError(null);
  }

  setSelectedTeam(team: Team | null) {
    runInAction(() => {
      this.selectedTeam = team;
      if (team) {
        localStorage.setItem('selectedTeam', JSON.stringify(team));
      } else {
        localStorage.removeItem('selectedTeam');
      }
    });
  }

  setCurrentUser(user: User | null) {
    log.debug('Setting current user:', user);
    runInAction(() => {
      if (user && (!this.currentUser || this.currentUser.role !== user.role)) {
        log.debug('Updating user with role:', user.role);
      }
      this.currentUser = user;
    });
  }

  setRoom(room: Room | null) {
    log.debug('Setting room:', room);
    const previousRoomId = this.room?.id;
    runInAction(() => {
      this.room = room;
      if (room) {
        this.discussionHands = [];
        this.discussionBursts = [];
        this.applyBoardColumns(room.template, room.columnTitles, room.columnColors);
        if (this.room) {
          this.room = { ...this.room, template: this.template };
        }
        this.roomFeatures = room.features
          ? { ...DEFAULT_ROOM_FEATURES, ...room.features }
          : { ...DEFAULT_ROOM_FEATURES };
        const authName = this.authProfile?.name;
        const foundUser = (this.currentUser && room.users.find((user) => user.id === this.currentUser?.id))
          || (authName ? room.users.find((user) => user.name === authName) : undefined)
          || room.users.find((user) => user.id === this.socket?.id);
        if (foundUser) {
          this.currentUser = foundUser;
          this.saveSession(foundUser.id, room.id, foundUser.name);
        }
        this.persistBoardState();
        if (previousRoomId && previousRoomId !== room.id) {
          this.arkanoidStatsKey = null;
          this.arkanoidActive = false;
          this.arkanoidHits.clear();
          this.arkanoidScore = 0;
          this.arkanoidCardsBroken = 0;
          this.arkanoidBestScore = 0;
          this.arkanoidBestCardsBroken = 0;
          this.arkanoidHasPlayed = false;
          this.arkanoidScores = [];
        }
        this.ensureArkanoidStats();
      } else {
        this.currentUser = null;
        this.clearSession();
        this.clearVoteError();
        this.phaseTimer = { durationSeconds: 0, remainingSeconds: 0, running: false };
        this.chatMessages = [];
        this.whiteboardStrokes = [];
        this.facilitatorAnnouncement = null;
        this.isFacilitatorDialogOpen = false;
        this.discussionNavigation = null;
        this.discussionHands = [];
        this.discussionBursts = [];
        this.template = 'classic';
        this.columnTitles = [...DEFAULT_COLUMN_TITLES];
        this.columnColors = [...DEFAULT_COLUMN_COLORS];
        this.roomFeatures = { ...DEFAULT_ROOM_FEATURES };
        this.sprintVip = { voteCount: 0 };
        this.retroRating = { hasVoted: false, votesCount: 0, totalCount: 0, resultsVisible: false };
        this.arkanoidStatsKey = null;
        this.arkanoidActive = false;
        this.arkanoidHits.clear();
        this.rejoinRequired = false;
        this.connectionStatus = 'online';
        this.arkanoidScore = 0;
        this.arkanoidCardsBroken = 0;
        this.arkanoidBestScore = 0;
        this.arkanoidBestCardsBroken = 0;
        this.arkanoidHasPlayed = false;
        this.arkanoidScores = [];
        this.isReconnecting = false;
        log.debug('Cleared room and session');
      }
    });
  }

  setPhase(phase: Phase) {
    log.debug('Setting phase:', phase);
    runInAction(() => {
      this.phase = phase;
      if (phase !== 'discussion') {
        this.discussionNavigation = null;
        this.facilitatorAnnouncement = null;
        this.isFacilitatorDialogOpen = false;
        this.discussionHands = [];
        this.discussionBursts = [];
      }
    });
  }

  setCards(cards: Card[]) {
    log.debug('Setting cards:', cards);
    runInAction(() => {
      this.cards = cards;
    });
  }

  setUsers(users: User[]) {
    runInAction(() => {
      this.users = this.normalizeUsers(users);
      if (this.currentUser) {
        const syncedUser = this.users.find((user) => user.name === this.currentUser?.name);
        if (syncedUser) {
          this.currentUser = syncedUser;
        }
      }
    });
  }

  updateState(state: RoomState) {
    log.debug('Updating state:', state);
    runInAction(() => {
      this.cards = state.cards;
      this.phase = state.phase;
      if (state.phase !== 'discussion') {
        this.discussionNavigation = null;
        this.facilitatorAnnouncement = null;
        this.isFacilitatorDialogOpen = false;
        this.discussionHands = [];
        this.discussionBursts = [];
      }
      this.users = this.normalizeUsers(state.users);
      if (this.currentUser) {
        const syncedUser = this.users.find((user) => user.name === this.currentUser?.name);
        if (syncedUser) {
          this.currentUser = syncedUser;
        }
      }
    });
    this.persistBoardState();
  }

  addCard(card: Card) {
    log.debug('Adding card:', card);
    runInAction(() => {
      this.cards.push(card);
    });
  }

  updateCard(updatedCard: Card) {
    log.debug('Updating card:', updatedCard);
    runInAction(() => {
      const index = this.cards.findIndex(c => c.id === updatedCard.id);
      if (index !== -1) {
        this.cards[index] = updatedCard;
      }
    });
  }

  addCardComment(cardId: string, comment: CardComment) {
    runInAction(() => {
      const card = this.cards.find((currentCard) => currentCard.id === cardId);
      if (card) {
        card.comments = [...(card.comments || []), comment];
      }
    });
  }

  updateCardComment(cardId: string, comment: CardComment) {
    runInAction(() => {
      const card = this.cards.find((currentCard) => currentCard.id === cardId);
      if (!card) return;
      const comments = card.comments || [];
      const index = comments.findIndex((current) => current.id === comment.id);
      if (index === -1) {
        card.comments = [...comments, comment];
        return;
      }
      const next = comments.slice();
      next[index] = comment;
      card.comments = next;
    });
  }

  setCardReactions(cardId: string, reactions: CardReaction[]) {
    runInAction(() => {
      const card = this.cards.find((currentCard) => currentCard.id === cardId);
      if (card) {
        card.reactions = reactions;
      }
    });
  }

  deleteCard(cardId: string) {
    log.debug('Deleting card:', cardId);
    runInAction(() => {
      this.cards = this.cards.filter(c => c.id !== cardId);
    });
  }

  clearAllCards() {
    runInAction(() => {
      this.cards = [];
    });
    this.persistBoardState();
  }

  moveCard(cardId: string, column: number, originColumn?: number) {
    log.debug('Moving card:', cardId, 'to column:', column);
    runInAction(() => {
      const card = this.cards.find(c => c.id === cardId);
      if (!card) return;
      const template = this.templateConfig;
      const movingIntoRoadmap = column >= template.columns.length && card.column < template.columns.length;
      if (originColumn != null) {
        card.originColumn = originColumn;
      } else if (movingIntoRoadmap && card.originColumn == null) {
        card.originColumn = card.column;
      }
      card.column = column;
      card.type = getCardTypeByColumn(template, column);
    });
  }

  updateVotes(cardId: string, likes: string[], dislikes: string[]) {
    log.debug('Updating votes:', { cardId, likes, dislikes });
    runInAction(() => {
      const card = this.cards.find(c => c.id === cardId);
      if (card) {
        card.likes = likes;
        card.dislikes = dislikes;
      }
    });
  }

  addUser(user: User) {
    log.debug('Adding user:', user);
    runInAction(() => {
      const existingIndex = this.users.findIndex(
        (currentUser) => currentUser.id === user.id || currentUser.name === user.name
      );

      if (existingIndex !== -1) {
        this.users[existingIndex] = user;
      } else {
        this.users.push(user);
      }
    });
  }

  removeUser(userId: string) {
    log.debug('Removing user:', userId);
    runInAction(() => {
      this.users = this.users.filter(u => u.id !== userId);
    });
  }

  get isOwner() {
    return Boolean(this.currentUser?.name && this.currentUser.name === this.room?.owner);
  }

  cardsInColumn(columnIndex: number): Card[] {
    let entry = this.columnCardsCache.get(columnIndex);
    if (!entry) {
      entry = computed(() => {
        const columnCards = this.cards.filter((card) => card.column === columnIndex);
        return columnCards.length ? columnCards : EMPTY_COLUMN_CARDS;
      });
      this.columnCardsCache.set(columnIndex, entry);
    }
    return entry.get();
  }

  get sortedCards() {
    return [...this.cards].sort((a, b) => {
      const scoreA = (a.likes?.length || 0) + (a.dislikes?.length || 0);
      const scoreB = (b.likes?.length || 0) + (b.dislikes?.length || 0);
      return scoreB - scoreA;
    });
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  canEditCard(card: Card): boolean {
    if (!this.roomFeatures.cardEditingEnabled) return false;
    return this.currentUser?.role === 'admin' || this.currentUser?.name === card.createdBy;
  }

  get templateConfig(): RetroTemplate {
    return getRetroTemplate(this.template);
  }

  private applyBoardColumns(templateId: RetroTemplateId | undefined, titles?: string[] | null, colors?: string[] | null) {
    const template = getRetroTemplate(templateId);
    this.template = template.id;
    const count = getColumnCount(template);
    this.columnTitles = titles?.length === count
      ? [...titles]
      : template.columns.map((column) => column.title);
    this.columnColors = normalizeColumnColors(colors, template);
  }

  canComposeInColumn(columnIndex: number): boolean {
    const template = this.templateConfig;
    if (this.phase === 'creation') return columnIndex >= 0 && columnIndex < template.columns.length;
    if (this.phase === 'roadmap') return columnIndex === template.columns.length;
    return false;
  }

  readonly cardsPerPersonPerRoom = 100;
  readonly cardLimitMessage = 'В одной комнате можно добавить не больше 100 карточек';

  get isCardLimitReached(): boolean {
    const name = this.currentUser?.name;
    if (!name) return false;
    return this.cards.filter((card) => card.createdBy === name).length >= this.cardsPerPersonPerRoom;
  }

  canAddCards(columnIndex: number): boolean {
    if (!this.canComposeInColumn(columnIndex)) return false;
    if (this.currentUser?.role === 'admin') return true;
    const actionColumn = this.templateConfig.actionColumnIndex;
    if (actionColumn == null || columnIndex !== actionColumn) return true;
    return this.roomFeatures.membersCanAddCards;
  }

  isCardTextHidden(card: Card): boolean {
    if (!this.roomFeatures.hideCardTextDuringCreation) return false;
    if (this.phase !== 'creation') return false;
    if (this.currentUser?.role === 'admin') return false;
    if (this.currentUser?.name === card.createdBy) return false;
    const actionColumn = this.templateConfig.actionColumnIndex;
    if (actionColumn != null && card.column === actionColumn && !this.roomFeatures.membersCanAddCards) return false;
    return true;
  }

  canUseCardSocial(card: Card): boolean {
    if (this.phase === 'rating') return false;
    if (!this.roomFeatures.reactionsEnabled && !this.roomFeatures.commentsEnabled) return false;
    return !this.isCardTextHidden(card);
  }

  canMoveCard(card: Card): boolean {
    if (this.phase === 'roadmap') return true;
    if (this.currentUser?.role === 'admin') return true;
    if (!this.roomFeatures.moveCardsEnabled) return false;
    return this.currentUser?.name === card.createdBy;
  }

  get canUseCardDragDrop(): boolean {
    if (this.phase !== 'creation') return false;
    if (this.currentUser?.role === 'admin') return true;
    return this.roomFeatures.moveCardsEnabled;
  }

  get canMergeCards(): boolean {
    return (
      this.phase === 'creation' &&
      this.currentUser?.role === 'admin' &&
      this.roomFeatures.cardEditingEnabled
    );
  }

  canChangePhase(): boolean {
    if (!this.currentUser?.name) return false;
    return this.currentUser.role === 'admin' || this.room?.owner === this.currentUser.name;
  }

  get isDiscussionFacilitator(): boolean {
    if (!this.currentUser || !this.facilitatorAnnouncement) return false;
    return this.facilitatorAnnouncement.userName === this.currentUser.name;
  }

  canControlDiscussionNavigation(): boolean {
    if (!this.currentUser) return false;
    if (this.isDiscussionFacilitator) return true;
    return this.currentUser.role === 'admin' || this.room?.owner === this.currentUser.name;
  }

  canEditColumnTitles(): boolean {
    return this.canControlDiscussionNavigation();
  }

  getColumnTitle(index: number): string {
    return this.columnTitles[index] ?? getTemplateColumn(this.templateConfig, index)?.title ?? '';
  }

  getColumnHint(index: number): string | undefined {
    return getTemplateColumn(this.templateConfig, index)?.hint;
  }

  getColumnKind(index: number): ColumnKind {
    return getTemplateColumn(this.templateConfig, index)?.kind ?? 'positive';
  }

  setColumnTitles(titles: string[]) {
    runInAction(() => {
      this.columnTitles = titles;
      if (this.room) {
        this.room = { ...this.room, columnTitles: titles };
      }
    });
  }

  requestColumnTitlesUpdate(titles: string[]) {
    this.setColumnTitles(titles);
    this.socketService?.setColumnTitles(titles);
  }

  getColumnColor(index: number): ColumnColorId {
    if (index < this.templateConfig.columns.length) {
      return this.columnColors[index] ?? this.templateConfig.columns[index].color;
    }
    return getTemplateColumn(this.templateConfig, index)?.color ?? 'none';
  }

  setColumnColors(colors: ColumnColorId[]) {
    runInAction(() => {
      this.columnColors = normalizeColumnColors(colors, this.templateConfig);
      if (this.room) {
        this.room = { ...this.room, columnColors: [...this.columnColors] };
      }
    });
  }

  requestColumnColorsUpdate(colors: ColumnColorId[]) {
    this.setColumnColors(colors);
    this.socketService?.setColumnColors(this.columnColors);
  }

  setRoomFeatures(features: Partial<RoomFeatures>) {
    runInAction(() => {
      const next: RoomFeatures = { ...DEFAULT_ROOM_FEATURES, ...this.roomFeatures, ...features };
      if (typeof features.backgroundImage === 'undefined') {
        next.backgroundImage = this.roomFeatures.backgroundImage;
      }
      this.roomFeatures = next;
      if (this.room) {
        this.room = { ...this.room, features: { ...next } };
      }
    });
  }

  setRoomBackground(backgroundImage: string) {
    this.setRoomFeatures({ backgroundImage: backgroundImage || '' });
  }

  requestRoomFeaturesUpdate(features: RoomFeatures) {
    if (!this.isAdmin) return;
    this.setRoomFeatures(features);
    this.socketService?.setRoomFeatures(features);
  }

  requestRoomBackgroundUpdate(backgroundImage: string) {
    if (!this.isAdmin) return;
    this.setRoomBackground(backgroundImage);
    this.socketService?.setRoomBackground(backgroundImage);
  }

  getUserReadyCount(): number {
    return this.users.filter(user => user.isReady).length;
  }

  getTotalUserCount(): number {
    return this.users.length;
  }

  isCurrentUserReady(): boolean {
    return this.currentUser?.isReady || false;
  }

  private arkanoidStorageKey(): string | null {
    const roomId = this.room?.id;
    const name = this.currentUser?.name?.trim();
    if (!roomId || !name) return null;
    return `${roomId}:${name}`;
  }

  ensureArkanoidStats() {
    const key = this.arkanoidStorageKey();
    if (!key || this.arkanoidStatsKey === key) return;
    this.arkanoidStatsKey = key;
    try {
      const raw = localStorage.getItem(`${ARKANOID_STATS_KEY_PREFIX}${key}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { bestScore?: number; bestCardsBroken?: number };
      const savedBest = Math.max(0, Math.floor(Number(parsed.bestScore) || 0));
      if (savedBest > this.arkanoidBestScore) {
        this.arkanoidBestScore = savedBest;
        this.arkanoidBestCardsBroken = Math.max(0, Math.floor(Number(parsed.bestCardsBroken) || 0));
      }
    } catch {
      localStorage.removeItem(`${ARKANOID_STATS_KEY_PREFIX}${key}`);
    }
  }

  private persistArkanoidStats() {
    const key = this.arkanoidStorageKey();
    if (!key || this.arkanoidBestScore <= 0) return;
    this.arkanoidStatsKey = key;
    try {
      localStorage.setItem(`${ARKANOID_STATS_KEY_PREFIX}${key}`, JSON.stringify({
        bestScore: this.arkanoidBestScore,
        bestCardsBroken: this.arkanoidBestCardsBroken
      }));
    } catch {
      // Ignore quota errors.
    }
  }

  beginArkanoidRound() {
    this.ensureArkanoidStats();
    this.arkanoidActive = true;
    this.arkanoidHasPlayed = true;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
    const sharedScore = this.arkanoidBestScore > 0 ? this.arkanoidBestScore : 0;
    const sharedBroken = sharedScore > 0 ? this.arkanoidBestCardsBroken : 0;
    this.socketService?.submitArkanoidScore(sharedScore, sharedBroken);
  }

  restartArkanoidRound() {
    this.arkanoidActive = true;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
  }

  finishArkanoidRound() {
    this.arkanoidActive = false;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
  }

  recordArkanoidHit(cardId: string): number {
    const previous = this.arkanoidHits.get(cardId) || 0;
    if (previous >= ARKANOID_HITS_TO_BREAK) return previous;
    const next = previous + 1;
    this.arkanoidHits.set(cardId, next);
    this.arkanoidScore += ARKANOID_POINTS_PER_HIT;
    if (next >= ARKANOID_HITS_TO_BREAK) {
      this.arkanoidCardsBroken += 1;
    }
    if (this.arkanoidScore > this.arkanoidBestScore) {
      this.arkanoidBestScore = this.arkanoidScore;
      this.arkanoidBestCardsBroken = this.arkanoidCardsBroken;
      this.persistArkanoidStats();
    }
    this.socketService?.submitArkanoidScore(this.arkanoidScore, this.arkanoidCardsBroken);
    return next;
  }

  setArkanoidScores(scores: ArkanoidScoreEntry[]) {
    const myName = this.currentUser?.name?.trim();
    const list = Array.isArray(scores) ? scores : [];
    const mine = myName ? list.find((entry) => entry.userName.trim() === myName) : undefined;
    const localBest = this.arkanoidBestScore;
    runInAction(() => {
      this.arkanoidScores = list;
      if (mine && mine.score > this.arkanoidBestScore) {
        this.arkanoidBestScore = Math.floor(mine.score);
        this.arkanoidBestCardsBroken = Math.max(0, Math.floor(mine.cardsBroken || 0));
      }
    });
    if (mine && mine.score > localBest) {
      this.persistArkanoidStats();
      return;
    }
    if (myName && localBest > (mine?.score || 0)) {
      this.socketService?.submitArkanoidScore(localBest, this.arkanoidBestCardsBroken);
    }
  }

  updateUserReadyState(isReady: boolean) {
    runInAction(() => {
      if (this.currentUser) {
        this.currentUser = { ...this.currentUser, isReady };
      }
      const currentName = this.currentUser?.name;
      if (currentName) {
        this.users = this.users.map((user) =>
          user.name === currentName ? { ...user, isReady } : user
        );
      }
    });
    this.persistBoardState();

    if (this.socketService) {
      log.debug('Updating user ready state:', isReady);
      void this.socketService.updateReadyState(isReady);
    }
  }

  private normalizeUsers(users: User[]): User[] {
    const uniqueByName = new Map<string, User>();
    users.forEach((user) => {
      uniqueByName.set(user.name, user);
    });
    return Array.from(uniqueByName.values());
  }
} 