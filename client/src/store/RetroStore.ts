import { makeAutoObservable } from 'mobx';
import {
  AuthProfile,
  Card,
  CardComment,
  CardReaction,
  ChatMessage,
  ColumnColorId,
  DiscussionBurst,
  DiscussionHand,
  DiscussionNavigationState,
  FacilitatorAnnouncement,
  Mood,
  Phase,
  PhaseTimerState,
  RetroRatingState,
  RetroTemplateId,
  Room,
  RoomFeatures,
  RoomState,
  SprintVipState,
  Team,
  User,
  WhiteboardStroke,
  ArkanoidScoreEntry
} from '../types';
import type { AppSocket } from '../services/socket';
import { SocketService } from '../services/socket';
import { clearStoredSession, readStoredSession, writeTabSession } from '../services/session';
import { log } from '../utils/logger';
import { AuthStore } from './AuthStore';
import { DiscussionStore } from './DiscussionStore';
import { ExtrasStore } from './ExtrasStore';
import { BoardCommands } from './hosts';
import { RoomStore } from './RoomStore';

const BOARD_STATE_KEY = 'retroBoardState';

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

export { ARKANOID_HITS_TO_BREAK, ARKANOID_POINTS_PER_HIT } from './ExtrasStore';

const delegated = false;

export class RetroStore {
  readonly auth = new AuthStore();
  readonly board: RoomStore;
  readonly discussion: DiscussionStore;
  readonly extras: ExtrasStore;

  socket: AppSocket | null = null;
  socketService: SocketService | null = null;
  error: string | null = null;
  isReconnecting = false;
  connectionStatus: ConnectionStatus = 'online';
  rejoinRequired = false;
  private boardPersistTimer: number | null = null;

  constructor() {
    this.board = new RoomStore({
      persistBoardState: () => this.persistBoardState(),
      commands: () => this.commands()
    });
    this.discussion = new DiscussionStore(() => this.board.room?.id);
    this.extras = new ExtrasStore({
      roomId: () => this.board.room?.id,
      userName: () => this.board.currentUser?.name,
      submitArkanoidScore: (score, cardsBroken) => {
        this.socketService?.submitArkanoidScore(score, cardsBroken);
      }
    });
    makeAutoObservable(this, {
      auth: delegated,
      board: delegated,
      discussion: delegated,
      extras: delegated,
      boardPersistTimer: delegated,
      cardsInColumn: delegated,
      authProfile: delegated,
      selectedTeam: delegated,
      currentUser: delegated,
      room: delegated,
      cards: delegated,
      phase: delegated,
      users: delegated,
      voteError: delegated,
      phaseTimer: delegated,
      chatMessages: delegated,
      whiteboardStrokes: delegated,
      facilitatorAnnouncement: delegated,
      isFacilitatorDialogOpen: delegated,
      discussionNavigation: delegated,
      discussionHands: delegated,
      discussionBursts: delegated,
      template: delegated,
      columnTitles: delegated,
      columnColors: delegated,
      roomFeatures: delegated,
      sprintVip: delegated,
      retroRating: delegated,
      arkanoidActive: delegated,
      arkanoidHits: delegated,
      arkanoidScore: delegated,
      arkanoidCardsBroken: delegated,
      arkanoidBestScore: delegated,
      arkanoidBestCardsBroken: delegated,
      arkanoidHasPlayed: delegated,
      arkanoidScores: delegated,
      isOwner: delegated,
      sortedCards: delegated,
      isAdmin: delegated,
      templateConfig: delegated,
      isCardLimitReached: delegated,
      canUseCardDragDrop: delegated,
      canMergeCards: delegated,
      cardsPerPersonPerRoom: delegated,
      cardLimitMessage: delegated
    } as object, { autoBind: true });
    this.tryRestoreBoardState();
    this.socketService = new SocketService(this);

    window.addEventListener('beforeunload', () => {
      if (this.currentUser && this.room) {
        writeTabSession({
          userId: this.currentUser.id,
          roomId: this.room.id,
          username: this.currentUser.name
        });
        this.flushBoardState();
      }
    });
  }

  commands(): BoardCommands | null {
    return this.socketService;
  }

  get authProfile() { return this.auth.profile; }
  get selectedTeam() { return this.auth.selectedTeam; }
  get currentUser() { return this.board.currentUser; }
  get room() { return this.board.room; }
  get cards() { return this.board.cards; }
  get phase() { return this.board.phase; }
  get users() { return this.board.users; }
  get voteError() { return this.board.voteError; }
  get phaseTimer() { return this.board.phaseTimer; }
  get template() { return this.board.template; }
  get columnTitles() { return this.board.columnTitles; }
  get columnColors() { return this.board.columnColors; }
  get roomFeatures() { return this.board.roomFeatures; }
  get chatMessages() { return this.extras.chatMessages; }
  get whiteboardStrokes() { return this.extras.whiteboardStrokes; }
  get sprintVip() { return this.extras.sprintVip; }
  get retroRating() { return this.discussion.retroRating; }
  get facilitatorAnnouncement() { return this.discussion.facilitatorAnnouncement; }
  get isFacilitatorDialogOpen() { return this.discussion.isFacilitatorDialogOpen; }
  get discussionNavigation() { return this.discussion.discussionNavigation; }
  get discussionHands() { return this.discussion.discussionHands; }
  get discussionBursts() { return this.discussion.discussionBursts; }
  get arkanoidActive() { return this.extras.arkanoidActive; }
  get arkanoidHits() { return this.extras.arkanoidHits; }
  get arkanoidScore() { return this.extras.arkanoidScore; }
  get arkanoidCardsBroken() { return this.extras.arkanoidCardsBroken; }
  get arkanoidBestScore() { return this.extras.arkanoidBestScore; }
  get arkanoidBestCardsBroken() { return this.extras.arkanoidBestCardsBroken; }
  get arkanoidHasPlayed() { return this.extras.arkanoidHasPlayed; }
  get arkanoidScores() { return this.extras.arkanoidScores; }
  get isOwner() { return this.board.isOwner; }
  get sortedCards() { return this.board.sortedCards; }
  get isAdmin() { return this.board.isAdmin; }
  get templateConfig() { return this.board.templateConfig; }
  get isCardLimitReached() { return this.board.isCardLimitReached; }
  get canUseCardDragDrop() { return this.board.canUseCardDragDrop; }
  get canMergeCards() { return this.board.canMergeCards; }
  get cardsPerPersonPerRoom() { return this.board.cardsPerPersonPerRoom; }
  get cardLimitMessage() { return this.board.cardLimitMessage; }

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

  get isDiscussionFacilitator(): boolean {
    return this.discussion.isFacilitator(this.currentUser?.name);
  }

  setReconnecting(value: boolean) {
    this.isReconnecting = value;
  }

  setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
  }

  setRejoinRequired(value: boolean) {
    this.rejoinRequired = value;
  }

  setSocket(socket: AppSocket) {
    log.debug('Setting socket:', socket.id);
    this.socket = socket;
  }

  setError(error: string | null) {
    log.debug('Setting error:', error);
    this.error = error;
  }

  setAuthProfile(profile: AuthProfile | null) {
    this.auth.setProfile(profile);
  }

  setSelectedTeam(team: Team | null) {
    this.auth.setSelectedTeam(team);
  }

  clearAuthProfile() {
    this.setRejoinRequired(false);
    this.auth.clear();
    this.setRoom(null);
    this.setError(null);
  }

  setCurrentUser(user: User | null) {
    this.board.setCurrentUser(user);
  }

  setVoteError(cardId: string, message: string) {
    this.board.setVoteError(cardId, message);
  }

  clearVoteError() {
    this.board.clearVoteError();
  }

  setPhaseTimer(timer: PhaseTimerState) {
    this.board.setPhaseTimer(timer);
  }

  setChatHistory(messages: ChatMessage[]) {
    this.extras.setChatHistory(messages);
  }

  addChatMessage(message: ChatMessage) {
    this.extras.addChatMessage(message);
  }

  setWhiteboardHistory(strokes: WhiteboardStroke[]) {
    this.extras.setWhiteboardHistory(strokes);
  }

  addWhiteboardStroke(stroke: WhiteboardStroke) {
    this.extras.addWhiteboardStroke(stroke);
  }

  clearWhiteboard() {
    this.extras.clearWhiteboard();
  }

  setRetroRating(rating: RetroRatingState) {
    this.discussion.setRetroRating(rating);
  }

  setFacilitatorAnnouncement(announcement: FacilitatorAnnouncement | null) {
    this.discussion.setFacilitatorAnnouncement(announcement);
  }

  dismissFacilitatorDialog() {
    this.discussion.dismissFacilitatorDialog();
  }

  setDiscussionNavigation(state: DiscussionNavigationState | null) {
    this.discussion.setDiscussionNavigation(state);
  }

  setDiscussionHands(hands: DiscussionHand[]) {
    this.discussion.setDiscussionHands(hands);
  }

  addDiscussionBurst(burst: DiscussionBurst) {
    this.discussion.addDiscussionBurst(burst);
  }

  setSprintVip(state: SprintVipState) {
    this.extras.setSprintVip(state);
  }

  setPhase(phase: Phase) {
    log.debug('Setting phase:', phase);
    this.board.setPhase(phase);
    if (phase !== 'discussion') this.discussion.leaveDiscussion();
  }

  setCards(cards: Card[]) {
    this.board.setCards(cards);
  }

  setUsers(users: User[]) {
    this.board.setUsers(users);
  }

  updateState(state: RoomState) {
    log.debug('Updating state:', state);
    this.board.applyState(state);
    if (state.phase !== 'discussion') this.discussion.leaveDiscussion();
    this.persistBoardState();
  }

  addCard(card: Card) { this.board.addCard(card); }
  updateCard(card: Card) { this.board.updateCard(card); }
  addCardComment(cardId: string, comment: CardComment) { this.board.addCardComment(cardId, comment); }
  updateCardComment(cardId: string, comment: CardComment) { this.board.updateCardComment(cardId, comment); }
  setCardReactions(cardId: string, reactions: CardReaction[]) { this.board.setCardReactions(cardId, reactions); }
  deleteCard(cardId: string) { this.board.deleteCard(cardId); }
  clearAllCards() { this.board.clearAllCards(); }
  moveCard(cardId: string, column: number, originColumn?: number) { this.board.moveCard(cardId, column, originColumn); }
  updateVotes(cardId: string, likes: string[], dislikes: string[]) { this.board.updateVotes(cardId, likes, dislikes); }
  addUser(user: User) { this.board.addUser(user); }
  removeUser(userId: string) { this.board.removeUser(userId); }

  cardsInColumn(columnIndex: number): Card[] {
    return this.board.cardsInColumn(columnIndex);
  }

  canEditCard(card: Card) { return this.board.canEditCard(card); }
  canComposeInColumn(columnIndex: number) { return this.board.canComposeInColumn(columnIndex); }
  canAddCards(columnIndex: number) { return this.board.canAddCards(columnIndex); }
  isCardTextHidden(card: Card) { return this.board.isCardTextHidden(card); }
  canUseCardSocial(card: Card) { return this.board.canUseCardSocial(card); }
  canMoveCard(card: Card) { return this.board.canMoveCard(card); }
  canChangePhase() { return this.board.canChangePhase(); }

  canControlDiscussionNavigation(): boolean {
    const user = this.currentUser;
    if (!user) return false;
    if (this.discussion.isFacilitator(user.name)) return true;
    return user.role === 'admin' || this.room?.owner === user.name;
  }

  canEditColumnTitles(): boolean {
    return this.canControlDiscussionNavigation();
  }

  getColumnTitle(index: number) { return this.board.getColumnTitle(index); }
  getColumnHint(index: number) { return this.board.getColumnHint(index); }
  getColumnKind(index: number) { return this.board.getColumnKind(index); }
  setColumnTitles(titles: string[]) { this.board.setColumnTitles(titles); }
  requestColumnTitlesUpdate(titles: string[]) { this.board.requestColumnTitlesUpdate(titles); }
  getColumnColor(index: number) { return this.board.getColumnColor(index); }
  setColumnColors(colors: ColumnColorId[]) { this.board.setColumnColors(colors); }
  requestColumnColorsUpdate(colors: ColumnColorId[]) { this.board.requestColumnColorsUpdate(colors); }
  setRoomFeatures(features: Partial<RoomFeatures>) { this.board.setRoomFeatures(features); }
  setRoomBackground(backgroundImage: string) { this.board.setRoomBackground(backgroundImage); }
  requestRoomFeaturesUpdate(features: RoomFeatures) { this.board.requestRoomFeaturesUpdate(features); }
  requestRoomBackgroundUpdate(backgroundImage: string) { this.board.requestRoomBackgroundUpdate(backgroundImage); }
  getUserReadyCount() { return this.board.getUserReadyCount(); }
  getTotalUserCount() { return this.board.getTotalUserCount(); }
  isCurrentUserReady() { return this.board.isCurrentUserReady(); }
  updateUserReadyState(isReady: boolean) { this.board.updateUserReadyState(isReady); }
  getSavedUserMood(roomId: string, username: string) { return this.board.getSavedUserMood(roomId, username); }
  saveUserMood(roomId: string, username: string, mood: Mood) { this.board.saveUserMood(roomId, username, mood); }

  ensureArkanoidStats() { this.extras.ensureArkanoidStats(); }
  beginArkanoidRound() { this.extras.beginArkanoidRound(); }
  restartArkanoidRound() { this.extras.restartArkanoidRound(); }
  finishArkanoidRound() { this.extras.finishArkanoidRound(); }
  recordArkanoidHit(cardId: string) { return this.extras.recordArkanoidHit(cardId); }
  setArkanoidScores(scores: ArkanoidScoreEntry[]) { this.extras.setArkanoidScores(scores); }

  setRoom(room: Room | null) {
    log.debug('Setting room:', room);
    if (room) {
      const roomChanged = this.board.openRoom(room, {
        authName: this.auth.profile?.name,
        socketId: this.socket?.id
      });
      this.discussion.clearPresence();
      if (roomChanged) this.extras.resetScores();
      this.extras.ensureArkanoidStats();
      this.persistBoardState();
      return;
    }

    this.board.closeRoom();
    this.clearSession();
    this.discussion.clear();
    this.extras.clear();
    this.rejoinRequired = false;
    this.connectionStatus = 'online';
    this.isReconnecting = false;
    log.debug('Cleared room and session');
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
    const room = this.board.room;
    const roomId = room?.id ?? readStoredSession()?.roomId;
    if (!roomId || !room) return;

    const snapshot: PersistedBoardState = {
      roomId,
      room,
      phase: this.board.phase,
      cards: this.board.cards.map((card) => (
        card.imageUrl?.startsWith('data:') ? { ...card, imageUrl: undefined } : card
      )),
      users: this.board.users,
      columnTitles: this.board.columnTitles,
      columnColors: this.board.columnColors,
      template: this.board.template,
      roomFeatures: {
        ...this.board.roomFeatures,
        backgroundImage: this.board.roomFeatures.backgroundImage?.startsWith('data:')
          ? ''
          : this.board.roomFeatures.backgroundImage
      },
      currentUser: this.board.currentUser,
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
    if (this.room) return this.canRenderBoard;
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
      this.board.hydrate(parsed);
      this.extras.ensureArkanoidStats();
    } catch {
      sessionStorage.removeItem(BOARD_STATE_KEY);
      localStorage.removeItem(BOARD_STATE_KEY);
    }
  }

  private clearBoardState() {
    sessionStorage.removeItem(BOARD_STATE_KEY);
    localStorage.removeItem(BOARD_STATE_KEY);
  }

  clearSession() {
    clearStoredSession();
    this.clearBoardState();
  }
}
