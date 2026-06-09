export interface User {
  id: string;
  name: string;
  roomId: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

export type Phase = 'creation' | 'voting' | 'discussion' | 'rating';

export interface Room {
  id: string;
  teamId?: string;
  owner: string;
  phase: Phase;
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
  phase: Phase;
  users: User[];
} 

export interface CreateRoomOptions {
  teamId?: string;
}

export interface PhaseTimerState {
  phase?: Phase;
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

export interface RetroRatingState {
  hasVoted: boolean;
  votesCount: number;
  totalCount: number;
  resultsVisible: boolean;
  average?: number;
  distribution?: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface FacilitatorAnnouncement {
  userId: string;
  userName: string;
  selectedAt: number;
}

export interface SprintVipState {
  vipUserName?: string;
  voteCount: number;
  myVote?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  points: WhiteboardPoint[];
}

export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';

export type AuthProfileType = 'fixed' | 'registered' | 'guest';

export const BUILTIN_TEAM_ID = 'cards-partners';

export interface AuthProfile {
  name: string;
  type: AuthProfileType;
  token: string;
  expiresAt: number;
}

export interface AvailableRoom {
  id: string;
  teamId?: string;
  usersCount: number;
  phase: Phase;
  owner: string;
  createdAt?: string;
}

export type TeamRole = 'admin' | 'user';

export interface TeamMember {
  teamId: string;
  name: string;
  role: TeamRole;
}

export interface Team {
  id: string;
  name: string;
  owner: string;
  createdAt?: string;
  members: TeamMember[];
}

export interface AvailableTeam {
  id: string;
  name: string;
  owner: string;
  membersCount: number;
  createdAt?: string;
}