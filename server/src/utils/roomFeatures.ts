import { isDislikeIconId, isLikeIconId, MAX_VOTE_LIMIT, MIN_VOTE_LIMIT, RoomFeatures, VoteLimit } from '../types';

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

const MAX_BACKGROUND_IMAGE_LENGTH = 3 * 1024 * 1024;

export const normalizeBackgroundImage = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_BACKGROUND_IMAGE_LENGTH) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed)) return trimmed;
  if (/^\/(?:api\/)?uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) return trimmed;
  return '';
};

const isVoteLimit = (value: unknown): value is VoteLimit =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_VOTE_LIMIT && value <= MAX_VOTE_LIMIT;

const resolveVoteLimit = (
  value: unknown,
  legacyVotesPerUser: unknown,
  fallback: VoteLimit
): VoteLimit => {
  if (isVoteLimit(value)) return value;
  if (isVoteLimit(legacyVotesPerUser)) return legacyVotesPerUser;
  return fallback;
};

const resolveAnonymousEnabled = (
  raw?: Partial<RoomFeatures> & { cardAuthorEnabled?: boolean } | null
): boolean => {
  if (typeof raw?.anonymousEnabled === 'boolean') {
    return raw.anonymousEnabled;
  }
  if (typeof raw?.cardAuthorEnabled === 'boolean') {
    return !raw.cardAuthorEnabled;
  }
  return DEFAULT_ROOM_FEATURES.anonymousEnabled;
};

export const normalizeRoomFeatures = (raw?: Partial<RoomFeatures> & { votesPerUser?: VoteLimit; cardAuthorEnabled?: boolean } | null): RoomFeatures => {
  const legacyVotesPerUser = raw?.votesPerUser;
  const likeIcon = raw?.likeIcon;
  const dislikeIcon = raw?.dislikeIcon;

  return {
    mediaEnabled: raw?.mediaEnabled ?? DEFAULT_ROOM_FEATURES.mediaEnabled,
    reactionsEnabled: raw?.reactionsEnabled ?? DEFAULT_ROOM_FEATURES.reactionsEnabled,
    commentsEnabled: raw?.commentsEnabled ?? DEFAULT_ROOM_FEATURES.commentsEnabled,
    moveCardsEnabled: raw?.moveCardsEnabled ?? DEFAULT_ROOM_FEATURES.moveCardsEnabled,
    membersCanAddCards: raw?.membersCanAddCards ?? DEFAULT_ROOM_FEATURES.membersCanAddCards,
    anonymousEnabled: resolveAnonymousEnabled(raw),
    hideCardTextDuringCreation: raw?.hideCardTextDuringCreation ?? DEFAULT_ROOM_FEATURES.hideCardTextDuringCreation,
    likesPerUser: resolveVoteLimit(raw?.likesPerUser, legacyVotesPerUser, DEFAULT_ROOM_FEATURES.likesPerUser),
    dislikesPerUser: resolveVoteLimit(raw?.dislikesPerUser, legacyVotesPerUser, DEFAULT_ROOM_FEATURES.dislikesPerUser),
    likeIcon: isLikeIconId(likeIcon) ? likeIcon : DEFAULT_ROOM_FEATURES.likeIcon,
    dislikeIcon: isDislikeIconId(dislikeIcon) ? dislikeIcon : DEFAULT_ROOM_FEATURES.dislikeIcon,
    dislikesEnabled: raw?.dislikesEnabled ?? DEFAULT_ROOM_FEATURES.dislikesEnabled,
    musicEnabled: raw?.musicEnabled ?? DEFAULT_ROOM_FEATURES.musicEnabled,
    retroRatingEnabled: raw?.retroRatingEnabled ?? DEFAULT_ROOM_FEATURES.retroRatingEnabled,
    sprintVipEnabled: raw?.sprintVipEnabled ?? DEFAULT_ROOM_FEATURES.sprintVipEnabled,
    drawingEnabled: raw?.drawingEnabled ?? DEFAULT_ROOM_FEATURES.drawingEnabled,
    cardEditingEnabled: raw?.cardEditingEnabled ?? DEFAULT_ROOM_FEATURES.cardEditingEnabled,
    chatEnabled: raw?.chatEnabled ?? DEFAULT_ROOM_FEATURES.chatEnabled,
    readyEnabled: raw?.readyEnabled ?? DEFAULT_ROOM_FEATURES.readyEnabled,
    facilitatorEnabled: raw?.facilitatorEnabled ?? DEFAULT_ROOM_FEATURES.facilitatorEnabled,
    backgroundImage: normalizeBackgroundImage(raw?.backgroundImage)
  };
};
