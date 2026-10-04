import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { isRoomAdmin } from '../access';
import { logger } from '../../utils/logger';
import { RealtimeSession } from '../session';
import { Phase, RoomFeatures, getRetroTemplate } from '../../types';
import { RoomService } from '../../services/RoomService';
import {
  buildDiscussionNavigation,
  canControlDiscussionNavigation,
  clearRoomTimer,
  emitDiscussionHands,
  emitRetroRatingStateToRoom,
  getRoomFeatures,
  getSortedCards,
  io,
  persistRoomEphemeral,
  resolveSocketActor,
  roomDiscussionNavigation,
  roomFacilitators,
  roomRaisedHands,
  roomRetroRatings,
  selectRandomFacilitator
} from '../runtime';

export function registerPhaseHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'change-phase', async ({ phase }) => {
    const allowedPhases: Phase[] = ['creation', 'voting', 'discussion', 'roadmap', 'rating'];
    if (!allowedPhases.includes(phase)) {
      rejectAction(socket, 'Invalid phase');
      return;
    }

    const actor = await resolveSocketActor(socket, session.currentUser);
    if (actor?.roomId) session.currentUser = actor;

    if (!actor?.roomId) {
      rejectAction(socket, 'Не удалось сменить этап: сессия не восстановлена');
      return;
    }

    const roomForPhase = await RoomService.getRoom(actor.roomId);
    if (phase === 'roadmap' && getRetroTemplate(roomForPhase?.template).id !== 'traffic-light') {
      rejectAction(socket, 'Дорожная карта доступна только для шаблона «Светофор»');
      return;
    }
    if (phase === 'rating') {
      if (roomForPhase && !getRoomFeatures(roomForPhase).retroRatingEnabled) {
        rejectAction(socket, 'Оценка ретро отключена в настройках комнаты');
        return;
      }
    }

    try {
      const updatedRoom = await RoomService.updatePhase(actor.roomId, phase, actor.id, actor.name);
      if (!updatedRoom) {
        rejectAction(socket, 'Failed to change phase');
        return;
      }

      let sortedCards = updatedRoom.cards;
      if (phase === 'discussion') {
        sortedCards = getSortedCards(updatedRoom.cards);
      }

      const roomWithResetStates = await RoomService.resetUsersReadyState(actor.roomId);
      const roomState = roomWithResetStates || updatedRoom;

      clearRoomTimer(actor.roomId, true);
      if (roomState.phase === 'rating') {
        roomRetroRatings.set(actor.roomId, { votes: new Map(), resultsVisible: false });
      }
      if (roomState.phase === 'discussion') {
        const navigationState = buildDiscussionNavigation(sortedCards);
        roomDiscussionNavigation.set(actor.roomId, navigationState);
        io.to(actor.roomId).emit('discussion-navigation', navigationState);
      } else {
        roomDiscussionNavigation.delete(actor.roomId);
        roomFacilitators.delete(actor.roomId);
      }
      roomRaisedHands.delete(actor.roomId);
      emitDiscussionHands(actor.roomId);

      io.to(actor.roomId).emit('phase-changed', {
        phase: roomState.phase,
        cards: sortedCards
      });
      io.to(actor.roomId).emit('state-updated', {
        cards: sortedCards,
        phase: roomState.phase,
        users: roomState.users
      });

      if (roomState.phase === 'discussion' && getRoomFeatures(roomState).facilitatorEnabled) {
        const facilitator = selectRandomFacilitator(roomState);
        if (facilitator) {
          roomFacilitators.set(actor.roomId, facilitator);
          io.to(actor.roomId).emit('facilitator-selected', facilitator);
        }
      }

      await emitRetroRatingStateToRoom(actor.roomId);
      await persistRoomEphemeral(actor.roomId);
    } catch (error) {
      logger.error({ err: error }, 'failed to change phase');
      rejectAction(socket, 'Failed to change phase');
    }
  });


  on(socket, 'set-column-titles', async ({ titles }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (actor?.roomId) session.currentUser = actor;

    if (!actor?.roomId) return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room) return;
      if (!canControlDiscussionNavigation(room, actor.name, actor.role, actor.roomId)) return;
      if (!Array.isArray(titles)) return;

      const updatedRoom = await RoomService.updateColumnTitles(actor.roomId, titles);
      if (!updatedRoom?.columnTitles) return;

      io.to(actor.roomId).emit('column-titles-updated', { titles: updatedRoom.columnTitles });
    } catch (error) {
      logger.error({ err: error }, 'error updating column titles');
    }
  });


  on(socket, 'set-column-colors', async ({ colors }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (actor?.roomId) session.currentUser = actor;

    if (!actor?.roomId) return;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room) return;
      if (!canControlDiscussionNavigation(room, actor.name, actor.role, actor.roomId)) return;
      if (!Array.isArray(colors)) return;

      const updatedRoom = await RoomService.updateColumnColors(actor.roomId, colors);
      if (!updatedRoom?.columnColors) return;

      io.to(actor.roomId).emit('column-colors-updated', { colors: updatedRoom.columnColors });
    } catch (error) {
      logger.error({ err: error }, 'error updating column colors');
    }
  });


  on(socket, 'set-room-features', async ({ features }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (!actor?.roomId || !features || typeof features !== 'object') return;
    session.currentUser = actor;
    const actorRoomId = actor.roomId;
    const actorName = actor.name;

    try {
      const room = await RoomService.getRoom(actorRoomId);
      if (!room) return;
      if (!isRoomAdmin(room, actorName)) return;

      const featurePatch = { ...(features as Partial<RoomFeatures>) };
      delete featurePatch.backgroundImage;
      const updatedRoom = await RoomService.updateRoomFeatures(actorRoomId, featurePatch);
      if (!updatedRoom?.features) return;

      const { backgroundImage: _backgroundImage, ...featuresWithoutBackground } = updatedRoom.features;
      io.to(actorRoomId).emit('room-features-updated', { features: featuresWithoutBackground });

      if (updatedRoom.phase === 'discussion') {
        if (updatedRoom.features.facilitatorEnabled && !roomFacilitators.get(actorRoomId)) {
          const facilitator = selectRandomFacilitator(updatedRoom);
          if (facilitator) {
            roomFacilitators.set(actorRoomId, facilitator);
            io.to(actorRoomId).emit('facilitator-selected', facilitator);
          }
        } else if (!updatedRoom.features.facilitatorEnabled) {
          roomFacilitators.delete(actorRoomId);
          io.to(actorRoomId).emit('facilitator-selected', null);
        }
        if (!updatedRoom.features.discussionActionsEnabled) {
          roomRaisedHands.delete(actorRoomId);
          emitDiscussionHands(actorRoomId);
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'error updating room features');
    }
  });

}
