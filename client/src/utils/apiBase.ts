export const getApiBase = (): string => {
  const configured = (process.env.REACT_APP_API_BASE || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
};
