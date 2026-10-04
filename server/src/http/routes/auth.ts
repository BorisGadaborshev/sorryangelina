import { Router } from 'express';
import { logger } from '../../utils/logger';
import { AccountService } from '../../services/AccountService';
import { TeamService } from '../../services/TeamService';
import { signAuthToken } from '../../config/jwt';
import { authRateLimit } from '../rateLimit';

const buildAuthResponse = (profile: { name: string; type: 'fixed' | 'registered' | 'guest' }) => {
  const { token, expiresAt } = signAuthToken(profile.name, profile.type);
  return {
    profile: {
      ...profile,
      token,
      expiresAt
    }
  };
};

export const authRouter = Router();

authRouter.use(authRateLimit);

authRouter.post('/fixed-users', (req, res) => {
  const { accessCode } = req.body as { accessCode?: string };
  if (!TeamService.verifyBuiltinAccessCode(accessCode)) {
    res.status(403).json({ error: 'Invalid access code' });
    return;
  }
  res.json({ users: AccountService.getFixedUsers() });
});

authRouter.post('/fixed-login', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: 'Name and password are required' });
    return;
  }

  try {
    const result = await AccountService.fixedLogin(name, password);
    res.json({
      ...buildAuthResponse(result.profile),
      isFirstLogin: result.isFirstLogin
    });
  } catch (error) {
    logger.error({ err: error }, 'fixed login error');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: 'Name and password are required' });
    return;
  }

  try {
    const profile = await AccountService.login(name, password);
    res.json(buildAuthResponse(profile));
  } catch (error) {
    logger.error({ err: error }, 'login error');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login' });
  }
});

authRouter.post('/register', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    res.status(400).json({ error: 'Name and password are required' });
    return;
  }

  try {
    const profile = await AccountService.register(name, password);
    res.json(buildAuthResponse(profile));
  } catch (error) {
    logger.error({ err: error }, 'register error');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to register' });
  }
});

authRouter.post('/guest', async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  try {
    const profile = await AccountService.guestLogin(name);
    res.json(buildAuthResponse(profile));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to login as guest' });
  }
});
