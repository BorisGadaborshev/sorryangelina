import { io, Socket } from 'socket.io-client';
import { RetroStore } from '../store/RetroStore';
import { Room, RoomState, User, Card, PhaseTimerState } from '../types';

export class SocketService {
  private socket: Socket;
  private store: RetroStore;

  constructor(store: RetroStore) {
    console.log('Initializing socket connection...');
    this.store = store;
    
    const isProd = process.env.NODE_ENV === 'production';
    const serverUrl = isProd
      ? 'https://sorryangelina.ru'
      : 'http://localhost:3001';

    // Initialize socket with updated configuration
    this.socket = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
      forceNew: true,
      autoConnect: false
    });
    
    this.store.setSocket(this.socket);
    
    // Setup enhanced connection handling
    this.socket.on('connect', () => {
      console.log('Socket connected successfully:', this.socket.id);
      this.store.setError(null);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.store.setError('Failed to connect to server. Please try again.');
      
      // Try to reconnect with polling if websocket fails
      const transport = this.socket.io?.opts?.transports?.[0];
      if (transport === 'websocket' && this.socket.io?.opts?.transports) {
        console.log('Retrying with polling transport...');
        this.socket.io.opts.transports = ['polling', 'websocket'];
        this.socket.connect();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.store.setError('Connection lost. Attempting to reconnect...');
      this.store.setRoom(null);
      
      if (!this.socket.connected) {
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          this.socket.connect();
        }, 1000);
      }
    });

    this.setupListeners();
    
    // Start the connection
    console.log('Starting initial connection...');
    this.socket.connect();
  }

  private setupListeners(): void {
    this.socket.on('error', (error: string) => {
      console.error('Server error:', error);
      this.store.setError(error);
    });

    this.socket.on('room-joined', ({ room, state, userId }: { room: Room; state: RoomState; userId: string }) => {
      console.log('Room joined event received - FULL DATA:', {
        room,
        state,
        userId,
        roomUsers: room.users,
        firstUser: room.users[0]
      });
      
      const savedUsername = localStorage.getItem('username');
      const savedUserId = localStorage.getItem('userId');
      
      if (savedUsername && savedUserId) {
        // Восстановление сессии: используем сохраненный ID
        const userToUpdate = room.users.find(u => u.name === savedUsername);
        if (userToUpdate) {
          console.log('Found user to restore - FULL USER:', userToUpdate);
          userToUpdate.id = savedUserId;
          // Устанавливаем текущего пользователя сразу
          this.store.setCurrentUser({
            id: userToUpdate.id,
            name: userToUpdate.name,
            roomId: room.id,
            role: userToUpdate.role
          });
        }
      } else if (userId) {
        // Новое подключение: сохраняем новый ID
        localStorage.setItem('userId', userId);
        // Находим пользователя по socket ID
        const userToUpdate = room.users.find(u => u.id === userId);
        if (userToUpdate) {
          console.log('Setting new user - FULL USER:', userToUpdate);
          localStorage.setItem('username', userToUpdate.name);
          // Устанавливаем текущего пользователя сразу
          this.store.setCurrentUser({
            id: userToUpdate.id,
            name: userToUpdate.name,
            roomId: room.id,
            role: userToUpdate.role
          });
        }
      }

      console.log('Final room state with roles:', room.users.map(u => ({ 
        id: u.id,
        name: u.name,
        role: u.role,
        roomId: u.roomId
      })));
      
      this.store.setRoom(room);
      this.store.updateState(state);
      this.store.setError(null);
    });

    this.socket.on('state-updated', (state: RoomState) => {
      console.log('State update received:', state);
      this.store.updateState(state);
    });

    this.socket.on('user-joined', (user: User) => {
      console.log('User joined:', user);
      this.store.addUser(user);
    });

    this.socket.on('user-left', (user: User) => {
      console.log('User left:', user);
      this.store.removeUser(user.id);
    });

    this.socket.on('card-added', (card: Card) => {
      console.log('Card added:', card);
      this.store.addCard(card);
    });

    this.socket.on('card-updated', (card: Card) => {
      console.log('Card updated:', card);
      this.store.updateCard(card);
    });

    this.socket.on('card-deleted', (cardId: string) => {
      console.log('Card deleted:', cardId);
      this.store.deleteCard(cardId);
    });

    this.socket.on('card-moved', ({ cardId, column }: { cardId: string; column: number }) => {
      console.log('Card moved:', { cardId, column });
      this.store.moveCard(cardId, column);
    });

    this.socket.on('card-voted', ({ cardId, likes, dislikes }: { cardId: string; likes: string[]; dislikes: string[] }) => {
      console.log('Card voted:', { cardId, likes, dislikes });
      this.store.updateVotes(cardId, likes, dislikes);
      this.store.clearVoteError();
    });

    this.socket.on('vote-error', ({ cardId, message }: { cardId: string; message: string }) => {
      this.store.setVoteError(cardId, message);
    });

    this.socket.on('phase-changed', ({ phase, cards }: { phase: 'creation' | 'voting' | 'discussion'; cards: Card[] }) => {
      console.log('Phase changed:', { phase, cards });
      this.store.setPhase(phase);
      this.store.setCards(cards);
    });

    this.socket.on('timer-updated', (timer: PhaseTimerState) => {
      this.store.setPhaseTimer(timer);
    });

    this.socket.on('user-kicked', () => {
      console.log('You have been kicked from the room');
      this.store.setRoom(null);
      this.store.setError('Вы были исключены из комнаты администратором');
    });

    this.socket.on('room-deleted', () => {
      console.log('Room has been deleted');
      this.store.setRoom(null);
      this.store.setError('Комната была удалена администратором');
    });
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
          reject(new Error('Failed to establish connection after multiple attempts'));
          return;
        }

        attemptCount++;
        console.log(`Connection attempt ${attemptCount}/${maxAttempts}`);

        const timeout = setTimeout(() => {
          this.socket.off('connect', handleConnect);
          this.socket.off('connect_error', handleError);
          
          if (attemptCount < maxAttempts) {
            console.log('Connection attempt timed out, retrying...');
            attemptConnection();
          } else {
            reject(new Error('Connection timeout'));
          }
        }, 5000);

        const handleConnect = () => {
          console.log('Connection established successfully');
          clearTimeout(timeout);
          this.socket.off('connect_error', handleError);
          resolve();
        };

        const handleError = (error: Error) => {
          console.error('Connection error:', error);
          clearTimeout(timeout);
          this.socket.off('connect', handleConnect);
          
          if (attemptCount < maxAttempts) {
            console.log('Retrying connection after error...');
            setTimeout(attemptConnection, 1000);
          } else {
            reject(error);
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

  async createRoom(roomId: string, password: string, username: string, token: string): Promise<void> {
    console.log('Attempting to create room:', roomId);
    try {
      await this.ensureConnection();
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('error', handleError);
          reject(new Error('Room creation timeout'));
        }, 10000);

        const handleError = (error: string) => {
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('error', handleError);
          reject(new Error(error));
        };

        const handleSuccess = ({ room, state, userId }: { room: Room; state: RoomState; userId: string }) => {
          console.log('Room creation success - FULL DATA:', {
            room,
            state,
            userId,
            roomUsers: room.users,
            firstUser: room.users[0]
          });
          
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('error', handleError);
          
          // Находим пользователя в комнате
          const currentUser = room.users.find(u => u.id === userId);
          if (currentUser) {
            console.log('Setting current user after room creation - FULL USER:', currentUser);
            localStorage.setItem('userId', userId);
            localStorage.setItem('roomId', room.id);
            localStorage.setItem('username', username);
            // Устанавливаем текущего пользователя до установки комнаты
            this.store.setCurrentUser({
              id: currentUser.id,
              name: currentUser.name,
              roomId: room.id,
              role: currentUser.role || 'admin' // Гарантируем, что создатель комнаты получит роль админа
            });
          }
          
          // Обновляем роли пользователей в комнате если нужно
          const updatedRoom = {
            ...room,
            users: room.users.map(u => ({
              ...u,
              role: u.id === userId ? 'admin' : (u.role || 'user')
            }))
          };
          
          this.store.setRoom(updatedRoom);
          this.store.updateState(state);
          resolve();
        };

        this.socket.once('error', handleError);
        this.socket.once('room-joined', handleSuccess);
        this.socket.emit('create-room', { roomId, password, username, token });
      });
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw new Error('Failed to connect to server');
    }
  }

  async joinRoom(roomId: string, password: string, username: string, token: string): Promise<void> {
    console.log('Attempting to join room:', roomId);
    try {
      await this.ensureConnection();
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('error', handleError);
          reject(new Error('Room join timeout'));
        }, 10000);

        const handleError = (error: string) => {
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('error', handleError);
          reject(new Error(error));
        };

        const handleSuccess = ({ room, state, userId }: { room: Room; state: RoomState; userId: string }) => {
          console.log('Room join success:', { room, state, userId });
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('error', handleError);
          
          // Находим пользователя в комнате
          const currentUser = room.users.find(u => u.id === userId);
          if (currentUser) {
            console.log('Setting current user after joining:', { name: currentUser.name, role: currentUser.role });
            localStorage.setItem('userId', userId);
            localStorage.setItem('roomId', room.id);
            localStorage.setItem('username', username);
            // Устанавливаем текущего пользователя до установки комнаты
            this.store.setCurrentUser(currentUser);
          }
          
          this.store.setRoom(room);
          this.store.updateState(state);
          resolve();
        };

        this.socket.once('error', handleError);
        this.socket.once('room-joined', handleSuccess);
        this.socket.emit('join-room', { roomId, password, username, token });
      });
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw new Error('Failed to connect to server');
    }
  }

  addCard(text: string, type: 'liked' | 'disliked' | 'suggestion', column: number, imageUrl?: string): void {
    const currentUser = this.store.currentUser;
    if (!currentUser) {
      console.error('Cannot add card: no current user');
      return;
    }
    console.log('Adding card with user:', currentUser);
    this.socket.emit('add-card', { text, type, column, imageUrl });
  }

  updateCard(cardId: string, text: string, imageUrl?: string): void {
    const currentUser = this.store.currentUser;
    if (!currentUser) {
      console.error('Cannot update card: no current user');
      return;
    }
    this.socket.emit('update-card', { cardId, text, imageUrl });
  }

  deleteCard(cardId: string): void {
    const currentUser = this.store.currentUser;
    if (!currentUser) {
      console.error('Cannot delete card: no current user');
      return;
    }
    this.socket.emit('delete-card', { cardId });
  }

  moveCard(cardId: string, column: number): void {
    this.socket.emit('move-card', { cardId, column });
  }

  voteCard(cardId: string, voteType: 'like' | 'dislike'): void {
    console.log('Voting for card:', { cardId, voteType });
    this.socket.emit('vote-card', { cardId, voteType });
  }

  async changePhase(phase: 'creation' | 'voting' | 'discussion'): Promise<void> {
    console.log('Changing phase to:', phase);
    this.socket.emit('change-phase', { phase });
  }

  async updateReadyState(isReady: boolean): Promise<void> {
    console.log('Updating ready state:', isReady);
    this.socket.emit('update-ready-state', { isReady });
  }

  setPhaseTimer(durationSeconds: number): void {
    this.socket.emit('set-phase-timer', { durationSeconds });
  }

  resetPhaseTimer(): void {
    this.socket.emit('reset-phase-timer');
  }

  async restoreSession(roomId: string, userId: string, username: string, token?: string): Promise<void> {
    console.log('Attempting to restore session:', { roomId, userId, username });
    try {
      await this.ensureConnection();
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('session-expired', handleExpired);
          this.socket.off('error', handleError);
          reject(new Error('Session restore timeout'));
        }, 10000);

        const handleExpired = () => {
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('session-expired', handleExpired);
          this.socket.off('error', handleError);
          this.store.clearSession();
          reject(new Error('Session expired'));
        };

        const handleError = (error: string) => {
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('session-expired', handleExpired);
          this.socket.off('error', handleError);
          reject(new Error(error));
        };

        const handleSuccess = ({ room, state }: { room: Room; state: RoomState }) => {
          console.log('Session restore success:', { room, state });
          clearTimeout(timeout);
          this.socket.off('room-joined', handleSuccess);
          this.socket.off('session-expired', handleExpired);
          this.socket.off('error', handleError);
          
          // Убеждаемся, что у пользователя правильный ID
          const userToUpdate = room.users.find(u => u.name === username);
          if (userToUpdate) {
            userToUpdate.id = userId;
          }
          
          this.store.setRoom(room);
          this.store.updateState(state);
          resolve();
        };

        this.socket.once('error', handleError);
        this.socket.once('room-joined', handleSuccess);
        this.socket.once('session-expired', handleExpired);
        this.socket.emit('restore-session', { roomId, userId, username, token });
      });
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw new Error('Failed to connect to server');
    }
  }

  disconnect(): void {
    console.log('Disconnecting socket');
    this.socket.disconnect();
  }

  // Новые методы для управления комнатой и пользователями
  deleteRoom() {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('delete-room');
  }

  kickUser(userId: string) {
    if (!this.socket || !this.store.isAdmin) return;
    this.socket.emit('kick-user', { userId });
  }

  leaveRoom() {
    if (!this.socket) return;
    this.socket.emit('leave-room');
    this.store.setRoom(null);
  }
} 