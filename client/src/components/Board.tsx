import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, AppBar, Toolbar, Typography, Button, ButtonGroup, CircularProgress, IconButton, Tooltip, Tabs, Tab, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, FormControl, Select, MenuItem, Menu, Divider } from '@mui/material';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import BrushIcon from '@mui/icons-material/Brush';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import RetroColumn from './RetroColumn';
import UserList from './UserList';
import { RetroStore } from '../store/RetroStore';
import DiscussionView from './DiscussionView';
import ChatTerminal from './ChatTerminal';
import CollaborativeWhiteboard from './CollaborativeWhiteboard';
import RetroRatingView from './RetroRatingView';
import RoomSettingsSidebar from './RoomSettingsSidebar';
import MusicPlayerWidget from './MusicPlayerWidget';
import { Mood, Phase } from '../types';
import { toCssBackgroundUrl } from '../utils/media';

interface Props {
  store: RetroStore;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

const MOOD_OPTIONS: Array<{ value: Mood; emoji: string; label: string; color: string; labelColor: string }> = [
  { value: 'great', emoji: '😀', label: 'Великолепно', color: '#34c759', labelColor: '#ffffff' },
  { value: 'good', emoji: '🙂', label: 'Хорошо', color: '#8fd400', labelColor: '#1f1f1f' },
  { value: 'neutral', emoji: '😐', label: 'Нормально', color: '#f2d000', labelColor: '#1f1f1f' },
  { value: 'bad', emoji: '🙁', label: 'Плохо', color: '#e9b000', labelColor: '#1f1f1f' },
  { value: 'awful', emoji: '😠', label: 'Злой', color: '#ff5b62', labelColor: '#ffffff' }
];
const WHITEBOARD_COLORS = ['#111111', '#006dff', '#00a878', '#ff6b00', '#e11d48', '#7c3aed'];

const PHASE_ACTIVE_GREEN = '#34c759';

const getNextPhase = (phase: Phase, retroRatingEnabled: boolean): Phase | null => {
  if (phase === 'creation') return 'voting';
  if (phase === 'voting') return 'discussion';
  if (phase === 'discussion') return retroRatingEnabled ? 'rating' : null;
  return null;
};

const getPhaseButtonSx = (isActive: boolean, extra?: object) => ({
  color: '#fff',
  ...(isActive && {
    color: PHASE_ACTIVE_GREEN,
    bgcolor: 'transparent',
    backgroundImage: 'none',
    boxShadow: 'none',
    outline: `2px solid ${PHASE_ACTIVE_GREEN}`,
    outlineOffset: '1px',
    zIndex: 1,
    '&.MuiButton-containedSecondary': {
      color: PHASE_ACTIVE_GREEN,
      bgcolor: 'transparent',
    },
    '&.Mui-disabled': {
      color: PHASE_ACTIVE_GREEN,
      bgcolor: 'transparent',
      opacity: 1,
    },
  }),
  ...extra,
});

const Board: React.FC<Props> = observer(({ store, themeMode, onToggleTheme }) => {
  const [isReady, setIsReady] = useState(() => Boolean(store.room));
  const [isUserListVisible, setIsUserListVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isDrawEnabled, setIsDrawEnabled] = useState(false);
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'eraser'>('pen');
  const [whiteboardColor, setWhiteboardColor] = useState(WHITEBOARD_COLORS[0]);
  const isMobile = useMediaQuery('(max-width:600px)');
  const isCompactDesktop = useMediaQuery('(max-width:1280px)');
  const [mobileTab, setMobileTab] = useState<number>(0); // 0 - доска, 1 - участники
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTimerSeconds, setSelectedTimerSeconds] = useState<number>(300);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const [timerAnchorEl, setTimerAnchorEl] = useState<null | HTMLElement>(null);
  const [isMoodDialogOpen, setIsMoodDialogOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [isAllReadyModalOpen, setIsAllReadyModalOpen] = useState(false);
  const allReadyDismissedRef = useRef(false);
  const previousTimerRef = useRef({ running: false, remainingSeconds: 0 });
  const wasTimerRunningRef = useRef(false);
  const appliedSavedMoodRef = useRef<string | null>(null);
  const [isMusicWidgetOpen, setIsMusicWidgetOpen] = useState(false);
  const [timerMusicVolume, setTimerMusicVolume] = useState(() => {
    const saved = localStorage.getItem('timerMusicVolume');
    const parsed = saved ? Number(saved) : 0.35;
    return Number.isFinite(parsed) ? parsed : 0.35;
  });

  useEffect(() => {
    if (store.room) {
      setIsReady(true);
      return;
    }
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [store.room]);

  const currentUserName = store.currentUser?.name;
  const currentRoomId = store.room?.id;
  const currentUserMood = currentUserName
    ? store.users.find((user) => user.name === currentUserName)?.mood
    : undefined;

  useEffect(() => {
    if (!currentRoomId || !currentUserName) return;

    if (currentUserMood) {
      setSelectedMood(currentUserMood);
      setIsMoodDialogOpen(false);
      store.saveUserMood(currentRoomId, currentUserName, currentUserMood);
      return;
    }

    const savedMood = store.getSavedUserMood(currentRoomId, currentUserName);
    if (savedMood) {
      setSelectedMood(savedMood);
      setIsMoodDialogOpen(false);
      const applyKey = `${currentRoomId}:${currentUserName}`;
      if (appliedSavedMoodRef.current !== applyKey) {
        appliedSavedMoodRef.current = applyKey;
        store.socketService?.setUserMood(savedMood);
      }
      return;
    }

    setSelectedMood(null);
    setIsMoodDialogOpen(true);
  }, [currentRoomId, currentUserName, currentUserMood, store]);

  const getPhaseTranslation = (phase: Phase): string => {
    const translations = {
      creation: 'Создание',
      voting: 'Голосование',
      discussion: 'Обсуждение',
      rating: 'Оценка ретро'
    };
    return translations[phase];
  };

  const handleReadyStateChange = (isReady: boolean) => {
    store.updateUserReadyState(isReady);
  };

  const playTimerEndSignal = useCallback(() => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.2);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(timerMusicVolume, 0.2), audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.65);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.7);
    oscillator.onended = () => audioContext.close();
  }, [timerMusicVolume]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isTimerMenuOpen = Boolean(timerAnchorEl);
  const features = store.roomFeatures;
  const canDrawOnBoard = !isMobile
    && features.drawingEnabled
    && (store.phase === 'creation' || store.phase === 'voting');
  const canUseChat = features.chatEnabled;
  const canPlayTimerMusic = features.musicEnabled;
  const readyEnabled = features.readyEnabled;
  const readyCount = store.getUserReadyCount();
  const totalCount = store.getTotalUserCount();
  const allUsersReady = readyEnabled && totalCount > 0 && readyCount === totalCount;
  const nextPhase = getNextPhase(store.phase, features.retroRatingEnabled);
  const canAdvancePhase = store.isAdmin && nextPhase !== null;
  useEffect(() => {
    if (allUsersReady) {
      if (!allReadyDismissedRef.current) {
        setIsAllReadyModalOpen(true);
      }
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      allReadyDismissedRef.current = false;
      setIsAllReadyModalOpen(false);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [allUsersReady, store.phase]);

  const handleCloseAllReadyModal = () => {
    allReadyDismissedRef.current = true;
    setIsAllReadyModalOpen(false);
  };

  const handleAdvancePhaseFromModal = () => {
    if (nextPhase && store.isAdmin) {
      store.socketService?.changePhase(nextPhase);
    }
    allReadyDismissedRef.current = true;
    setIsAllReadyModalOpen(false);
  };

  useEffect(() => {
    localStorage.setItem('timerMusicVolume', String(timerMusicVolume));
  }, [timerMusicVolume]);

  useEffect(() => {
    if (store.phaseTimer.running && !wasTimerRunningRef.current && canPlayTimerMusic) {
      setIsMusicWidgetOpen(true);
    }
    wasTimerRunningRef.current = store.phaseTimer.running;
  }, [store.phaseTimer.running, canPlayTimerMusic]);

  useEffect(() => {
    if (!canUseChat && isChatVisible) {
      setIsChatVisible(false);
    }
  }, [canUseChat, isChatVisible]);

  useEffect(() => {
    const previous = previousTimerRef.current;
    if (previous.running && previous.remainingSeconds <= 1 && !store.phaseTimer.running && store.phaseTimer.remainingSeconds === 0) {
      playTimerEndSignal();
    }
    previousTimerRef.current = {
      running: store.phaseTimer.running,
      remainingSeconds: store.phaseTimer.remainingSeconds
    };
  }, [store.phaseTimer.running, store.phaseTimer.remainingSeconds, playTimerEndSignal]);

  useEffect(() => {
    if (!canDrawOnBoard && isDrawEnabled) {
      setIsDrawEnabled(false);
    }
  }, [canDrawOnBoard, isDrawEnabled]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, combine } = result;
    if (store.phase !== 'creation') return;
    const draggedCard = store.cards.find((card) => card.id === draggableId);
    if (!draggedCard || !store.canMoveCard(draggedCard)) return;

    if (combine) {
      if (!store.canMergeCards || combine.draggableId === draggableId) return;
      store.socketService?.mergeCards(combine.draggableId, draggableId);
      return;
    }

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const destinationColumn = Number(destination.droppableId.replace('column-', ''));
    if (Number.isNaN(destinationColumn)) return;

    store.socketService?.moveCard(draggableId, destinationColumn);
  };

  const handleSaveMood = () => {
    if (!selectedMood || !currentUserName || !currentRoomId) return;
    store.saveUserMood(currentRoomId, currentUserName, selectedMood);
    store.socketService?.setUserMood(selectedMood);
    setIsMoodDialogOpen(false);
  };

  if (!store.canRenderBoard) {
    if (!store.hasBoardSession && !store.hasCachedBoardState) {
      return (
        <Box sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Загрузка доски...
        </Typography>
      </Box>
    );
  }

  if (!isReady) {
    return null;
  }

  const currentUser = store.currentUser!;

  const renderColumns = () => {
    const columns = (
      <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 2,
        width: '100%',
        minWidth: 0,
        minHeight: isMobile ? 'auto' : '100%',
        height: 'auto',
        alignItems: 'stretch',
      }}>
        <RetroColumn
          type="liked"
          columnIndex={0}
          store={store}
          enableDragDrop={store.canUseCardDragDrop}
          onAddCardStart={() => setIsDrawEnabled(false)}
        />
        <RetroColumn
          type="disliked"
          columnIndex={1}
          store={store}
          enableDragDrop={store.canUseCardDragDrop}
          onAddCardStart={() => setIsDrawEnabled(false)}
        />
        <RetroColumn
          type="suggestion"
          columnIndex={2}
          store={store}
          enableDragDrop={store.canUseCardDragDrop}
          onAddCardStart={() => setIsDrawEnabled(false)}
        />
      </Box>
    );

    if (!store.canUseCardDragDrop) {
      return columns;
    }

    return <DragDropContext onDragEnd={handleDragEnd}>{columns}</DragDropContext>;
  };

  const renderContent = () => {
    switch (store.phase) {
      case 'discussion':
        return <DiscussionView store={store} />;
      case 'rating':
        return <RetroRatingView store={store} />;
      case 'creation':
      case 'voting':
      default:
        return renderColumns();
    }
  };

  const leaveRoomButton = (
    <Tooltip title="Выход из комнаты">
      <IconButton
        color="inherit"
        onClick={() => store.socketService?.leaveRoom()}
        size="small"
        aria-label="Выход из комнаты"
      >
        <ExitToAppIcon />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {store.isReconnecting && !store.cards.length && (
        <Box sx={{
          px: 2,
          py: 0.75,
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          textAlign: 'center',
          typography: 'body2',
          flexShrink: 0,
        }}>
          Загрузка доски...
        </Box>
      )}
      <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary', flexShrink: 0 }}>
        <Toolbar sx={{ gap: 1, flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', minHeight: 64 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, whiteSpace: 'nowrap', lineHeight: 1.2, fontSize: { xs: '1.1rem', md: '1.35rem' } }}
          >
            {isCompactDesktop && !isMobile ? store.room?.id : `Комната: ${store.room?.id}`}
          </Typography>
          {isCompactDesktop && !isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              <Typography variant="caption" sx={{ mr: 0.5, color: store.phaseTimer.running ? 'warning.main' : 'text.secondary', whiteSpace: 'nowrap' }}>
                {formatDuration(store.phaseTimer.remainingSeconds)}
              </Typography>
              <Tooltip title="Таймер и музыка">
                <IconButton size="small" onClick={(event) => setTimerAnchorEl(event.currentTarget)}>
                  <AccessTimeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {(() => {
            const canChange = store.canChangePhase();
            const isAdmin = store.canChangePhase();

            const timerControls = (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2, whiteSpace: 'nowrap' }}>
                <Typography variant="caption" sx={{ color: store.phaseTimer.running ? 'warning.light' : 'text.secondary', whiteSpace: 'nowrap' }}>
                  Таймер: {formatDuration(store.phaseTimer.remainingSeconds)}
                </Typography>
                <Tooltip title="Таймер и музыка">
                  <IconButton size="small" onClick={(event) => setTimerAnchorEl(event.currentTarget)}>
                    <AccessTimeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );

            return isAdmin ? (
              <Box sx={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                width: isMobile ? '100%' : 'auto',
                gap: isMobile ? 0.5 : 0,
              }}>
                {isMobile ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 0.5,
                      width: '100%',
                    }}
                  >
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => store.socketService?.changePhase('creation')}
                      disabled={store.phase === 'creation' || !canChange}
                      sx={getPhaseButtonSx(store.phase === 'creation', { minWidth: 0, px: 1 })}
                    >
                      Создание
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => store.socketService?.changePhase('voting')}
                      disabled={store.phase === 'voting' || !canChange}
                      sx={getPhaseButtonSx(store.phase === 'voting', { minWidth: 0, px: 1 })}
                    >
                      Голосование
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => store.socketService?.changePhase('discussion')}
                      disabled={store.phase === 'discussion' || !canChange}
                      sx={getPhaseButtonSx(store.phase === 'discussion', { minWidth: 0, px: 1 })}
                    >
                      Обсуждение
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => store.socketService?.changePhase('rating')}
                      disabled={store.phase === 'rating' || !canChange || !features.retroRatingEnabled}
                      sx={getPhaseButtonSx(store.phase === 'rating', { minWidth: 0, px: 1 })}
                    >
                      Оценка
                    </Button>
                  </Box>
                ) : (
                  <ButtonGroup variant="contained" color="secondary" size="small" sx={{ mr: 2, overflow: 'visible' }}>
                    <Button
                      onClick={() => store.socketService?.changePhase('creation')}
                      disabled={store.phase === 'creation' || !canChange}
                      sx={getPhaseButtonSx(store.phase === 'creation')}
                    >
                      Создание
                    </Button>
                    <Button
                      onClick={() => store.socketService?.changePhase('voting')}
                      disabled={store.phase === 'voting' || !canChange}
                      sx={getPhaseButtonSx(store.phase === 'voting')}
                    >
                      Голосование
                    </Button>
                    <Button
                      onClick={() => store.socketService?.changePhase('discussion')}
                      disabled={store.phase === 'discussion' || !canChange}
                      sx={getPhaseButtonSx(store.phase === 'discussion')}
                    >
                      Обсуждение
                    </Button>
                    <Button
                      onClick={() => store.socketService?.changePhase('rating')}
                      disabled={store.phase === 'rating' || !canChange || !features.retroRatingEnabled}
                      sx={getPhaseButtonSx(store.phase === 'rating')}
                    >
                      Оценка
                    </Button>
                  </ButtonGroup>
                )}
                {!isCompactDesktop ? timerControls : null}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: isMobile ? 0 : 1, ml: 'auto' }}>
                {!isCompactDesktop ? timerControls : null}
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    color: PHASE_ACTIVE_GREEN,
                    px: 1.25,
                    py: 0.5,
                    border: `2px solid ${PHASE_ACTIVE_GREEN}`,
                    borderRadius: 1,
                    lineHeight: 1.2,
                  }}
                >
                  {getPhaseTranslation(store.phase)}
                </Typography>
              </Box>
            );
            
          })()}
          {!isCompactDesktop && !isMobile && (
            <>
              <Tooltip title="Настройки">
                <IconButton
                  color="inherit"
                  onClick={() => setIsSettingsOpen(true)}
                  size="small"
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
              {leaveRoomButton}
            </>
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
                <MenuItem onClick={() => { setMoreAnchorEl(null); setIsSettingsOpen(true); }}>
                  Настройки
                </MenuItem>
              </Menu>
              {leaveRoomButton}
            </>
          )}
          {isMobile ? (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5, gap: 0.5 }}>
                <Tooltip title="Таймер и музыка">
                  <IconButton
                    color="inherit"
                    onClick={(event) => setTimerAnchorEl(event.currentTarget)}
                    size="small"
                  >
                    <AccessTimeIcon />
                  </IconButton>
                </Tooltip>
                {canUseChat && (
                  <Tooltip title={isChatVisible ? 'Скрыть чат' : 'Показать чат'}>
                    <IconButton
                      color="inherit"
                      onClick={() => setIsChatVisible(!isChatVisible)}
                      size="small"
                    >
                      <ChatBubbleOutlineIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Настройки">
                  <IconButton
                    color="inherit"
                    onClick={() => setIsSettingsOpen(true)}
                    size="small"
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                {leaveRoomButton}
              </Box>
              {readyEnabled && store.currentUser && (
                <Button
                  variant="outlined"
                  color={store.currentUser.isReady ? 'success' : 'primary'}
                  fullWidth
                  size="small"
                  onClick={() => handleReadyStateChange(!store.currentUser!.isReady)}
                  startIcon={store.currentUser.isReady ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                  sx={{ mb: 0.5 }}
                >
                  {store.currentUser.isReady ? 'Я готов(а)' : 'Отметить готовность'}
                </Button>
              )}
              <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)} textColor="inherit" indicatorColor="secondary" sx={{ width: '100%' }}>
                <Tab label="Доска" />
                <Tab
                  label={
                    readyEnabled ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        Участники (
                        ✅ {store.getUserReadyCount()}
                        {' / '}
                        <PersonIcon sx={{ fontSize: 16 }} />
                        {store.users.length})
                      </Box>
                    ) : `Участники (${store.users.length})`
                  }
                />
              </Tabs>
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
            <Box sx={{ p: 1.5, minWidth: 260 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Осталось: {formatDuration(store.phaseTimer.remainingSeconds)}
              </Typography>

              {canPlayTimerMusic && (
              <Box sx={{ mb: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  startIcon={<MusicNoteIcon fontSize="small" />}
                  onClick={() => {
                    setIsMusicWidgetOpen(true);
                    setTimerAnchorEl(null);
                  }}
                >
                  Плеер музыки
                </Button>
              </Box>
              )}

              {store.currentUser?.role === 'admin' && (
                <>
                  <Divider sx={{ my: 1.5 }} />
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
                      disabled={!store.phaseTimer.running}
                    >
                      Сброс
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Menu>
        </Toolbar>
      </AppBar>
      <MusicPlayerWidget
        open={isMusicWidgetOpen}
        enabled={canPlayTimerMusic}
        timerRunning={store.phaseTimer.running}
        remainingLabel={formatDuration(store.phaseTimer.remainingSeconds)}
        volume={timerMusicVolume}
        onVolumeChange={setTimerMusicVolume}
        onClose={() => setIsMusicWidgetOpen(false)}
      />

      {/* Контент */}
      <Box sx={{ 
        display: 'flex', 
        flexGrow: 1,
        minHeight: 0,
        overflow: 'hidden',
        p: 1.25, 
        gap: 1.25,
        minWidth: 0,
        ...(store.roomFeatures.backgroundImage
          ? {
              backgroundImage: toCssBackgroundUrl(store.roomFeatures.backgroundImage),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundColor: 'background.default'
            }
          : {})
      }}>
        {isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, overflow: 'hidden', gap: 1 }}>
            {mobileTab === 1 ? (
              <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <UserList 
                  users={store.users}
                  onlineUsers={store.users.map(u => u.id)}
                  currentUserId={currentUser.id}
                  currentPhase={store.phase}
                  onReadyStateChange={handleReadyStateChange}
                  store={store}
                  showReadyControl={false}
                />
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
                {renderContent()}
              </Box>
            )}
            {canUseChat && isChatVisible && (
              <Box sx={{ flexShrink: 0 }}>
                <ChatTerminal store={store} compact />
              </Box>
            )}
          </Box>
        ) : (
          <>
            <Box sx={{ 
              width: isUserListVisible ? 300 : 0,
              flexShrink: 0,
              alignSelf: 'stretch',
              minHeight: 0,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: 1,
              transition: 'width 0.2s ease-in-out',
              visibility: isUserListVisible ? 'visible' : 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <UserList 
                  users={store.users}
                  onlineUsers={store.users.map(u => u.id)}
                  currentUserId={currentUser.id}
                  currentPhase={store.phase}
                  onReadyStateChange={handleReadyStateChange}
                  store={store}
                  showReadyControl={readyEnabled}
                />
              </Box>
              <Box sx={{ p: 0.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {canUseChat && (
                    <Tooltip title={isChatVisible ? 'Скрыть чат' : 'Показать чат'}>
                      <IconButton
                        size="small"
                        color={isChatVisible ? 'primary' : 'default'}
                        onClick={() => setIsChatVisible(!isChatVisible)}
                      >
                        <ChatBubbleOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDrawOnBoard && (
                    <>
                      <Tooltip title={isDrawEnabled ? 'Выключить рисование' : 'Включить рисование'}>
                        <IconButton
                          size="small"
                          color={isDrawEnabled ? 'primary' : 'default'}
                          onClick={() => setIsDrawEnabled((prev) => !prev)}
                        >
                          <BrushIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {isDrawEnabled && (
                        <>
                          <Tooltip title="Перо">
                            <IconButton
                              size="small"
                              color={whiteboardTool === 'pen' ? 'primary' : 'default'}
                              onClick={() => {
                                setWhiteboardTool('pen');
                                if (!isDrawEnabled) setIsDrawEnabled(true);
                              }}
                            >
                              <BrushIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ластик">
                            <IconButton
                              size="small"
                              color={whiteboardTool === 'eraser' ? 'primary' : 'default'}
                              onClick={() => {
                                setWhiteboardTool('eraser');
                                if (!isDrawEnabled) setIsDrawEnabled(true);
                              }}
                            >
                              <CleaningServicesIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {WHITEBOARD_COLORS.map((item) => (
                            <Button
                              key={item}
                              onClick={() => {
                                setWhiteboardColor(item);
                                setWhiteboardTool('pen');
                                if (!isDrawEnabled) setIsDrawEnabled(true);
                              }}
                              sx={{
                                minWidth: 16,
                                width: 16,
                                height: 16,
                                p: 0,
                                borderRadius: '50%',
                                bgcolor: item,
                                border: whiteboardColor === item && whiteboardTool === 'pen' ? '2px solid #111' : '1px solid rgba(0,0,0,0.2)'
                              }}
                            />
                          ))}
                          <Tooltip title="Очистить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                store.clearWhiteboard();
                                store.socketService?.clearWhiteboard();
                              }}
                            >
                              <DeleteSweepIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            </Box>
            <Box sx={{ 
              flexGrow: 1,
              minWidth: 0,
              minHeight: 0,
              overflow: 'auto',
              overflowX: 'hidden',
              position: 'relative',
            }}>
              {renderContent()}
              {canDrawOnBoard && (
                <>
                  <CollaborativeWhiteboard
                    store={store}
                    enabled={isDrawEnabled}
                    tool={whiteboardTool}
                    color={whiteboardColor}
                  />
                </>
              )}
            </Box>
            {canUseChat && isChatVisible && (
              <Box
                sx={{
                  width: 330,
                  flexShrink: 0,
                  minWidth: 280,
                  maxWidth: 380,
                  minHeight: 0,
                  alignSelf: 'stretch',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <ChatTerminal store={store} />
              </Box>
            )}
          </>
        )}
      </Box>

      <RoomSettingsSidebar
        store={store}
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
        isUserListVisible={isUserListVisible}
        onToggleUserList={() => setIsUserListVisible((prev) => !prev)}
      />

      <Dialog
        open={store.isFacilitatorDialogOpen}
        onClose={() => store.dismissFacilitatorDialog()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Ведущий выбран</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Карточки читает {store.facilitatorAnnouncement?.userName}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => store.dismissFacilitatorDialog()}>
            Понятно
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isMoodDialogOpen}
        onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
          setIsMoodDialogOpen(false);
        }}
      >
        <DialogTitle>Как ваше самочувствие?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Выберите смайлик, который отражает ваше самочувствие и отношение к спринту
          </DialogContentText>
          <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'center', mb: 1 }}>
              {MOOD_OPTIONS.map((option) => {
                const isActive = selectedMood === option.value;
                return (
                  <Box key={option.value} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      onClick={() => setSelectedMood(option.value)}
                      sx={{
                        minWidth: 56,
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        fontSize: '1.65rem',
                        bgcolor: option.color,
                        border: isActive ? '3px solid' : '1px solid',
                        borderColor: isActive ? 'text.primary' : 'transparent',
                        lineHeight: 1
                      }}
                    >
                      {option.emoji}
                    </Button>
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderRadius: 999, overflow: 'hidden' }}>
              {MOOD_OPTIONS.map((option) => (
                <Box
                  key={option.value}
                  sx={{
                    height: 28,
                    bgcolor: option.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 0.5
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: option.labelColor,
                      fontSize: '0.68rem',
                      lineHeight: 1.1,
                      fontWeight: 600,
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {option.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleSaveMood} disabled={!selectedMood}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isAllReadyModalOpen} onClose={handleCloseAllReadyModal} maxWidth="xs" fullWidth>
        <DialogTitle>Все готовы</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Все участники ({totalCount}) отметили готовность на этапе «{getPhaseTranslation(store.phase)}».
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {canAdvancePhase && nextPhase && (
            <Button variant="contained" color="secondary" onClick={handleAdvancePhaseFromModal} sx={{ color: 'white' }}>
              {getPhaseTranslation(nextPhase)}
            </Button>
          )}
          <Button variant="outlined" onClick={handleCloseAllReadyModal}>
            ОК
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default Board;