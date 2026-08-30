export interface User {
  id: string;
  name: string;
  roomId: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

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

export const DEFAULT_COLUMN_COLORS: ColumnColorId[] = ['none', 'none', 'none'];

export const COLUMN_COLOR_PRESETS: Record<ColumnColorId, {
  label: string;
  light: { bg: string; accent: string };
  dark: { bg: string; accent: string };
}> = {
  none: { label: 'Без цвета', light: { bg: 'transparent', accent: '#90a4ae' }, dark: { bg: 'transparent', accent: '#78909c' } },
  teal: { label: 'Бирюзовый', light: { bg: '#e0f2ef', accent: '#00897b' }, dark: { bg: '#1c2b28', accent: '#4db6ac' } },
  pink: { label: 'Розовый', light: { bg: '#fce4ec', accent: '#d81b60' }, dark: { bg: '#2c1f24', accent: '#f06292' } },
  purple: { label: 'Фиолетовый', light: { bg: '#f3e5f5', accent: '#8e24aa' }, dark: { bg: '#261d2c', accent: '#ba68c8' } },
  blue: { label: 'Синий', light: { bg: '#e3f2fd', accent: '#1565c0' }, dark: { bg: '#1c2633', accent: '#64b5f6' } },
  indigo: { label: 'Индиго', light: { bg: '#e8eaf6', accent: '#3949ab' }, dark: { bg: '#20233a', accent: '#7986cb' } },
  cyan: { label: 'Голубой', light: { bg: '#e0f7fa', accent: '#00838f' }, dark: { bg: '#1a2b2e', accent: '#4dd0e1' } },
  green: { label: 'Зелёный', light: { bg: '#e8f5e9', accent: '#2e7d32' }, dark: { bg: '#1d2a1f', accent: '#81c784' } },
  amber: { label: 'Янтарный', light: { bg: '#fff8e1', accent: '#f9a825' }, dark: { bg: '#2c2718', accent: '#ffd54f' } },
  orange: { label: 'Оранжевый', light: { bg: '#fff3e0', accent: '#ef6c00' }, dark: { bg: '#2c2318', accent: '#ffb74d' } },
  slate: { label: 'Серый', light: { bg: '#eceff1', accent: '#546e7a' }, dark: { bg: '#23282c', accent: '#90a4ae' } }
};

export const isColumnColorId = (value: unknown): value is ColumnColorId =>
  typeof value === 'string' && (COLUMN_COLOR_IDS as readonly string[]).includes(value);

export const normalizeColumnColors = (colors?: string[] | null): ColumnColorId[] => {
  if (!Array.isArray(colors) || colors.length !== COLUMN_COUNT || !colors.every(isColumnColorId)) {
    return [...DEFAULT_COLUMN_COLORS];
  }
  return [...colors];
};

export const getColumnColorStyles = (colorId: ColumnColorId, mode: 'light' | 'dark') => {
  const preset = COLUMN_COLOR_PRESETS[colorId] ?? COLUMN_COLOR_PRESETS.none;
  const colors = mode === 'dark' ? preset.dark : preset.light;
  return {
    fill: colorId === 'none' ? undefined : colors.bg,
    accent: colors.accent
  };
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

export const DEFAULT_ROOM_FEATURES: RoomFeatures = {
  mediaEnabled: true,
  reactionsEnabled: true,
  commentsEnabled: true,
  moveCardsEnabled: false,
  membersCanAddCards: true,
  anonymousEnabled: true,
  hideCardTextDuringCreation: true,
  likesPerUser: 3,
  dislikesPerUser: 3,
  likeIcon: 'peach',
  dislikeIcon: 'eggplant',
  dislikesEnabled: true,
  musicEnabled: true,
  retroRatingEnabled: true,
  sprintVipEnabled: true,
  drawingEnabled: true,
  cardEditingEnabled: true,
  chatEnabled: true,
  readyEnabled: true,
  facilitatorEnabled: false,
  backgroundImage: ''
};

export interface Room {
  id: string;
  teamId?: string;
  owner: string;
  phase: Phase;
  columnTitles?: string[];
  columnColors?: ColumnColorId[];
  features?: RoomFeatures;
  users: User[];
  cards: Card[];
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
const CARD_TEXT_EDIT_SEPARATOR = /\n-{3,}\n/;

export const getCardTextSegments = (text: string): string[] => {
  const segments = text
    .split(CARD_TEXT_SEGMENT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : (text.trim() ? [text.trim()] : []);
};

export const joinCardTextSegments = (segments: string[]): string =>
  segments.map((part) => part.trim()).filter(Boolean).join(CARD_TEXT_SEGMENT_SEPARATOR);

export const cardTextToEditorValue = (text: string): string =>
  getCardTextSegments(text).join('\n---\n');

export const editorValueToCardText = (value: string): string =>
  joinCardTextSegments(value.split(CARD_TEXT_EDIT_SEPARATOR));

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

const flattenMarkdownLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const withMarkdownAuthor = (text: string, author?: string): string => {
  const name = author?.trim();
  return name ? `${text} // ${name}` : text;
};

export const buildColumnMarkdown = (cards: Card[]): string =>
  cards
    .map((card) => {
      const title =
        flattenMarkdownLine(getCardTextSegments(card.text).join(' — '))
        || (card.imageUrl ? '[изображение]' : '');
      if (!title) return '';

      const lines = [`- ${withMarkdownAuthor(title, card.createdBy)}`];
      for (const comment of card.comments || []) {
        const commentText = flattenMarkdownLine(comment.text || '');
        if (!commentText) continue;
        lines.push(`  - ${withMarkdownAuthor(commentText, comment.userName)}`);
      }
      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n');

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

export interface DiscussionNavigationState {
  unviewedCardIds: string[];
  viewedCardIds: string[];
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
  hasPassword?: boolean;
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