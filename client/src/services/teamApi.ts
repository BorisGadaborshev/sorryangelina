import { AuthProfile, AvailableRoom, AvailableTeam, BUILTIN_TEAM_ID, Team } from '../types';
import { getApiBase } from '../utils/apiBase';
import { apiFetch } from '../utils/apiFetch';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  token?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function requestJson<T>(path: string, fallbackError: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await apiFetch(`${getApiBase()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok || (data && typeof data === 'object' && 'error' in data && data.error)) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
}

const teamPath = (teamId: string, suffix = '') => `/api/teams/${encodeURIComponent(teamId)}${suffix}`;

export const teamApi = {
  listTeams: (signal?: AbortSignal) =>
    requestJson<AvailableTeam[]>('/api/teams', 'Failed to fetch teams', { signal }),

  listRooms: (teamId: string, signal?: AbortSignal) =>
    requestJson<AvailableRoom[]>(teamPath(teamId, '/rooms'), 'Failed to fetch rooms', { signal }),

  getTeam: (teamId: string, token: string, signal?: AbortSignal) =>
    requestJson<Team>(teamPath(teamId), 'Failed to fetch team', { token, signal }),

  joinTeam: (teamId: string, token: string, password?: string) =>
    requestJson<Team>(teamPath(teamId, '/join'), 'Не удалось войти в команду', {
      method: 'POST',
      token,
      body: password ? { password } : {}
    }),

  unlockTeam: (teamId: string, password: string) =>
    requestJson<{ members: string[] }>(teamPath(teamId, '/unlock'), 'Не удалось открыть команду', {
      method: 'POST',
      body: { password }
    }),

  createTeam: (token: string, payload: { name: string; password: string; members: string[]; scrumMasterName?: string }) =>
    requestJson<Team>('/api/teams', 'Не удалось создать команду', { method: 'POST', token, body: payload }),

  removeMember: (teamId: string, token: string, name: string) =>
    requestJson<Team>(teamPath(teamId, '/members'), 'Не удалось удалить участника', {
      method: 'DELETE',
      token,
      body: { name }
    }),

  resetMemberPassword: (teamId: string, token: string, name: string) =>
    requestJson<{ team?: Team; password: string }>(teamPath(teamId, '/members/reset-password'), 'Не удалось сбросить пароль', {
      method: 'POST',
      token,
      body: { name }
    }),

  changeTeamPassword: (teamId: string, token: string, password: string) =>
    requestJson<Team>(teamPath(teamId, '/password'), 'Не удалось сменить пароль команды', {
      method: 'POST',
      token,
      body: { password }
    }),

  deleteRoom: (roomId: string, token: string) =>
    requestJson<unknown>(`/api/rooms/${encodeURIComponent(roomId)}`, 'Не удалось удалить комнату', {
      method: 'DELETE',
      token
    }),

  login: (teamId: string, name: string, password: string) =>
    requestJson<{ profile?: AuthProfile }>(
      teamId === BUILTIN_TEAM_ID ? '/api/auth/fixed-login' : '/api/auth/login',
      'Не удалось войти',
      { method: 'POST', body: { name, password } }
    ),

  register: (name: string, password: string) =>
    requestJson<{ profile?: AuthProfile }>('/api/auth/register', 'Не удалось создать учетку', {
      method: 'POST',
      body: { name, password }
    })
};
