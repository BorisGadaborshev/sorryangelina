import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { RealtimeSession } from '../session';
import { RoomService } from '../../services/RoomService';
import { logger } from '../../utils/logger';
import { isRoomAdmin } from '../access';
import {
  clearRoomTimer,
  startRoomTimer
} from '../runtime';

export function registerTimerHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'set-phase-timer', async ({ durationSeconds }) => {
    if (!session.currentUser?.roomId) return;

    const allowedDurations = [60, 180, 300, 600, 900];
    if (!allowedDurations.includes(durationSeconds)) {
      rejectAction(socket, 'Invalid timer duration');
      return;
    }

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      if (!isRoomAdmin(room, session.currentUser.name)) {
        rejectAction(socket, 'Only admin can start timer');
        return;
      }

      startRoomTimer(
        session.currentUser.roomId,
        room.phase,
        durationSeconds,
        Date.now() + durationSeconds * 1000
      );
    } catch (error) {
      logger.error({ err: error }, 'failed to start phase timer');
      rejectAction(socket, 'Failed to start timer');
    }
  });


  on(socket, 'reset-phase-timer', async () => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      if (!isRoomAdmin(room, session.currentUser.name)) {
        rejectAction(socket, 'Only admin can reset timer');
        return;
      }

      clearRoomTimer(session.currentUser.roomId, true);
    } catch (error) {
      logger.error({ err: error }, 'failed to reset phase timer');
      rejectAction(socket, 'Failed to reset timer');
    }
  });

}
