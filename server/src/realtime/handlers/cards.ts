import crypto from 'crypto';
import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { RealtimeSession } from '../session';
import { Card, alignSegmentAuthors, compactSegmentAuthors, getCardTextSegments, getCardTypeByColumn, getRetroTemplate } from '../../types';
import { RoomService } from '../../services/RoomService';
import { assertCardSlotAvailable, UsageLimitError } from '../../services/UsageLimits';
import { ContentModerationError } from '../../services/ContentModeration';
import { eventAuth } from '../socketAuth';
import { replaceCardImage } from '../../services/ImageStore';
import { logger } from '../../utils/logger';
import { isRoomAdmin, moderateRoomText } from '../access';
import { bumpRoomVersion } from '../roomSync';
import {
  allowDiscussionBurst,
  emitDiscussionBurst,
  getRoomFeatures,
  io,
  isNegativeColumn,
  isRoadmapColumn,
  resolveSocketActor
} from '../runtime';

export function registerCardsHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'add-card', async ({ text, column, imageUrl }) => {
    if (!session.currentUser) return;
    const actorName = session.currentUser.name;
    const actorRoomId = session.currentUser.roomId;

    try {
      logger.debug({ roomId: actorRoomId, column }, 'add-card');
      const room = await RoomService.getRoom(actorRoomId);
      const template = getRetroTemplate(room?.template);
      const targetColumn = Number(column);
      const analysisColumn = template.columns.length;
      const canAddInPhase = room?.phase === 'creation'
        || (room?.phase === 'roadmap' && template.roadmapColumns && targetColumn === analysisColumn);
      if (!room || !canAddInPhase || !Number.isInteger(targetColumn)) return;
      if (room.phase === 'creation' && (targetColumn < 0 || targetColumn >= template.columns.length)) return;

      const features = getRoomFeatures(room);
      const actionColumn = template.actionColumnIndex;
      if (actionColumn != null && !features.membersCanAddCards && targetColumn === actionColumn) {
        if (!isRoomAdmin(room, actorName)) return;
      }
      const trimmedText = typeof text === 'string' ? text.trim() : '';
      if (!trimmedText && !imageUrl) return;
      await moderateRoomText(room, trimmedText);
      await assertCardSlotAvailable(actorRoomId, actorName);
      const cardId = crypto.randomUUID();
      const safeImageUrl = features.mediaEnabled && imageUrl
        ? await replaceCardImage(actorRoomId, cardId, imageUrl)
        : undefined;

      const card: Card = {
        id: cardId,
        text: trimmedText,
        type: getCardTypeByColumn(template, targetColumn),
        createdBy: actorName,
        likes: [],
        dislikes: [],
        column: targetColumn,
        imageUrl: safeImageUrl,
        comments: [],
        reactions: []
      };

      const updatedRoom = await RoomService.addCard(actorRoomId, card);
      if (updatedRoom) {
        io.to(actorRoomId).emit('card-added', card);
        bumpRoomVersion(actorRoomId);
      }
    } catch (error) {
      if (error instanceof UsageLimitError || error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to add card');
      rejectAction(socket, 'Failed to add card');
    }
  });


  on(socket, 'update-card', async ({ cardId, text, imageUrl }) => {
    if (!session.currentUser) return;
    const currentUserName = session.currentUser.name;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || (room.phase !== 'creation' && room.phase !== 'discussion' && room.phase !== 'roadmap')) return;

      const features = getRoomFeatures(room);
      if (!features.cardEditingEnabled) return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;
      if (!isRoomAdmin(room, currentUserName) && card.createdBy !== currentUserName) return;

      const updates: Partial<Card> = {};
      if (typeof text === 'string') {
        await moderateRoomText(room, text);
        updates.text = text.trim();
        updates.segmentAuthors = compactSegmentAuthors(
          alignSegmentAuthors(updates.text, card.createdBy, card.segmentAuthors),
          card.createdBy
        ) ?? [];
      }
      if (typeof imageUrl !== 'undefined') {
        updates.imageUrl = features.mediaEnabled
          ? await replaceCardImage(session.currentUser.roomId, cardId, imageUrl)
          : undefined;
      }
      if (Object.keys(updates).length === 0) return;

      const updatedRoom = await RoomService.updateCard(session.currentUser.roomId, cardId, updates);
      if (updatedRoom) {
        const updatedCard = updatedRoom.cards.find((currentCard) => currentCard.id === cardId);
        if (updatedCard) {
          io.to(session.currentUser.roomId).emit('card-updated', updatedCard);
        }
        bumpRoomVersion(session.currentUser.roomId);
      }
    } catch (error) {
      if (error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to update card');
      rejectAction(socket, 'Failed to update card');
    }
  });


  on(socket, 'delete-card', async ({ cardId }) => {
    if (!session.currentUser) return;
    const currentUserName = session.currentUser.name;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || (room.phase !== 'creation' && room.phase !== 'discussion' && room.phase !== 'roadmap')) return;
      if (!getRoomFeatures(room).cardEditingEnabled) return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;
      if (!isRoomAdmin(room, currentUserName) && card.createdBy !== currentUserName) return;

      const updatedRoom = await RoomService.deleteCard(session.currentUser.roomId, cardId);
      if (updatedRoom) {
        io.to(session.currentUser.roomId).emit('card-deleted', cardId);
        bumpRoomVersion(session.currentUser.roomId);
      }
    } catch (error) {
      logger.error({ err: error }, 'failed to delete card');
      rejectAction(socket, 'Failed to delete card');
    }
  });


  on(socket, 'delete-all-cards', async () => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room) return;

      const actor = room.users.find((user) => user.id === session.currentUser?.id || user.name === session.currentUser?.name);
      if (!actor || !isRoomAdmin(room, actor.name)) {
        rejectAction(socket, 'Только администратор может удалить все карточки');
        return;
      }

      const updatedRoom = await RoomService.deleteAllCards(session.currentUser.roomId);
      if (updatedRoom) {
        io.to(session.currentUser.roomId).emit('cards-cleared');
        bumpRoomVersion(session.currentUser.roomId);
      }
    } catch (error) {
      logger.error({ err: error }, 'failed to delete all cards');
      rejectAction(socket, 'Failed to delete all cards');
    }
  });


  on(socket, 'merge-cards', async ({ targetCardId, sourceCardId }) => {
    if (!session.currentUser || typeof targetCardId !== 'string' || typeof sourceCardId !== 'string') return;
    if (targetCardId === sourceCardId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'creation') return;
      if (!getRoomFeatures(room).cardEditingEnabled) return;

      if (!isRoomAdmin(room, session.currentUser.name)) return;

      const targetCard = room.cards.find((card) => card.id === targetCardId);
      const sourceCard = room.cards.find((card) => card.id === sourceCardId);
      if (!targetCard || !sourceCard) return;

      const updatedRoom = await RoomService.mergeCards(session.currentUser.roomId, targetCardId, sourceCardId);
      if (updatedRoom) {
        io.to(session.currentUser.roomId).emit('state-updated', {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        });
        bumpRoomVersion(session.currentUser.roomId);
      }
    } catch (error) {
      logger.error({ err: error }, 'failed to merge cards');
      rejectAction(socket, 'Failed to merge cards');
    }
  });


  on(socket, 'unmerge-card', async ({ cardId }) => {
    if (!session.currentUser || typeof cardId !== 'string') return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'creation') return;
      if (!getRoomFeatures(room).cardEditingEnabled) return;
      if (!isRoomAdmin(room, session.currentUser.name)) return;

      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card || getCardTextSegments(card.text).length < 2) return;

      const updatedRoom = await RoomService.unmergeCard(session.currentUser.roomId, cardId);
      if (updatedRoom) {
        io.to(session.currentUser.roomId).emit('state-updated', {
          cards: updatedRoom.cards,
          phase: updatedRoom.phase,
          users: updatedRoom.users
        });
        bumpRoomVersion(session.currentUser.roomId);
      }
    } catch (error) {
      if (error instanceof UsageLimitError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to unmerge card');
      rejectAction(socket, 'Не удалось отменить объединение');
    }
  });


  on(socket, 'move-card', async ({ cardId, column }) => {
    if (!session.currentUser) return;
    const currentUserName = session.currentUser.name;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      const template = getRetroTemplate(room?.template);
      const targetColumn = Number(column);
      const roadmapMove = room?.phase === 'roadmap'
        && Boolean(template.roadmapColumns)
        && Number.isInteger(targetColumn)
        && (isNegativeColumn(template, targetColumn) || isRoadmapColumn(template, targetColumn));
      const creationMove = room?.phase === 'creation'
        && Number.isInteger(targetColumn)
        && targetColumn >= 0
        && targetColumn < template.columns.length;
      if (!room || (!creationMove && !roadmapMove)) return;

      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card) return;

      if (creationMove) {
        if (!isRoomAdmin(room, currentUserName)) {
          if (!getRoomFeatures(room).moveCardsEnabled) return;
          if (card.createdBy !== currentUserName) return;
        }
      }

      const nextType = getCardTypeByColumn(template, targetColumn);
      const updates: Partial<Card> = { column: targetColumn, type: nextType };
      if (
        roadmapMove
        && isRoadmapColumn(template, targetColumn)
        && card.originColumn == null
        && card.column < template.columns.length
      ) {
        updates.originColumn = card.column;
      }
      const updatedRoom = await RoomService.updateCard(session.currentUser.roomId, cardId, updates);
      if (!updatedRoom) return;

      io.to(session.currentUser.roomId).emit('card-moved', { cardId, column: targetColumn, originColumn: updates.originColumn ?? card.originColumn });
      bumpRoomVersion(session.currentUser.roomId);
    } catch (error) {
      logger.error({ err: error }, 'failed to move card');
      rejectAction(socket, 'Failed to move card');
    }
  });


  on(socket, 'vote-card', async ({ cardId, voteType }) => {
    if (!session.currentUser) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'voting') return;

      const features = getRoomFeatures(room);
      if (voteType === 'dislike' && !features.dislikesEnabled) return;

      const card = room.cards.find(c => c.id === cardId);
      if (!card) return;

      const updatedRoom = await RoomService.updateCardVotes(session.currentUser.roomId, cardId, session.currentUser.id, voteType);
      if (updatedRoom) {
        const updatedCard = updatedRoom.cards.find(c => c.id === cardId);
        if (updatedCard) {
          io.to(session.currentUser.roomId).emit('card-voted', { 
            cardId, 
            likes: updatedCard.likes,
            dislikes: updatedCard.dislikes
          });
          bumpRoomVersion(session.currentUser.roomId);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to vote for card';
      if (error instanceof Error && (message.includes('не более') || message.includes('отключены'))) {
        socket.emit('vote-error', { cardId, message });
        return;
      }
      logger.error({ err: error }, 'failed to vote for card');
      rejectAction(socket, message);
    }
  });


  on(socket, 'update-ready-state', async ({ isReady, token, roomId: payloadRoomId }) => {
    try {
      let actor = await resolveSocketActor(socket, session.currentUser);
      if (!actor?.roomId || !actor.name) {
        const auth = eventAuth(socket, token);
        const roomId = typeof payloadRoomId === 'string' && payloadRoomId
          ? payloadRoomId
          : (typeof socket.data.roomId === 'string' ? socket.data.roomId : undefined);
        if (auth?.name && roomId) {
          const room = await RoomService.getRoom(roomId);
          const user = room?.users.find((roomUser) => roomUser.name === auth.name);
          if (user) {
            actor = { ...user, roomId };
            socket.join(roomId);
          }
        }
      }
      if (!actor?.roomId || !actor.name) {
        return;
      }

      session.currentUser = actor;
      socket.data.userId = actor.id;
      socket.data.userName = actor.name;
      socket.data.roomId = actor.roomId;

      const roomForFeatures = await RoomService.getRoom(actor.roomId);
      if (roomForFeatures && !getRoomFeatures(roomForFeatures).readyEnabled) {
        rejectAction(socket, 'Отметка готовности отключена в настройках комнаты');
        return;
      }

      const room = await RoomService.updateUserReadyState(actor.roomId, actor.id, isReady, actor.name);
      if (room) {
        io.to(actor.roomId).emit('state-updated', {
          cards: room.cards,
          phase: room.phase,
          users: room.users
        });
        bumpRoomVersion(actor.roomId);
      }
    } catch (error) {
      logger.error({ err: error }, 'failed to update ready state');
    }
  });


  on(socket, 'set-card-author-reveal', async ({ cardId, revealed }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (!actor?.roomId || typeof cardId !== 'string' || typeof revealed !== 'boolean') return;
    session.currentUser = actor;

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room || room.phase !== 'discussion' || !getRoomFeatures(room).discussionActionsEnabled) return;
      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card || card.createdBy !== actor.name) return;

      const nextRevealed = revealed;
      if (Boolean(card.authorRevealed) === nextRevealed) return;

      const updatedRoom = await RoomService.updateCard(actor.roomId, cardId, { authorRevealed: nextRevealed });
      const updatedCard = updatedRoom?.cards.find((currentCard) => currentCard.id === cardId);
      if (!updatedCard) return;

      io.to(actor.roomId).emit('card-updated', updatedCard);
      bumpRoomVersion(actor.roomId);
      if (nextRevealed && allowDiscussionBurst(actor.roomId, actor.name)) {
        emitDiscussionBurst(actor.roomId, '✍️', actor.name);
      }
    } catch (error) {
      logger.error({ err: error }, 'failed to reveal card author');
    }
  });

}
