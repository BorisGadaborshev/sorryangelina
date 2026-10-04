import { Response, Router } from 'express';
import { BUILTIN_TEAM_ID, TeamService } from '../../services/TeamService';
import { AccountService } from '../../services/AccountService';
import { RoomService } from '../../services/RoomService';
import { verifyAuthToken } from '../../config/jwt';
import { readAuth, requireAuth } from '../authMiddleware';
import { authRateLimit } from '../rateLimit';

const normalizeNameList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean);
};

const rejectGuestImpersonation = async (
  auth: { name: string; type: string },
  res: Response
): Promise<boolean> => {
  if (auth.type === 'guest' && await AccountService.hasAccount(auth.name)) {
    res.status(403).json({ error: 'Это имя занято, войдите с паролем' });
    return true;
  }
  return false;
};

export const teamsRouter = Router();

teamsRouter.get('/', async (_req, res) => {
  try {
    const teams = await TeamService.getAllTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error getting teams:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

teamsRouter.post('/', requireAuth, async (req, res) => {
  const auth = readAuth(res);
  const { name, password, members, scrumMasterName } = req.body as {
    name?: string;
    password?: string;
    members?: string[];
    scrumMasterName?: string;
  };

  if (!name?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Team name and password are required' });
    return;
  }

  try {
    const team = await TeamService.createTeam({
      name,
      password,
      owner: auth.name,
      members: normalizeNameList(members),
      scrumMasterName
    });
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create team' });
  }
});

teamsRouter.post('/:teamId/unlock', authRateLimit, async (req, res) => {
  const { password } = req.body as { password?: string };

  try {
    const members = await TeamService.unlockTeamRoster(req.params.teamId, password);
    res.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unlock team';
    if (message !== 'Team password is required' && message !== 'Invalid team password') {
      console.error('Error unlocking team:', error);
    }
    const status = message === 'Team not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

teamsRouter.post('/:teamId/join', authRateLimit, requireAuth, async (req, res) => {
  const auth = readAuth(res);
  const { password } = req.body as { password?: string };
  const isFixedBuiltinJoin = req.params.teamId === BUILTIN_TEAM_ID && auth.type === 'fixed';

  try {
    const team = isFixedBuiltinJoin
      ? await TeamService.joinBuiltinTeamForFixedUser(auth.name)
      : await TeamService.joinTeam(req.params.teamId, password, auth.name);
    res.json(team);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join team';
    if (message !== 'Team password is required') {
      console.error('Error joining team:', error);
    }
    res.status(400).json({ error: message });
  }
});

teamsRouter.get('/:teamId', requireAuth, async (req, res) => {
  const auth = readAuth(res);

  try {
    const team = await TeamService.getTeam(req.params.teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (!TeamService.isTeamMember(team, auth.name)) {
      res.status(403).json({ error: 'Only team members can view this team' });
      return;
    }
    if (!(await TeamService.hasUnlockedTeamPassword(team, auth.name))) {
      res.status(403).json({ error: 'Team password is required' });
      return;
    }
    res.json(team);
  } catch (error) {
    console.error('Error getting team:', error);
    res.status(500).json({ error: 'Failed to get team' });
  }
});

teamsRouter.delete('/:teamId/members', requireAuth, async (req, res) => {
  const auth = readAuth(res);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Member name is required' });
    return;
  }
  if (await rejectGuestImpersonation(auth, res)) return;

  try {
    const team = await TeamService.removeMember(req.params.teamId, auth.name, name);
    res.json(team);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    const status = message === 'Team not found' ? 404 : message.includes('Только админ команды') ? 403 : 400;
    console.error('Error removing team member:', error);
    res.status(status).json({ error: message });
  }
});

teamsRouter.post('/:teamId/members/reset-password', requireAuth, async (req, res) => {
  const auth = readAuth(res);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Member name is required' });
    return;
  }
  if (await rejectGuestImpersonation(auth, res)) return;

  try {
    const result = await TeamService.resetMemberPassword(req.params.teamId, auth.name, name);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    const status = message === 'Team not found' ? 404 : message.includes('Только админ команды') ? 403 : 400;
    console.error('Error resetting member password:', error);
    res.status(status).json({ error: message });
  }
});

teamsRouter.post('/:teamId/password', requireAuth, async (req, res) => {
  const auth = readAuth(res);
  const { password } = req.body as { password?: string };
  if (!password?.trim()) {
    res.status(400).json({ error: 'Team password is required' });
    return;
  }
  if (await rejectGuestImpersonation(auth, res)) return;

  try {
    const team = await TeamService.changeTeamPassword(req.params.teamId, auth.name, password);
    res.json(team);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update team password';
    const status = message === 'Team not found' ? 404 : message.includes('Только админ команды') ? 403 : 400;
    console.error('Error updating team password:', error);
    res.status(status).json({ error: message });
  }
});

teamsRouter.get('/:teamId/members', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const auth = verifyAuthToken(token);
  const accessCode = typeof req.headers['x-subo-access'] === 'string'
    ? req.headers['x-subo-access']
    : undefined;

  if (req.params.teamId === BUILTIN_TEAM_ID) {
    if (!TeamService.canAccessBuiltinRoster(auth, accessCode)) {
      res.status(403).json({ error: 'Access code required' });
      return;
    }
  }

  try {
    const members = await TeamService.getTeamRosterNames(req.params.teamId);
    res.json({ members });
  } catch (error) {
    console.error('Error getting team members:', error);
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

teamsRouter.get('/:teamId/rooms', async (req, res) => {
  try {
    const team = await TeamService.getTeam(req.params.teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const rooms = await RoomService.getAvailableRoomSummaries(req.params.teamId);
    res.json(rooms);
  } catch (error) {
    console.error('Error getting team rooms:', error);
    res.status(500).json({ error: 'Failed to get team rooms' });
  }
});
