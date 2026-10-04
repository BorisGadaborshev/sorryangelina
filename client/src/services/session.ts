export interface TabSession {
  roomId: string;
  userId: string;
  username: string;
}

const TAB_SESSION_KEY = 'retroTabSession';

const canUseSessionStorage = (): boolean => typeof sessionStorage !== 'undefined';

const parseSession = (raw: string | null): TabSession | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TabSession>;
    if (!parsed.roomId || !parsed.userId || !parsed.username) return null;
    return {
      roomId: parsed.roomId,
      userId: parsed.userId,
      username: parsed.username
    };
  } catch {
    return null;
  }
};

export const readTabSession = (): TabSession | null => {
  if (!canUseSessionStorage()) return null;
  return parseSession(sessionStorage.getItem(TAB_SESSION_KEY));
};

const readLegacySession = (): TabSession | null => {
  const roomId = localStorage.getItem('roomId');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  if (!roomId || !userId || !username) return null;
  return { roomId, userId, username };
};

export const readStoredSession = (): TabSession | null => {
  const tabSession = readTabSession();
  if (tabSession) return tabSession;
  const legacy = readLegacySession();
  if (!legacy) return null;
  writeTabSession(legacy);
  return legacy;
};

export const writeTabSession = (session: TabSession): void => {
  if (canUseSessionStorage()) {
    sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(session));
  }
  localStorage.setItem('userId', session.userId);
  localStorage.setItem('roomId', session.roomId);
  localStorage.setItem('username', session.username);
};

export const clearStoredSession = (): void => {
  if (canUseSessionStorage()) {
    sessionStorage.removeItem(TAB_SESSION_KEY);
    sessionStorage.removeItem('roomPassword');
  }
  localStorage.removeItem('userId');
  localStorage.removeItem('roomId');
  localStorage.removeItem('username');
};

export const cardDraftKey = (roomId: string, columnIndex: number): string =>
  `draft:${roomId}:${columnIndex}`;
