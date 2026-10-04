const SERVER_ERROR_MESSAGES: Record<string, string> = {
  'Invalid password': 'Неверный пароль комнаты',
  'Unauthorized: token is invalid or expired': 'Сессия истекла. Войдите снова',
  'Unauthorized: token does not match user': 'Сессия не совпадает с пользователем',
  'Room already exists': 'Комната с таким именем уже есть',
  'Join the team before creating a room': 'Сначала вступите в команду',
  'Team password is required': 'Нужен пароль команды'
};

export type SessionErrorCode = 'timeout' | 'expired' | 'password' | 'auth' | 'other';

export class SessionError extends Error {
  readonly code: SessionErrorCode;

  constructor(message: string, code: SessionErrorCode) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

export const mapServerError = (message: string): string => {
  const trimmed = message.trim();
  if (!trimmed) return 'Что-то пошло не так. Попробуйте ещё раз';
  if (SERVER_ERROR_MESSAGES[trimmed]) return SERVER_ERROR_MESSAGES[trimmed];
  if (/unauthorized/i.test(trimmed)) return 'Нужно войти снова';
  if (/invalid password/i.test(trimmed)) return 'Неверный пароль комнаты';
  if (/timeout/i.test(trimmed)) return 'Сервер не ответил вовремя. Проверьте соединение';
  if (/^[\u0020-\u007E]+$/.test(trimmed)) return 'Что-то пошло не так. Попробуйте ещё раз';
  return trimmed;
};

export const classifyServerError = (message: string): SessionErrorCode => {
  if (/timeout/i.test(message)) return 'timeout';
  if (/session-expired/i.test(message)) return 'expired';
  if (/password/i.test(message)) return 'password';
  if (/unauthorized/i.test(message)) return 'auth';
  return 'other';
};

export const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.name === 'AbortError';
};
