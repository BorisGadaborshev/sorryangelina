import type {
  ArkanoidScoreEntry,
  Card,
  CardComment,
  CardReaction,
  CardType,
  ChatMessage,
  ColumnColorId,
  DiscussionBurst,
  DiscussionHand,
  DiscussionNavigationState,
  FacilitatorAnnouncement,
  Mood,
  Phase,
  PhaseTimerState,
  RetroRatingState,
  Room,
  RoomFeatures,
  RoomState,
  SprintVipState,
  User,
  WhiteboardStroke
} from './domain';

export type VoteChoice = 'like' | 'dislike';

export interface AddCardPayload {
  text?: string;
  type?: CardType;
  column: number;
  imageUrl?: string;
}

export interface UpdateCardPayload {
  cardId: string;
  text?: string;
  imageUrl?: string | null;
}

export interface CardIdPayload {
  cardId: string;
}

export interface MergeCardsPayload {
  targetCardId: string;
  sourceCardId: string;
}

export interface MoveCardPayload {
  cardId: string;
  column: number;
}

export interface VoteCardPayload {
  cardId: string;
  voteType: VoteChoice;
}

export interface ReadyStatePayload {
  isReady: boolean;
  token?: string;
  roomId?: string;
}

export interface AuthorRevealPayload {
  cardId: string;
  revealed: boolean;
}

export interface CommentPayload {
  cardId: string;
  text: string;
}

export interface UpdateCommentPayload {
  cardId: string;
  commentId: string;
  text: string;
}

export interface ReactionPayload {
  cardId: string;
  emoji: string;
}

export interface SessionRestorePayload {
  roomId: string;
  userId: string;
  username?: string;
  token?: string;
}

export interface CreateRoomPayload {
  roomId: string;
  password?: string;
  username?: string;
  token?: string;
  teamId?: string;
  template?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  password?: string;
  username?: string;
  token?: string;
}

export interface ChangePhasePayload {
  phase: Phase;
}

export interface ColumnTitlesPayload {
  titles: string[];
}

export interface ColumnColorsPayload {
  colors: string[];
}

export interface RoomFeaturesPayload {
  features: Partial<RoomFeatures>;
}

export const PHASE_TIMER_DURATIONS = [60, 180, 300, 600, 900] as const;
export type PhaseTimerDuration = typeof PHASE_TIMER_DURATIONS[number];

export const isPhaseTimerDuration = (value: unknown): value is PhaseTimerDuration =>
  typeof value === 'number' && (PHASE_TIMER_DURATIONS as readonly number[]).includes(value);

export interface PhaseTimerPayload {
  durationSeconds: PhaseTimerDuration;
}

export interface DiscussionNavigationPayload {
  unviewedCardIds: string[];
  viewedCardIds: string[];
}

export interface DiscussionBurstPayload {
  emoji: string;
}

export interface RetroRatingPayload {
  value: 1 | 2 | 3 | 4 | 5;
}

export interface SprintVipPayload {
  userName: string;
}

export interface ArkanoidScorePayload {
  score: number;
  cardsBroken: number;
}

export interface MoodPayload {
  mood: Mood;
}

export interface ChatPayload {
  text: string;
}

export interface BackgroundPayload {
  backgroundImage: string;
}

export interface UserIdPayload {
  userId: string;
}

export interface EmptyPayload {
  [key: string]: never;
}

export interface ClientToServerEvents {
  'restore-session': (payload: SessionRestorePayload) => void;
  'create-room': (payload: CreateRoomPayload) => void;
  'join-room': (payload: JoinRoomPayload) => void;
  'leave-room': (payload?: EmptyPayload) => void;
  disconnect: (reason: string) => void;
  error: (error: unknown) => void;
  'add-card': (payload: AddCardPayload) => void;
  'update-card': (payload: UpdateCardPayload) => void;
  'delete-card': (payload: CardIdPayload) => void;
  'delete-all-cards': (payload?: EmptyPayload) => void;
  'merge-cards': (payload: MergeCardsPayload) => void;
  'unmerge-card': (payload: CardIdPayload) => void;
  'move-card': (payload: MoveCardPayload) => void;
  'vote-card': (payload: VoteCardPayload) => void;
  'update-ready-state': (payload: ReadyStatePayload) => void;
  'set-card-author-reveal': (payload: AuthorRevealPayload) => void;
  'add-card-comment': (payload: CommentPayload) => void;
  'update-card-comment': (payload: UpdateCommentPayload) => void;
  'toggle-card-reaction': (payload: ReactionPayload) => void;
  'change-phase': (payload: ChangePhasePayload) => void;
  'set-column-titles': (payload: ColumnTitlesPayload) => void;
  'set-column-colors': (payload: ColumnColorsPayload) => void;
  'set-room-features': (payload: RoomFeaturesPayload) => void;
  'set-phase-timer': (payload: PhaseTimerPayload) => void;
  'reset-phase-timer': (payload?: EmptyPayload) => void;
  'set-discussion-navigation': (payload: DiscussionNavigationPayload) => void;
  'discussion-burst': (payload: DiscussionBurstPayload) => void;
  'toggle-discussion-hand': (payload?: EmptyPayload) => void;
  'submit-retro-rating': (payload: RetroRatingPayload) => void;
  'show-retro-rating-results': (payload?: EmptyPayload) => void;
  'vote-sprint-vip': (payload: SprintVipPayload) => void;
  'arkanoid-score': (payload: ArkanoidScorePayload) => void;
  'set-user-mood': (payload: MoodPayload) => void;
  'send-chat-message': (payload: ChatPayload) => void;
  'whiteboard-stroke': (payload: WhiteboardStroke) => void;
  'clear-whiteboard': (payload?: EmptyPayload) => void;
  'set-room-background': (payload: BackgroundPayload) => void;
  'transfer-room-admin': (payload: UserIdPayload) => void;
  'kick-user': (payload: UserIdPayload) => void;
  'delete-room': (payload?: EmptyPayload) => void;
  'sync-room': (payload?: EmptyPayload) => void;
}

export type ClientEventName = keyof ClientToServerEvents;

export type ClientEventPayload<E extends ClientEventName> = NonNullable<Parameters<ClientToServerEvents[E]>[0]>;

export interface RoomJoinedPayload {
  room: Room;
  state: RoomState;
  userId: string;
}

export interface ServerToClientEvents {
  error: (message: string) => void;
  'session-expired': () => void;
  kicked: () => void;
  'user-kicked': () => void;
  'room-deleted': () => void;
  'room-joined': (payload: RoomJoinedPayload) => void;
  'state-updated': (state: RoomState) => void;
  'room-version': (payload: { version: number }) => void;
  'user-joined': (user: User) => void;
  'user-left': (user: User) => void;
  'card-added': (card: Card) => void;
  'card-updated': (card: Card) => void;
  'card-deleted': (cardId: string) => void;
  'cards-cleared': () => void;
  'card-moved': (payload: { cardId: string; column: number; originColumn?: number }) => void;
  'card-voted': (payload: { cardId: string; likes: string[]; dislikes: string[] }) => void;
  'card-comment-added': (payload: { cardId: string; comment: CardComment }) => void;
  'card-comment-updated': (payload: { cardId: string; comment: CardComment }) => void;
  'card-reaction-updated': (payload: { cardId: string; reactions: CardReaction[] }) => void;
  'vote-error': (payload: { cardId: string; message: string }) => void;
  'phase-changed': (payload: { phase: Phase; cards: Card[] }) => void;
  'timer-updated': (timer: PhaseTimerState) => void;
  'chat-history': (payload: { messages: ChatMessage[] }) => void;
  'chat-message': (message: ChatMessage) => void;
  'whiteboard-history': (payload: { strokes: WhiteboardStroke[] }) => void;
  'whiteboard-stroke': (stroke: WhiteboardStroke) => void;
  'whiteboard-cleared': () => void;
  'retro-rating-state': (rating: RetroRatingState) => void;
  'facilitator-selected': (announcement: FacilitatorAnnouncement | null) => void;
  'discussion-navigation': (state: DiscussionNavigationState) => void;
  'discussion-hands': (payload: { hands: DiscussionHand[] }) => void;
  'discussion-burst': (burst: DiscussionBurst) => void;
  'column-titles-updated': (payload: { titles: string[] }) => void;
  'column-colors-updated': (payload: { colors: ColumnColorId[] }) => void;
  'room-features-updated': (payload: { features: RoomFeatures }) => void;
  'room-background-updated': (payload: { backgroundImage: string }) => void;
  'sprint-vip-state': (state: SprintVipState) => void;
  'arkanoid-scores': (payload: { scores: ArkanoidScoreEntry[] }) => void;
}
