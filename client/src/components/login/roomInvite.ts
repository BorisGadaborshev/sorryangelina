const GREETING = 'Привет! Зову вас на ретро.';
const OUTRO = 'Заходите, будем разбирать итоги спринта.';

const resolveAuthLink = (): string => {
  const publicAuthUrl = (import.meta.env.VITE_PUBLIC_AUTH_URL || '').trim();
  if (publicAuthUrl) return new URL(publicAuthUrl).toString();
  return typeof window !== 'undefined' ? new URL('/', window.location.href).toString() : '';
};

interface InviteInput {
  roomId: string;
  password: string;
  hasPassword: boolean | undefined;
}

export const buildRoomInvite = ({ roomId, password, hasPassword }: InviteInput) => {
  const authLink = resolveAuthLink();
  const passwordLine = password.trim() ? `Пароль: ${password.trim()}` : null;
  const canInvite = Boolean(passwordLine) || hasPassword === false;
  const roomLines = [GREETING, '', `Комната: ${roomId}`, ...(passwordLine ? [passwordLine] : [])];

  const message = canInvite ? [...roomLines, '🔗 Вход:', authLink, '', OUTRO].join('\n') : '';
  const telegramText = canInvite ? [...roomLines, '', OUTRO].join('\n') : '';
  const telegramLink = `https://t.me/share/url?url=${encodeURIComponent(authLink)}&text=${encodeURIComponent(
    telegramText || `${GREETING}\nКомната: ${roomId}`
  )}`;

  return { message, telegramLink };
};
