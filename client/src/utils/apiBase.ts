export const getApiBase = (): string => {
  const configured = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return import.meta.env.PROD ? '' : 'http://localhost:3001';
};
