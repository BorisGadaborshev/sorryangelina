import React, { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, CircularProgress, Paper, Typography } from '@mui/material';
import { RetroStore } from '../store/RetroStore';
import { AuthProfile, AvailableRoom, AvailableTeam, BUILTIN_TEAM_ID, Team } from '../types';
import { teamApi } from '../services/teamApi';
import { isAbortError } from '../utils/errors';
import AuthPanel from './AuthPanel';
import CreateTeamDialog from './CreateTeamDialog';
import TeamLobby from './TeamLobby';
import TeamRoomsView from './TeamRoomsView';
import JoinTeamDialog from './login/JoinTeamDialog';
import PrivacyNotice from './login/PrivacyNotice';
import { useRoomDialogs } from './login/useRoomDialogs';
import { useTeamAdmin } from './login/useTeamAdmin';

interface Props {
  store: RetroStore;
}

const LOGIN_ERRORS: Record<string, string> = {
  'Invalid password': 'Неверный пароль',
  'Account not found': 'Учетная запись не найдена',
  'Name is not in fixed list': 'Это ФИО не состоит в команде'
};

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const Login: React.FC<Props> = observer(({ store }) => {
  const [authTab, setAuthTab] = useState(0);
  const [loginStep, setLoginStep] = useState<'teams' | 'credentials'>('teams');
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [isTeamMembersLoading, setIsTeamMembersLoading] = useState(false);
  const [loginNames, setLoginNames] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);

  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [pendingTeamPassword, setPendingTeamPassword] = useState('');

  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isJoinTeamDialogOpen, setIsJoinTeamDialogOpen] = useState(false);
  const [selectedTeamForJoin, setSelectedTeamForJoin] = useState<AvailableTeam | null>(null);
  const [joinTeamPassword, setJoinTeamPassword] = useState('');
  const [joinTeamError, setJoinTeamError] = useState<string | null>(null);
  const [isAutoJoiningBuiltinTeam, setIsAutoJoiningBuiltinTeam] = useState(false);
  const [isChoosingTeam, setIsChoosingTeam] = useState(false);

  const selectedTeam = store.selectedTeam;
  const selectedTeamId = selectedTeam?.id;
  const authToken = store.authProfile?.token;
  const isFixedAuth = store.authProfile?.type === 'fixed';

  const fetchAvailableRooms = useCallback(async (signal?: AbortSignal) => {
    if (!selectedTeamId) {
      setAvailableRooms([]);
      return;
    }
    setIsRoomsLoading(true);
    try {
      setAvailableRooms(await teamApi.listRooms(selectedTeamId, signal));
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return;
      store.setError('Не удалось загрузить список комнат');
    } finally {
      if (!signal?.aborted) setIsRoomsLoading(false);
    }
  }, [selectedTeamId, store]);

  const fetchSelectedTeam = useCallback(async (signal?: AbortSignal) => {
    if (!authToken || !selectedTeamId) return;
    setIsTeamMembersLoading(true);
    try {
      store.setSelectedTeam(await teamApi.getTeam(selectedTeamId, authToken, signal));
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return;
      if (error instanceof Error && error.message === 'Team password is required') {
        store.setSelectedTeam(null);
        setIsChoosingTeam(true);
        return;
      }
      store.setError('Не удалось загрузить участников команды');
    } finally {
      if (!signal?.aborted) setIsTeamMembersLoading(false);
    }
  }, [selectedTeamId, authToken, store]);

  const fetchAvailableTeams = useCallback(async (signal?: AbortSignal) => {
    setIsTeamsLoading(true);
    try {
      setAvailableTeams(await teamApi.listTeams(signal));
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return;
      store.setError('Не удалось загрузить список команд');
    } finally {
      if (!signal?.aborted) setIsTeamsLoading(false);
    }
  }, [store]);

  useEffect(() => {
    const controller = new AbortController();
    if (!store.authProfile || !isFixedAuth || isChoosingTeam) {
      void fetchAvailableTeams(controller.signal);
    }
    return () => controller.abort();
  }, [fetchAvailableTeams, store.authProfile, isFixedAuth, isChoosingTeam]);

  useEffect(() => {
    const controller = new AbortController();
    if (store.authProfile && selectedTeamId) {
      void fetchAvailableRooms(controller.signal);
      void fetchSelectedTeam(controller.signal);
    }
    return () => controller.abort();
  }, [fetchAvailableRooms, fetchSelectedTeam, store.authProfile, selectedTeamId]);

  const autoJoinBuiltinTeam = useCallback(async () => {
    if (!store.authProfile || store.authProfile.type !== 'fixed' || store.selectedTeam) return;
    setIsAutoJoiningBuiltinTeam(true);
    store.setError(null);
    try {
      store.setSelectedTeam(await teamApi.joinTeam(BUILTIN_TEAM_ID, store.authProfile.token));
      setIsChoosingTeam(false);
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось войти в команду'));
    } finally {
      setIsAutoJoiningBuiltinTeam(false);
    }
  }, [store]);

  useEffect(() => {
    if (isFixedAuth && !selectedTeam && !isChoosingTeam) {
      void autoJoinBuiltinTeam();
    }
  }, [autoJoinBuiltinTeam, isFixedAuth, selectedTeam, isChoosingTeam]);

  const teamAdmin = useTeamAdmin(store);
  const rooms = useRoomDialogs({
    store,
    availableRooms,
    refreshRooms: () => fetchAvailableRooms(),
    setIsLoading
  });

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

  const completeTeamJoin = (team: Team) => {
    store.setSelectedTeam(team);
    setIsChoosingTeam(false);
    setIsJoinTeamDialogOpen(false);
    setSelectedTeamForJoin(null);
    setJoinTeamPassword('');
    setJoinTeamError(null);
  };

  const handleChangeTeam = () => {
    store.setSelectedTeam(null);
    store.setError(null);
    setIsChoosingTeam(true);
    void fetchAvailableTeams();
  };

  const handleTeamMemberLogin = async () => {
    if (!loginName || !loginPassword || !selectedTeamForJoin) return;
    setIsLoading(true);
    store.setError(null);
    try {
      let profile: AuthProfile | undefined;
      try {
        profile = (await teamApi.login(selectedTeamForJoin.id, loginName, loginPassword)).profile;
      } catch (error) {
        const message = errorMessage(error, 'Не удалось войти');
        throw new Error(LOGIN_ERRORS[message] ?? message);
      }
      if (!profile) throw new Error('Не удалось войти');

      const team = await teamApi.joinTeam(selectedTeamForJoin.id, profile.token, pendingTeamPassword || undefined);
      handleAuthSuccess(profile);
      completeTeamJoin(team);
      resetLoginTeamSelection();
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось войти'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerName || !registerPassword) return;
    setIsLoading(true);
    store.setError(null);
    try {
      const { profile } = await teamApi.register(registerName, registerPassword);
      if (!profile) throw new Error('Не удалось создать учетку');
      handleAuthSuccess(profile, { chooseTeam: true });
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось создать учетку'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenJoinTeamDialog = (team: AvailableTeam) => {
    setSelectedTeamForJoin(team);
    setJoinTeamPassword('');
    setJoinTeamError(null);
    setIsJoinTeamDialogOpen(true);
  };

  const closeJoinTeamDialog = () => {
    setIsJoinTeamDialogOpen(false);
    setJoinTeamError(null);
  };

  const handleSelectTeam = async (team: AvailableTeam) => {
    if (!store.authProfile) return;
    setIsLoading(true);
    store.setError(null);
    try {
      completeTeamJoin(await teamApi.joinTeam(team.id, store.authProfile.token));
      await fetchAvailableTeams();
    } catch (error) {
      const message = errorMessage(error, 'Не удалось войти в команду');
      if (message === 'Team password is required' || message === 'Invalid team password') {
        handleOpenJoinTeamDialog(team);
      } else {
        store.setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const unlockTeamForLogin = async (team: AvailableTeam, password: string) => {
    const { members } = await teamApi.unlockTeam(team.id, password);
    if (!members) throw new Error('Не удалось открыть команду');
    setPendingTeamPassword(password);
    setLoginNames(members);
    setLoginName(members[0] || '');
    setLoginPassword('');
    setLoginStep('credentials');
    setIsJoinTeamDialogOpen(false);
    setJoinTeamPassword('');
  };

  const handleJoinTeam = async () => {
    const password = joinTeamPassword.trim();
    if (!selectedTeamForJoin || !password) return;

    setIsLoading(true);
    setJoinTeamError(null);
    store.setError(null);
    try {
      if (!store.authProfile) {
        await unlockTeamForLogin(selectedTeamForJoin, password);
        return;
      }
      completeTeamJoin(await teamApi.joinTeam(selectedTeamForJoin.id, store.authProfile.token, password));
      await fetchAvailableTeams();
    } catch (error) {
      const fallback = store.authProfile ? 'Не удалось войти в команду' : 'Не удалось открыть команду';
      const message = errorMessage(error, fallback);
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
      store.setSelectedTeam(await teamApi.createTeam(store.authProfile.token, payload));
      setIsChoosingTeam(false);
      setIsCreateTeamDialogOpen(false);
      await fetchAvailableTeams();
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось создать команду'));
    } finally {
      setIsLoading(false);
    }
  };

  const joinTeamDialog = (submitLabel: string) => (
    <JoinTeamDialog
      open={isJoinTeamDialogOpen}
      teamName={selectedTeamForJoin?.name}
      password={joinTeamPassword}
      error={joinTeamError}
      isLoading={isLoading}
      submitLabel={submitLabel}
      onPassword={setJoinTeamPassword}
      onClearError={() => setJoinTeamError(null)}
      onClose={closeJoinTeamDialog}
      onSubmit={() => { void handleJoinTeam(); }}
    />
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
          onCreateClick={() => {
            store.setError(null);
            setIsCreateTeamDialogOpen(true);
          }}
          onLogout={() => store.clearAuthProfile()}
        />
        <CreateTeamDialog
          open={isCreateTeamDialogOpen}
          currentUserName={store.authProfile.name}
          isLoading={isLoading}
          error={store.error}
          onClose={() => setIsCreateTeamDialogOpen(false)}
          onCreate={handleCreateTeam}
        />
        {joinTeamDialog('Войти')}
      </>
    );
  }

  if (store.authProfile) {
    return (
      <TeamRoomsView
        store={store}
        isLoading={isLoading}
        isRoomsLoading={isRoomsLoading}
        isTeamMembersLoading={isTeamMembersLoading}
        currentUserName={teamAdmin.currentUserName}
        isTeamAdmin={teamAdmin.isTeamAdmin}
        availableRooms={availableRooms}
        onRefreshRooms={() => { void fetchAvailableRooms(); }}
        onChangeTeam={handleChangeTeam}
        onLogout={() => { setIsChoosingTeam(false); store.clearAuthProfile(); }}
        onRoomClick={rooms.clickRoom}
        onCreateClick={rooms.openCreate}
        onDeleteClick={rooms.openDelete}
        onInviteClick={rooms.openInvite}
        onRemoveMember={teamAdmin.openRemove}
        onResetPassword={teamAdmin.resetMemberPassword}
        onOpenChangeTeamPassword={teamAdmin.openChangePassword}
        createDialog={rooms.createDialog}
        joinDialog={rooms.joinDialog}
        deleteDialog={rooms.deleteDialog}
        inviteDialog={rooms.inviteDialog}
        removeDialog={teamAdmin.removeDialog}
        resetDialog={teamAdmin.resetDialog}
        changePasswordDialog={teamAdmin.changePasswordDialog}
      />
    );
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
        <AuthPanel
          authTab={authTab}
          loginStep={loginStep}
          isLoading={isLoading}
          isTeamsLoading={isTeamsLoading}
          availableTeams={availableTeams}
          selectedTeam={selectedTeamForJoin}
          loginNames={loginNames}
          loginName={loginName}
          loginPassword={loginPassword}
          registerName={registerName}
          registerPassword={registerPassword}
          onAuthTab={setAuthTab}
          onClearError={() => store.setError(null)}
          onRefreshTeams={() => { void fetchAvailableTeams(); }}
          onTeamClick={handleOpenJoinTeamDialog}
          onBackToTeams={resetLoginTeamSelection}
          onLoginName={setLoginName}
          onLoginPassword={setLoginPassword}
          onLogin={() => { void handleTeamMemberLogin(); }}
          onRegisterName={setRegisterName}
          onRegisterPassword={setRegisterPassword}
          onRegister={() => { void handleRegister(); }}
        />
      </Paper>
      {joinTeamDialog('Продолжить')}
      <PrivacyNotice />
    </Box>
  );
});

export default Login;
