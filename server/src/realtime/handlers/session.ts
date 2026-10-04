import { Socket } from 'socket.io';
import { logger } from '../../utils/logger';
import { on, rejectAction } from '../on';
import { RealtimeSession } from '../session';
import { User, isRetroTemplateId } from '../../types';
import { RoomService } from '../../services/RoomService';
import { TeamService } from '../../services/TeamService';
import { BUILTIN_TEAM_ID } from '../../services/TeamService';
import { assertNoProfanity, ContentModerationError } from '../../services/ContentModeration';
import { assertCreationSlotAvailable, UsageLimitError } from '../../services/UsageLimits';
import { eventAuth } from '../socketAuth';
import { currentRoomVersion } from '../roomSync';
import {
  addRoomPresence,
  adjustConnectionCount,
  clearRoomPasswordAttempts,
  registerInvalidRoomPassword,
  roomPasswordRetryAfterMs,
  emitArkanoidScoresToSocket,
  emitDiscussionHandsToSocket,
  emitDiscussionNavigationToSocket,
  hydrateRoomEphemeral,
  emitFacilitatorToSocket,
  emitRetroRatingStateToRoom,
  emitRetroRatingStateToSocket,
  emitSprintVipStateToRoom,
  emitSprintVipStateToSocket,
  emitTimerToSocket,
  handleUserDisconnect,
  handleUserLeavingRoom,
  roomChats,
  roomWhiteboards
} from '../runtime';

export function registerSessionHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'sync-room', async () => {
    if (!session.currentUser?.roomId) return;
    const room = await RoomService.getRoom(session.currentUser.roomId);
    if (!room) return;
    socket.emit('state-updated', {
      cards: room.cards,
      phase: room.phase,
      users: room.users,
      version: currentRoomVersion(room.id)
    });
  });

  on(socket, 'restore-session', async ({ roomId, userId, username, token }) => {
    const auth = eventAuth(socket, token);
    if (!auth) {
      socket.emit('session-expired');
      return;
    }

    try {
      const { room, user } = await RoomService.restoreSession(
        roomId,
        userId,
        socket.id,
        username || auth.name
      );
      
      if (!room || !user) {
        logger.debug({ roomId, userId }, 'session restore failed');
        socket.emit('session-expired');
        return;
      }
      if (user.name !== auth.name) {
        socket.emit('session-expired');
        return;
      }

      socket.join(roomId);
      session.currentUser = { ...user, roomId };
      socket.data.userId = session.currentUser.id;
      socket.data.userName = session.currentUser.name;
      socket.data.authType = auth.type;
      socket.data.roomId = roomId;
      addRoomPresence(roomId, user.name, socket.id);
      
      logger.debug({ roomId, userId: session.currentUser.id }, 'session restored');
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: session.currentUser.id
      });
      socket.to(roomId).emit('state-updated', {
        cards: room.cards,
        phase: room.phase,
        users: room.users
      });
      await hydrateRoomEphemeral(roomId);
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
      emitRetroRatingStateToSocket(socket, room);
      emitSprintVipStateToSocket(socket, room);
      emitArkanoidScoresToSocket(socket, roomId);
      emitDiscussionNavigationToSocket(socket, roomId, room);
      emitFacilitatorToSocket(socket, roomId, room);
      emitDiscussionHandsToSocket(socket, roomId);
    } catch (error) {
      logger.error({ err: error }, 'error restoring session');
      socket.emit('session-expired');
    }
  });


  on(socket, 'create-room', async ({ roomId, password, username, token, teamId, template }) => {
    const auth = eventAuth(socket, token);
    if (!auth) {
      rejectAction(socket, 'Unauthorized: token is invalid or expired');
      return;
    }
    if (username && auth.name !== username) {
      rejectAction(socket, 'Unauthorized: token does not match user');
      return;
    }
    const effectiveUsername = auth.name;
    const normalizedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : BUILTIN_TEAM_ID;
    try {
      const teamRole = await TeamService.getUserRole(normalizedTeamId, effectiveUsername);
      if (!teamRole) {
        rejectAction(socket, 'Join the team before creating a room');
        return;
      }

      const existingRoom = await RoomService.getRoom(roomId);
      if (existingRoom) {
        logger.debug({ roomId }, 'room already exists');
        rejectAction(socket, 'Room already exists');
        return;
      }

      if (typeof template !== 'undefined' && !isRetroTemplateId(template)) {
        rejectAction(socket, 'Unknown retro template');
        return;
      }

      if (typeof roomId !== 'string' || !roomId.trim()) {
        rejectAction(socket, 'Room name is required');
        return;
      }

      await assertCreationSlotAvailable(effectiveUsername, 'room');
      await assertNoProfanity([{ kind: 'room', text: roomId }]);

      const room = await RoomService.createRoom(roomId, password, socket.id, effectiveUsername, {
        teamId: normalizedTeamId,
        template: isRetroTemplateId(template) ? template : 'classic'
      });
      socket.join(roomId);
      socket.data.userId = socket.id;
      socket.data.userName = effectiveUsername;
      socket.data.authType = auth.type;
      socket.data.roomId = roomId;
      session.currentUser = room.users.find((user) => user.id === socket.id) || {
        id: socket.id,
        name: effectiveUsername,
        roomId,
        role: 'user'
      };
      addRoomPresence(roomId, effectiveUsername, socket.id);
      
      logger.info({ roomId }, 'room created');
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: socket.id
      });
      await hydrateRoomEphemeral(roomId);
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
      emitRetroRatingStateToSocket(socket, room);
      emitSprintVipStateToSocket(socket, room);
      emitArkanoidScoresToSocket(socket, roomId);
    } catch (error) {
      const limitMessage = error instanceof ContentModerationError || error instanceof UsageLimitError
        ? error.message
        : null;
      if (!limitMessage) {
        logger.error({ err: error }, 'error creating room');
      }
      rejectAction(socket, limitMessage ?? 'Failed to create room');
    }
  });


  on(socket, 'join-room', async ({ roomId, password, username, token }) => {
    const auth = eventAuth(socket, token);
    if (!auth) {
      rejectAction(socket, 'Unauthorized: token is invalid or expired');
      return;
    }
    if (username && auth.name !== username) {
      rejectAction(socket, 'Unauthorized: token does not match user');
      return;
    }
    const effectiveUsername = auth.name;
    if (roomPasswordRetryAfterMs(socket.id) > 0) {
      rejectAction(socket, 'Too many invalid passwords');
      return;
    }
    try {
      const isValid = await RoomService.validatePassword(roomId, password);
      if (!isValid) {
        logger.info({ roomId }, 'invalid room password');
        const lockedForMs = registerInvalidRoomPassword(socket.id);
        rejectAction(socket, lockedForMs > 0 ? 'Too many invalid passwords' : 'Invalid password');
        return;
      }
      clearRoomPasswordAttempts(socket.id);

      const existingRoom = await RoomService.getRoom(roomId);
      if (!existingRoom) {
        rejectAction(socket, 'Room not found');
        return;
      }
      const teamRole = existingRoom.teamId
        ? await TeamService.getUserRole(existingRoom.teamId, effectiveUsername)
        : null;
      if (existingRoom.teamId && !teamRole) {
        rejectAction(socket, 'Join the team before joining a room');
        return;
      }

      // Check for existing user first
      const existingUser = await RoomService.findExistingUser(roomId, effectiveUsername);
      const user: User = {
        id: socket.id,
        name: effectiveUsername,
        roomId,
        role: 'user'
      };

      if (existingUser) {
        user.role = existingUser.role || 'user';
      }

      await RoomService.addUser(roomId, user);

      const room = await RoomService.getRoom(roomId);
      if (!room) {
        rejectAction(socket, 'Room not found');
        return;
      }

      const joinedUser = room.users.find((roomUser) => roomUser.name === effectiveUsername);

      socket.join(roomId);
      session.currentUser = joinedUser
        ? { ...joinedUser, roomId }
        : user;
      socket.data.userId = session.currentUser.id;
      socket.data.userName = effectiveUsername;
      socket.data.authType = auth.type;
      socket.data.roomId = roomId;
      addRoomPresence(roomId, effectiveUsername, socket.id);
      
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: user.id
      });
      await hydrateRoomEphemeral(roomId);
      emitTimerToSocket(socket, roomId);
      socket.emit('chat-history', { messages: roomChats.get(roomId) || [] });
      socket.emit('whiteboard-history', { strokes: roomWhiteboards.get(roomId) || [] });
      emitRetroRatingStateToSocket(socket, room);
      emitSprintVipStateToSocket(socket, room);
      emitArkanoidScoresToSocket(socket, roomId);
      emitDiscussionNavigationToSocket(socket, roomId, room);
      emitFacilitatorToSocket(socket, roomId, room);
      emitDiscussionHandsToSocket(socket, roomId);
      if (!existingUser) {
        socket.to(roomId).emit('user-joined', user);
      } else {
        socket.to(roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
      }
      await emitRetroRatingStateToRoom(roomId);
      await emitSprintVipStateToRoom(roomId);
    } catch (error) {
      logger.error({ err: error }, 'error joining room');
      rejectAction(socket, 'Failed to join room');
    }
  });


  on(socket, 'leave-room', async () => {
    if (!session.currentUser?.roomId) return;

    try {
      const leavingUser = session.currentUser;
      session.currentUser = null;
      await handleUserLeavingRoom(socket, leavingUser);
      socket.emit('left-room');
    } catch (error) {
      logger.error({ err: error }, 'error handling leave-room');
    }
  });


  on(socket, 'disconnect', (reason) => {
    const connectionCount = adjustConnectionCount(-1);
    clearRoomPasswordAttempts(socket.id);
    logger.debug({ socketId: socket.id, connections: connectionCount, reason }, 'client disconnected');
    
    if (!session.currentUser) return;

    try {
      const disconnectedUser = session.currentUser;
      session.currentUser = null;
      handleUserDisconnect(socket, disconnectedUser);
    } catch (error) {
      logger.error({ err: error }, 'error handling disconnect');
    }
  });


  on(socket, 'error', (error) => {
    logger.error({ err: error, socketId: socket.id }, 'socket error');
  });
}
