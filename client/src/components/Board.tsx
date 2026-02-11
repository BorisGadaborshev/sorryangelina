import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, AppBar, Toolbar, Typography, Button, ButtonGroup, CircularProgress, IconButton, Tooltip, Tabs, Tab, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, FormControl, Select, MenuItem, Menu } from '@mui/material';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PeopleIcon from '@mui/icons-material/People';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RetroColumn from './RetroColumn';
import UserList from './UserList';
import { RetroStore } from '../store/RetroStore';
import DiscussionView from './DiscussionView';

interface Props {
  store: RetroStore;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Board: React.FC<Props> = observer(({ store, themeMode, onToggleTheme }) => {
  const [isReady, setIsReady] = useState(false);
  const [isUserListVisible, setIsUserListVisible] = useState(true);
  const isMobile = useMediaQuery('(max-width:600px)');
  const isCompactDesktop = useMediaQuery('(max-width:1280px)');
  const [mobileTab, setMobileTab] = useState<number>(0); // 0 - доска, 1 - участники
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTimerSeconds, setSelectedTimerSeconds] = useState<number>(300);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const [timerAnchorEl, setTimerAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const getPhaseTranslation = (phase: 'creation' | 'voting' | 'discussion'): string => {
    const translations = {
      creation: 'Создание',
      voting: 'Голосование',
      discussion: 'Обсуждение'
    };
    return translations[phase];
  };

  const handleReadyStateChange = (isReady: boolean) => {
    store.socketService?.updateReadyState(isReady);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isTimerMenuOpen = Boolean(timerAnchorEl);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (store.phase !== 'creation') return;
    if (destination.droppableId === source.droppableId) return;

    const destinationColumn = Number(destination.droppableId.replace('column-', ''));
    if (Number.isNaN(destinationColumn)) return;

    store.socketService?.moveCard(draggableId, destinationColumn);
  };

  if (!store.room || !store.currentUser || !isReady) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderColumns = () => {
    const columns = (
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, width: '100%' }}>
        <RetroColumn
          title="Было хорошо"
          type="liked"
          columnIndex={0}
          store={store}
          enableDragDrop={store.phase === 'creation'}
        />
        <RetroColumn
          title="Было не очень"
          type="disliked"
          columnIndex={1}
          store={store}
          enableDragDrop={store.phase === 'creation'}
        />
        <RetroColumn
          title="А давайте!:"
          type="suggestion"
          columnIndex={2}
          store={store}
          enableDragDrop={store.phase === 'creation'}
        />
      </Box>
    );

    if (store.phase !== 'creation') {
      return columns;
    }

    return <DragDropContext onDragEnd={handleDragEnd}>{columns}</DragDropContext>;
  };

  const renderContent = () => {
    switch (store.phase) {
      case 'discussion':
        return <DiscussionView store={store} />;
      case 'creation':
      case 'voting':
      default:
        return renderColumns();
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar sx={{ gap: 1, flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', minHeight: 64 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, whiteSpace: 'nowrap', lineHeight: 1.2, fontSize: { xs: '1.1rem', md: '1.35rem' } }}
          >
            {isCompactDesktop && !isMobile ? store.room?.id : `Ретроспектива - Комната: ${store.room?.id}`}
          </Typography>
          {isCompactDesktop && !isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              <Typography variant="caption" sx={{ mr: 0.5, color: store.phaseTimer.running ? 'warning.main' : 'text.secondary', whiteSpace: 'nowrap' }}>
                {formatDuration(store.phaseTimer.remainingSeconds)}
              </Typography>
              {store.currentUser?.role === 'admin' && (
                <Tooltip title="Настройки таймера">
                  <IconButton size="small" onClick={(event) => setTimerAnchorEl(event.currentTarget)}>
                    <AccessTimeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
          <Typography variant="subtitle1" sx={{ mr: isMobile ? 0 : 2, whiteSpace: 'nowrap' }}>
            Этап: {getPhaseTranslation(store.phase)}
          </Typography>
          {(() => {
            const canChange = store.canChangePhase();
            const readyCount = store.getUserReadyCount();
            const totalCount = store.getTotalUserCount();
            const isAdmin = store.currentUser?.role === 'admin';

            const timerControls = (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2, whiteSpace: 'nowrap' }}>
                <Typography variant="caption" sx={{ color: store.phaseTimer.running ? 'warning.light' : 'text.secondary', whiteSpace: 'nowrap' }}>
                  Таймер: {formatDuration(store.phaseTimer.remainingSeconds)}
                </Typography>
                <Tooltip title="Настройки таймера">
                  <IconButton size="small" onClick={(event) => setTimerAnchorEl(event.currentTarget)}>
                    <AccessTimeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );

            return isAdmin ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={`${readyCount} из ${totalCount} участников готовы`}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      mr: 2, 
                      color: readyCount === totalCount ? 'success.light' : 'warning.light',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {readyCount}/{totalCount} готовы
                  </Typography>
                </Tooltip>
                <ButtonGroup variant="contained" color="secondary" size="small" sx={{ mr: 2 }}>
                  <Button
                    onClick={() => store.socketService?.changePhase('creation')}
                    disabled={store.phase === 'creation' || !canChange}
                    sx={{ color: 'white' }}
                  >
                    Создание
                  </Button>
                  <Button
                    onClick={() => store.socketService?.changePhase('voting')}
                    disabled={store.phase === 'voting' || !canChange}
                    sx={{ color: 'white' }}
                  >
                    Голосование
                  </Button>
                  <Button
                    onClick={() => store.socketService?.changePhase('discussion')}
                    disabled={store.phase === 'discussion' || !canChange}
                    sx={{ color: 'white' }}
                  >
                    Обсуждение
                  </Button>
                </ButtonGroup>
                {!isCompactDesktop ? timerControls : null}
              </Box>
            ) : !isCompactDesktop ? (
              <Typography variant="caption" sx={{ mr: 2, color: store.phaseTimer.running ? 'warning.light' : 'text.secondary', whiteSpace: 'nowrap' }}>
                Таймер: {formatDuration(store.phaseTimer.remainingSeconds)}
              </Typography>
            ) : null;
            
          })()}
          {store.currentUser?.role === 'admin' && !isCompactDesktop && (
            <Tooltip title="Удалить комнату">
              <IconButton
                color="inherit"
                onClick={() => setIsDeleteDialogOpen(true)}
                size="small"
              >
                <DeleteForeverIcon />
              </IconButton>
            </Tooltip>
          )}
          {!isCompactDesktop && (
            <Tooltip title={themeMode === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}>
              <IconButton color="inherit" onClick={onToggleTheme} size="small">
                {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          )}
          {!isMobile && isCompactDesktop && (
            <>
              <IconButton size="small" onClick={(event) => setMoreAnchorEl(event.currentTarget)} aria-label="more actions">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {'>>'}
                </Typography>
              </IconButton>
              <Menu
                anchorEl={moreAnchorEl}
                open={Boolean(moreAnchorEl)}
                onClose={() => setMoreAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {store.currentUser?.role === 'admin' && (
                  <MenuItem onClick={() => { setMoreAnchorEl(null); setIsDeleteDialogOpen(true); }}>
                    Удалить комнату
                  </MenuItem>
                )}
                <MenuItem onClick={() => { setMoreAnchorEl(null); onToggleTheme(); }}>
                  {themeMode === 'dark' ? 'Светлая тема' : 'Темная тема'}
                </MenuItem>
                <MenuItem onClick={() => { setMoreAnchorEl(null); setIsUserListVisible(!isUserListVisible); }}>
                  {isUserListVisible ? 'Скрыть участников' : 'Показать участников'}
                </MenuItem>
                <MenuItem onClick={() => { setMoreAnchorEl(null); store.socketService?.leaveRoom(); }}>
                  Выйти из комнаты
                </MenuItem>
              </Menu>
            </>
          )}
          {isMobile ? (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                <Tooltip title="Выйти из комнаты">
                  <IconButton
                    color="inherit"
                    onClick={() => store.socketService?.leaveRoom()}
                    size="small"
                  >
                    <ExitToAppIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)} textColor="inherit" indicatorColor="secondary" sx={{ width: '100%' }}>
                <Tab label="Доска" />
                <Tab label={`Участники (${store.users.length})`} />
              </Tabs>
            </Box>
          ) : !isCompactDesktop ? (
            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                color="inherit"
                onClick={() => setIsUserListVisible(!isUserListVisible)}
                size="small"
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 0.5 }} />
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    {store.users.length}
                  </Typography>
                  {isUserListVisible ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                </Box>
              </IconButton>
              <Tooltip title="Выйти из комнаты">
                <IconButton
                  color="inherit"
                  onClick={() => store.socketService?.leaveRoom()}
                  size="small"
                >
                  <ExitToAppIcon />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ ml: 1 }} />
          )}
          <Menu
            anchorEl={timerAnchorEl}
            open={isTimerMenuOpen}
            onClose={() => setTimerAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Осталось: {formatDuration(store.phaseTimer.remainingSeconds)}
              </Typography>
              <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                <Select
                  value={selectedTimerSeconds}
                  onChange={(event) => setSelectedTimerSeconds(Number(event.target.value))}
                  sx={{ height: 32 }}
                >
                  <MenuItem value={60}>1 минута</MenuItem>
                  <MenuItem value={180}>3 минуты</MenuItem>
                  <MenuItem value={300}>5 минут</MenuItem>
                  <MenuItem value={600}>10 минут</MenuItem>
                  <MenuItem value={900}>15 минут</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    store.socketService?.setPhaseTimer(selectedTimerSeconds);
                    setTimerAnchorEl(null);
                  }}
                  disabled={store.currentUser?.role !== 'admin'}
                >
                  {store.phaseTimer.running ? 'Перезапуск' : 'Старт'}
                </Button>
                <Button
                  size="small"
                  color="error"
                  fullWidth
                  onClick={() => {
                    store.socketService?.resetPhaseTimer();
                    setTimerAnchorEl(null);
                  }}
                  disabled={store.currentUser?.role !== 'admin' || !store.phaseTimer.running}
                >
                  Сброс
                </Button>
              </Box>
            </Box>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Контент */}
      <Box sx={{ 
        display: 'flex', 
        flexGrow: 1, 
        p: 1.25, 
        gap: 1.25,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden'
      }}>
        {isMobile ? (
          mobileTab === 1 ? (
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
              <UserList 
                users={store.users}
                onlineUsers={store.users.map(u => u.id)}
                currentUserId={store.currentUser.id}
                currentPhase={store.phase}
                onReadyStateChange={handleReadyStateChange}
                store={store}
              />
            </Box>
          ) : (
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {renderContent()}
            </Box>
          )
        ) : (
          <>
            <Box sx={{ 
              width: isUserListVisible ? 300 : 0,
              flexShrink: 0,
              overflowY: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: 1,
              transition: 'width 0.2s ease-in-out',
              visibility: isUserListVisible ? 'visible' : 'hidden'
            }}>
              <UserList 
                users={store.users}
                onlineUsers={store.users.map(u => u.id)}
                currentUserId={store.currentUser.id}
                currentPhase={store.phase}
                onReadyStateChange={handleReadyStateChange}
                store={store}
              />
            </Box>
            <Box sx={{ 
              flexGrow: 1,
              overflowY: 'auto'
            }}>
              {renderContent()}
            </Box>
          </>
        )}
      </Box>

      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Удалить комнату?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Комната будет удалена для всех участников. Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setIsDeleteDialogOpen(false);
              store.socketService?.deleteRoom();
            }}
          >
            Удалить комнату
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default Board;