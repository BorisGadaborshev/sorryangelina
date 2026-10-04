import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { logger } from '../../utils/logger';
import { RealtimeSession } from '../session';
import { DISCUSSION_BURST_EMOJIS } from '../../types';
import { RoomService } from '../../services/RoomService';
import {
  allowDiscussionBurst,
  canControlDiscussionNavigation,
  emitDiscussionBurst,
  emitDiscussionHands,
  getRoomFeatures,
  io,
  normalizeDiscussionNavigation,
  persistRoomEphemeral,
  resolveSocketActor,
  roomDiscussionNavigation,
  roomRaisedHands
} from '../runtime';

export function registerDiscussionHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'set-discussion-navigation', async ({ unviewedCardIds, viewedCardIds }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (actor?.roomId) session.currentUser = actor;

    if (!actor?.roomId) return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room || room.phase !== 'discussion') return;
      if (!canControlDiscussionNavigation(room, actor.name, actor.role, actor.roomId)) {
        const current = roomDiscussionNavigation.get(actor.roomId);
        if (current) {
          socket.emit('discussion-navigation', current);
        }
        return;
      }

      const normalized = normalizeDiscussionNavigation(room, {
        unviewedCardIds: Array.isArray(unviewedCardIds)
          ? unviewedCardIds.filter((id): id is string => typeof id === 'string')
          : [],
        viewedCardIds: Array.isArray(viewedCardIds)
          ? viewedCardIds.filter((id): id is string => typeof id === 'string')
          : []
      });
      if (!normalized) return;

      roomDiscussionNavigation.set(actor.roomId, normalized);
      io.to(actor.roomId).emit('discussion-navigation', normalized);
      await persistRoomEphemeral(actor.roomId);
    } catch (error) {
      logger.error({ err: error }, 'failed to update discussion navigation');
      rejectAction(socket, 'Не удалось обновить обсуждение');
    }
  });


  on(socket, 'discussion-burst', async ({ emoji }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (!actor?.roomId || typeof emoji !== 'string') return;
    session.currentUser = actor;
    if (!(DISCUSSION_BURST_EMOJIS as readonly string[]).includes(emoji)) return;
    if (!allowDiscussionBurst(actor.roomId, actor.name)) return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room || room.phase !== 'discussion' || !getRoomFeatures(room).discussionActionsEnabled) return;
      emitDiscussionBurst(actor.roomId, emoji, actor.name);
    } catch (error) {
      logger.error({ err: error }, 'error sending discussion burst');
    }
  });


  on(socket, 'toggle-discussion-hand', async () => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (!actor?.roomId) return;
    session.currentUser = actor;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room || room.phase !== 'discussion' || !getRoomFeatures(room).discussionActionsEnabled) return;

      let hands = roomRaisedHands.get(actor.roomId);
      if (!hands) {
        hands = new Map();
        roomRaisedHands.set(actor.roomId, hands);
      }

      if (hands.has(actor.name)) {
        hands.delete(actor.name);
        if (hands.size === 0) roomRaisedHands.delete(actor.roomId);
      } else {
        hands.set(actor.name, actor.name);
        emitDiscussionBurst(actor.roomId, '✋', actor.name);
      }
      emitDiscussionHands(actor.roomId);
    } catch (error) {
      logger.error({ err: error }, 'error toggling discussion hand');
    }
  });

}
