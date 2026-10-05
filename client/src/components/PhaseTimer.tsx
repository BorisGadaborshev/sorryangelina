import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, Divider, FormControl, MenuItem, Select, Typography } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { RetroStore } from '../store/RetroStore';

const MusicPlayerWidget = lazy(() => import('./MusicPlayerWidget'));

export const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const PhaseTimerLabel = observer(({ store, prefix }: { store: RetroStore; prefix?: string }) => {
  const remaining = formatDuration(store.phaseTimer.remainingSeconds);
  return (
    <Typography
      variant="caption"
      sx={{ color: store.phaseTimer.running ? 'warning.main' : 'text.secondary', whiteSpace: 'nowrap', mt: '3px' }}
    >
      {prefix ? `${prefix}${remaining}` : remaining}
    </Typography>
  );
});

export const ConnectionStatusLabel = observer(({ store }: { store: RetroStore }) => {
  if (store.connectionStatus === 'online') return null;
  const offline = store.connectionStatus === 'offline';
  return (
    <Typography variant="caption" sx={{ color: offline ? 'error.main' : 'warning.main', whiteSpace: 'nowrap' }}>
      {offline ? 'Нет связи' : 'Переподключение'}
    </Typography>
  );
});

interface WatcherProps {
  store: RetroStore;
  canPlayTimerMusic: boolean;
  onTimerStart: () => void;
  onTimerEnd: () => void;
}

export const PhaseTimerWatcher = observer(({ store, canPlayTimerMusic, onTimerStart, onTimerEnd }: WatcherProps) => {
  const previousRef = useRef({ running: false, remainingSeconds: 0 });
  const wasRunningRef = useRef(false);
  const running = store.phaseTimer.running;
  const remainingSeconds = store.phaseTimer.remainingSeconds;

  useEffect(() => {
    if (running && !wasRunningRef.current && canPlayTimerMusic) {
      onTimerStart();
    }
    wasRunningRef.current = running;
  }, [running, canPlayTimerMusic, onTimerStart]);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous.running && previous.remainingSeconds <= 1 && !running && remainingSeconds === 0) {
      onTimerEnd();
    }
    previousRef.current = { running, remainingSeconds };
  }, [running, remainingSeconds, onTimerEnd]);

  return null;
});

interface MenuProps {
  store: RetroStore;
  canPlayTimerMusic: boolean;
  selectedTimerSeconds: number;
  onSelectTimerSeconds: (seconds: number) => void;
  onOpenMusic: () => void;
  onClose: () => void;
}

export const PhaseTimerMenuPanel = observer(({
  store,
  canPlayTimerMusic,
  selectedTimerSeconds,
  onSelectTimerSeconds,
  onOpenMusic,
  onClose
}: MenuProps) => (
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
          onClick={onOpenMusic}
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
            onChange={(event) => onSelectTimerSeconds(Number(event.target.value))}
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
              onClose();
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
              onClose();
            }}
            disabled={!store.phaseTimer.running}
          >
            Сброс
          </Button>
        </Box>
      </>
    )}
  </Box>
));

interface MusicSlotProps {
  store: RetroStore;
  open: boolean;
  enabled: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
}

export const TimerMusicSlot = observer(({ store, open, enabled, volume, onVolumeChange, onClose }: MusicSlotProps) => {
  if (!enabled || (!open && !store.phaseTimer.running)) return null;
  return (
    <Suspense fallback={null}>
      <MusicPlayerWidget
        open={open}
        enabled={enabled}
        timerRunning={store.phaseTimer.running}
        remainingLabel={formatDuration(store.phaseTimer.remainingSeconds)}
        volume={volume}
        onVolumeChange={onVolumeChange}
        onClose={onClose}
      />
    </Suspense>
  );
});
