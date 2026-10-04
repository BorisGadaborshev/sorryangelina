import crypto from 'crypto';
import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { RealtimeSession } from '../session';
import { AccountService } from '../../services/AccountService';
import { RoomService } from '../../services/RoomService';
import { replaceBackgroundImage } from '../../services/ImageStore';
import { ContentModerationError } from '../../services/ContentModeration';
import { logger } from '../../utils/logger';
import { isRoomAdmin, moderateRoomText } from '../access';
import { ChatMessage } from '../../types';
import {
  appendChatMessage,
  cancelPendingUserDeparture,
  clearRoomRuntimeState,
  emitArkanoidScoresToRoom,
  emitRetroRatingStateToRoom,
  emitSprintVipStateToRoom,
  getPresentUserNames,
  getRoomFeatures,
  io,
  normalizeMood,
  normalizeWhiteboardStroke,
  resolveSocketActor,
  roomArkanoidScores,
  roomSprintVipVotes,
  roomWhiteboards
} from '../runtime';

export function registerExtrasHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'vote-sprint-vip', async ({ userName }) => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;
      if (!getRoomFeatures(room).sprintVipEnabled) return;

      const targetName = typeof userName === 'string' ? userName.trim() : '';
      const votes = roomSprintVipVotes.get(session.currentUser.roomId) || new Map<string, string>();
      const currentVote = votes.get(session.currentUser.name);

      if (!targetName || targetName === session.currentUser.name) {
        return;
      }

      if (!room.users.some((user) => user.name === targetName)) {
        rejectAction(socket, 'Участник не найден');
        return;
      }

      if (currentVote === targetName) {
        votes.delete(session.currentUser.name);
      } else {
        votes.set(session.currentUser.name, targetName);
      }

      roomSprintVipVotes.set(session.currentUser.roomId, votes);
      await emitSprintVipStateToRoom(session.currentUser.roomId);
    } catch (error) {
      logger.error({ err: error }, 'error voting sprint VIP');
      rejectAction(socket, 'Не удалось проголосовать за VIP спринта');
    }
  });


  on(socket, 'arkanoid-score', ({ score, cardsBroken }: { score?: number; cardsBroken?: number }) => {
    if (!session.currentUser?.roomId || !session.currentUser.name) return;
    const safeScore = Math.floor(Number(score));
    const safeBroken = Math.floor(Number(cardsBroken));
    if (!Number.isFinite(safeScore) || safeScore < 0 || safeScore > 1_000_000) return;
    const broken = Number.isFinite(safeBroken) ? Math.max(0, Math.min(10_000, safeBroken)) : 0;
    const roomId = session.currentUser.roomId;
    const byUser = roomArkanoidScores.get(roomId) || new Map<string, { userName: string; score: number; cardsBroken: number }>();
    const previous = byUser.get(session.currentUser.name);
    if (previous && previous.score >= safeScore) return;
    byUser.set(session.currentUser.name, { userName: session.currentUser.name, score: safeScore, cardsBroken: broken });
    roomArkanoidScores.set(roomId, byUser);
    emitArkanoidScoresToRoom(roomId);
  });


  on(socket, 'set-user-mood', async ({ mood }) => {
    if (!session.currentUser?.roomId) return;
    const safeMood = normalizeMood(mood);
    if (!safeMood) {
      rejectAction(socket, 'Invalid mood');
      return;
    }

    try {
      const room = await RoomService.updateUserMood(session.currentUser.roomId, session.currentUser.id, safeMood);
      if (!room) return;
      session.currentUser = {
        ...session.currentUser,
        mood: safeMood
      };
      io.to(session.currentUser.roomId).emit('state-updated', {
        cards: room.cards,
        phase: room.phase,
        users: room.users
      });
    } catch (error) {
      logger.error({ err: error }, 'failed to update user mood');
      rejectAction(socket, 'Failed to update user mood');
    }
  });


  on(socket, 'send-chat-message', async ({ text }) => {
    if (!session.currentUser?.roomId) return;
    const room = await RoomService.getRoom(session.currentUser.roomId);
    if (!room || !getRoomFeatures(room).chatEnabled) return;
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) return;
    try {
      await moderateRoomText(room, normalized);
    } catch (error) {
      if (error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      throw error;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: session.currentUser.roomId,
      userName: session.currentUser.name,
      text: normalized.slice(0, 500),
      timestamp: Date.now()
    };

    appendChatMessage(session.currentUser.roomId, message);
    io.to(session.currentUser.roomId).emit('chat-message', message);
  });


  on(socket, 'whiteboard-stroke', async (payload) => {
    if (!session.currentUser?.roomId) return;
    const room = await RoomService.getRoom(session.currentUser.roomId);
    if (!room || !getRoomFeatures(room).drawingEnabled) return;
    const stroke = normalizeWhiteboardStroke(payload);
    if (!stroke) return;
    const current = roomWhiteboards.get(session.currentUser.roomId) || [];
    const next = [...current, stroke].slice(-5000);
    roomWhiteboards.set(session.currentUser.roomId, next);
    io.to(session.currentUser.roomId).emit('whiteboard-stroke', stroke);
  });


  on(socket, 'clear-whiteboard', async () => {
    if (!session.currentUser?.roomId) return;
    const room = await RoomService.getRoom(session.currentUser.roomId);
    if (!room || !getRoomFeatures(room).drawingEnabled) return;
    roomWhiteboards.set(session.currentUser.roomId, []);
    io.to(session.currentUser.roomId).emit('whiteboard-cleared');
  });


  on(socket, 'set-room-background', async ({ backgroundImage }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (!actor?.roomId) return;
    session.currentUser = actor;
    const actorRoomId = actor.roomId;
    const actorName = actor.name;

    try {
      const room = await RoomService.getRoom(actorRoomId);
      if (!room) return;
      if (!isRoomAdmin(room, actorName)) return;

      const nextBackground = await replaceBackgroundImage(actorRoomId, backgroundImage);
      const updatedRoom = await RoomService.updateRoomFeatures(actorRoomId, { backgroundImage: nextBackground });
      if (!updatedRoom?.features) return;

      io.to(actorRoomId).emit('room-background-updated', { backgroundImage: updatedRoom.features.backgroundImage });
    } catch (error) {
      logger.error({ err: error }, 'failed to update room background');
    }
  });


  on(socket, 'transfer-room-admin', async ({ userId }) => {
    if (!session.currentUser?.roomId || typeof userId !== 'string') return;

    try {
      const updatedRoom = await RoomService.transferRoomAdmin(
        session.currentUser.roomId,
        session.currentUser.id,
        userId,
        session.currentUser.name
      );
      if (!updatedRoom) {
        rejectAction(socket, 'Не удалось передать права администратора');
        return;
      }

      io.to(session.currentUser.roomId).emit('state-updated', {
        cards: updatedRoom.cards,
        phase: updatedRoom.phase,
        users: updatedRoom.users
      });
    } catch (error) {
      logger.error({ err: error }, 'error transferring room admin');
      rejectAction(socket, 'Не удалось передать права администратора');
    }
  });


  on(socket, 'kick-user', async ({ userId }) => {
    if (!session.currentUser?.roomId || typeof userId !== 'string' || userId === session.currentUser.id) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      const actor = room.users.find((user) => user.id === session.currentUser?.id || user.name === session.currentUser?.name);
      if (!actor || actor.role !== 'admin') {
        rejectAction(socket, 'Только администратор может исключать участников');
        return;
      }

      const roomId = session.currentUser.roomId;
      const kickedUser = room.users.find((user) => user.id === userId);
      if (kickedUser) {
        cancelPendingUserDeparture(roomId, kickedUser.name);
      }
      const updatedRoom = await RoomService.removeUser(roomId, userId, kickedUser?.name, getPresentUserNames(roomId));
      if (!updatedRoom) return;

      const socketsInRoom = await io.in(roomId).fetchSockets();
      for (const roomSocket of socketsInRoom) {
        if (roomSocket.data.userId === userId) {
          roomSocket.emit('kicked');
          roomSocket.leave(roomId);
        }
      }

      io.to(roomId).emit('state-updated', {
        cards: updatedRoom.cards,
        phase: updatedRoom.phase,
        users: updatedRoom.users
      });
      await emitRetroRatingStateToRoom(roomId);
      await emitSprintVipStateToRoom(roomId);
    } catch (error) {
      logger.error({ err: error }, 'error kicking user');
      rejectAction(socket, 'Не удалось исключить участника');
    }
  });


  on(socket, 'delete-room', async () => {
    if (!session.currentUser?.roomId) {
      rejectAction(socket, 'Room not found');
      return;
    }

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) {
        rejectAction(socket, 'Room not found');
        return;
      }

      const isOwner = room.owner === session.currentUser.name;
      if (!isOwner) {
        rejectAction(socket, 'Only room creator can delete the room');
        return;
      }
      if (socket.data.authType === 'guest' && await AccountService.hasAccount(room.owner)) {
        rejectAction(socket, 'Это имя занято, войдите с паролем');
        return;
      }

      const roomId = session.currentUser.roomId;
      await RoomService.deleteRoom(roomId);
      clearRoomRuntimeState(roomId, false);

      io.to(roomId).emit('room-deleted');
      io.in(roomId).socketsLeave(roomId);
      session.currentUser = null;
    } catch (error) {
      logger.error({ err: error }, 'error deleting room');
      rejectAction(socket, 'Failed to delete room');
    }
  });

}
