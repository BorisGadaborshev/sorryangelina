export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';
export type Phase = 'creation' | 'voting' | 'discussion' | 'rating';

export const DEFAULT_COLUMN_TITLES = ['Было хорошо', 'Было не очень', 'А давайте!:'] as const;
export const COLUMN_COUNT = DEFAULT_COLUMN_TITLES.length;

export type VoteLimit = 1 | 3 | 5;

export interface RoomFeatures {
  mediaEnabled: boolean;
  reactionsEnabled: boolean;
  commentsEnabled: boolean;
  moveCardsEnabled: boolean;
  anonymousEnabled: boolean;
  likesPerUser: VoteLimit;
  dislikesPerUser: VoteLimit;
  dislikesEnabled: boolean;
  musicEnabled: boolean;
  retroRatingEnabled: boolean;
  sprintVipEnabled: boolean;
  drawingEnabled: boolean;
  cardEditingEnabled: boolean;
  chatEnabled: boolean;
}

export interface User {
  id: string;
  name: string;
  roomId: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

export interface CardComment {
  id: string;
  cardId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface CardReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export const CARD_REACTION_EMOJIS = ['👍', '👎', '👏', '❤️', '🔥', '🎉', '🥰', '😨', '😂'] as const;
export type CardReactionEmoji = typeof CARD_REACTION_EMOJIS[number];

export interface Card {
  id: string;
  text: string;
  type: 'liked' | 'disliked' | 'suggestion';
  createdBy: string;
  likes: string[];
  dislikes: string[];
  column: number;
  imageUrl?: string;
  comments?: CardComment[];
  reactions?: CardReaction[];
}

// Интерфейс для комнаты в базе данных
export interface RoomDocument {
  id: string;
  password: string;
  teamId?: string;
  owner: string;
  phase: Phase;
  columnTitles?: string[];
  features?: RoomFeatures;
  createdAt?: string;
  users: User[];
  cards: Card[];
}

// Интерфейс для комнаты, отправляемой клиенту
export interface Room {
  id: string;
  teamId?: string;
  owner: string;
  phase: Phase;
  columnTitles?: string[];
  features?: RoomFeatures;
  createdAt?: string;
  users: User[];
  cards: Card[];
}

export interface RoomState {
  cards: Card[];
  phase: Phase;
  users: User[];
}

export interface CreateRoomOptions {
  teamId?: string;
  userRole?: TeamRole;
}

export type AuthProfileType = 'fixed' | 'registered' | 'guest';

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

export interface TeamDocument extends Team {
  passwordHash: string;
}

export interface AvailableTeam {
  id: string;
  name: string;
  owner: string;
  membersCount: number;
  createdAt?: string;
}

export interface CreateTeamInput {
  name: string;
  password: string;
  owner: string;
  members: string[];
  scrumMasterName?: string;
}