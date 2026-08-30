import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  Fade,
  IconButton,
  Paper,
  Slider,
  Tooltip,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

const LOCAL_TRACK_SRC = '/audio/timer-music.mp3';
const LOCAL_TRACK_TITLE = 'Текущий трек';
const RADIO_RETRY_LIMIT = 3;
const POSITION_STORAGE_KEY = 'musicPlayerWidgetPosition';
const COMPACT_STORAGE_KEY = 'musicPlayerWidgetCompact';
const VIEWPORT_MARGIN = 8;

interface WidgetPosition {
  left: number;
  top: number;
}

const readStoredPosition = (): WidgetPosition | null => {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WidgetPosition;
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return parsed;
    }
  } catch {
    // Ignore broken localStorage values.
  }
  return null;
};

const readStoredCompact = (): boolean => {
  try {
    return localStorage.getItem(COMPACT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const clampPosition = (
  left: number,
  top: number,
  width: number,
  height: number
): WidgetPosition => {
  const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    left: Math.min(Math.max(VIEWPORT_MARGIN, left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_MARGIN, top), maxTop)
  };
};

type MusicSource =
  | { kind: 'local' }
  | { kind: 'radio'; name: string; url: string; country?: string };

interface RadioStationResponse {
  name: string;
  url: string;
  country?: string;
}

interface Props {
  open: boolean;
  enabled: boolean;
  timerRunning: boolean;
  remainingLabel: string;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
}

const getApiBase = (): string => (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');

const MusicPlayerWidget: React.FC<Props> = ({
  open,
  enabled,
  timerRunning,
  remainingLabel,
  volume,
  onVolumeChange,
  onClose
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState<WidgetPosition | null>(readStoredPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompact, setIsCompact] = useState(readStoredCompact);
  const wantPlayingRef = useRef(false);
  const radioRetryRef = useRef(0);
  const skipRequestIdRef = useRef(0);
  const wasTimerRunningRef = useRef(false);
  const [source, setSource] = useState<MusicSource>({ kind: 'local' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLocalUnavailable, setIsLocalUnavailable] = useState(false);
  const [isLoadingRadio, setIsLoadingRadio] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);

  const trackTitle = source.kind === 'local' ? LOCAL_TRACK_TITLE : source.name;
  const trackSubtitle = source.kind === 'local'
    ? `Таймер · ${remainingLabel}`
    : source.country
      ? `Radio-Browser · ${source.country}`
      : 'Radio-Browser';
  const audioSrc = source.kind === 'local' ? LOCAL_TRACK_SRC : source.url;

  const applyVolume = useCallback((nextVolume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = nextVolume;
    }
    onVolumeChange(nextVolume);
  }, [onVolumeChange]);

  const tryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || !wantPlayingRef.current) return;

    audio.volume = volume;
    void audio.play()
      .then(() => {
        if (!wantPlayingRef.current) {
          audio.pause();
          setIsPlaying(false);
          return;
        }
        setIsBlocked(false);
        setIsPlaying(true);
        if (source.kind === 'local') {
          setIsLocalUnavailable(false);
        }
      })
      .catch(() => {
        if (!wantPlayingRef.current) return;
        setIsBlocked(true);
        setIsPlaying(false);
      });
  }, [enabled, source.kind, volume]);

  const stopPlayback = useCallback((resetPosition: boolean) => {
    wantPlayingRef.current = false;
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      return;
    }
    audio.pause();
    if (resetPosition) {
      audio.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const loadRadioStation = useCallback(async () => {
    const requestId = skipRequestIdRef.current + 1;
    skipRequestIdRef.current = requestId;
    setIsLoadingRadio(true);
    setRadioError(null);

    try {
      const response = await fetch(`${getApiBase()}/api/radio/station`);
      if (!response.ok) {
        throw new Error('Radio-Browser request failed');
      }
      const station = await response.json() as RadioStationResponse;
      if (requestId !== skipRequestIdRef.current) return;
      if (!station.url) {
        throw new Error('Empty stream url');
      }

      radioRetryRef.current = 0;
      wantPlayingRef.current = true;
      setIsLocalUnavailable(false);
      setSource({
        kind: 'radio',
        name: station.name || 'Radio-Browser',
        url: station.url,
        country: station.country
      });
    } catch {
      if (requestId !== skipRequestIdRef.current) return;
      setRadioError('Не удалось включить станцию Radio-Browser');
    } finally {
      if (requestId === skipRequestIdRef.current) {
        setIsLoadingRadio(false);
      }
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!timerRunning) {
      wasTimerRunningRef.current = false;
      stopPlayback(true);
      setSource({ kind: 'local' });
      setIsBlocked(false);
      setRadioError(null);
      radioRetryRef.current = 0;
      return;
    }

    if (!wasTimerRunningRef.current) {
      wantPlayingRef.current = true;
      setSource({ kind: 'local' });
      setRadioError(null);
      radioRetryRef.current = 0;
      tryPlay();
    }
    wasTimerRunningRef.current = true;
  }, [stopPlayback, timerRunning, tryPlay]);

  useEffect(() => {
    if (!enabled) {
      stopPlayback(true);
    }
  }, [enabled, stopPlayback]);

  useEffect(() => {
    if (wantPlayingRef.current) {
      tryPlay();
    }
  }, [audioSrc, tryPlay]);

  const handleAudioError = () => {
    const audio = audioRef.current;
    const mediaError = audio?.error;
    if (!mediaError || mediaError.code === mediaError.MEDIA_ERR_ABORTED) return;

    if (source.kind === 'local') {
      setIsLocalUnavailable(true);
      setIsPlaying(false);
      return;
    }

    if (radioRetryRef.current >= RADIO_RETRY_LIMIT) {
      setRadioError('Поток недоступен. Нажмите Next ещё раз.');
      return;
    }

    radioRetryRef.current += 1;
    void loadRadioStation();
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !timerRunning) return;

    const actuallyPlaying = !audio.paused && !audio.ended;
    if (actuallyPlaying || isPlaying) {
      stopPlayback(false);
      setIsBlocked(false);
      return;
    }

    wantPlayingRef.current = true;
    tryPlay();
  };

  const handlePrevious = () => {
    skipRequestIdRef.current += 1;
    setIsLoadingRadio(false);
    setRadioError(null);
    radioRetryRef.current = 0;
    wantPlayingRef.current = true;
    setSource({ kind: 'local' });
  };

  const handleVolumeSlider = (_: Event, value: number | number[]) => {
    applyVolume((Array.isArray(value) ? value[0] : value) / 100);
  };

  const setCompactMode = (next: boolean) => {
    setIsCompact(next);
    localStorage.setItem(COMPACT_STORAGE_KEY, next ? '1' : '0');
    window.requestAnimationFrame(() => {
      const paper = paperRef.current;
      if (!paper || !position) return;
      const nextPosition = clampPosition(position.left, position.top, paper.offsetWidth, paper.offsetHeight);
      setPosition(nextPosition);
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPosition));
    });
  };

  const handleDragPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const paper = paperRef.current;
    if (!paper) return;

    const rect = paper.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    paper.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setPosition({ left: rect.left, top: rect.top });
  };

  const handleDragPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return;
    const paper = paperRef.current;
    const width = paper?.offsetWidth ?? 340;
    const height = paper?.offsetHeight ?? 160;
    setPosition(clampPosition(
      event.clientX - dragRef.current.offsetX,
      event.clientY - dragRef.current.offsetY,
      width,
      height
    ));
  };

  const handleDragPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    const paper = paperRef.current;
    if (!paper) return;
    const rect = paper.getBoundingClientRect();
    const next = clampPosition(rect.left, rect.top, paper.offsetWidth, paper.offsetHeight);
    setPosition(next);
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    const keepOnScreen = () => {
      setPosition((current) => {
        if (!current) return current;
        const paper = paperRef.current;
        const next = clampPosition(
          current.left,
          current.top,
          paper?.offsetWidth ?? 340,
          paper?.offsetHeight ?? 160
        );
        if (next.left === current.left && next.top === current.top) return current;
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener('resize', keepOnScreen);
    keepOnScreen();
    return () => window.removeEventListener('resize', keepOnScreen);
  }, [open]);

  if (!enabled) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={audioSrc}
        loop={source.kind === 'local'}
        preload="auto"
        onCanPlay={tryPlay}
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (source.kind !== 'local') {
            setIsPlaying(false);
          }
        }}
        onError={handleAudioError}
      />
      <Fade in={open} unmountOnExit>
        <Paper
          ref={paperRef}
          elevation={8}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          sx={{
            position: 'fixed',
            ...(position
              ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
              : { right: { xs: 12, sm: 24 }, bottom: { xs: 12, sm: 24 } }),
            zIndex: 1400,
            width: isCompact ? { xs: 'auto', sm: 'auto' } : { xs: 'calc(100vw - 24px)', sm: 340 },
            maxWidth: { xs: 'calc(100vw - 24px)', sm: isCompact ? 420 : 340 },
            p: isCompact ? 0.75 : 1.5,
            borderRadius: 2,
            bgcolor: 'background.paper',
            userSelect: isDragging ? 'none' : 'auto'
          }}
        >
          <Box
            onPointerDown={handleDragPointerDown}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: isCompact ? 0.5 : 1,
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none'
            }}
          >
            <DragIndicatorIcon
              fontSize="small"
              color="action"
              sx={{ flexShrink: 0, pointerEvents: 'none' }}
            />
            {!isCompact && (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'action.selected',
                  flexShrink: 0,
                  pointerEvents: 'none'
                }}
              >
                {isLoadingRadio ? <CircularProgress size={18} /> : <MusicNoteIcon fontSize="small" />}
              </Box>
            )}
            <Box sx={{ minWidth: 0, flexGrow: 1, pointerEvents: 'none', maxWidth: isCompact ? 140 : 'none' }}>
              <Typography variant={isCompact ? 'caption' : 'subtitle2'} noWrap title={trackTitle} sx={{ fontWeight: 600, display: 'block' }}>
                {trackTitle}
              </Typography>
              {!isCompact && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {trackSubtitle}
                </Typography>
              )}
            </Box>
            {isCompact && (
              <>
                <IconButton
                  color="primary"
                  size="small"
                  onClick={handlePlayPause}
                  disabled={!timerRunning || (source.kind === 'local' && isLocalUnavailable)}
                  aria-label={isPlaying ? 'Пауза музыки' : 'Включить музыку'}
                  sx={{ cursor: 'pointer' }}
                >
                  {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
                <Tooltip title="Следующая станция Radio-Browser">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => void loadRadioStation()}
                      disabled={!timerRunning || isLoadingRadio}
                      aria-label="Следующий трек"
                      sx={{ cursor: 'pointer' }}
                    >
                      <SkipNextIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
            <IconButton
              size="small"
              onClick={() => setCompactMode(!isCompact)}
              aria-label={isCompact ? 'Развернуть плеер' : 'Свернуть плеер'}
              sx={{ cursor: 'pointer' }}
            >
              {isCompact ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={onClose} aria-label="Закрыть плеер" sx={{ cursor: 'pointer' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {!isCompact && (
            <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
            <Tooltip title="Текущий трек">
              <span>
                <IconButton
                  size="small"
                  onClick={handlePrevious}
                  disabled={!timerRunning || source.kind === 'local' || isLoadingRadio}
                  aria-label="Вернуться к текущему треку"
                >
                  <SkipPreviousIcon />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              color="primary"
              onClick={handlePlayPause}
              disabled={!timerRunning || (source.kind === 'local' && isLocalUnavailable)}
              aria-label={isPlaying ? 'Пауза музыки' : 'Включить музыку'}
            >
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Tooltip title="Следующая станция Radio-Browser">
              <span>
                <IconButton
                  size="small"
                  onClick={() => void loadRadioStation()}
                  disabled={!timerRunning || isLoadingRadio}
                  aria-label="Следующий трек"
                >
                  <SkipNextIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
            <VolumeUpIcon fontSize="small" color="action" />
            <Slider
              size="small"
              value={Math.round(volume * 100)}
              min={0}
              max={100}
              onChange={handleVolumeSlider}
              aria-label="Громкость музыки"
            />
          </Box>

          {isBlocked && timerRunning && !isPlaying && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
              Браузер заблокировал автозапуск. Нажмите play.
            </Typography>
          )}
          {isLocalUnavailable && source.kind === 'local' && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              Трек не найден. Добавьте файл в client/public/audio/timer-music.mp3.
            </Typography>
          )}
          {!timerRunning && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Музыка запускается вместе с таймером. Next включает Radio-Browser.
            </Typography>
          )}
          {radioError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {radioError}
            </Typography>
          )}
            </>
          )}
        </Paper>
      </Fade>
    </>
  );
};

export default MusicPlayerWidget;
