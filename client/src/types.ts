export interface User {
  id: string;
  name: string;
  roomId: string;
  role: 'admin' | 'user';
  isReady?: boolean;
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
}

export interface RoomState {
  cards: Card[];
  phase: 'creation' | 'voting' | 'discussion';
  users: User[];
} 

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