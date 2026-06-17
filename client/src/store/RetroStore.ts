import { makeAutoObservable, runInAction } from 'mobx';
import { AuthProfile, Card, ChatMessage, DiscussionNavigationState, FacilitatorAnnouncement, Phase, PhaseTimerState, RetroRatingState, Room, RoomState, SprintVipState, Team, User, WhiteboardStroke } from '../types';
import { Socket } from 'socket.io-client';
import { SocketService } from '../services/socket';

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
  voteError: { cardId: string; message: string } | null = null;
  phaseTimer: PhaseTimerState = { durationSeconds: 0, remainingSeconds: 0, running: false };
  chatMessages: ChatMessage[] = [];
  whiteboardStrokes: WhiteboardStroke[] = [];
  facilitatorAnnouncement: FacilitatorAnnouncement | null = null;
  discussionNavigation: DiscussionNavigationState | null = null;
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
    this.tryRestoreSession();

    // Обработка закрытия окна/вкладки
    window.addEventListener('beforeunload', () => {
      // Сохраняем текущее состояние перед закрытием
      if (this.currentUser && this.room) {
        this.saveSession(this.currentUser.id, this.room.id, this.currentUser.name);
      }
    });
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

  private async tryRestoreSession() {
    const userId = localStorage.getItem('userId');
    const roomId = localStorage.getItem('roomId');
    const username = localStorage.getItem('username');

    if (userId && roomId && username && this.socketService) {
      try {
        console.log('Attempting to restore session with:', { userId, roomId, username });
        await this.socketService.restoreSession(roomId, userId, username, this.authProfile?.token);
      } catch (error) {
        console.error('Failed to restore session:', error);
        this.clearSession();
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
      } else {
        this.currentUser = null;
        this.clearSession();
        this.clearVoteError();
        this.phaseTimer = { durationSeconds: 0, remainingSeconds: 0, running: false };
        this.chatMessages = [];
        this.whiteboardStrokes = [];
        this.facilitatorAnnouncement = null;
        this.discussionNavigation = null;
        this.sprintVip = { voteCount: 0 };
        this.retroRating = { hasVoted: false, votesCount: 0, totalCount: 0, resultsVisible: false };
        console.log('Cleared room and session');
      }
    });
  }

  setPhase(phase: Phase) {
    console.log('Setting phase:', phase);
    runInAction(() => {
      this.phase = phase;
      if (phase === 'creation') {
        this.facilitatorAnnouncement = null;
        this.discussionNavigation = null;
      }
      if (phase !== 'discussion') {
        this.discussionNavigation = null;
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
      if (state.phase === 'creation') {
        this.facilitatorAnnouncement = null;
        this.discussionNavigation = null;
      }
      if (state.phase !== 'discussion') {
        this.discussionNavigation = null;
      }
      this.users = this.normalizeUsers(state.users);
      if (this.currentUser) {
        const syncedUser = this.users.find((user) => user.name === this.currentUser?.name);
        if (syncedUser) {
          this.currentUser = syncedUser;
        }
      }
    });
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

  deleteCard(cardId: string) {
    console.log('Deleting card:', cardId);
    runInAction(() => {
      this.cards = this.cards.filter(c => c.id !== cardId);
    });
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
    console.log('Calculating sorted cards. Current phase:', this.phase);
    console.log('Total cards:', this.cards.length);
    
    const cards = this.cards.map(c => ({
      ...c,
      score: (c.likes?.length || 0) - (c.dislikes?.length || 0)
    }));

    console.log('Cards before sorting:', cards.map(c => ({
      id: c.id,
      text: c.text.substring(0, 20) + '...',
      likes: c.likes?.length || 0,
      dislikes: c.dislikes?.length || 0,
      score: c.score
    })));
    
    const sortedCards = [...cards].sort((a, b) => b.score - a.score);

    console.log('Cards after sorting:', sortedCards.map(c => ({
      id: c.id,
      text: c.text.substring(0, 20) + '...',
      likes: c.likes?.length || 0,
      dislikes: c.dislikes?.length || 0,
      score: c.score
    })));
    
    return sortedCards;
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
    return this.currentUser?.role === 'admin' || this.currentUser?.name === card.createdBy;
  }

  canChangePhase(): boolean {
    return this.currentUser?.role === 'admin' || this.room?.owner === this.currentUser?.name;
  }

  canControlDiscussionNavigation(): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin' || this.room?.owner === this.currentUser.name) {
      return true;
    }
    return this.facilitatorAnnouncement?.userName === this.currentUser.name;
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
    if (this.socketService) {
      console.log('Updating user ready state:', isReady);
      this.socketService.updateReadyState(isReady);
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