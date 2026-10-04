import { NextFunction, Request, Response } from 'express';
import { AuthTokenPayload, verifyAuthToken } from '../config/jwt';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const auth = verifyAuthToken(token);

  if (!auth) {
    res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
    return;
  }

  res.locals.auth = auth;
  next();
};

export const readAuth = (res: Response): AuthTokenPayload => res.locals.auth as AuthTokenPayload;
