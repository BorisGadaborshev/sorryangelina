import { Socket } from 'socket.io';
import { AuthTokenPayload, verifyAuthToken } from '../config/jwt';
import { AuthProfileType } from '../types';

const AUTH_TYPES: AuthProfileType[] = ['fixed', 'registered', 'guest'];

const isAuthPayload = (value: unknown): value is AuthTokenPayload => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { name?: unknown; type?: unknown };
  return typeof candidate.name === 'string'
    && AUTH_TYPES.includes(candidate.type as AuthProfileType);
};

// A token in the event payload wins. An empty payload falls back to the
// token already checked in the handshake, so handlers keep working when
// the client stops repeating it on every event.
export function eventAuth(socket: Socket, token: unknown): AuthTokenPayload | null {
  if (typeof token === 'string' && token.trim()) {
    return verifyAuthToken(token);
  }
  return isAuthPayload(socket.data.auth) ? socket.data.auth : null;
}
