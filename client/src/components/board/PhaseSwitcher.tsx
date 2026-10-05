import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, Typography } from '@mui/material';
import { RetroStore } from '../../store/RetroStore';
import { getPhaseLabel, PHASE_OPTIONS } from './phases';

const PHASE_ACCENT = '#6c63ff';
const PHASE_PLAQUE_GRADIENT = 'linear-gradient(135deg, #766dff 0%, #5b54e8 100%)';

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
    ? PHASE_PLAQUE_GRADIENT
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

interface Props {
  store: RetroStore;
  isMobile: boolean;
  isDarkMode: boolean;
  timerControls: React.ReactNode;
}

const PhaseSwitcher: React.FC<Props> = observer(({ store, isMobile, isDarkMode, timerControls }) => {
  const canChange = store.canChangePhase();

  if (!canChange) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: isMobile ? 0 : 1, ml: 'auto' }}>
        {timerControls}
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'nowrap',
            fontWeight: 800,
            color: '#fff',
            px: 1.35,
            py: 0.75,
            borderRadius: '10px',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            bgcolor: PHASE_ACCENT,
            backgroundImage: PHASE_PLAQUE_GRADIENT,
            boxShadow: '0 4px 12px rgba(92, 84, 232, 0.3)',
          }}
        >
          {getPhaseLabel(store.phase)}
        </Typography>
      </Box>
    );
  }

  return (
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
          bgcolor: isDarkMode ? 'rgba(255,255,255,0.045)' : 'rgba(20, 24, 40, 0.035)',
          boxShadow: isDarkMode
            ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(20, 24, 40, 0.04)',
        }}
      >
        {PHASE_OPTIONS.filter((option) => option.value !== 'roadmap' || store.template === 'traffic-light').map(({ value, label, shortLabel, icon: PhaseIcon }) => {
          const isActive = store.phase === value;
          const isUnavailable = value === 'rating' && !store.roomFeatures.retroRatingEnabled;

          return (
            <Button
              key={value}
              variant="text"
              size="small"
              startIcon={<PhaseIcon />}
              aria-pressed={isActive}
              onClick={() => store.socketService?.changePhase(value)}
              disabled={isActive || isUnavailable}
              sx={getPhaseButtonSx(isActive, isUnavailable, isMobile, isDarkMode)}
            >
              {isMobile ? shortLabel : label}
            </Button>
          );
        })}
      </Box>
      {timerControls}
    </Box>
  );
});

export default PhaseSwitcher;
