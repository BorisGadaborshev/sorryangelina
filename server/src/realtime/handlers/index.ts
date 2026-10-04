import { Socket } from 'socket.io';
import { RealtimeSession } from '../session';
import { registerSessionHandlers } from './session';
import { registerCardsHandlers } from './cards';
import { registerSocialHandlers } from './social';
import { registerPhaseHandlers } from './phase';
import { registerDiscussionHandlers } from './discussion';
import { registerTimerHandlers } from './timer';
import { registerRatingHandlers } from './rating';
import { registerExtrasHandlers } from './extras';

export function registerSocketHandlers(socket: Socket, session: RealtimeSession): void {
  registerSessionHandlers(socket, session);
  registerCardsHandlers(socket, session);
  registerSocialHandlers(socket, session);
  registerPhaseHandlers(socket, session);
  registerDiscussionHandlers(socket, session);
  registerTimerHandlers(socket, session);
  registerRatingHandlers(socket, session);
  registerExtrasHandlers(socket, session);
}
