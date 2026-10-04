import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { isRoomAdmin } from '../access';
import { logger } from '../../utils/logger';
import { RealtimeSession } from '../session';
import { RoomService } from '../../services/RoomService';
import {
  emitRetroRatingStateToRoom,
  getRetroRatingState,
  getRoomFeatures,
  persistRoomEphemeral
} from '../runtime';

export function registerRatingHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'submit-retro-rating', async ({ value }) => {
    if (!session.currentUser?.roomId) return;
    if (![1, 2, 3, 4, 5].includes(value)) {
      rejectAction(socket, 'Invalid retro rating');
      return;
    }

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'rating') return;
      if (!getRoomFeatures(room).retroRatingEnabled) return;

      const ratingState = getRetroRatingState(session.currentUser.roomId);
      if (!ratingState.votes.has(session.currentUser.id)) {
        ratingState.votes.set(session.currentUser.id, value);
      }
      await persistRoomEphemeral(session.currentUser.roomId);
      await emitRetroRatingStateToRoom(session.currentUser.roomId);
    } catch (error) {
      logger.error({ err: error }, 'failed to submit retro rating');
      rejectAction(socket, 'Failed to submit retro rating');
    }
  });


  on(socket, 'show-retro-rating-results', async () => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'rating') return;
      if (!getRoomFeatures(room).retroRatingEnabled) return;

      const ratingState = getRetroRatingState(session.currentUser.roomId);
      if (!isRoomAdmin(room, session.currentUser.name) || ratingState.votes.size < room.users.length) {
        rejectAction(socket, 'Results are available after all participants vote');
        return;
      }

      ratingState.resultsVisible = true;
      await persistRoomEphemeral(session.currentUser.roomId);
      await emitRetroRatingStateToRoom(session.currentUser.roomId);
    } catch (error) {
      logger.error({ err: error }, 'failed to show retro rating results');
      rejectAction(socket, 'Failed to show retro rating results');
    }
  });

}
