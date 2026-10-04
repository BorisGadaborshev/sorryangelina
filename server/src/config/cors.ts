import './env';

export const productionOrigins = [
  'https://insretro.ru',
  'https://www.insretro.ru',
  'https://sorryangelina.ru',
  'https://www.sorryangelina.ru'
];

export const corsOrigin = process.env.NODE_ENV === 'production'
  ? productionOrigins
  : 'http://localhost:3000';
