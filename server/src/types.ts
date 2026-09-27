export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';
export type Phase = 'creation' | 'voting' | 'discussion' | 'roadmap' | 'rating';

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

export const isColumnColorId = (value: unknown): value is ColumnColorId =>
  typeof value === 'string' && (COLUMN_COLOR_IDS as readonly string[]).includes(value);

export type RetroTemplateId = 'classic' | 'start-stop-continue' | 'sailboat' | 'four-ls' | 'traffic-light';
export type ColumnKind = 'positive' | 'negative' | 'suggestion';
export type CardType = 'liked' | 'disliked' | 'suggestion';

export interface RetroTemplateColumn {
  title: string;
  hint?: string;
  color: ColumnColorId;
  kind: ColumnKind;
}

export interface RetroTemplate {
  id: RetroTemplateId;
  name: string;
  description: string;
  columns: RetroTemplateColumn[];
  actionColumnIndex: number | null;
  roadmapColumns?: RetroTemplateColumn[];
}

export const RETRO_TEMPLATES: Record<RetroTemplateId, RetroTemplate> = {
  classic: {
    id: 'classic',
    name: 'Классика',
    description: 'Что получилось, что мешало и какие действия берём',
    actionColumnIndex: 2,
    columns: [
      { title: 'Было хорошо', hint: 'Что получилось хорошо и стоит повторить?', color: 'teal', kind: 'positive' },
      { title: 'Было не очень', hint: 'Что мешало и что хочется изменить?', color: 'pink', kind: 'negative' },
      { title: 'А, давайте', hint: 'Какие конкретные действия сделаем дальше?', color: 'blue', kind: 'suggestion' }
    ]
  },
  'start-stop-continue': {
    id: 'start-stop-continue',
    name: 'Start / Stop / Continue',
    description: 'Что начать, что прекратить и что продолжить',
    actionColumnIndex: 0,
    columns: [
      { title: 'Start', hint: 'Какие новые практики помогут работать эффективнее?', color: 'green', kind: 'suggestion' },
      { title: 'Stop', hint: 'От чего стоит отказаться?', color: 'pink', kind: 'negative' },
      { title: 'Continue', hint: 'Что уже работает и нужно продолжать?', color: 'teal', kind: 'positive' }
    ]
  },
  sailboat: {
    id: 'sailboat',
    name: 'Парусник',
    description: 'Что двигает вперёд, что тормозит, какие риски и куда плывём',
    actionColumnIndex: 3,
    columns: [
      { title: 'Паруса', hint: 'Что помогает нам двигаться вперёд?', color: 'teal', kind: 'positive' },
      { title: 'Якоря', hint: 'Что нас тормозит?', color: 'slate', kind: 'negative' },
      { title: 'Рифы', hint: 'Какие риски могут помешать?', color: 'orange', kind: 'negative' },
      { title: 'Земля', hint: 'К какому результату мы идём?', color: 'blue', kind: 'suggestion' }
    ]
  },
  'four-ls': {
    id: 'four-ls',
    name: '4L',
    description: 'Что понравилось, чему научились, чего не хватило и чего хотим',
    actionColumnIndex: 3,
    columns: [
      { title: 'Liked', hint: 'Что понравилось в этом спринте?', color: 'teal', kind: 'positive' },
      { title: 'Learned', hint: 'Чему мы научились?', color: 'cyan', kind: 'positive' },
      { title: 'Lacked', hint: 'Чего нам не хватало?', color: 'pink', kind: 'negative' },
      { title: 'Longed For', hint: 'Чего хотим в следующий раз?', color: 'purple', kind: 'suggestion' }
    ]
  },
  'traffic-light': {
    id: 'traffic-light',
    name: 'Светофор',
    description: 'Зелёный, жёлтый и красный, затем дорожная карта',
    actionColumnIndex: null,
    columns: [
      { title: 'Зелёный', hint: 'Что продолжаем делать?', color: 'green', kind: 'positive' },
      { title: 'Жёлтый', hint: 'Что нужно изменить?', color: 'amber', kind: 'negative' },
      { title: 'Красный', hint: 'Что нужно прекратить?', color: 'pink', kind: 'negative' }
    ],
    roadmapColumns: [
      { title: 'Анализ', hint: 'Почему это происходит?', color: 'indigo', kind: 'suggestion' },
      { title: 'Эксперимент', hint: 'Какой эксперимент проведём?', color: 'purple', kind: 'suggestion' },
      { title: 'Результат', hint: 'Какой результат хотим получить?', color: 'green', kind: 'suggestion' }
    ]
  }
};

export const isRetroTemplateId = (value: unknown): value is RetroTemplateId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(RETRO_TEMPLATES, value);

export const getRetroTemplate = (id?: string | null): RetroTemplate =>
  isRetroTemplateId(id) ? RETRO_TEMPLATES[id] : RETRO_TEMPLATES.classic;

export const getColumnCount = (template: RetroTemplate): number => template.columns.length;

export const getTemplateColumn = (template: RetroTemplate, column: number): RetroTemplateColumn | undefined => {
  if (column >= 0 && column < template.columns.length) return template.columns[column];
  const roadmapIndex = column - template.columns.length;
  return template.roadmapColumns?.[roadmapIndex];
};

export const getCardTypeByColumn = (template: RetroTemplate, column: number): CardType => {
  const kind = getTemplateColumn(template, column)?.kind ?? 'positive';
  if (kind === 'negative') return 'disliked';
  if (kind === 'suggestion') return 'suggestion';
  return 'liked';
};

export const DEFAULT_COLUMN_TITLES = RETRO_TEMPLATES.classic.columns.map((column) => column.title);
export const COLUMN_COUNT = DEFAULT_COLUMN_TITLES.length;
export const LETS_DO_COLUMN_INDEX = RETRO_TEMPLATES.classic.actionColumnIndex ?? 2;
export const DEFAULT_COLUMN_COLORS: ColumnColorId[] = RETRO_TEMPLATES.classic.columns.map((column) => column.color);

export const normalizeColumnColors = (
  colors?: string[] | null,
  template: RetroTemplate = RETRO_TEMPLATES.classic
): ColumnColorId[] => {
  const defaults = template.columns.map((column) => column.color);
  if (!Array.isArray(colors) || colors.length !== defaults.length || !colors.every(isColumnColorId)) {
    return defaults;
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
  arkanoidEnabled: boolean;
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
  updatedAt?: string;
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
  type: CardType;
  createdBy: string;
  likes: string[];
  dislikes: string[];
  column: number;
  originColumn?: number;
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
  template?: RetroTemplateId;
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
  template?: RetroTemplateId;
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
  template?: RetroTemplateId;
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