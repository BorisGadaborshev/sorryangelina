import { Socket } from 'socket.io';
import { on } from '../on';
import { RealtimeSession } from '../session';
import { RoomService } from '../../services/RoomService';
import {
  RoomTimerSession,
  clearRoomTimer,
  emitTimerToRoom,
  getRemainingSeconds,
  io,
  roomTimers
} from '../runtime';

export function registerTimerHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'set-phase-timer', async ({ durationSeconds }) => {
    if (!session.currentUser?.roomId) return;

    const allowedDurations = [60, 180, 300, 600, 900];
    if (!allowedDurations.includes(durationSeconds)) {
      socket.emit('error', 'Invalid timer duration');
      return;
    }

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      const isAdmin = room.users.some(
        (user) => user.name === session.currentUser?.name && user.role === 'admin'
      );
      if (!isAdmin) {
        socket.emit('error', 'Only admin can start timer');
        return;
      }

      clearRoomTimer(session.currentUser.roomId, false);

      const endAt = Date.now() + durationSeconds * 1000;
      const timerSession: RoomTimerSession = {
        phase: room.phase,
        durationSeconds,
        endAt,
        interval: setInterval(() => {
          const activeSession = roomTimers.get(room.id);
          if (!activeSession) return;

          const remainingSeconds = getRemainingSeconds(activeSession.endAt);
          if (remainingSeconds <= 0) {
            io.to(room.id).emit('timer-updated', {
              phase: activeSession.phase,
              durationSeconds: activeSession.durationSeconds,
              remainingSeconds: 0,
              running: false
            });
            clearRoomTimer(room.id, false);
            return;
          }

          emitTimerToRoom(room.id, activeSession);
        }, 1000)
      };

      roomTimers.set(session.currentUser.roomId, timerSession);
      emitTimerToRoom(session.currentUser.roomId, timerSession);
    } catch (error) {
      console.error('Error setting phase timer:', error);
      socket.emit('error', 'Failed to start timer');
    }
  });


  on(socket, 'reset-phase-timer', async () => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      const isAdmin = room.users.some(
        (user) => user.name === session.currentUser?.name && user.role === 'admin'
      );
      if (!isAdmin) {
        socket.emit('error', 'Only admin can reset timer');
        return;
      }

      clearRoomTimer(session.currentUser.roomId, true);
    } catch (error) {
      console.error('Error resetting phase timer:', error);
      socket.emit('error', 'Failed to reset timer');
    }
  });

}
