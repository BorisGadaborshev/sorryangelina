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
  Typography
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
  const [authTab, setAuthTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [fixedUsers, setFixedUsers] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);

  const [fixedName, setFixedName] = useState('');
  const [fixedPassword, setFixedPassword] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [guestName, setGuestName] = useState('');

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
  const [isFixedUsersUnlocked, setIsFixedUsersUnlocked] = useState(
    () => localStorage.getItem('fixedUsersUnlocked') === 'true'
  );
  const [isSuboDialogOpen, setIsSuboDialogOpen] = useState(false);
  const [suboInput, setSuboInput] = useState('');
  const [suboError, setSuboError] = useState<string | null>(null);
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

  const fetchFixedUsers = useCallback(async (accessCode: string) => {
    try {
      const response = await fetch(`${getApiBase()}/api/auth/fixed-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fixed users');
      }
      const data = (await response.json()) as { users: string[] };
      setFixedUsers(data.users);
      setFixedName((prev) => (prev || data.users[0] || ''));
    } catch (error) {
      setIsFixedUsersUnlocked(false);
      localStorage.removeItem('fixedUsersUnlocked');
      localStorage.removeItem('suboAccessCode');
      store.setError('Не удалось загрузить фиксированные ФИО');
    }
  }, [store]);

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
    if (!isFixedUsersUnlocked) return;
    const accessCode = localStorage.getItem('suboAccessCode');
    if (!accessCode) {
      setIsFixedUsersUnlocked(false);
      localStorage.removeItem('fixedUsersUnlocked');
      return;
    }
    void fetchFixedUsers(accessCode);
  }, [fetchFixedUsers, isFixedUsersUnlocked]);

  useEffect(() => {
    if (store.authProfile && (!isFixedAuth || isChoosingTeam)) {
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

  const handleAuthSuccess = (profile: AuthProfile) => {
    store.setAuthProfile(profile);
    store.setError(null);
    setIsChoosingTeam(false);
    setAccountPassword('');
    setRegisterPassword('');
    setFixedPassword('');
  };

  const handleChangeTeam = () => {
    store.setSelectedTeam(null);
    store.setError(null);
    setIsChoosingTeam(true);
    void fetchAvailableTeams();
  };

  const handleFixedLogin = async () => {
    if (!fixedName || !fixedPassword) return;
    setIsLoading(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/fixed-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fixedName, password: fixedPassword })
      });
      const data = (await response.json()) as FixedLoginResponse | { error: string };
      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Не удалось войти');
      }
      handleAuthSuccess((data as FixedLoginResponse).profile);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось войти');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountLogin = async () => {
    if (!accountName || !accountPassword) return;
    setIsLoading(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName, password: accountPassword })
      });
      const data = (await response.json()) as { profile?: AuthProfile; error?: string };
      if (!response.ok || !data.profile) {
        throw new Error(data.error || 'Не удалось войти в учетку');
      }
      handleAuthSuccess(data.profile);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось войти в учетку');
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
      handleAuthSuccess(data.profile);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось создать учетку');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (!guestName.trim()) return;
    setIsLoading(true);
    store.setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName.trim() })
      });
      const data = (await response.json()) as { profile?: AuthProfile; error?: string };
      if (!response.ok || !data.profile) {
        throw new Error(data.error || 'Не удалось войти гостем');
      }
      handleAuthSuccess(data.profile);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось войти гостем');
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
    if (!store.authProfile || !selectedTeamForJoin || !joinTeamPassword.trim()) return;

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

  const handleSuboSubmit = () => {
    const normalized = suboInput.trim();
    if (!/^\d{4}-\d$/.test(normalized)) {
      setSuboError('Формат номера: NNNN-N');
      return;
    }
    if (normalized !== '1395-5') {
      setSuboError('Неверный номер СУБО');
      return;
    }
    setIsFixedUsersUnlocked(true);
    localStorage.setItem('fixedUsersUnlocked', 'true');
    localStorage.setItem('suboAccessCode', normalized);
    void fetchFixedUsers(normalized);
    setIsSuboDialogOpen(false);
    setSuboInput('');
    setSuboError(null);
  };

  const renderAuthBlock = () => (
    <>
      <Tabs value={authTab} onChange={(_, value) => setAuthTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}>
        <Tab label={isFixedUsersUnlocked ? 'Команда "Карты и Партнеры"' : 'Вход по СУБО'} />
        <Tab label="Вход в учетку" />
        <Tab label="Новая учетка" />
        <Tab label="Гость" />
      </Tabs>

      {authTab === 0 && (
        <>
          {!isFixedUsersUnlocked ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Для просмотра списка ФИО введите номер СУБО.
              </Typography>
              <Button fullWidth variant="outlined" onClick={() => setIsSuboDialogOpen(true)}>
                Ввести номер СУБО
              </Button>
            </Box>
          ) : (
            <>
              <TextField
                fullWidth
                select
                label="Выберите ФИО"
                margin="normal"
                value={fixedName}
                onChange={(event) => setFixedName(event.target.value)}
                disabled={isLoading}
              >
                {fixedUsers.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                type="password"
                label="Пароль (при первом входе будет создан)"
                margin="normal"
                value={fixedPassword}
                onChange={(event) => setFixedPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleFixedLogin();
                  }
                }}
                disabled={isLoading}
              />
              <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={handleFixedLogin} disabled={isLoading || !fixedName || !fixedPassword}>
                {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Войти по ФИО'}
              </Button>
            </>
          )}
        </>
      )}

      {authTab === 1 && (
        <>
          <TextField
            fullWidth
            label="ФИО"
            margin="normal"
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            disabled={isLoading}
          />
          <TextField
            fullWidth
            type="password"
            label="Пароль"
            margin="normal"
            value={accountPassword}
            onChange={(event) => setAccountPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAccountLogin();
              }
            }}
            disabled={isLoading}
          />
          <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={handleAccountLogin} disabled={isLoading || !accountName || !accountPassword}>
            {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Войти'}
          </Button>
        </>
      )}

      {authTab === 2 && (
        <>
          <TextField
            fullWidth
            label="ФИО"
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
                handleRegister();
              }
            }}
            disabled={isLoading}
          />
          <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={handleRegister} disabled={isLoading || !registerName || !registerPassword}>
            {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Создать учетку'}
          </Button>
        </>
      )}

      {authTab === 3 && (
        <>
          <TextField
            fullWidth
            label="ФИО гостя"
            margin="normal"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            disabled={isLoading}
            required
          />
          <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={handleGuestLogin} disabled={isLoading || !guestName.trim()}>
            {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Войти гостем'}
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
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 3 }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box>
          <Typography variant="h5">Комнаты команды {store.selectedTeam?.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            Вы вошли как: <b>{store.authProfile?.name}</b>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
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

      <Box sx={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-start', minHeight: 0 }}>
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
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Paper elevation={3} sx={{ p: 3, width: '100%', maxWidth: 720 }}>
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
        open={isSuboDialogOpen}
        onClose={() => {
          setIsSuboDialogOpen(false);
          setSuboError(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Введите номер СУБО</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Номер СУБО"
            placeholder="NNNN-N"
            value={suboInput}
            onChange={(event) => {
              setSuboInput(event.target.value);
              if (suboError) setSuboError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSuboSubmit();
              }
            }}
            error={Boolean(suboError)}
            helperText={suboError || 'Формат: NNNN-N'}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsSuboDialogOpen(false);
              setSuboError(null);
            }}
          >
            Отмена
          </Button>
          <Button variant="contained" onClick={handleSuboSubmit}>
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default Login;