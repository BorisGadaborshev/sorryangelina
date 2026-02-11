import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, AppBar, Toolbar, Typography, Button, ButtonGroup, CircularProgress, IconButton, Tooltip, Tabs, Tab, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, FormControl, Select, MenuItem } from '@mui/material';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PeopleIcon from '@mui/icons-material/People';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RetroColumn from './RetroColumn';
import UserList from './UserList';
import { RetroStore } from '../store/RetroStore';
import DiscussionView from './DiscussionView';

interface Props {
  store: RetroStore;
}

const Board: React.FC<Props> = observer(({ store }) => {
  const [isReady, setIsReady] = useState(false);
  const [isUserListVisible, setIsUserListVisible] = useState(true);
  const isMobile = useMediaQuery('(max-width:600px)');
  const [mobileTab, setMobileTab] = useState<number>(0); // 0 - доска, 1 - участники
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTimerSeconds, setSelectedTimerSeconds] = useState<number>(300);

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
          title="Что прошло хорошо"
          type="liked"
          columnIndex={0}
          store={store}
          enableDragDrop={store.phase === 'creation'}
        />
        <RetroColumn
          title="Что нужно улучшить"
          type="disliked"
          columnIndex={1}
          store={store}
          enableDragDrop={store.phase === 'creation'}
        />
        <RetroColumn
          title="План действий"
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
      <AppBar position="static">
        <Toolbar sx={{ gap: 1, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, mt: '20px' }}>
            Ретроспектива - Комната: {store.room?.id}
          </Typography>
          <Typography variant="subtitle1" sx={{ mr: isMobile ? 0 : 2 }}>
            Этап: {getPhaseTranslation(store.phase)}
          </Typography>
          {(() => {
            const canChange = store.canChangePhase();
            const readyCount = store.getUserReadyCount();
            const totalCount = store.getTotalUserCount();
            const isAdmin = store.currentUser?.role === 'admin';

            return isAdmin ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={`${readyCount} из ${totalCount} участников готовы`}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      mr: 2, 
                      color: readyCount === totalCount ? 'success.light' : 'warning.light'
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                  <Typography variant="caption" sx={{ color: store.phaseTimer.running ? 'warning.light' : 'text.secondary' }}>
                    Таймер: {formatDuration(store.phaseTimer.remainingSeconds)}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <Select
                      value={selectedTimerSeconds}
                      onChange={(event) => setSelectedTimerSeconds(Number(event.target.value))}
                      sx={{ color: 'white', '.MuiSelect-icon': { color: 'white' }, height: 32 }}
                    >
                      <MenuItem value={60}>1 минута</MenuItem>
                      <MenuItem value={180}>3 минуты</MenuItem>
                      <MenuItem value={300}>5 минут</MenuItem>
                      <MenuItem value={600}>10 минут</MenuItem>
                      <MenuItem value={900}>15 минут</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ color: 'white', borderColor: 'white' }}
                    onClick={() => store.socketService?.setPhaseTimer(selectedTimerSeconds)}
                  >
                    {store.phaseTimer.running ? 'Перезапуск' : 'Старт'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Typography variant="caption" sx={{ mr: 2, color: store.phaseTimer.running ? 'warning.light' : 'text.secondary' }}>
                Таймер: {formatDuration(store.phaseTimer.remainingSeconds)}
              </Typography>
            );
          })()}
          {store.currentUser?.role === 'admin' && (
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
          ) : (
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
          )}
        </Toolbar>
      </AppBar>

      {/* Контент */}
      <Box sx={{ 
        display: 'flex', 
        flexGrow: 1, 
        p: 2, 
        gap: 2,
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