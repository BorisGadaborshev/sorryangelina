export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';
export const PHASES = ['creation', 'grouping', 'voting', 'discussion', 'roadmap', 'rating'] as const;
export type Phase = (typeof PHASES)[number];

export const isOrganizePhase = (phase: Phase): boolean =>
  phase === 'creation' || phase === 'grouping';

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
  tooltip?: string;
  color: ColumnColorId;
  kind: ColumnKind;
}

export interface RetroTemplate {
  id: RetroTemplateId;
  name: string;
  description: string;
  columns: RetroTemplateColumn[];
  actionColumnIndex: number | null;
  roadmapColumns: RetroTemplateColumn[];
}

export const ROADMAP_TASK_INDEX = 1;

export const getRoadmapTaskColumn = (template: RetroTemplate): number =>
  template.columns.length + ROADMAP_TASK_INDEX;

export const isRoadmapTaskColumn = (template: RetroTemplate, column: number): boolean =>
  column === getRoadmapTaskColumn(template);

export const isDiscussionCard = (card: { column: number }, template: RetroTemplate): boolean =>
  card.column >= 0 && card.column < template.columns.length;

export const sortCardsByVotes = (cards: Card[]): Card[] =>
  [...cards].sort((left, right) => {
    const scoreLeft = (left.likes?.length || 0) + (left.dislikes?.length || 0);
    const scoreRight = (right.likes?.length || 0) + (right.dislikes?.length || 0);
    return scoreRight - scoreLeft;
  });

export const getDiscussionCards = (cards: Card[], template: RetroTemplate): Card[] =>
  sortCardsByVotes(cards.filter((card) => isDiscussionCard(card, template)));

export const ROADMAP_COLUMNS: RetroTemplateColumn[] = [
  {
    title: 'Анализ',
    hint: 'В чём проблема и что может её решить?',
    tooltip: 'Анализ — в чём проблема и что может её решить.',
    color: 'indigo',
    kind: 'suggestion'
  },
  {
    title: 'Задача',
    hint: 'Как проверить это на практике?',
    tooltip: 'Задача — как проверить на практике.',
    color: 'purple',
    kind: 'suggestion'
  },
  {
    title: 'Результат',
    hint: 'Что получилось после внедрения?',
    tooltip: 'Результат — что получилось после внедрения (заполняется на следующей ретроспективе).',
    color: 'green',
    kind: 'suggestion'
  }
];

export const RETRO_TEMPLATES: Record<RetroTemplateId, RetroTemplate> = {
  classic: {
    id: 'classic',
    name: 'Классика',
    description: 'Что получилось, что мешало и какие действия берём',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
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
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      {
        title: 'Start',
        hint: 'Какие новые практики, инструменты и подходы помогут работать эффективнее?',
        tooltip: 'Start (начать).\nКакие новые практики, инструменты и подходы помогут работать эффективнее?',
        color: 'green',
        kind: 'suggestion'
      },
      {
        title: 'Stop',
        hint: 'От каких действий, встреч или сложившихся практик нужно отказаться?',
        tooltip: 'Stop (прекратить).\nОт каких действий, встреч или сложившихся практик нужно отказаться, потому что они тратят время, демотивируют и не несут пользы?',
        color: 'pink',
        kind: 'negative'
      },
      {
        title: 'Continue',
        hint: 'Какие существующие практики отлично работают, и нужно их сохранить?',
        tooltip: 'Continue (продолжить).\nКакие существующие практики отлично работают, и нужно их сохранить?',
        color: 'teal',
        kind: 'positive'
      }
    ]
  },
  sailboat: {
    id: 'sailboat',
    name: 'Парусник',
    description: 'Что двигает вперёд, что тормозит, какие риски и куда плывём',
    actionColumnIndex: 3,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      {
        title: 'Паруса',
        hint: 'Что даёт энергию и ускоряет процессы?',
        tooltip: 'Паруса (движущая сила).\nДают энергию и ускоряют процессы — успешные практики, мотивация, инструменты.',
        color: 'teal',
        kind: 'positive'
      },
      {
        title: 'Якоря',
        hint: 'Что замедляет или останавливает работу?',
        tooltip: 'Якоря (тормозящие факторы).\nЗамедляют или останавливают работу — рутина, блокеры, бюрократия, ошибки.',
        color: 'slate',
        kind: 'negative'
      },
      {
        title: 'Рифы',
        hint: 'Что может пойти не так?',
        tooltip: 'Рифы (риски).\nПоказывают, что может пойти не так — препятствия, ограничения, внешние угрозы.',
        color: 'orange',
        kind: 'negative'
      },
      {
        title: 'Земля',
        hint: 'К какому результату плывёт команда?',
        tooltip: 'Земля (цели).\nУказывают на результат, к которому «плывёт» команда — видение команды, цель спринта или проекта.',
        color: 'blue',
        kind: 'suggestion'
      }
    ]
  },
  'four-ls': {
    id: 'four-ls',
    name: '4L',
    description: 'Что понравилось, чему научились, чего не хватило и чего хотим',
    actionColumnIndex: 3,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      {
        title: 'Liked',
        hint: 'Какие события, действия или результаты вызвали положительные эмоции?',
        tooltip: 'Liked (понравилось, закрепляем успех).\nКакие события, действия или результаты вызвали положительные эмоции.',
        color: 'teal',
        kind: 'positive'
      },
      {
        title: 'Learned',
        hint: 'Чему научились, что поняли о проекте или друг о друге?',
        tooltip: 'Learned (изучили, фиксируем рост).\nЧему научились, что поняли о проекте или друг о друге.',
        color: 'cyan',
        kind: 'positive'
      },
      {
        title: 'Lacked',
        hint: 'Какого ресурса, информации, инструмента не хватило для эффективной работы?',
        tooltip: 'Lacked (не хватило, выделяем дефициты).\nКакого ресурса, информации, инструмента не хватило для эффективной работы.',
        color: 'pink',
        kind: 'negative'
      },
      {
        title: 'Longed For',
        hint: 'Какие амбициозные улучшения нужны для идеального сценария выполнения?',
        tooltip: 'Longed For (желаемое, формулируем потребности).\nКакие амбициозные улучшения нужны для идеального сценария выполнения.',
        color: 'purple',
        kind: 'suggestion'
      }
    ]
  },
  'traffic-light': {
    id: 'traffic-light',
    name: 'Светофор',
    description: 'Зелёный, жёлтый и красный, затем дорожная карта',
    actionColumnIndex: null,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      {
        title: 'Зелёный',
        hint: 'Что работает отлично и не требует изменений?',
        tooltip: '🟢 Зелёный — работает отлично и не требует изменений.',
        color: 'green',
        kind: 'positive'
      },
      {
        title: 'Жёлтый',
        hint: 'Что работает с напряжением и требует постоянного контроля?',
        tooltip: '🟡 Жёлтый — работает с напряжением и требует постоянного контроля.',
        color: 'amber',
        kind: 'negative'
      },
      {
        title: 'Красный',
        hint: 'Что работает плохо, постоянно мешает и требует вмешательства?',
        tooltip: '🔴 Красный — работает плохо, постоянно мешает и требует вмешательства.',
        color: 'pink',
        kind: 'negative'
      }
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
  groupingEnabled: boolean;
  roadmapEnabled: boolean;
  retroRatingEnabled: boolean;
  sprintVipEnabled: boolean;
  drawingEnabled: boolean;
  arkanoidEnabled: boolean;
  cardEditingEnabled: boolean;
  chatEnabled: boolean;
  readyEnabled: boolean;
  facilitatorEnabled: boolean;
  discussionActionsEnabled: boolean;
  contentModerationEnabled: boolean;
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
  groupingEnabled: true,
  roadmapEnabled: true,
  retroRatingEnabled: true,
  sprintVipEnabled: true,
  drawingEnabled: true,
  arkanoidEnabled: true,
  cardEditingEnabled: true,
  chatEnabled: true,
  readyEnabled: true,
  facilitatorEnabled: false,
  discussionActionsEnabled: true,
  contentModerationEnabled: false,
  backgroundImage: ''
};

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

export const DISCUSSION_BURST_EMOJIS = ['😂', '😭', '😠', '👍', '👎', '😮', '🤮', '👏', '❤️', '🔥', '🎉', '🥰'] as const;
export type DiscussionBurstEmoji = typeof DISCUSSION_BURST_EMOJIS[number];

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

export const alignSegmentAuthors = (
  text: string,
  createdBy: string,
  segmentAuthors?: string[] | null
): string[] => {
  const fallback = createdBy.trim();
  return getCardTextSegments(text).map((_, index) => segmentAuthors?.[index]?.trim() || fallback);
};

export const mergeSegmentAuthors = (
  targetText: string,
  targetCreatedBy: string,
  targetAuthors: string[] | undefined,
  sourceText: string,
  sourceCreatedBy: string,
  sourceAuthors: string[] | undefined
): string[] => [
  ...alignSegmentAuthors(targetText, targetCreatedBy, targetAuthors),
  ...alignSegmentAuthors(sourceText, sourceCreatedBy, sourceAuthors)
];

export const compactSegmentAuthors = (authors: string[], createdBy: string): string[] | undefined => {
  if (authors.length <= 1 && (!authors[0] || authors[0] === createdBy)) return undefined;
  return authors;
};

export const isCardSegmentAuthor = (
  card: { text: string; createdBy: string; segmentAuthors?: string[] },
  name: string
): boolean => {
  const normalized = name.trim();
  if (!normalized) return false;
  return alignSegmentAuthors(card.text, card.createdBy, card.segmentAuthors).includes(normalized);
};

export const CARD_TASK_STATUSES = [
  'analysis',
  'execution',
  'testing',
  'done',
  'closed'
] as const;

export type CardTaskStatus = (typeof CARD_TASK_STATUSES)[number];

export const DEFAULT_CARD_TASK_STATUS: CardTaskStatus = 'analysis';

export const CARD_TASK_STATUS_LABELS: Record<CardTaskStatus, string> = {
  analysis: 'Анализ',
  execution: 'Исполнение',
  testing: 'Тестирование',
  done: 'Выполнено',
  closed: 'Закрыто'
};

export const isCardTaskStatus = (value: unknown): value is CardTaskStatus =>
  typeof value === 'string' && (CARD_TASK_STATUSES as readonly string[]).includes(value);

export interface CardTask {
  assignees: string[];
  status?: CardTaskStatus;
  dueDate?: string;
  sprint?: string;
  effortDays?: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const isOpenCardTaskStatus = (status?: CardTaskStatus): boolean =>
  status !== 'done' && status !== 'closed';

export const isOpenRoadmapTaskCard = (card: Card, template: RetroTemplate): boolean =>
  isRoadmapTaskColumn(template, card.column) && isOpenCardTaskStatus(card.task?.status);

export interface RoomSnapshotForTaskCarry {
  id: string;
  template?: RetroTemplateId;
  cards: Card[];
}

export const selectOpenTasksFromPreviousSprints = (
  previousRoomsNewestFirst: RoomSnapshotForTaskCarry[]
): Card[] => {
  for (const room of previousRoomsNewestFirst) {
    const template = getRetroTemplate(room.template);
    const taskCards = room.cards.filter((card) => isRoadmapTaskColumn(template, card.column));
    if (taskCards.length === 0) continue;
    return taskCards.filter((card) => isOpenCardTaskStatus(card.task?.status));
  }
  return [];
};

export const cloneTaskCardForNextSprint = (
  card: Card,
  nextTemplate: RetroTemplate,
  nextId: string
): Card => {
  const column = getRoadmapTaskColumn(nextTemplate);
  const originInRange = card.originColumn != null
    && card.originColumn >= 0
    && card.originColumn < nextTemplate.columns.length;
  return {
    id: nextId,
    text: card.text,
    type: getCardTypeByColumn(nextTemplate, column),
    createdBy: card.createdBy,
    likes: [],
    dislikes: [],
    column,
    originColumn: originInRange ? card.originColumn : undefined,
    authorRevealed: card.authorRevealed,
    segmentAuthors: card.segmentAuthors,
    task: card.task
      ? { ...card.task, assignees: [...card.task.assignees] }
      : { assignees: [], status: DEFAULT_CARD_TASK_STATUS }
  };
};

export const normalizeCardTask = (raw: unknown): CardTask | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const assignees = Array.isArray(source.assignees)
    ? [...new Set(
      source.assignees
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0 && item.length <= 80)
    )].slice(0, 12)
    : [];
  const dueDate = typeof source.dueDate === 'string' && DATE_ONLY.test(source.dueDate)
    ? source.dueDate
    : undefined;
  const sprint = typeof source.sprint === 'string' ? source.sprint.trim().slice(0, 40) : '';
  const effort = Number(source.effortDays);
  const effortDays = Number.isFinite(effort) && effort > 0
    ? Math.min(100, Math.round(effort * 2) / 2)
    : undefined;
  const status = isCardTaskStatus(source.status) ? source.status : undefined;
  if (assignees.length === 0 && !dueDate && !sprint && effortDays == null && !status) return undefined;
  return {
    assignees,
    status: status ?? DEFAULT_CARD_TASK_STATUS,
    dueDate,
    sprint: sprint || undefined,
    effortDays
  };
};

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
  authorRevealed?: boolean;
  segmentAuthors?: string[];
  task?: CardTask;
}

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
  version?: number;
}

export interface PhaseTimerState {
  phase?: Phase;
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
  endAt?: number;
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

export interface DiscussionBurst {
  id: string;
  emoji: string;
  userName: string;
}

export interface DiscussionHand {
  userName: string;
}

export interface SprintVipState {
  vipUserName?: string;
  voteCount: number;
  myVote?: string;
}

export interface ArkanoidScoreEntry {
  userName: string;
  score: number;
  cardsBroken: number;
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

export type AuthProfileType = 'fixed' | 'registered' | 'guest';

export type TeamRole = 'admin' | 'user';

export interface TeamMember {
  teamId: string;
  name: string;
  role: TeamRole;
}

export interface TeamRoomSettings {
  template: RetroTemplateId;
  columnTitles: string[];
  columnColors: ColumnColorId[];
  features: RoomFeatures;
}

export const DEFAULT_TEAM_ROOM_SETTINGS: TeamRoomSettings = {
  template: 'classic',
  columnTitles: [...DEFAULT_COLUMN_TITLES],
  columnColors: [...DEFAULT_COLUMN_COLORS],
  features: { ...DEFAULT_ROOM_FEATURES }
};

export interface Team {
  id: string;
  name: string;
  owner: string;
  createdAt?: string;
  members: TeamMember[];
  roomSettings?: TeamRoomSettings;
}

export interface AvailableTeam {
  id: string;
  name: string;
  owner: string;
  membersCount: number;
  createdAt?: string;
}
