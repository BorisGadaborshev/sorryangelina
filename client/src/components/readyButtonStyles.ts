export const ACCENT_GRADIENT = 'linear-gradient(135deg, #766dff 0%, #5b54e8 100%)';
export const ACCENT_GRADIENT_HOVER = 'linear-gradient(135deg, #827aff 0%, #655df0 100%)';
export const ACCENT_SHADOW = '0 4px 12px rgba(92, 84, 232, 0.3)';

export const getReadyButtonSx = (isReady: boolean) => ({
  minHeight: 42,
  border: '1px solid transparent',
  borderRadius: '10px',
  color: '#fff',
  backgroundImage: isReady
    ? 'linear-gradient(135deg, #38c976 0%, #22a95c 100%)'
    : ACCENT_GRADIENT,
  boxShadow: isReady
    ? '0 4px 12px rgba(34, 169, 92, 0.28)'
    : ACCENT_SHADOW,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  textTransform: 'none',
  transition: 'background 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  '&:hover': {
    color: '#fff',
    borderColor: 'transparent',
    backgroundImage: isReady
      ? 'linear-gradient(135deg, #42d580 0%, #29b866 100%)'
      : ACCENT_GRADIENT_HOVER,
    boxShadow: isReady
      ? '0 5px 14px rgba(34, 169, 92, 0.34)'
      : '0 5px 14px rgba(92, 84, 232, 0.36)',
    transform: 'translateY(-1px)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  '&:focus-visible': {
    outline: `3px solid ${isReady ? 'rgba(34, 169, 92, 0.24)' : 'rgba(108, 99, 255, 0.28)'}`,
    outlineOffset: 2,
  },
});
