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
import { AuthProfile, AvailableRoom } from '../types';
import RoomTiles from './RoomTiles';

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
  const [fixedUsers, setFixedUsers] = useState<string[]>([]);
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
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteRoomId, setDeleteRoomId] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [isFixedUsersUnlocked, setIsFixedUsersUnlocked] = useState(false);
  const [isSuboDialogOpen, setIsSuboDialogOpen] = useState(false);
  const [suboInput, setSuboInput] = useState('');
  const [suboError, setSuboError] = useState<string | null>(null);

  const fetchFixedUsers = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/auth/fixed-users`);
      if (!response.ok) {
        throw new Error('Failed to fetch fixed users');
      }
      const data = (await response.json()) as { users: string[] };
      setFixedUsers(data.users);
      setFixedName((prev) => (prev || data.users[0] || ''));
    } catch (error) {
      store.setError('Не удалось загрузить фиксированные ФИО');
    }
  }, [store]);

  const fetchAvailableRooms = useCallback(async () => {
    setIsRoomsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/rooms`);
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
  }, [store]);

  useEffect(() => {
    fetchFixedUsers();
  }, [fetchFixedUsers]);

  useEffect(() => {
    if (store.authProfile) {
      fetchAvailableRooms();
    }
  }, [fetchAvailableRooms, store.authProfile]);

  const handleAuthSuccess = (profile: AuthProfile) => {
    store.setAuthProfile(profile);
    store.setError(null);
    setAccountPassword('');
    setRegisterPassword('');
    setFixedPassword('');
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

  const handleCreateRoom = async () => {
    if (!store.authProfile || !createRoomId.trim() || !createRoomPassword.trim()) return;

    setIsLoading(true);
    store.setError(null);
    try {
      await store.socketService?.createRoom(createRoomId.trim(), createRoomPassword.trim(), store.authProfile.name, store.authProfile.token);
      setIsCreateDialogOpen(false);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Не удалось создать комнату');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!store.authProfile || !selectedRoomId.trim() || !joinRoomPassword.trim()) return;

    setIsLoading(true);
    setJoinRoomError(null);
    store.setError(null);
    try {
      await store.socketService?.joinRoom(selectedRoomId.trim(), joinRoomPassword.trim(), store.authProfile.name, store.authProfile.token);
      setIsJoinDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось подключиться к комнате';
      setJoinRoomError(message);
      store.setError(null);
    } finally {
      setIsLoading(false);
    }
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
    setIsSuboDialogOpen(false);
    setSuboInput('');
    setSuboError(null);
  };

  const renderAuthBlock = () => (
    <>
      <Tabs value={authTab} onChange={(_, value) => setAuthTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}>
        <Tab label="Команда &quot;Карты и Партнеры&quot;" />
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
                Команда "Карты и Партнеры"
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
        bgcolor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 3 }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box>
          <Typography variant="h5">Выбор комнаты</Typography>
          <Typography variant="body2" color="text.secondary">
            Вы вошли как: <b>{store.authProfile?.name}</b>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={fetchAvailableRooms} disabled={isRoomsLoading}>
            Обновить
          </Button>
          <Button onClick={() => store.clearAuthProfile()}>Сменить аккаунт</Button>
        </Box>
      </Box>

      {store.error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {store.error}
        </Typography>
      )}

      <Box sx={{ flex: 1 }}>
        {isRoomsLoading ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <RoomTiles
            rooms={availableRooms}
            currentUserName={store.authProfile?.name || ''}
            onRoomClick={handleOpenJoinDialog}
            onCreateClick={handleOpenCreateDialog}
            onDeleteClick={handleOpenDeleteDialog}
          />
        )}
      </Box>

      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Создать комнату</DialogTitle>
        <DialogContent>
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
            label="Пароль комнаты"
            margin="normal"
            value={createRoomPassword}
            onChange={(event) => setCreateRoomPassword(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleCreateRoom}
            disabled={isLoading || !createRoomId.trim() || !createRoomPassword.trim()}
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
          <Button variant="contained" onClick={handleJoinRoom} disabled={isLoading || !joinRoomPassword.trim()}>
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
    </Box>
  );

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
        bgcolor: '#f5f5f5',
        p: 2
      }}
    >
      <Paper elevation={3} sx={{ p: 3, width: '100%', maxWidth: 720 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Retro Board
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