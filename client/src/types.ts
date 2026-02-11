export interface User {
  id: string;
  name: string;
  roomId: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

export interface Room {
  id: string;
  owner: string;
  phase: 'creation' | 'voting' | 'discussion';
  users: User[];
  cards: Card[];
}

export interface Card {
  id: string;
  text: string;
  type: 'liked' | 'disliked' | 'suggestion';
  createdBy: string;
  likes: string[];
  dislikes: string[];
  column: number;
  imageUrl?: string;
}

export interface RoomState {
  cards: Card[];
  phase: 'creation' | 'voting' | 'discussion';
  users: User[];
} 

export interface PhaseTimerState {
  phase?: 'creation' | 'voting' | 'discussion';
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';

export type AuthProfileType = 'fixed' | 'registered' | 'guest';

export interface AuthProfile {
  name: string;
  type: AuthProfileType;
  token: string;
  expiresAt: number;
}

export interface AvailableRoom {
  id: string;
  usersCount: number;
  phase: string;
  owner: string;
  createdAt?: string;
}