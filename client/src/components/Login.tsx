import React, { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import { RetroStore } from '../store/RetroStore';
import { AuthProfile, AvailableRoom, AvailableTeam, BUILTIN_TEAM_ID, Team } from '../types';
import CreateTeamDialog from './CreateTeamDialog';
import RoomTiles from './RoomTiles';
import TeamLobby from './TeamLobby';
import TeamMembersPanel from './TeamMembersPanel';

interface Props {
  store: RetroStore;
}

interface FixedLoginResponse {
  profile: AuthProfile;
  isFirstLogin: boolean;
}

const getApiBase = (): string => (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');

const Login: React.FC<Props> = observer(({ store }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [authTab, setAuthTab] = useState(0);
  const [loginStep, setLoginStep] = useState<'teams' | 'credentials'>('teams');
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [loginNames, setLoginNames] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);

  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [pendingTeamPassword, setPendingTeamPassword] = useState('');

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [createRoomId, setCreateRoomId] = useState('');
  const [createRoomPassword, setCreateRoomPassword] = useState('');
  const [joinRoomPassword, setJoinRoomPassword] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isJoinTeamDialogOpen, setIsJoinTeamDialogOpen] = useState(false);
  const [selectedTeamForJoin, setSelectedTeamForJoin] = useState<AvailableTeam | null>(null);
  const [joinTeamPassword, setJoinTeamPassword] = useState('');
  const [joinTeamError, setJoinTeamError] = useState<string | null>(null);
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteRoomId, setDeleteRoomId] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteRoomId, setInviteRoomId] = useState('');
  const [inviteRoomPassword, setInviteRoomPassword] = useState('');
  const [inviteCopySuccess, setInviteCopySuccess] = useState(false);
  const [isAutoJoiningBuiltinTeam, setIsAutoJoiningBuiltinTeam] = useState(false);
  const [isChoosingTeam, setIsChoosingTeam] = useState(false);
  const [isTeamMembersLoading, setIsTeamMembersLoading] = useState(false);
  const [busyMemberName, setBusyMemberName] = useState<string | null>(null);
  const [isRemoveMemberDialogOpen, setIsRemoveMemberDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState('');
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordMember, setResetPasswordMember] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordCopySuccess, setResetPasswordCopySuccess] = useState(false);
  const [isChangeTeamPasswordDialogOpen, setIsChangeTeamPasswordDialogOpen] = useState(false);
  const [changeTeamPasswordValue, setChangeTeamPasswordValue] = useState('');
  const [changeTeamPasswordError, setChangeTeamPasswordError] = useState<string | null>(null);
  const selectedTeam = store.selectedTeam;
  const isFixedAuth = store.authProfile?.type === 'fixed';

  const fetchAvailableRooms = useCallback(async () => {
    if (!selectedTeam) {
      setAvailableRooms([]);
      return;
    }
    const teamId = selectedTeam.id;

    setIsRoomsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(teamId)}/rooms`);
      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }
      const rooms = (await response.json()) as AvailableRoom[];
      setAvailableRooms(rooms);
    } catch (error) {
      store.setError('Не удалось загрузить список комнат');
    } finally {
      setIsRoomsLoading(false);
    }
  }, [selectedTeam?.id, store]);

  const fetchSelectedTeam = useCallback(async () => {
    if (!store.authProfile || !selectedTeam) return;
    const teamId = selectedTeam.id;

    setIsTeamMembersLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(teamId)}`, {
        headers: {
          Authorization: `Bearer ${store.authProfile.token}`
        }
      });
      if (response.status === 403) {
        const data = (await response.json()) as { error?: string };
        if (data.error === 'Team password is required') {
          store.setSelectedTeam(null);
          setIsChoosingTeam(true);
          return;
        }
        throw new Error('Failed to fetch team');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch team');
      }
      const team = (await response.json()) as Team;
      store.setSelectedTeam(team);
    } catch (error) {
      store.setError('Не удалось загрузить участников команды');
    } finally {
      setIsTeamMembersLoading(false);
    }
  }, [selectedTeam?.id, store, store.authProfile?.token]);

  const fetchAvailableTeams = useCallback(async () => {
    setIsTeamsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/teams`);
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      const teams = (await response.json()) as AvailableTeam[];
      setAvailableTeams(teams);
    } catch (error) {
      store.setError('Не удалось загрузить список команд');
    } finally {
      setIsTeamsLoading(false);
    }
  }, [store]);

  useEffect(() => {
    if (!store.authProfile || (store.authProfile && (!isFixedAuth || isChoosingTeam))) {
      fetchAvailableTeams();
    }
  }, [fetchAvailableTeams, store.authProfile, isFixedAuth, isChoosingTeam]);

  useEffect(() => {
    if (store.authProfile && selectedTeam) {
      fetchAvailableRooms();
      void fetchSelectedTeam();
    }
  }, [fetchAvailableRooms, fetchSelectedTeam, store.authProfile, selectedTeam?.id]);

  const autoJoinBuiltinTeam = useCallback(async () => {
    if (!store.authProfile || store.authProfile.type !== 'fixed' || store.selectedTeam) return;

    setIsAutoJoiningBuiltinTeam(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(BUILTIN_TEAM_ID)}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${store.authProfile.token}`
        },
        body: JSON.stringify({})
      });
      const data = (await response.json()) as Team | { error?: string };
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data && data.error ? data.error : 'Не удалось войти в команду');
      }
      store.setSelectedTeam(data as Team);
      setIsChoosingTeam(false);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось войти в команду');
    } finally {
      setIsAutoJoiningBuiltinTeam(false);
    }
  }, [store]);

  useEffect(() => {
    if (isFixedAuth && !selectedTeam && !isChoosingTeam) {
      void autoJoinBuiltinTeam();
    }
  }, [autoJoinBuiltinTeam, isFixedAuth, selectedTeam, isChoosingTeam]);

  const resetLoginTeamSelection = () => {
    setLoginStep('teams');
    setLoginNames([]);
    setLoginName('');
    setLoginPassword('');
    setPendingTeamPassword('');
    setSelectedTeamForJoin(null);
    setJoinTeamPassword('');
    setJoinTeamError(null);
  };

  const handleAuthSuccess = (profile: AuthProfile, options?: { chooseTeam?: boolean }) => {
    store.setAuthProfile(profile);
    store.setError(null);
    setIsChoosingTeam(Boolean(options?.chooseTeam));
    setRegisterPassword('');
    setLoginPassword('');
  };

  const handleChangeTeam = () => {
    store.setSelectedTeam(null);
    store.setError(null);
    setIsChoosingTeam(true);
    void fetchAvailableTeams();
  };

  const joinTeamWithProfile = async (profile: AuthProfile, teamId: string, password?: string): Promise<Team> => {
    const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(teamId)}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.token}`
      },
      body: JSON.stringify(password ? { password } : {})
    });
    const data = (await response.json()) as Team | { error?: string };
    if (!response.ok || 'error' in data) {
      throw new Error('error' in data && data.error ? data.error : 'Не удалось войти в команду');
    }
    return data as Team;
  };

  const handleTeamMemberLogin = async () => {
    if (!loginName || !loginPassword || !selectedTeamForJoin) return;
    setIsLoading(true);
    store.setError(null);
    try {
      const isBuiltinTeam = selectedTeamForJoin.id === BUILTIN_TEAM_ID;
      const response = await fetch(`${getApiBase()}${isBuiltinTeam ? '/api/auth/fixed-login' : '/api/auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, password: loginPassword })
      });
      const data = (await response.json()) as FixedLoginResponse | { profile?: AuthProfile; error: string };
      if (!response.ok) {
        const message = 'error' in data ? data.error : 'Не удалось войти';
        throw new Error(
          message === 'Invalid password'
            ? 'Неверный пароль'
            : message === 'Account not found'
              ? 'Учетная запись не найдена'
              : message === 'Name is not in fixed list'
                ? 'Это ФИО не состоит в команде'
                : message
        );
      }
      const profile = 'profile' in data && data.profile ? data.profile : null;
      if (!profile) {
        throw new Error('Не удалось войти');
      }

      const team = await joinTeamWithProfile(profile, selectedTeamForJoin.id, pendingTeamPassword || undefined);
      handleAuthSuccess(profile);
      completeTeamJoin(team);
      resetLoginTeamSelection();
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось войти');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerName || !registerPassword) return;
    setIsLoading(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: registerName, password: registerPassword })
      });
      const data = (await response.json()) as { profile?: AuthProfile; error?: string };
      if (!response.ok || !data.profile) {
        throw new Error(data.error || 'Не удалось создать учетку');
      }
      handleAuthSuccess(data.profile, { chooseTeam: true });
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось создать учетку');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateRoomId('');
    setCreateRoomPassword('');
    setIsCreateDialogOpen(true);
  };

  const handleOpenJoinDialog = (roomId: string) => {
    setSelectedRoomId(roomId);
    setJoinRoomPassword('');
    setJoinRoomError(null);
    setIsJoinDialogOpen(true);
  };

  const handleOpenDeleteDialog = (roomId: string) => {
    setDeleteRoomId(roomId);
    setDeleteConfirmText('');
    setIsDeleteDialogOpen(true);
  };

  const handleOpenInviteDialog = (roomId: string) => {
    setInviteRoomId(roomId);
    setInviteRoomPassword('');
    setInviteCopySuccess(false);
    setIsInviteDialogOpen(true);
  };

  const completeTeamJoin = (team: Team) => {
    store.setSelectedTeam(team);
    setIsChoosingTeam(false);
    setIsJoinTeamDialogOpen(false);
    setSelectedTeamForJoin(null);
    setJoinTeamPassword('');
    setJoinTeamError(null);
  };

  const requestJoinTeam = async (teamId: string, password?: string): Promise<Team> => {
    if (!store.authProfile) {
      throw new Error('Необходимо войти в аккаунт');
    }
    const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(teamId)}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.authProfile.token}`
      },
      body: JSON.stringify(password ? { password } : {})
    });
    const data = (await response.json()) as Team | { error?: string };
    if (!response.ok || 'error' in data) {
      throw new Error('error' in data && data.error ? data.error : 'Не удалось войти в команду');
    }
    return data as Team;
  };

  const handleOpenJoinTeamDialog = (team: AvailableTeam) => {
    setSelectedTeamForJoin(team);
    setJoinTeamPassword('');
    setJoinTeamError(null);
    setIsJoinTeamDialogOpen(true);
  };

  const handleSelectTeam = async (team: AvailableTeam) => {
    if (!store.authProfile) return;

    setIsLoading(true);
    store.setError(null);
    try {
      const joinedTeam = await requestJoinTeam(team.id);
      completeTeamJoin(joinedTeam);
      await fetchAvailableTeams();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось войти в команду';
      if (message === 'Team password is required' || message === 'Invalid team password') {
        handleOpenJoinTeamDialog(team);
      } else {
        store.setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!selectedTeamForJoin || !joinTeamPassword.trim()) return;

    if (!store.authProfile) {
      setIsLoading(true);
      setJoinTeamError(null);
      store.setError(null);
      try {
        const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(selectedTeamForJoin.id)}/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: joinTeamPassword.trim() })
        });
        const data = (await response.json()) as { members?: string[]; error?: string };
        if (!response.ok || !data.members) {
          throw new Error(data.error || 'Не удалось открыть команду');
        }
        setPendingTeamPassword(joinTeamPassword.trim());
        setLoginNames(data.members);
        setLoginName(data.members[0] || '');
        setLoginPassword('');
        setLoginStep('credentials');
        setIsJoinTeamDialogOpen(false);
        setJoinTeamPassword('');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось открыть команду';
        setJoinTeamError(message === 'Invalid team password' ? 'Неверный пароль команды' : message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setJoinTeamError(null);
    store.setError(null);
    try {
      const team = await requestJoinTeam(selectedTeamForJoin.id, joinTeamPassword.trim());
      completeTeamJoin(team);
      await fetchAvailableTeams();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось войти в команду';
      setJoinTeamError(message === 'Invalid team password' ? 'Неверный пароль команды' : message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async (payload: { name: string; password: string; members: string[]; scrumMasterName?: string }) => {
    if (!store.authProfile) return;

    setIsLoading(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${store.authProfile.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as Team | { error?: string };
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data && data.error ? data.error : 'Не удалось создать команду');
      }
      store.setSelectedTeam(data as Team);
      setIsChoosingTeam(false);
      setIsCreateTeamDialogOpen(false);
      await fetchAvailableTeams();
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось создать команду');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!store.authProfile || !store.selectedTeam || !createRoomId.trim()) return;

    setIsLoading(true);
    store.setError(null);
    try {
      sessionStorage.setItem('roomPassword', createRoomPassword.trim());
      await store.socketService?.createRoom(
        createRoomId.trim(),
        createRoomPassword.trim() || undefined,
        store.authProfile.name,
        store.authProfile.token,
        {
          teamId: store.selectedTeam.id
        }
      );
      setIsCreateDialogOpen(false);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось создать комнату');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoomById = async (roomId: string, password: string) => {
    if (!store.authProfile) return;

    setIsLoading(true);
    setJoinRoomError(null);
    store.setError(null);
    try {
      sessionStorage.setItem('roomPassword', password);
      await store.socketService?.joinRoom(roomId, password, store.authProfile.name, store.authProfile.token);
      setIsJoinDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось подключиться к комнате';
      setJoinRoomError(message);
      store.setError(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!selectedRoomId.trim()) return;
    const selectedRoom = availableRooms.find((room) => room.id === selectedRoomId);
    if (selectedRoom?.hasPassword !== false && !joinRoomPassword.trim()) return;
    await joinRoomById(selectedRoomId.trim(), joinRoomPassword.trim());
  };

  const handleRoomClick = async (roomId: string) => {
    const room = availableRooms.find((item) => item.id === roomId);
    if (room?.hasPassword === false) {
      try {
        await joinRoomById(roomId, '');
      } catch (error) {
        store.setError(error instanceof Error ? error.message : 'Не удалось подключиться к комнате');
      }
      return;
    }
    handleOpenJoinDialog(roomId);
  };

  const handleDeleteRoomFromTile = async () => {
    if (!store.authProfile || !deleteRoomId || deleteConfirmText.trim() !== deleteRoomId) return;

    setIsDeletingRoom(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/rooms/${encodeURIComponent(deleteRoomId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${store.authProfile.token}`
        }
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось удалить комнату');
      }
      setIsDeleteDialogOpen(false);
      setDeleteRoomId('');
      setDeleteConfirmText('');
      await fetchAvailableRooms();
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось удалить комнату');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const currentUserName = store.authProfile?.name || '';
  const isTeamAdmin = Boolean(
    selectedTeam &&
    currentUserName &&
    (selectedTeam.owner === currentUserName ||
      selectedTeam.members.some((member) => member.name === currentUserName && member.role === 'admin'))
  );

  const handleOpenRemoveMemberDialog = (name: string) => {
    setMemberToRemove(name);
    setIsRemoveMemberDialogOpen(true);
  };

  const handleRemoveMember = async () => {
    if (!store.authProfile || !selectedTeam || !memberToRemove) return;

    setBusyMemberName(memberToRemove);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(selectedTeam.id)}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${store.authProfile.token}`
        },
        body: JSON.stringify({ name: memberToRemove })
      });
      const data = (await response.json()) as Team | { error?: string };
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data && data.error ? data.error : 'Не удалось удалить участника');
      }
      store.setSelectedTeam(data as Team);
      setIsRemoveMemberDialogOpen(false);
      setMemberToRemove('');
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось удалить участника');
    } finally {
      setBusyMemberName(null);
    }
  };

  const handleResetMemberPassword = async (name: string) => {
    if (!store.authProfile || !selectedTeam) return;

    setBusyMemberName(name);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(selectedTeam.id)}/members/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${store.authProfile.token}`
        },
        body: JSON.stringify({ name })
      });
      const data = (await response.json()) as { team?: Team; password?: string; error?: string };
      if (!response.ok || !data.password) {
        throw new Error(data.error || 'Не удалось сбросить пароль');
      }
      if (data.team) {
        store.setSelectedTeam(data.team);
      }
      setResetPasswordMember(name);
      setResetPasswordValue(data.password);
      setResetPasswordCopySuccess(false);
      setIsResetPasswordDialogOpen(true);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось сбросить пароль');
    } finally {
      setBusyMemberName(null);
    }
  };

  const handleChangeTeamPassword = async () => {
    if (!store.authProfile || !selectedTeam || !changeTeamPasswordValue.trim()) return;

    setIsLoading(true);
    setChangeTeamPasswordError(null);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/teams/${encodeURIComponent(selectedTeam.id)}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${store.authProfile.token}`
        },
        body: JSON.stringify({ password: changeTeamPasswordValue.trim() })
      });
      const data = (await response.json()) as Team | { error?: string };
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data && data.error ? data.error : 'Не удалось сменить пароль команды');
      }
      store.setSelectedTeam(data as Team);
      setIsChangeTeamPasswordDialogOpen(false);
      setChangeTeamPasswordValue('');
    } catch (error) {
      setChangeTeamPasswordError(error instanceof Error ? error.message : 'Не удалось сменить пароль команды');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyResetPassword = async () => {
    if (!resetPasswordValue) return;
    try {
      await navigator.clipboard.writeText(resetPasswordValue);
      setResetPasswordCopySuccess(true);
      setTimeout(() => setResetPasswordCopySuccess(false), 2000);
    } catch (error) {
      store.setError('Не удалось скопировать пароль');
    }
  };

  const publicAuthUrl = (process.env.REACT_APP_PUBLIC_AUTH_URL || '').trim();
  const authLink = publicAuthUrl
    ? new URL(publicAuthUrl).toString()
    : typeof window !== 'undefined'
      ? new URL('/', window.location.href).toString()
      : '';

  const inviteRoom = availableRooms.find((room) => room.id === inviteRoomId);
  const invitePasswordLine = inviteRoomPassword.trim() ? `Пароль: ${inviteRoomPassword.trim()}` : null;

  const buildInviteMessage = (passwordLine: string | null) => {
    const lines = [
      'Привет! Зову вас на ретро.',
      '',
      `Комната: ${inviteRoomId}`
    ];
    if (passwordLine) {
      lines.push(passwordLine);
    }
    lines.push('🔗 Вход:', authLink, '', 'Заходите, будем разбирать итоги спринта.');
    return lines.join('\n');
  };

  const inviteTelegramText = invitePasswordLine
    ? [
        'Привет! Зову вас на ретро.',
        '',
        `Комната: ${inviteRoomId}`,
        invitePasswordLine,
        '',
        'Заходите, будем разбирать итоги спринта.'
      ].join('\n')
    : inviteRoom?.hasPassword === false
      ? [
          'Привет! Зову вас на ретро.',
          '',
          `Комната: ${inviteRoomId}`,
          '',
          'Заходите, будем разбирать итоги спринта.'
        ].join('\n')
      : '';

  const inviteMessage = invitePasswordLine
    ? buildInviteMessage(invitePasswordLine)
    : inviteRoom?.hasPassword === false
      ? buildInviteMessage(null)
      : '';

  const handleCopyInvite = async () => {
    if (!inviteMessage) return;
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setInviteCopySuccess(true);
      setTimeout(() => setInviteCopySuccess(false), 2000);
    } catch (error) {
      store.setError('Не удалось скопировать приглашение');
    }
  };

  const telegramShareLink = `https://t.me/share/url?url=${encodeURIComponent(authLink)}&text=${encodeURIComponent(
    inviteTelegramText || `Привет! Зову вас на ретро.\nКомната: ${inviteRoomId}`
  )}`;

  const renderAuthBlock = () => (
    <>
      <Tabs
        value={authTab}
        onChange={(_, value) => {
          setAuthTab(value);
          store.setError(null);
        }}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab label="Вход" />
        <Tab label="Регистрация" />
      </Tabs>

      {authTab === 0 && loginStep === 'teams' && (
        <TeamLobby
          teams={availableTeams}
          isLoading={isTeamsLoading}
          onRefresh={fetchAvailableTeams}
          onTeamClick={handleOpenJoinTeamDialog}
          variant="embedded"
        />
      )}

      {authTab === 0 && loginStep === 'credentials' && (
        <>
          <Button size="small" onClick={resetLoginTeamSelection} sx={{ mb: 1 }}>
            К командам
          </Button>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            {selectedTeamForJoin?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Выберите ФИО и введите пароль
          </Typography>
          {loginNames.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              В команде пока нет участников. Зарегистрируйтесь и войдите в команду после создания учетки.
            </Alert>
          ) : (
            <>
              <TextField
                fullWidth
                select
                label="ФИО"
                margin="normal"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                disabled={isLoading}
              >
                {loginNames.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                type="password"
                label={selectedTeamForJoin?.id === BUILTIN_TEAM_ID ? 'Пароль (при первом входе будет создан)' : 'Пароль'}
                margin="normal"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleTeamMemberLogin();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                fullWidth
                variant="contained"
                sx={{ mt: 2 }}
                onClick={handleTeamMemberLogin}
                disabled={isLoading || !loginName || !loginPassword}
              >
                {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Войти'}
              </Button>
            </>
          )}
        </>
      )}

      {authTab === 1 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            После регистрации вы сможете выбрать комнату или создать свою.
          </Typography>
          <TextField
            fullWidth
            label="Имя"
            margin="normal"
            value={registerName}
            onChange={(event) => setRegisterName(event.target.value)}
            disabled={isLoading}
          />
          <TextField
            fullWidth
            type="password"
            label="Пароль"
            margin="normal"
            value={registerPassword}
            onChange={(event) => setRegisterPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleRegister();
              }
            }}
            disabled={isLoading}
          />
          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 2 }}
            onClick={handleRegister}
            disabled={isLoading || !registerName || !registerPassword}
          >
            {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Создать учетку'}
          </Button>
        </>
      )}
    </>
  );

  const renderRoomsBlock = () => (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 3 }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          gap: 1.5,
          mb: 2
        }}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
          <Typography variant="h5" sx={{ overflowWrap: 'anywhere' }}>
            Комнаты команды {store.selectedTeam?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            Вы вошли как: <b>{store.authProfile?.name}</b>
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            flexWrap: { sm: 'wrap' },
            gap: 1,
            flexShrink: 0
          }}
        >
          <Button variant="outlined" onClick={fetchAvailableRooms} disabled={isRoomsLoading}>
            Обновить
          </Button>
          <Button variant="outlined" onClick={handleChangeTeam}>
            Сменить команду
          </Button>
          <Button onClick={() => { setIsChoosingTeam(false); store.clearAuthProfile(); }}>Выйти</Button>
        </Box>
      </Box>

      {store.error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {store.error}
        </Typography>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', md: 'flex-start' },
          minHeight: 0,
          minWidth: 0
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {isRoomsLoading ? (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <RoomTiles
              rooms={availableRooms}
              currentUserName={store.authProfile?.name || ''}
              onRoomClick={handleRoomClick}
              onCreateClick={handleOpenCreateDialog}
              onDeleteClick={handleOpenDeleteDialog}
              onInviteClick={handleOpenInviteDialog}
            />
          )}
        </Box>
        <TeamMembersPanel
          members={store.selectedTeam?.members || []}
          owner={store.selectedTeam?.owner || ''}
          currentUserName={currentUserName}
          isAdmin={isTeamAdmin}
          isLoading={isTeamMembersLoading}
          busyMemberName={busyMemberName}
          onRemoveMember={handleOpenRemoveMemberDialog}
          onResetPassword={handleResetMemberPassword}
          onChangeTeamPassword={() => {
            setChangeTeamPasswordValue('');
            setChangeTeamPasswordError(null);
            setIsChangeTeamPasswordDialogOpen(true);
          }}
        />
      </Box>

      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Создать комнату</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Комната будет создана внутри команды <b>{store.selectedTeam?.name}</b>.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="ID комнаты"
            margin="normal"
            value={createRoomId}
            onChange={(event) => setCreateRoomId(event.target.value)}
          />
          <TextField
            fullWidth
            type="password"
            label="Пароль комнаты (необязательно)"
            margin="normal"
            value={createRoomPassword}
            onChange={(event) => setCreateRoomPassword(event.target.value)}
            helperText="Оставьте пустым, если вход в комнату должен быть без пароля"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleCreateRoom();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleCreateRoom}
            disabled={isLoading || !createRoomId.trim()}
          >
            {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isJoinDialogOpen} onClose={() => setIsJoinDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Войти в комнату {selectedRoomId}</DialogTitle>
        <DialogContent>
          {joinRoomError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {joinRoomError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Пароль комнаты"
            margin="normal"
            value={joinRoomPassword}
            onChange={(event) => {
              setJoinRoomPassword(event.target.value);
              if (joinRoomError) setJoinRoomError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleJoinRoom();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsJoinDialogOpen(false);
              setJoinRoomError(null);
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleJoinRoom}
            disabled={isLoading || !joinRoomPassword.trim()}
          >
            {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Войти'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Точное подтверждение удаления</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            Чтобы удалить комнату, введите ее ID точно как показано: <b>{deleteRoomId}</b>
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Введите ID комнаты"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteRoomFromTile}
            disabled={isDeletingRoom || deleteConfirmText.trim() !== deleteRoomId}
          >
            {isDeletingRoom ? <CircularProgress size={18} color="inherit" /> : 'Удалить комнату'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isInviteDialogOpen} onClose={() => setIsInviteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Приглашение в комнату {inviteRoomId}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            {inviteRoom?.hasPassword === false
              ? 'Комната без пароля — можно сразу скопировать приглашение для Telegram.'
              : 'Введите пароль комнаты, чтобы сформировать приглашение для Telegram.'}
          </DialogContentText>
          {inviteRoom?.hasPassword !== false && (
            <TextField
              autoFocus
              fullWidth
              label="Пароль комнаты"
              margin="normal"
              value={inviteRoomPassword}
              onChange={(event) => {
                setInviteRoomPassword(event.target.value);
                if (inviteCopySuccess) setInviteCopySuccess(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleCopyInvite();
                }
              }}
            />
          )}
          {inviteMessage && (
            <TextField
              fullWidth
              margin="normal"
              multiline
              minRows={6}
              label="Текст приглашения (Telegram)"
              value={inviteMessage}
              InputProps={{ readOnly: true }}
            />
          )}
          {inviteCopySuccess && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Приглашение скопировано.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsInviteDialogOpen(false)}>Закрыть</Button>
          <Button
            variant="outlined"
            onClick={handleCopyInvite}
            disabled={!inviteMessage}
          >
            Скопировать
          </Button>
          <Button
            variant="contained"
            component="a"
            href={telegramShareLink}
            target="_blank"
            rel="noopener noreferrer"
            disabled={!inviteMessage}
          >
            Открыть в Telegram
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isRemoveMemberDialogOpen}
        onClose={() => {
          setIsRemoveMemberDialogOpen(false);
          setMemberToRemove('');
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Удалить участника</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Удалить <b>{memberToRemove}</b> из команды? Этот человек больше не будет в списке участников.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsRemoveMemberDialogOpen(false);
              setMemberToRemove('');
            }}
          >
            Отмена
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleRemoveMember}
            disabled={Boolean(busyMemberName)}
          >
            {busyMemberName ? <CircularProgress size={18} color="inherit" /> : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isResetPasswordDialogOpen}
        onClose={() => setIsResetPasswordDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Новый пароль</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            Пароль для <b>{resetPasswordMember}</b> сброшен. Передайте его участнику — старый больше не подойдёт.
          </DialogContentText>
          <TextField
            fullWidth
            label="Временный пароль"
            value={resetPasswordValue}
            InputProps={{ readOnly: true }}
            margin="normal"
          />
          {resetPasswordCopySuccess && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Пароль скопирован.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsResetPasswordDialogOpen(false)}>
            Закрыть
          </Button>
          <Button variant="contained" onClick={handleCopyResetPassword} disabled={!resetPasswordValue}>
            Скопировать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isChangeTeamPasswordDialogOpen}
        onClose={() => {
          setIsChangeTeamPasswordDialogOpen(false);
          setChangeTeamPasswordError(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Сменить пароль команды</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            После смены пароля участникам нужно будет ввести его заново, чтобы войти в команду.
          </DialogContentText>
          {changeTeamPasswordError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {changeTeamPasswordError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Новый пароль команды"
            margin="normal"
            value={changeTeamPasswordValue}
            onChange={(event) => {
              setChangeTeamPasswordValue(event.target.value);
              if (changeTeamPasswordError) setChangeTeamPasswordError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleChangeTeamPassword();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsChangeTeamPasswordDialogOpen(false);
              setChangeTeamPasswordError(null);
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleChangeTeamPassword}
            disabled={isLoading || !changeTeamPasswordValue.trim()}
          >
            {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  if (store.authProfile && !store.selectedTeam) {
    if (isFixedAuth && !isChoosingTeam) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            {isAutoJoiningBuiltinTeam ? 'Вход в команду «Карты и Партнеры»...' : 'Загрузка...'}
          </Typography>
          {store.error && (
            <Typography color="error" sx={{ px: 2, textAlign: 'center' }}>
              {store.error}
            </Typography>
          )}
        </Box>
      );
    }

    return (
      <>
        {store.error && (
          <Typography color="error" sx={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 1200 }}>
            {store.error}
          </Typography>
        )}
        <TeamLobby
          teams={availableTeams}
          currentUserName={store.authProfile.name}
          isLoading={isTeamsLoading}
          onRefresh={fetchAvailableTeams}
          onTeamClick={handleSelectTeam}
          onCreateClick={() => setIsCreateTeamDialogOpen(true)}
          onLogout={() => store.clearAuthProfile()}
        />
        <CreateTeamDialog
          open={isCreateTeamDialogOpen}
          currentUserName={store.authProfile.name}
          isLoading={isLoading}
          onClose={() => setIsCreateTeamDialogOpen(false)}
          onCreate={handleCreateTeam}
        />
        <Dialog
          open={isJoinTeamDialogOpen}
          onClose={() => {
            setIsJoinTeamDialogOpen(false);
            setJoinTeamError(null);
          }}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Войти в команду {selectedTeamForJoin?.name}</DialogTitle>
          <DialogContent>
            {joinTeamError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {joinTeamError}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              type="password"
              label="Пароль команды"
              margin="normal"
              value={joinTeamPassword}
              onChange={(event) => {
                setJoinTeamPassword(event.target.value);
                if (joinTeamError) setJoinTeamError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleJoinTeam();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setIsJoinTeamDialogOpen(false);
                setJoinTeamError(null);
              }}
            >
              Отмена
            </Button>
            <Button variant="contained" onClick={handleJoinTeam} disabled={isLoading || !joinTeamPassword.trim()}>
              {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Войти'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  if (store.authProfile) {
    return renderRoomsBlock();
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
        pb: { xs: 14, sm: 12 }
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          width: '100%',
          maxWidth: authTab === 0 && loginStep === 'teams' ? 720 : 480,
          maxHeight: { xs: 'calc(100vh - 140px)', sm: '90vh' },
          overflow: 'auto'
        }}
      >
        <Typography variant="h5" sx={{ mb: 2 }}>
          Ретроспектива
        </Typography>
        {store.error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {store.error}
          </Typography>
        )}
        {renderAuthBlock()}
      </Paper>
      <Dialog
        open={isJoinTeamDialogOpen}
        onClose={() => {
          setIsJoinTeamDialogOpen(false);
          setJoinTeamError(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Войти в команду {selectedTeamForJoin?.name}</DialogTitle>
        <DialogContent>
          {joinTeamError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {joinTeamError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Пароль команды"
            margin="normal"
            value={joinTeamPassword}
            onChange={(event) => {
              setJoinTeamPassword(event.target.value);
              if (joinTeamError) setJoinTeamError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleJoinTeam();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsJoinTeamDialogOpen(false);
              setJoinTeamError(null);
            }}
          >
            Отмена
          </Button>
          <Button variant="contained" onClick={handleJoinTeam} disabled={isLoading || !joinTeamPassword.trim()}>
            {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Продолжить'}
          </Button>
        </DialogActions>
      </Dialog>
      <Box
        role="status"
        sx={{
          position: 'fixed',
          left: { xs: 12, sm: 24 },
          right: { xs: 12, sm: 24 },
          bottom: { xs: 12, sm: 20 },
          zIndex: 1100,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <Paper
          elevation={6}
          sx={{
            pointerEvents: 'auto',
            maxWidth: 720,
            width: '100%',
            px: { xs: 1.75, sm: 2.5 },
            py: { xs: 1.25, sm: 1.5 },
            borderRadius: { xs: 2.5, sm: 3 },
            bgcolor: isDark ? '#f4f4f5' : '#1a1a1a',
            color: isDark ? '#141414' : '#f5f5f5',
            boxShadow: isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.45)'
              : '0 8px 24px rgba(0, 0, 0, 0.22)'
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              lineHeight: { xs: 1.4, sm: 1.5 },
              textAlign: 'center'
            }}
          >
            Настоящий сайт не осуществляет сбор, обработку или хранение персональных данных пользователей, а также не
            использует файлы cookie и не фиксирует IP-адреса посетителей.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
});

export default Login;