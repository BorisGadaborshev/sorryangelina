import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { RealtimeSession } from '../session';
import { RoomService } from '../../services/RoomService';
import { ContentModerationError } from '../../services/ContentModeration';
import { logger } from '../../utils/logger';
import { moderateRoomText } from '../access';
import { bumpRoomVersion } from '../roomSync';
import {
  canInteractWithCardSocial,
  getRoomFeatures,
  io
} from '../runtime';

export function registerSocialHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'add-card-comment', async ({ cardId, text }) => {
    if (!session.currentUser) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || !canInteractWithCardSocial(room.phase)) return;
      if (!getRoomFeatures(room).commentsEnabled) return;
      if (typeof cardId !== 'string' || typeof text !== 'string') return;
      await moderateRoomText(room, text);

      const result = await RoomService.addCardComment(
        session.currentUser.roomId,
        cardId,
        session.currentUser.id,
        session.currentUser.name,
        text
      );
      if (!result) return;

      io.to(session.currentUser.roomId).emit('card-comment-added', {
        cardId,
        comment: result.comment
      });
      bumpRoomVersion(session.currentUser.roomId);
    } catch (error) {
      if (error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to add card comment');
      rejectAction(socket, 'Failed to add card comment');
    }
  });


  on(socket, 'update-card-comment', async ({ cardId, commentId, text }) => {
    if (!session.currentUser) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || !canInteractWithCardSocial(room.phase)) return;
      if (!getRoomFeatures(room).commentsEnabled) return;
      if (typeof cardId !== 'string' || typeof commentId !== 'string' || typeof text !== 'string') return;
      await moderateRoomText(room, text);

      const comment = await RoomService.updateCardComment(
        session.currentUser.roomId,
        cardId,
        commentId,
        session.currentUser.id,
        text
      );
      if (!comment) return;

      io.to(session.currentUser.roomId).emit('card-comment-updated', { cardId, comment });
      bumpRoomVersion(session.currentUser.roomId);
    } catch (error) {
      if (error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to update card comment');
      rejectAction(socket, 'Failed to update card comment');
    }
  });


  on(socket, 'toggle-card-reaction', async ({ cardId, emoji }) => {
    if (!session.currentUser) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || !canInteractWithCardSocial(room.phase)) return;
      if (!getRoomFeatures(room).reactionsEnabled) return;
      if (typeof cardId !== 'string' || typeof emoji !== 'string') return;

      const updatedCard = await RoomService.toggleCardReaction(
        session.currentUser.roomId,
        cardId,
        session.currentUser.id,
        session.currentUser.name,
        emoji
      );
      if (!updatedCard) return;

      io.to(session.currentUser.roomId).emit('card-reaction-updated', {
        cardId,
        reactions: updatedCard.reactions || []
      });
      bumpRoomVersion(session.currentUser.roomId);
    } catch (error) {
      logger.error({ err: error }, 'failed to toggle card reaction');
      rejectAction(socket, 'Failed to toggle card reaction');
    }
  });

}
