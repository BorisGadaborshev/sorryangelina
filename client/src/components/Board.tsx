import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, AppBar, Toolbar, Typography, Button, CircularProgress, IconButton, Tooltip, Tabs, Tab, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Menu, MenuItem, Snackbar, Alert, TextField } from '@mui/material';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import BrushIcon from '@mui/icons-material/Brush';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import HowToVoteRoundedIcon from '@mui/icons-material/HowToVoteRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import RetroColumn from './RetroColumn';
import UserList from './UserList';
import { RetroStore } from '../store/RetroStore';
import ChatTerminal from './ChatTerminal';
import JoystickIcon from './JoystickIcon';
import RoomSettingsSidebar from './RoomSettingsSidebar';
import ErrorBoundary from './ErrorBoundary';
import { ConnectionStatusLabel, PhaseTimerLabel, PhaseTimerMenuPanel, PhaseTimerWatcher, TimerMusicSlot } from './PhaseTimer';
import { Mood, Phase, RetroTemplateId } from '../types';
import { toCssBackgroundUrl } from '../utils/media';
import { getReadyButtonSx } from './readyButtonStyles';
import { readStoredSession } from '../services/session';
import { mapServerError } from '../utils/errors';

const DiscussionView = lazy(() => import('./DiscussionView'));
const CollaborativeWhiteboard = lazy(() => import('./CollaborativeWhiteboard'));
const ArkanoidGame = lazy(() => import('./ArkanoidGame'));
const RetroRatingView = lazy(() => import('./RetroRatingView'));
const RoadmapView = lazy(() => import('./RoadmapView'));

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
const PHASE_ACCENT = '#6c63ff';

const PHASE_OPTIONS: Array<{
  value: Phase;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}> = [
  { value: 'creation', label: 'Создание', shortLabel: 'Создание', icon: EditNoteRoundedIcon },
  { value: 'voting', label: 'Голосование', shortLabel: 'Голоса', icon: HowToVoteRoundedIcon },
  { value: 'discussion', label: 'Обсуждение', shortLabel: 'Обсуждение', icon: ForumRoundedIcon },
  { value: 'roadmap', label: 'Дорожная карта', shortLabel: 'Карта', icon: AccountTreeRoundedIcon },
  { value: 'rating', label: 'Оценка ретро', shortLabel: 'Оценка', icon: AutoAwesomeRoundedIcon },
];

const RoomRejoinDialog: React.FC<{
  open: boolean;
  password: string;
  error: string | null;
  busy: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onLeave: () => void;
}> = ({ open, password, error, busy, onPasswordChange, onSubmit, onLeave }) => (
  <Dialog open={open} maxWidth="xs" fullWidth>
    <DialogTitle>Нужен пароль комнаты</DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ mb: 2 }}>
        Сессия комнаты истекла. Введите пароль, чтобы вернуться на доску.
      </DialogContentText>
      <TextField
        autoFocus
        fullWidth
        type="password"
        label="Пароль"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        error={Boolean(error)}
        helperText={error || ' '}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onLeave} disabled={busy}>Выйти</Button>
      <Button variant="contained" onClick={onSubmit} disabled={busy}>Войти</Button>
    </DialogActions>
  </Dialog>
);

const getNextPhase = (phase: Phase, templateId: RetroTemplateId, retroRatingEnabled: boolean): Phase | null => {
  if (phase === 'creation') return 'voting';
  if (phase === 'voting') return 'discussion';
  if (phase === 'discussion') return templateId === 'traffic-light' ? 'roadmap' : (retroRatingEnabled ? 'rating' : null);
  if (phase === 'roadmap') return retroRatingEnabled ? 'rating' : null;
  return null;
};

const getPhaseButtonSx = (isActive: boolean, isUnavailable: boolean, isMobile: boolean, isDarkMode: boolean) => ({
  minWidth: 0,
  minHeight: isMobile ? 42 : 36,
  px: isMobile ? 1 : 1.35,
  border: '1px solid',
  borderColor: isActive ? 'transparent' : 'divider',
  borderRadius: '10px !important',
  color: isActive ? '#fff' : 'text.secondary',
  bgcolor: isActive ? PHASE_ACCENT : (isDarkMode ? 'rgba(255,255,255,0.09)' : 'background.paper'),
  backgroundImage: isActive
    ? 'linear-gradient(135deg, #766dff 0%, #5b54e8 100%)'
    : 'none',
  boxShadow: isActive
    ? '0 4px 12px rgba(92, 84, 232, 0.3)'
    : (isMobile ? '0 1px 3px rgba(20, 24, 40, 0.1)' : 'none'),
  fontSize: isMobile ? '0.75rem' : '0.78rem',
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: '-0.01em',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transition: 'color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  '& .MuiButton-startIcon': {
    mr: isMobile ? 0.6 : 0.7,
    '& svg': { fontSize: isMobile ? 17 : 18 },
  },
  '&:hover': {
    color: isActive ? '#fff' : 'text.primary',
    bgcolor: isActive ? PHASE_ACCENT : (isDarkMode ? 'rgba(255,255,255,0.14)' : 'action.hover'),
    borderColor: !isActive ? 'text.disabled' : undefined,
    backgroundImage: isActive
      ? 'linear-gradient(135deg, #827aff 0%, #655df0 100%)'
      : 'none',
    boxShadow: isActive ? '0 5px 14px rgba(92, 84, 232, 0.36)' : 'none',
    transform: isActive ? 'none' : 'translateY(-1px)',
  },
  '&:focus-visible': {
    outline: `3px solid rgba(108, 99, 255, 0.28)`,
    outlineOffset: 1,
  },
  '&.Mui-disabled': {
    color: isActive ? '#fff' : 'text.disabled',
    bgcolor: isActive ? PHASE_ACCENT : (isDarkMode ? 'rgba(255,255,255,0.09)' : 'background.paper'),
    borderColor: isActive ? 'transparent' : 'divider',
    backgroundImage: isActive
      ? 'linear-gradient(135deg, #766dff 0%, #5b54e8 100%)'
      : 'none',
    boxShadow: isActive ? '0 4px 12px rgba(92, 84, 232, 0.3)' : 'none',
    opacity: isUnavailable && !isActive ? 0.42 : 1,
  },
});

const Board: React.FC<Props> = observer(({ store, themeMode, onToggleTheme }) => {
  const [isReady, setIsReady] = useState(() => Boolean(store.room));
  const [isUserListVisible, setIsUserListVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isDrawEnabled, setIsDrawEnabled] = useState(false);
  const [isArkanoidEnabled, setIsArkanoidEnabled] = useState(false);
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
  const appliedSavedMoodRef = useRef<string | null>(null);
  const [rejoinPassword, setRejoinPassword] = useState('');
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [isRejoining, setIsRejoining] = useState(false);
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
    const translations: Record<Phase, string> = {
      creation: 'Создание',
      voting: 'Голосование',
      discussion: 'Обсуждение',
      roadmap: 'Дорожная карта',
      rating: 'Оценка ретро'
    };
    return translations[phase];
  };

  const handleReadyStateChange = useCallback((isReady: boolean) => {
    store.updateUserReadyState(isReady);
  }, [store]);

  const openTimerMusic = useCallback(() => {
    setIsMusicWidgetOpen(true);
  }, []);

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

  const isTimerMenuOpen = Boolean(timerAnchorEl);
  const features = store.roomFeatures;
  const canDrawOnBoard = !isMobile
    && features.drawingEnabled
    && (store.phase === 'creation' || store.phase === 'voting');
  const canPlayArkanoid = !isMobile
    && features.arkanoidEnabled
    && (store.phase === 'creation' || store.phase === 'voting');
  const canUseChat = features.chatEnabled;
  const canPlayTimerMusic = features.musicEnabled;
  const readyEnabled = features.readyEnabled;
  const readyCount = store.getUserReadyCount();
  const totalCount = store.getTotalUserCount();
  const allUsersReady = readyEnabled && totalCount > 0 && readyCount === totalCount;
  const nextPhase = getNextPhase(store.phase, store.template, features.retroRatingEnabled);
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
    if (!canUseChat && isChatVisible) {
      setIsChatVisible(false);
    }
  }, [canUseChat, isChatVisible]);

  useEffect(() => {
    if (!canDrawOnBoard && isDrawEnabled) {
      setIsDrawEnabled(false);
    }
  }, [canDrawOnBoard, isDrawEnabled]);

  useEffect(() => {
    if (!canPlayArkanoid && isArkanoidEnabled) {
      setIsArkanoidEnabled(false);
    }
  }, [canPlayArkanoid, isArkanoidEnabled]);

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

  const submitRejoin = async () => {
    const session = readStoredSession();
    const token = store.authProfile?.token;
    const username = store.authProfile?.name;
    const roomId = store.room?.id || session?.roomId;
    if (!roomId || !token || !username) return;
    setIsRejoining(true);
    setRejoinError(null);
    try {
      await store.socketService?.joinRoom(roomId, rejoinPassword, username, token);
      setRejoinPassword('');
      store.setRejoinRequired(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось войти в комнату';
      setRejoinError(mapServerError(message));
    } finally {
      setIsRejoining(false);
    }
  };

  const rejoinDialog = (
    <RoomRejoinDialog
      open={store.rejoinRequired}
      password={rejoinPassword}
      error={rejoinError}
      busy={isRejoining}
      onPasswordChange={setRejoinPassword}
      onSubmit={() => { void submitRejoin(); }}
      onLeave={() => store.socketService?.leaveRoom()}
    />
  );

  if (!store.canRenderBoard) {
    if (store.rejoinRequired) {
      return rejoinDialog;
    }
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
      <Box sx={{ width: '100%', minWidth: 0, height: isMobile ? 'auto' : '100%', overflowX: isMobile ? 'visible' : 'auto' }}>
        <Box sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          width: '100%',
          minWidth: isMobile ? 0 : 'min-content',
          minHeight: isMobile ? 'auto' : '100%',
          height: 'auto',
          alignItems: 'stretch',
        }}>
          {store.templateConfig.columns.map((column, columnIndex) => (
            <RetroColumn
              key={columnIndex}
              columnIndex={columnIndex}
              store={store}
              enableDragDrop={store.canUseCardDragDrop}
              onAddCardStart={() => setIsDrawEnabled(false)}
            />
          ))}
        </Box>
      </Box>
    );

    if (!store.canUseCardDragDrop) {
      return columns;
    }

    return <DragDropContext onDragEnd={handleDragEnd}>{columns}</DragDropContext>;
  };

  const renderContent = () => {
    let phaseView: React.ReactNode;
    switch (store.phase) {
      case 'discussion':
        phaseView = <DiscussionView store={store} />;
        break;
      case 'roadmap':
        phaseView = <RoadmapView store={store} />;
        break;
      case 'rating':
        phaseView = <RetroRatingView store={store} />;
        break;
      case 'creation':
      case 'voting':
      default:
        phaseView = renderColumns();
    }
    return (
      <ErrorBoundary title="Доску не удалось показать">
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={28} /></Box>}>
          {phaseView}
        </Suspense>
      </ErrorBoundary>
    );
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
      {store.isReconnecting && (
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
          <ConnectionStatusLabel store={store} />
          {isCompactDesktop && !isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              <PhaseTimerLabel store={store} />
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                <PhaseTimerLabel store={store} prefix="Таймер: " />
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
                <Box
                  role="group"
                  aria-label="Переключение этапа ретроспективы"
                  sx={{
                    display: isMobile ? 'grid' : 'flex',
                    flexWrap: isMobile ? undefined : 'wrap',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : undefined,
                    gap: isMobile ? 0.75 : 0.5,
                    width: isMobile ? '100%' : 'auto',
                    mr: isMobile ? 0 : 2,
                    p: 0.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(20, 24, 40, 0.035)',
                    boxShadow: themeMode === 'dark'
                      ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(20, 24, 40, 0.04)',
                  }}
                >
                  {PHASE_OPTIONS.filter((option) => option.value !== 'roadmap' || store.template === 'traffic-light').map(({ value, label, shortLabel, icon: PhaseIcon }) => {
                    const isActive = store.phase === value;
                    const isUnavailable = value === 'rating' && !features.retroRatingEnabled;

                    return (
                      <Button
                        key={value}
                        variant="text"
                        size="small"
                        startIcon={<PhaseIcon />}
                        aria-pressed={isActive}
                        onClick={() => store.socketService?.changePhase(value)}
                        disabled={isActive || !canChange || isUnavailable}
                        sx={getPhaseButtonSx(isActive, isUnavailable, isMobile, themeMode === 'dark')}
                      >
                        {isMobile ? shortLabel : label}
                      </Button>
                    );
                  })}
                </Box>
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
                  variant="contained"
                  fullWidth
                  size="small"
                  onClick={() => handleReadyStateChange(!store.currentUser!.isReady)}
                  startIcon={store.currentUser.isReady ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                  sx={{ ...getReadyButtonSx(Boolean(store.currentUser.isReady)), mb: 0.5 }}
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
            <PhaseTimerMenuPanel
              store={store}
              canPlayTimerMusic={canPlayTimerMusic}
              selectedTimerSeconds={selectedTimerSeconds}
              onSelectTimerSeconds={setSelectedTimerSeconds}
              onOpenMusic={() => {
                setIsMusicWidgetOpen(true);
                setTimerAnchorEl(null);
              }}
              onClose={() => setTimerAnchorEl(null)}
            />
          </Menu>
        </Toolbar>
      </AppBar>
      <PhaseTimerWatcher
        store={store}
        canPlayTimerMusic={canPlayTimerMusic}
        onTimerStart={openTimerMusic}
        onTimerEnd={playTimerEndSignal}
      />
      <TimerMusicSlot
        store={store}
        open={isMusicWidgetOpen}
        enabled={canPlayTimerMusic}
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
                    <Tooltip title={isDrawEnabled ? 'Выключить рисование' : 'Включить рисование'}>
                      <IconButton
                        size="small"
                        color={isDrawEnabled ? 'primary' : 'default'}
                        onClick={() => {
                          setIsDrawEnabled((prev) => !prev);
                          setIsArkanoidEnabled(false);
                        }}
                      >
                        <BrushIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canPlayArkanoid && (
                    <Tooltip title={isArkanoidEnabled ? 'Выйти из Arkanoid' : 'Запустить Arkanoid'}>
                      <IconButton
                        size="small"
                        color={isArkanoidEnabled ? 'primary' : 'default'}
                        aria-label={isArkanoidEnabled ? 'Выйти из Arkanoid' : 'Запустить Arkanoid'}
                        onClick={() => {
                          setIsArkanoidEnabled((prev) => !prev);
                          setIsDrawEnabled(false);
                        }}
                      >
                        <JoystickIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDrawOnBoard && isDrawEnabled && (
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
                </Box>
              </Box>
            </Box>
            <Box sx={{
              flexGrow: 1,
              minWidth: 0,
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <Box sx={{ height: '100%', overflow: 'auto', overflowX: 'hidden' }}>
                {renderContent()}
              </Box>
              {canDrawOnBoard && isDrawEnabled && !isArkanoidEnabled && (
                <ErrorBoundary title="Доску для рисования не удалось показать">
                  <Suspense fallback={null}>
                    <CollaborativeWhiteboard
                      store={store}
                      enabled
                      tool={whiteboardTool}
                      color={whiteboardColor}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
              {isArkanoidEnabled && canPlayArkanoid && (
                <ErrorBoundary title="Игру не удалось показать">
                  <Suspense fallback={null}>
                    <ArkanoidGame store={store} />
                  </Suspense>
                </ErrorBoundary>
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

      <Snackbar
        open={Boolean(store.error)}
        autoHideDuration={6000}
        onClose={() => store.setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => store.setError(null)} sx={{ width: '100%' }}>
          {store.error}
        </Alert>
      </Snackbar>

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

      {rejoinDialog}
    </Box>
  );
});

export default Board;