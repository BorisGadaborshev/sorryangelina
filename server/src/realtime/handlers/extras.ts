import { Socket } from 'socket.io';
import { on } from '../on';
import { RealtimeSession } from '../session';
import { Room } from '../../types';
import { AccountService } from '../../services/AccountService';
import { RoomService } from '../../services/RoomService';
import { replaceBackgroundImage, replaceCardImage } from '../../services/ImageStore';
import {
  ChatMessage,
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
        socket.emit('error', 'Участник не найден');
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
      console.error('Error voting sprint VIP:', error);
      socket.emit('error', 'Не удалось проголосовать за VIP спринта');
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
      socket.emit('error', 'Invalid mood');
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
      console.error('Error updating user mood:', error);
      socket.emit('error', 'Failed to update user mood');
    }
  });


  on(socket, 'send-chat-message', async ({ text }) => {
    if (!session.currentUser?.roomId) return;
    const room = await RoomService.getRoom(session.currentUser.roomId);
    if (!room || !getRoomFeatures(room).chatEnabled) return;
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      const isAdmin = room.users.some((user) => user.name === actorName && user.role === 'admin');
      if (!isAdmin) return;

      const nextBackground = await replaceBackgroundImage(actorRoomId, backgroundImage);
      const updatedRoom = await RoomService.updateRoomFeatures(actorRoomId, { backgroundImage: nextBackground });
      if (!updatedRoom?.features) return;

      io.to(actorRoomId).emit('room-background-updated', { backgroundImage: updatedRoom.features.backgroundImage });
    } catch (error) {
      console.error('Error updating room background:', error);
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
        socket.emit('error', 'Не удалось передать права администратора');
        return;
      }

      io.to(session.currentUser.roomId).emit('state-updated', {
        cards: updatedRoom.cards,
        phase: updatedRoom.phase,
        users: updatedRoom.users
      });
    } catch (error) {
      console.error('Error transferring room admin:', error);
      socket.emit('error', 'Не удалось передать права администратора');
    }
  });


  on(socket, 'kick-user', async ({ userId }) => {
    if (!session.currentUser?.roomId || typeof userId !== 'string' || userId === session.currentUser.id) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      const actor = room.users.find((user) => user.id === session.currentUser?.id || user.name === session.currentUser?.name);
      if (!actor || actor.role !== 'admin') {
        socket.emit('error', 'Только администратор может исключать участников');
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
      console.error('Error kicking user:', error);
      socket.emit('error', 'Не удалось исключить участника');
    }
  });


  on(socket, 'delete-room', async () => {
    if (!session.currentUser?.roomId) {
      socket.emit('error', 'Room not found');
      return;
    }

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      const isOwner = room.owner === session.currentUser.name;
      if (!isOwner) {
        socket.emit('error', 'Only room creator can delete the room');
        return;
      }
      if (socket.data.authType === 'guest' && await AccountService.hasAccount(room.owner)) {
        socket.emit('error', 'Это имя занято, войдите с паролем');
        return;
      }

      const roomId = session.currentUser.roomId;
      await RoomService.deleteRoom(roomId);
      clearRoomRuntimeState(roomId, false);

      io.to(roomId).emit('room-deleted');
      io.in(roomId).socketsLeave(roomId);
      session.currentUser = null;
    } catch (error) {
      console.error('Error deleting room:', error);
      socket.emit('error', 'Failed to delete room');
    }
  });

}
