import { computed, IComputedValue, makeAutoObservable, runInAction } from 'mobx';
import {
  Card,
  CardComment,
  CardReaction,
  ColumnColorId,
  ColumnKind,
  DEFAULT_COLUMN_COLORS,
  DEFAULT_COLUMN_TITLES,
  DEFAULT_ROOM_FEATURES,
  Mood,
  Phase,
  PhaseTimerState,
  RetroTemplate,
  RetroTemplateId,
  Room,
  RoomFeatures,
  RoomState,
  User,
  getCardTypeByColumn,
  getColumnCount,
  getRetroTemplate,
  getTemplateColumn,
  normalizeColumnColors
} from '../types';
import { writeTabSession } from '../services/session';
import { log } from '../utils/logger';
import { BoardHost } from './hosts';

const USER_MOOD_KEY_PREFIX = 'retroUserMood:';
const VALID_MOODS: Mood[] = ['great', 'good', 'neutral', 'bad', 'awful'];
const EMPTY_COLUMN_CARDS: Card[] = [];
const IDLE_TIMER: PhaseTimerState = { durationSeconds: 0, remainingSeconds: 0, running: false };

export interface OpenRoomHints {
  authName?: string;
  socketId?: string;
}

export class RoomStore {
  room: Room | null = null;
  cards: Card[] = [];
  phase: Phase = 'creation';
  users: User[] = [];
  currentUser: User | null = null;
  voteError: { cardId: string; message: string } | null = null;
  phaseTimer: PhaseTimerState = { ...IDLE_TIMER };
  template: RetroTemplateId = 'classic';
  columnTitles: string[] = [...DEFAULT_COLUMN_TITLES];
  columnColors: ColumnColorId[] = [...DEFAULT_COLUMN_COLORS];
  roomFeatures: RoomFeatures = { ...DEFAULT_ROOM_FEATURES };
  readonly cardsPerPersonPerRoom = 100;
  readonly cardLimitMessage = 'В одной комнате можно добавить не больше 100 карточек';
  private phaseTimerTicker: number | null = null;
  private columnCardsCache = new Map<number, IComputedValue<Card[]>>();

  constructor(private readonly host: BoardHost) {
    makeAutoObservable(this, {
      host: false,
      columnCardsCache: false,
      phaseTimerTicker: false,
      cardsInColumn: false
    } as object, { autoBind: true });
  }

  get isOwner() {
    return Boolean(this.currentUser?.name && this.currentUser.name === this.room?.owner);
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  get templateConfig(): RetroTemplate {
    return getRetroTemplate(this.template);
  }

  get sortedCards() {
    return [...this.cards].sort((a, b) => {
      const scoreA = (a.likes?.length || 0) + (a.dislikes?.length || 0);
      const scoreB = (b.likes?.length || 0) + (b.dislikes?.length || 0);
      return scoreB - scoreA;
    });
  }

  get isCardLimitReached(): boolean {
    const name = this.currentUser?.name;
    if (!name) return false;
    return this.cards.filter((card) => card.createdBy === name).length >= this.cardsPerPersonPerRoom;
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

  private applyBoardColumns(templateId: RetroTemplateId | undefined, titles?: string[] | null, colors?: string[] | null) {
    const template = getRetroTemplate(templateId);
    this.template = template.id;
    const count = getColumnCount(template);
    this.columnTitles = titles?.length === count
      ? [...titles]
      : template.columns.map((column) => column.title);
    this.columnColors = normalizeColumnColors(colors, template);
  }

  private normalizeUsers(users: User[]): User[] {
    const uniqueByName = new Map<string, User>();
    users.forEach((user) => {
      uniqueByName.set(user.name, user);
    });
    return Array.from(uniqueByName.values());
  }

  private syncCurrentUser() {
    if (!this.currentUser) return;
    const syncedUser = this.users.find((user) => user.name === this.currentUser?.name);
    if (syncedUser) this.currentUser = syncedUser;
  }

  private syncPhaseTimerClock() {
    if (this.phaseTimerTicker != null) {
      window.clearInterval(this.phaseTimerTicker);
      this.phaseTimerTicker = null;
    }
    const endAt = this.phaseTimer.endAt;
    if (!this.phaseTimer.running || typeof endAt !== 'number') return;
    const tick = () => {
      const remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      runInAction(() => {
        this.phaseTimer.remainingSeconds = remainingSeconds;
        if (remainingSeconds <= 0) this.phaseTimer.running = false;
      });
      if (remainingSeconds <= 0 && this.phaseTimerTicker != null) {
        window.clearInterval(this.phaseTimerTicker);
        this.phaseTimerTicker = null;
      }
    };
    tick();
    this.phaseTimerTicker = window.setInterval(tick, 250);
  }

  setPhaseTimer(timer: PhaseTimerState) {
    this.phaseTimer = timer;
    this.syncPhaseTimerClock();
  }

  setCurrentUser(user: User | null) {
    log.debug('Setting current user:', user);
    if (user && (!this.currentUser || this.currentUser.role !== user.role)) {
      log.debug('Updating user with role:', user.role);
    }
    this.currentUser = user;
  }

  setVoteError(cardId: string, message: string) {
    this.voteError = { cardId, message };
  }

  clearVoteError() {
    this.voteError = null;
  }

  setPhase(phase: Phase) {
    this.phase = phase;
  }

  setCards(cards: Card[]) {
    log.debug('Setting cards:', cards);
    this.cards = cards;
  }

  setUsers(users: User[]) {
    this.users = this.normalizeUsers(users);
    this.syncCurrentUser();
  }

  applyState(state: RoomState) {
    this.cards = state.cards;
    this.phase = state.phase;
    this.users = this.normalizeUsers(state.users);
    this.syncCurrentUser();
  }

  addCard(card: Card) {
    log.debug('Adding card:', card);
    this.cards.push(card);
  }

  updateCard(updatedCard: Card) {
    log.debug('Updating card:', updatedCard);
    const index = this.cards.findIndex((card) => card.id === updatedCard.id);
    if (index !== -1) this.cards[index] = updatedCard;
  }

  addCardComment(cardId: string, comment: CardComment) {
    const card = this.cards.find((currentCard) => currentCard.id === cardId);
    if (card) card.comments = [...(card.comments || []), comment];
  }

  updateCardComment(cardId: string, comment: CardComment) {
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
  }

  setCardReactions(cardId: string, reactions: CardReaction[]) {
    const card = this.cards.find((currentCard) => currentCard.id === cardId);
    if (card) card.reactions = reactions;
  }

  deleteCard(cardId: string) {
    log.debug('Deleting card:', cardId);
    this.cards = this.cards.filter((card) => card.id !== cardId);
  }

  clearAllCards() {
    this.cards = [];
    this.host.persistBoardState();
  }

  moveCard(cardId: string, column: number, originColumn?: number) {
    log.debug('Moving card:', cardId, 'to column:', column);
    const card = this.cards.find((current) => current.id === cardId);
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
  }

  updateVotes(cardId: string, likes: string[], dislikes: string[]) {
    log.debug('Updating votes:', { cardId, likes, dislikes });
    const card = this.cards.find((current) => current.id === cardId);
    if (!card) return;
    card.likes = likes;
    card.dislikes = dislikes;
  }

  addUser(user: User) {
    log.debug('Adding user:', user);
    const existingIndex = this.users.findIndex(
      (currentUser) => currentUser.id === user.id || currentUser.name === user.name
    );
    if (existingIndex !== -1) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }
  }

  removeUser(userId: string) {
    log.debug('Removing user:', userId);
    this.users = this.users.filter((user) => user.id !== userId);
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

  canEditCard(card: Card): boolean {
    if (!this.roomFeatures.cardEditingEnabled) return false;
    return this.currentUser?.role === 'admin' || this.currentUser?.name === card.createdBy;
  }

  canComposeInColumn(columnIndex: number): boolean {
    const template = this.templateConfig;
    if (this.phase === 'creation') return columnIndex >= 0 && columnIndex < template.columns.length;
    if (this.phase === 'roadmap') return columnIndex === template.columns.length;
    return false;
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

  canChangePhase(): boolean {
    if (!this.currentUser?.name) return false;
    return this.currentUser.role === 'admin' || this.room?.owner === this.currentUser.name;
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
    this.columnTitles = titles;
    if (this.room) this.room = { ...this.room, columnTitles: titles };
  }

  requestColumnTitlesUpdate(titles: string[]) {
    this.setColumnTitles(titles);
    this.host.commands()?.setColumnTitles(titles);
  }

  getColumnColor(index: number): ColumnColorId {
    if (index < this.templateConfig.columns.length) {
      return this.columnColors[index] ?? this.templateConfig.columns[index].color;
    }
    return getTemplateColumn(this.templateConfig, index)?.color ?? 'none';
  }

  setColumnColors(colors: ColumnColorId[]) {
    this.columnColors = normalizeColumnColors(colors, this.templateConfig);
    if (this.room) this.room = { ...this.room, columnColors: [...this.columnColors] };
  }

  requestColumnColorsUpdate(colors: ColumnColorId[]) {
    this.setColumnColors(colors);
    this.host.commands()?.setColumnColors(this.columnColors);
  }

  setRoomFeatures(features: Partial<RoomFeatures>) {
    const next: RoomFeatures = { ...DEFAULT_ROOM_FEATURES, ...this.roomFeatures, ...features };
    if (typeof features.backgroundImage === 'undefined') {
      next.backgroundImage = this.roomFeatures.backgroundImage;
    }
    this.roomFeatures = next;
    if (this.room) this.room = { ...this.room, features: { ...next } };
  }

  setRoomBackground(backgroundImage: string) {
    this.setRoomFeatures({ backgroundImage: backgroundImage || '' });
  }

  requestRoomFeaturesUpdate(features: RoomFeatures) {
    if (!this.isAdmin) return;
    this.setRoomFeatures(features);
    this.host.commands()?.setRoomFeatures(features);
  }

  requestRoomBackgroundUpdate(backgroundImage: string) {
    if (!this.isAdmin) return;
    this.setRoomBackground(backgroundImage);
    this.host.commands()?.setRoomBackground(backgroundImage);
  }

  getUserReadyCount(): number {
    return this.users.filter((user) => user.isReady).length;
  }

  getTotalUserCount(): number {
    return this.users.length;
  }

  isCurrentUserReady(): boolean {
    return this.currentUser?.isReady || false;
  }

  updateUserReadyState(isReady: boolean) {
    if (this.currentUser) this.currentUser = { ...this.currentUser, isReady };
    const currentName = this.currentUser?.name;
    if (currentName) {
      this.users = this.users.map((user) => (
        user.name === currentName ? { ...user, isReady } : user
      ));
    }
    this.host.persistBoardState();
    const commands = this.host.commands();
    if (commands) {
      log.debug('Updating user ready state:', isReady);
      void commands.updateReadyState(isReady);
    }
  }

  getSavedUserMood(roomId: string, username: string): Mood | null {
    const raw = localStorage.getItem(`${USER_MOOD_KEY_PREFIX}${roomId}:${username}`);
    return VALID_MOODS.includes(raw as Mood) ? (raw as Mood) : null;
  }

  saveUserMood(roomId: string, username: string, mood: Mood) {
    localStorage.setItem(`${USER_MOOD_KEY_PREFIX}${roomId}:${username}`, mood);
  }

  openRoom(room: Room, hints: OpenRoomHints): boolean {
    const previousRoomId = this.room?.id;
    this.room = room;
    this.applyBoardColumns(room.template, room.columnTitles, room.columnColors);
    if (this.room) this.room = { ...this.room, template: this.template };
    this.roomFeatures = room.features
      ? { ...DEFAULT_ROOM_FEATURES, ...room.features }
      : { ...DEFAULT_ROOM_FEATURES };
    const foundUser = (this.currentUser && room.users.find((user) => user.id === this.currentUser?.id))
      || (hints.authName ? room.users.find((user) => user.name === hints.authName) : undefined)
      || room.users.find((user) => user.id === hints.socketId);
    if (foundUser) {
      this.currentUser = foundUser;
      writeTabSession({ userId: foundUser.id, roomId: room.id, username: foundUser.name });
    }
    return Boolean(previousRoomId && previousRoomId !== room.id);
  }

  hydrate(snapshot: {
    room: Room;
    phase?: Phase;
    cards?: Card[];
    users?: User[];
    columnTitles?: string[];
    columnColors?: string[] | null;
    template?: RetroTemplateId;
    roomFeatures?: RoomFeatures;
    currentUser: User | null;
  }) {
    this.room = snapshot.room;
    this.phase = snapshot.phase ?? 'creation';
    this.cards = snapshot.cards ?? [];
    this.users = this.normalizeUsers(snapshot.users ?? []);
    this.applyBoardColumns(snapshot.template ?? snapshot.room.template, snapshot.columnTitles, snapshot.columnColors);
    this.roomFeatures = snapshot.roomFeatures
      ? { ...DEFAULT_ROOM_FEATURES, ...snapshot.roomFeatures }
      : { ...DEFAULT_ROOM_FEATURES };
    this.currentUser = snapshot.currentUser;
  }

  closeRoom() {
    this.currentUser = null;
    this.voteError = null;
    this.phaseTimer = { ...IDLE_TIMER };
    this.syncPhaseTimerClock();
    this.template = 'classic';
    this.columnTitles = [...DEFAULT_COLUMN_TITLES];
    this.columnColors = [...DEFAULT_COLUMN_COLORS];
    this.roomFeatures = { ...DEFAULT_ROOM_FEATURES };
    this.room = null;
  }
}
