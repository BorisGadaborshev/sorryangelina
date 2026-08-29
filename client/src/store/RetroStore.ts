import { makeAutoObservable, runInAction } from 'mobx';
import { AuthProfile, Card, CardComment, CardReaction, ChatMessage, ColumnColorId, DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_TITLES, DEFAULT_ROOM_FEATURES, DiscussionNavigationState, FacilitatorAnnouncement, LETS_DO_COLUMN_INDEX, Mood, Phase, PhaseTimerState, RetroRatingState, Room, RoomFeatures, RoomState, SprintVipState, Team, User, WhiteboardStroke, normalizeColumnColors } from '../types';
import { Socket } from 'socket.io-client';
import { SocketService } from '../services/socket';

const BOARD_STATE_KEY = 'retroBoardState';
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
  roomFeatures: RoomFeatures;
  currentUser: User | null;
}

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
  voteError: { cardId: string; message: string } | null = null;
  phaseTimer: PhaseTimerState = { durationSeconds: 0, remainingSeconds: 0, running: false };
  chatMessages: ChatMessage[] = [];
  whiteboardStrokes: WhiteboardStroke[] = [];
  facilitatorAnnouncement: FacilitatorAnnouncement | null = null;
  isFacilitatorDialogOpen = false;
  discussionNavigation: DiscussionNavigationState | null = null;
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

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    this.socketService = new SocketService(this);
    this.tryRestoreAuth();
    this.tryRestoreSelectedTeam();
    this.tryRestoreBoardState();
    this.tryRestoreSession();

    window.addEventListener('beforeunload', () => {
      if (this.currentUser && this.room) {
        this.saveSession(this.currentUser.id, this.room.id, this.currentUser.name);
        this.persistBoardState();
      }
    });
  }

  get hasBoardSession(): boolean {
    if (this.room) return true;
    if (!this.authProfile) return false;
    return Boolean(localStorage.getItem('roomId') && localStorage.getItem('username'));
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

  persistBoardState() {
    const roomId = this.room?.id ?? localStorage.getItem('roomId');
    if (!roomId || !this.room) return;

    const snapshot: PersistedBoardState = {
      roomId,
      room: this.room,
      phase: this.phase,
      cards: this.cards,
      users: this.users,
      columnTitles: this.columnTitles,
      columnColors: this.columnColors,
      roomFeatures: this.roomFeatures,
      currentUser: this.currentUser,
    };

    sessionStorage.setItem(BOARD_STATE_KEY, JSON.stringify(snapshot));
    try {
      localStorage.setItem(BOARD_STATE_KEY, JSON.stringify(snapshot));
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
    const roomId = localStorage.getItem('roomId');
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
        this.columnTitles = parsed.columnTitles?.length === DEFAULT_COLUMN_TITLES.length
          ? [...parsed.columnTitles]
          : [...DEFAULT_COLUMN_TITLES];
        this.columnColors = normalizeColumnColors(parsed.columnColors);
        this.roomFeatures = parsed.roomFeatures
          ? { ...DEFAULT_ROOM_FEATURES, ...parsed.roomFeatures }
          : { ...DEFAULT_ROOM_FEATURES };
        this.currentUser = parsed.currentUser;
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
    localStorage.setItem('userId', userId);
    localStorage.setItem('roomId', roomId);
    localStorage.setItem('username', username);
  }

  clearSession() {
    localStorage.removeItem('userId');
    localStorage.removeItem('roomId');
    localStorage.removeItem('username');
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

  private async tryRestoreSession() {
    const userId = localStorage.getItem('userId');
    const roomId = localStorage.getItem('roomId');
    const username = localStorage.getItem('username');

    if (userId && roomId && username && this.socketService) {
      const hasCachedBoard = this.canRenderBoard;
      try {
        if (!hasCachedBoard) {
          this.setReconnecting(true);
        }
        console.log('Attempting to restore session with:', { userId, roomId, username });
        await this.socketService.restoreSession(roomId, userId, username, this.authProfile?.token);
        this.setReconnecting(false);
      } catch (error) {
        console.error('Failed to restore session:', error);
        if (!this.room) {
          this.clearSession();
          this.setReconnecting(false);
        }
      }
    }
  }

  setSocket(socket: Socket) {
    console.log('Setting socket:', socket.id);
    runInAction(() => {
      this.socket = socket;
    });
  }

  setError(error: string | null) {
    console.log('Setting error:', error);
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

      const roomId = this.room?.id ?? localStorage.getItem('roomId');
      const alreadySeen = roomId
        ? this.getSeenFacilitatorSelectedAt(roomId) === announcement.selectedAt
        : false;
      this.isFacilitatorDialogOpen = !alreadySeen;
    });
  }

  dismissFacilitatorDialog() {
    const announcement = this.facilitatorAnnouncement;
    const roomId = this.room?.id ?? localStorage.getItem('roomId');
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
    console.log('Setting current user:', user);
    runInAction(() => {
      if (user && (!this.currentUser || this.currentUser.role !== user.role)) {
        console.log('Updating user with role:', user.role);
      }
      this.currentUser = user;
    });
  }

  setRoom(room: Room | null) {
    console.log('Setting room:', room);
    runInAction(() => {
      this.room = room;
      if (room) {
        if (room.columnTitles?.length === DEFAULT_COLUMN_TITLES.length) {
          this.columnTitles = [...room.columnTitles];
        } else {
          this.columnTitles = [...DEFAULT_COLUMN_TITLES];
        }
        this.columnColors = normalizeColumnColors(room.columnColors);
        this.roomFeatures = room.features
          ? { ...DEFAULT_ROOM_FEATURES, ...room.features }
          : { ...DEFAULT_ROOM_FEATURES };
        const savedUsername = localStorage.getItem('username');
        console.log('Current users in room:', room.users.map(u => ({ name: u.name, role: u.role })));
        
        if (savedUsername) {
          // Находим пользователя по имени и сохраняем его полностью (включая роль)
          const foundUser = room.users.find(u => u.name === savedUsername);
          if (foundUser) {
            console.log('Found user by saved username:', { name: foundUser.name, role: foundUser.role });
            this.currentUser = foundUser;
            // Сохраняем текущую сессию
            this.saveSession(foundUser.id, room.id, foundUser.name);
            console.log('Restored user session:', this.currentUser);
          }
        }

        // Если не нашли по сохраненным данным, это новое подключение
        if (!this.currentUser) {
          const foundUser = room.users.find(u => u.id === this.socket?.id);
          if (foundUser) {
            console.log('Found user by socket ID:', { name: foundUser.name, role: foundUser.role });
            this.currentUser = foundUser;
            this.saveSession(foundUser.id, room.id, foundUser.name);
            console.log('New connection, saved session for:', this.currentUser);
          }
        }
        this.persistBoardState();
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
        this.columnTitles = [...DEFAULT_COLUMN_TITLES];
        this.columnColors = [...DEFAULT_COLUMN_COLORS];
        this.roomFeatures = { ...DEFAULT_ROOM_FEATURES };
        this.sprintVip = { voteCount: 0 };
        this.retroRating = { hasVoted: false, votesCount: 0, totalCount: 0, resultsVisible: false };
        this.isReconnecting = false;
        console.log('Cleared room and session');
      }
    });
  }

  setPhase(phase: Phase) {
    console.log('Setting phase:', phase);
    runInAction(() => {
      this.phase = phase;
      if (phase !== 'discussion') {
        this.discussionNavigation = null;
        this.facilitatorAnnouncement = null;
        this.isFacilitatorDialogOpen = false;
      }
    });
  }

  setCards(cards: Card[]) {
    console.log('Setting cards:', cards);
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
    console.log('Updating state:', state);
    runInAction(() => {
      this.cards = state.cards;
      this.phase = state.phase;
      if (state.phase !== 'discussion') {
        this.discussionNavigation = null;
        this.facilitatorAnnouncement = null;
        this.isFacilitatorDialogOpen = false;
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
    console.log('Adding card:', card);
    runInAction(() => {
      this.cards.push(card);
    });
  }

  updateCard(updatedCard: Card) {
    console.log('Updating card:', updatedCard);
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

  setCardReactions(cardId: string, reactions: CardReaction[]) {
    runInAction(() => {
      const card = this.cards.find((currentCard) => currentCard.id === cardId);
      if (card) {
        card.reactions = reactions;
      }
    });
  }

  deleteCard(cardId: string) {
    console.log('Deleting card:', cardId);
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

  moveCard(cardId: string, column: number) {
    console.log('Moving card:', cardId, 'to column:', column);
    runInAction(() => {
      const card = this.cards.find(c => c.id === cardId);
      if (card) {
        card.column = column;
        card.type = column === 1 ? 'disliked' : column === 2 ? 'suggestion' : 'liked';
      }
    });
  }

  updateVotes(cardId: string, likes: string[], dislikes: string[]) {
    console.log('Updating votes:', { cardId, likes, dislikes });
    runInAction(() => {
      const card = this.cards.find(c => c.id === cardId);
      if (card) {
        card.likes = likes;
        card.dislikes = dislikes;
      }
    });
  }

  addUser(user: User) {
    console.log('Adding user:', user);
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
    console.log('Removing user:', userId);
    runInAction(() => {
      this.users = this.users.filter(u => u.id !== userId);
    });
  }

  get isOwner() {
    return this.currentUser?.id === this.room?.owner;
  }

  get sortedCards() {
    return [...this.cards].sort((a, b) => {
      const scoreA = (a.likes?.length || 0) - (a.dislikes?.length || 0);
      const scoreB = (b.likes?.length || 0) - (b.dislikes?.length || 0);
      return scoreB - scoreA;
    });
  }

  get isAdmin(): boolean {
    const isAdmin = this.currentUser?.role === 'admin';
    console.log('Checking isAdmin:', { 
      currentUser: this.currentUser?.name,
      role: this.currentUser?.role,
      isAdmin 
    });
    return isAdmin;
  }

  canEditCard(card: Card): boolean {
    if (!this.roomFeatures.cardEditingEnabled) return false;
    return this.currentUser?.role === 'admin' || this.currentUser?.name === card.createdBy;
  }

  canAddCards(columnIndex: number): boolean {
    if (this.currentUser?.role === 'admin') return true;
    if (columnIndex !== LETS_DO_COLUMN_INDEX) return true;
    return this.roomFeatures.membersCanAddCards;
  }

  isCardTextHidden(card: Card): boolean {
    if (!this.roomFeatures.hideCardTextDuringCreation) return false;
    if (this.phase !== 'creation') return false;
    if (this.currentUser?.role === 'admin') return false;
    if (this.currentUser?.name === card.createdBy) return false;
    if (card.column === LETS_DO_COLUMN_INDEX) return false;
    return true;
  }

  canUseCardSocial(card: Card): boolean {
    if (this.phase === 'rating') return false;
    if (!this.roomFeatures.reactionsEnabled && !this.roomFeatures.commentsEnabled) return false;
    if (card.column === LETS_DO_COLUMN_INDEX) return true;
    return !this.isCardTextHidden(card);
  }

  canMoveCard(card: Card): boolean {
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
    return this.columnTitles[index] ?? DEFAULT_COLUMN_TITLES[index];
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
    return this.columnColors[index] ?? DEFAULT_COLUMN_COLORS[index];
  }

  setColumnColors(colors: ColumnColorId[]) {
    runInAction(() => {
      this.columnColors = normalizeColumnColors(colors);
      if (this.room) {
        this.room = { ...this.room, columnColors: [...this.columnColors] };
      }
    });
  }

  requestColumnColorsUpdate(colors: ColumnColorId[]) {
    this.setColumnColors(colors);
    this.socketService?.setColumnColors(this.columnColors);
  }

  setRoomFeatures(features: RoomFeatures) {
    runInAction(() => {
      this.roomFeatures = { ...DEFAULT_ROOM_FEATURES, ...features };
      if (this.room) {
        this.room = { ...this.room, features: { ...DEFAULT_ROOM_FEATURES, ...features } };
      }
    });
  }

  requestRoomFeaturesUpdate(features: RoomFeatures) {
    if (!this.isAdmin) return;
    this.setRoomFeatures(features);
    this.socketService?.setRoomFeatures(features);
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
      console.log('Updating user ready state:', isReady);
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