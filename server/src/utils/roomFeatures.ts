import { RoomFeatures, VoteLimit } from '../types';

export const DEFAULT_ROOM_FEATURES: RoomFeatures = {
  mediaEnabled: true,
  reactionsEnabled: true,
  commentsEnabled: true,
  moveCardsEnabled: true,
  anonymousEnabled: true,
  hideCardTextDuringCreation: true,
  likesPerUser: 3,
  dislikesPerUser: 3,
  dislikesEnabled: true,
  musicEnabled: true,
  retroRatingEnabled: true,
  sprintVipEnabled: true,
  drawingEnabled: true,
  cardEditingEnabled: true,
  chatEnabled: true,
  readyEnabled: true
};

const isVoteLimit = (value: unknown): value is VoteLimit =>
  value === 1 || value === 3 || value === 5;

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

  return {
    mediaEnabled: raw?.mediaEnabled ?? DEFAULT_ROOM_FEATURES.mediaEnabled,
    reactionsEnabled: raw?.reactionsEnabled ?? DEFAULT_ROOM_FEATURES.reactionsEnabled,
    commentsEnabled: raw?.commentsEnabled ?? DEFAULT_ROOM_FEATURES.commentsEnabled,
    moveCardsEnabled: raw?.moveCardsEnabled ?? DEFAULT_ROOM_FEATURES.moveCardsEnabled,
    anonymousEnabled: resolveAnonymousEnabled(raw),
    hideCardTextDuringCreation: raw?.hideCardTextDuringCreation ?? DEFAULT_ROOM_FEATURES.hideCardTextDuringCreation,
    likesPerUser: resolveVoteLimit(raw?.likesPerUser, legacyVotesPerUser, DEFAULT_ROOM_FEATURES.likesPerUser),
    dislikesPerUser: resolveVoteLimit(raw?.dislikesPerUser, legacyVotesPerUser, DEFAULT_ROOM_FEATURES.dislikesPerUser),
    dislikesEnabled: raw?.dislikesEnabled ?? DEFAULT_ROOM_FEATURES.dislikesEnabled,
    musicEnabled: raw?.musicEnabled ?? DEFAULT_ROOM_FEATURES.musicEnabled,
    retroRatingEnabled: raw?.retroRatingEnabled ?? DEFAULT_ROOM_FEATURES.retroRatingEnabled,
    sprintVipEnabled: raw?.sprintVipEnabled ?? DEFAULT_ROOM_FEATURES.sprintVipEnabled,
    drawingEnabled: raw?.drawingEnabled ?? DEFAULT_ROOM_FEATURES.drawingEnabled,
    cardEditingEnabled: raw?.cardEditingEnabled ?? DEFAULT_ROOM_FEATURES.cardEditingEnabled,
    chatEnabled: raw?.chatEnabled ?? DEFAULT_ROOM_FEATURES.chatEnabled,
    readyEnabled: raw?.readyEnabled ?? DEFAULT_ROOM_FEATURES.readyEnabled
  };
};
