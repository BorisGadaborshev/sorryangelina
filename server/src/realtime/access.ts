import { Room, User } from '../types';
import { assertNoProfanity } from '../services/ContentModeration';
import { normalizeRoomFeatures } from '../utils/roomFeatures';

export const isRoomAdmin = (room: Pick<Room, 'owner' | 'users'>, userName: string): boolean => {
  if (room.owner === userName) return true;
  return room.users.some((user: User) => user.name === userName && user.role === 'admin');
};

export const moderateRoomText = async (room: Room, text: string | undefined): Promise<void> => {
  const trimmed = text?.trim();
  if (!trimmed || !normalizeRoomFeatures(room.features).contentModerationEnabled) return;
  await assertNoProfanity([{ kind: 'card', text: trimmed }]);
};
