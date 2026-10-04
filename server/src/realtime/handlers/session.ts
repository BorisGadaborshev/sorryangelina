import { Socket } from 'socket.io';
import { on } from '../on';
import { RealtimeSession } from '../session';
import { Room, User, isRetroTemplateId } from '../../types';
import { RoomService } from '../../services/RoomService';
import { TeamService } from '../../services/TeamService';
import { BUILTIN_TEAM_ID } from '../../services/TeamService';
import { assertNoProfanity, ContentModerationError } from '../../services/ContentModeration';
import { assertCardSlotAvailable, assertCreationSlotAvailable, UsageLimitError } from '../../services/UsageLimits';
import { eventAuth } from '../socketAuth';
import {
  addRoomPresence,
  adjustConnectionCount,
  emitArkanoidScoresToSocket,
  emitDiscussionHandsToSocket,
  emitDiscussionNavigationToSocket,
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
        console.log('Failed to restore session:', { roomId, userId });
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
      
      console.log('Session restored successfully:', { roomId, userId: session.currentUser.id });
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
      console.error('Error restoring session:', error);
      socket.emit('session-expired');
    }
  });


  on(socket, 'create-room', async ({ roomId, password, username, token, teamId, template }) => {
    const auth = eventAuth(socket, token);
    if (!auth) {
      socket.emit('error', 'Unauthorized: token is invalid or expired');
      return;
    }
    if (username && auth.name !== username) {
      socket.emit('error', 'Unauthorized: token does not match user');
      return;
    }
    const effectiveUsername = auth.name;
    const normalizedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : BUILTIN_TEAM_ID;
    try {
      const teamRole = await TeamService.getUserRole(normalizedTeamId, effectiveUsername);
      if (!teamRole) {
        socket.emit('error', 'Join the team before creating a room');
        return;
      }

      const existingRoom = await RoomService.getRoom(roomId);
      if (existingRoom) {
        console.log('Room already exists:', roomId);
        socket.emit('error', 'Room already exists');
        return;
      }

      if (typeof template !== 'undefined' && !isRetroTemplateId(template)) {
        socket.emit('error', 'Unknown retro template');
        return;
      }

      if (typeof roomId !== 'string' || !roomId.trim()) {
        socket.emit('error', 'Room name is required');
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
      
      console.log('Room created successfully:', roomId);
      socket.emit('room-joined', { 
        room, 
        state: { 
          cards: room.cards, 
          phase: room.phase, 
          users: room.users 
        },
        userId: socket.id
      });
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
        console.error('Error creating room:', error);
      }
      socket.emit('error', limitMessage ?? 'Failed to create room');
    }
  });


  on(socket, 'join-room', async ({ roomId, password, username, token }) => {
    const auth = eventAuth(socket, token);
    if (!auth) {
      socket.emit('error', 'Unauthorized: token is invalid or expired');
      return;
    }
    if (username && auth.name !== username) {
      socket.emit('error', 'Unauthorized: token does not match user');
      return;
    }
    const effectiveUsername = auth.name;
    try {
      const isValid = await RoomService.validatePassword(roomId, password);
      if (!isValid) {
        console.log('Invalid password for room:', roomId);
        socket.emit('error', 'Invalid password');
        return;
      }

      const existingRoom = await RoomService.getRoom(roomId);
      if (!existingRoom) {
        socket.emit('error', 'Room not found');
        return;
      }
      const teamRole = existingRoom.teamId
        ? await TeamService.getUserRole(existingRoom.teamId, effectiveUsername)
        : null;
      if (existingRoom.teamId && !teamRole) {
        socket.emit('error', 'Join the team before joining a room');
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
        socket.emit('error', 'Room not found');
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
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
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
      console.error('Error handling leave-room:', error);
    }
  });


  on(socket, 'disconnect', (reason) => {
    const connectionCount = adjustConnectionCount(-1);
    console.log(`Client disconnected (${connectionCount} total):`, socket.id);
    console.log('Disconnect reason:', reason);
    
    if (!session.currentUser) return;

    try {
      const disconnectedUser = session.currentUser;
      session.currentUser = null;
      handleUserDisconnect(socket, disconnectedUser);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });


  on(socket, 'error', (error) => {
    console.error('Socket error for client:', socket.id, error);
  });
}
