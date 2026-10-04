import { Express } from 'express';
import { authRouter } from './auth';
import { radioRouter } from './radio';
import { roomsRouter } from './rooms';
import { teamsRouter } from './teams';

export const registerHttpRoutes = (app: Express): void => {
  app.use('/api/rooms', roomsRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/radio', radioRouter);
};
