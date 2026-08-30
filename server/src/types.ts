export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';
export type Phase = 'creation' | 'voting' | 'discussion' | 'rating';

export const DEFAULT_COLUMN_TITLES = ['Было хорошо', 'Было не очень', 'А давайте!:'] as const;
export const COLUMN_COUNT = DEFAULT_COLUMN_TITLES.length;
export const LETS_DO_COLUMN_INDEX = 2;

export const COLUMN_COLOR_IDS = [
  'none',
  'teal',
  'pink',
  'purple',
  'blue',
  'indigo',
  'cyan',
  'green',
  'amber',
  'orange',
  'slate'
] as const;

export type ColumnColorId = typeof COLUMN_COLOR_IDS[number];

export const DEFAULT_COLUMN_COLORS: ColumnColorId[] = ['teal', 'pink', 'blue'];

export const isColumnColorId = (value: unknown): value is ColumnColorId =>
  typeof value === 'string' && (COLUMN_COLOR_IDS as readonly string[]).includes(value);

export const normalizeColumnColors = (colors?: string[] | null): ColumnColorId[] => {
  if (!Array.isArray(colors) || colors.length !== COLUMN_COUNT || !colors.every(isColumnColorId)) {
    return [...DEFAULT_COLUMN_COLORS];
  }
  return [...colors];
};

export const MIN_VOTE_LIMIT = 1;
export const MAX_VOTE_LIMIT = 20;
export type VoteLimit = number;

export const LIKE_ICON_IDS = ['peach', 'banana', 'hotPepper', 'avocado', 'pineapple', 'thumbsUp'] as const;
export type LikeIconId = typeof LIKE_ICON_IDS[number];

export const DISLIKE_ICON_IDS = ['eggplant', 'rottenTomato', 'grapefruit', 'egg', 'thumbsDown'] as const;
export type DislikeIconId = typeof DISLIKE_ICON_IDS[number];

export const isLikeIconId = (value: unknown): value is LikeIconId =>
  typeof value === 'string' && (LIKE_ICON_IDS as readonly string[]).includes(value);

export const isDislikeIconId = (value: unknown): value is DislikeIconId =>
  typeof value === 'string' && (DISLIKE_ICON_IDS as readonly string[]).includes(value);

export interface RoomFeatures {
  mediaEnabled: boolean;
  reactionsEnabled: boolean;
  commentsEnabled: boolean;
  moveCardsEnabled: boolean;
  membersCanAddCards: boolean;
  anonymousEnabled: boolean;
  hideCardTextDuringCreation: boolean;
  likesPerUser: VoteLimit;
  dislikesPerUser: VoteLimit;
  likeIcon: LikeIconId;
  dislikeIcon: DislikeIconId;
  dislikesEnabled: boolean;
  musicEnabled: boolean;
  retroRatingEnabled: boolean;
  sprintVipEnabled: boolean;
  drawingEnabled: boolean;
  cardEditingEnabled: boolean;
  chatEnabled: boolean;
  readyEnabled: boolean;
  facilitatorEnabled: boolean;
  backgroundImage: string;
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

export const CARD_TEXT_SEGMENT_SEPARATOR = '\u001e';

export const getCardTextSegments = (text: string): string[] => {
  const segments = text
    .split(CARD_TEXT_SEGMENT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : (text.trim() ? [text.trim()] : []);
};

export const joinCardTextSegments = (segments: string[]): string =>
  segments.map((part) => part.trim()).filter(Boolean).join(CARD_TEXT_SEGMENT_SEPARATOR);

export const mergeCardTexts = (targetText: string, sourceText: string): string =>
  joinCardTextSegments([...getCardTextSegments(targetText), ...getCardTextSegments(sourceText)]);

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
  columnColors?: ColumnColorId[];
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
  columnColors?: ColumnColorId[];
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
  passwordVersion: number;
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