import crypto from 'crypto';
import { AuthProfileType } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

export interface AuthTokenPayload {
  name: string;
  type: AuthProfileType;
  iat: number;
  exp: number;
}

interface SignedToken {
  token: string;
  expiresAt: number;
}

const base64UrlEncode = (value: string): string =>
  Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf-8');
};

const signRaw = (input: string): string =>
  crypto.createHmac('sha256', JWT_SECRET).update(input).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export const signAuthToken = (name: string, type: AuthProfileType): SignedToken => {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    name,
    type,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signRaw(`${encodedHeader}.${encodedPayload}`);
  const token = `${encodedHeader}.${encodedPayload}.${signature}`;

  return {
    token,
    expiresAt: payload.exp * 1000
  };
};

export const verifyAuthToken = (token?: string): AuthTokenPayload | null => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = signRaw(`${encodedHeader}.${encodedPayload}`);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthTokenPayload;
    if (!payload?.name || !payload?.type || !payload?.exp || !payload?.iat) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
};
