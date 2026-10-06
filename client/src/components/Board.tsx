import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Typography, CircularProgress, useMediaQuery, Snackbar, Alert } from '@mui/material';
import UserList from './UserList';
import { RetroStore } from '../store/RetroStore';
import ChatTerminal from './ChatTerminal';
import RoomSettingsSidebar from './RoomSettingsSidebar';
import ErrorBoundary from './ErrorBoundary';
import { PhaseTimerWatcher, TimerMusicSlot } from './PhaseTimer';
import { toCssBackgroundUrl } from '../utils/media';
import { playTimerEndSignal } from '../utils/sound';
import { readStoredSession } from '../services/session';
import { mapServerError } from '../utils/errors';
import BoardHeader from './board/BoardHeader';
import PhaseContent from './board/PhaseContent';
import BoardToolbar, { WHITEBOARD_COLORS, WhiteboardTool } from './board/BoardToolbar';
import { AllReadyDialog, FacilitatorDialog, MoodDialog, RoomRejoinDialog } from './board/BoardDialogs';
import { getNextPhase, getPhaseLabel } from './board/phases';
import { useBoardMood } from './board/useBoardMood';
import { useAllReadyPrompt } from './board/useAllReadyPrompt';
import { setFloorCatArkanoidActive } from './floorCatPreference';
import FloorCat from './FloorCat';

const CollaborativeWhiteboard = lazy(() => import('./CollaborativeWhiteboard'));
const ArkanoidGame = lazy(() => import('./ArkanoidGame'));

interface Props {
  store: RetroStore;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Board: React.FC<Props> = observer(({ store, themeMode, onToggleTheme }) => {
  const [isReady, setIsReady] = useState(() => Boolean(store.room));
  const [isUserListVisible, setIsUserListVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isDrawEnabled, setIsDrawEnabled] = useState(false);
  const [isArkanoidEnabled, setIsArkanoidEnabled] = useState(false);
  const [whiteboardTool, setWhiteboardTool] = useState<WhiteboardTool>('pen');
  const [whiteboardColor, setWhiteboardColor] = useState(WHITEBOARD_COLORS[0]);
  const isMobile = useMediaQuery('(max-width:600px)');
  const isCompactDesktop = useMediaQuery('(max-width:1280px)');
  const [mobileTab, setMobileTab] = useState<number>(0); // 0 - доска, 1 - участники
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTimerSeconds, setSelectedTimerSeconds] = useState<number>(300);
  const [rejoinPassword, setRejoinPassword] = useState('');
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [isRejoining, setIsRejoining] = useState(false);
  const [isMusicWidgetOpen, setIsMusicWidgetOpen] = useState(false);
  const [timerMusicVolume, setTimerMusicVolume] = useState(() => {
    const saved = localStorage.getItem('timerMusicVolume');
    const parsed = saved ? Number(saved) : 0.35;
    return Number.isFinite(parsed) ? parsed : 0.35;
  });
  const mood = useBoardMood(store);

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

  const handleReadyStateChange = useCallback((isReady: boolean) => {
    store.updateUserReadyState(isReady);
  }, [store]);

  const openTimerMusic = useCallback(() => {
    setIsMusicWidgetOpen(true);
  }, []);

  const handleTimerEnd = useCallback(() => {
    playTimerEndSignal(timerMusicVolume);
  }, [timerMusicVolume]);

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
  const allReady = useAllReadyPrompt(allUsersReady, store.phase);

  const handleAdvancePhaseFromModal = () => {
    if (nextPhase && store.isAdmin) {
      store.socketService?.changePhase(nextPhase);
    }
    allReady.dismiss();
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
    store.setChatPanelOpen(canUseChat && isChatVisible);
    return () => store.setChatPanelOpen(false);
  }, [store, canUseChat, isChatVisible]);

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

  useEffect(() => {
    setFloorCatArkanoidActive(isArkanoidEnabled);
    return () => setFloorCatArkanoidActive(false);
  }, [isArkanoidEnabled]);

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

  const renderContent = () => (
    <PhaseContent store={store} isMobile={isMobile} onAddCardStart={() => setIsDrawEnabled(false)} />
  );

  const toggleChat = () => setIsChatVisible(!isChatVisible);

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
      <BoardHeader
        store={store}
        isMobile={isMobile}
        isCompactDesktop={isCompactDesktop}
        isDarkMode={themeMode === 'dark'}
        canUseChat={canUseChat}
        isChatVisible={isChatVisible}
        mobileTab={mobileTab}
        selectedTimerSeconds={selectedTimerSeconds}
        onSelectTimerSeconds={setSelectedTimerSeconds}
        onToggleChat={toggleChat}
        onTab={setMobileTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenMusic={openTimerMusic}
      />
      <PhaseTimerWatcher
        store={store}
        canPlayTimerMusic={canPlayTimerMusic}
        onTimerStart={openTimerMusic}
        onTimerEnd={handleTimerEnd}
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
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: themeMode === 'dark' ? 'none' : '0 8px 24px rgba(20, 24, 40, 0.06)',
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
              <BoardToolbar
                store={store}
                canUseChat={canUseChat}
                canDraw={canDrawOnBoard}
                canPlayArkanoid={canPlayArkanoid}
                isChatVisible={isChatVisible}
                isDrawEnabled={isDrawEnabled}
                isArkanoidEnabled={isArkanoidEnabled}
                tool={whiteboardTool}
                color={whiteboardColor}
                onToggleChat={toggleChat}
                onToggleDraw={() => {
                  setIsDrawEnabled((prev) => !prev);
                  setIsArkanoidEnabled(false);
                }}
                onToggleArkanoid={() => {
                  setIsArkanoidEnabled((prev) => !prev);
                  setIsDrawEnabled(false);
                }}
                onTool={setWhiteboardTool}
                onColor={setWhiteboardColor}
              />
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

      <FacilitatorDialog
        open={store.isFacilitatorDialogOpen}
        userName={store.facilitatorAnnouncement?.userName}
        onClose={() => store.dismissFacilitatorDialog()}
      />

      <MoodDialog
        open={mood.isOpen}
        selectedMood={mood.selectedMood}
        onSelect={mood.select}
        onClose={mood.close}
        onSave={mood.save}
      />

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

      <AllReadyDialog
        open={allReady.isOpen}
        totalCount={totalCount}
        phaseLabel={getPhaseLabel(store.phase)}
        nextPhaseLabel={canAdvancePhase && nextPhase ? getPhaseLabel(nextPhase) : null}
        onAdvance={handleAdvancePhaseFromModal}
        onClose={allReady.dismiss}
      />

      {rejoinDialog}
      <FloorCat />
    </Box>
  );
});

export default Board;
