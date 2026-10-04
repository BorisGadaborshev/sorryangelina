import { Socket } from 'socket.io';
import { on } from '../on';
import { RealtimeSession } from '../session';
import { RoomService } from '../../services/RoomService';
import {
  emitRetroRatingStateToRoom,
  getRetroRatingState,
  getRoomFeatures
} from '../runtime';

export function registerRatingHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'submit-retro-rating', async ({ value }) => {
    if (!session.currentUser?.roomId) return;
    if (![1, 2, 3, 4, 5].includes(value)) {
      socket.emit('error', 'Invalid retro rating');
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
      await emitRetroRatingStateToRoom(session.currentUser.roomId);
    } catch (error) {
      console.error('Error submitting retro rating:', error);
      socket.emit('error', 'Failed to submit retro rating');
    }
  });


  on(socket, 'show-retro-rating-results', async () => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'rating') return;
      if (!getRoomFeatures(room).retroRatingEnabled) return;

      const isAdmin = room.users.some(
        (user) => user.name === session.currentUser?.name && user.role === 'admin'
      );
      const ratingState = getRetroRatingState(session.currentUser.roomId);
      if (!isAdmin || ratingState.votes.size < room.users.length) {
        socket.emit('error', 'Results are available after all participants vote');
        return;
      }

      ratingState.resultsVisible = true;
      await emitRetroRatingStateToRoom(session.currentUser.roomId);
    } catch (error) {
      console.error('Error showing retro rating results:', error);
      socket.emit('error', 'Failed to show retro rating results');
    }
  });

}
