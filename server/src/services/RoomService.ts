import crypto from 'crypto';
import { RoomModel } from '../models/Room';
import { Room, RoomDocument, User, Card, CardComment, Phase, CreateRoomOptions, RoomFeatures, CARD_REACTION_EMOJIS, getColumnCount, getRetroTemplate, isRetroTemplateId, normalizeColumnColors } from '../types';
import { normalizeRoomFeatures } from '../utils/roomFeatures';
import {
  deleteCardMedia,
  deleteRoomCardMedia,
  deleteRoomMedia,
  reassignCardMedia
} from './ImageStore';
import bcrypt from 'bcrypt';
import { assertCreationSlotAvailable } from './UsageLimits';
import { RoomCache } from './RoomCache';

export class RoomService {
  static async createRoom(roomId: string, password: string | undefined, owner: string, username: string, options: CreateRoomOptions = {}): Promise<Room> {
    RoomCache.invalidate(roomId);
    try {
      await assertCreationSlotAvailable(username, 'room');
      const normalizedPassword = password?.trim() || '';
      const hasPassword = normalizedPassword.length > 0;
      const hashedPassword = hasPassword ? await bcrypt.hash(normalizedPassword, 10) : '';
      const user: User = {
        id: owner,
        name: username,
        roomId,
        role: 'admin',
        isReady: false
      };
    
        
      const templateId = options.template ?? 'classic';
      if (!isRetroTemplateId(templateId)) {
        throw new Error('Invalid retro template');
      }

      const room = await RoomModel.create({
        id: roomId,
        password: hashedPassword,
        hasPassword,
        teamId: options.teamId,
        owner: username,
        phase: 'creation',
        template: templateId,
        users: [user],
        cards: []
      });

      const convertedRoom = this.convertToRoom(room);
          return convertedRoom;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async getRoom(roomId: string): Promise<Room | null> {
    const cached = RoomCache.get(roomId);
    if (cached) return cached;
    const generation = RoomCache.generation(roomId);
    const room = await this.ensureRoomHasAdmin(roomId);
    if (!room) return null;
    const converted = this.convertToRoom(room);
    RoomCache.set(roomId, converted, generation);
    return converted;
  }

  private static isRoomAdmin(user: User, roomOwner: string): boolean {
    return user.role === 'admin' || user.name === roomOwner;
  }

  private static async ensureRoomHasAdmin(roomId: string): Promise<RoomDocument | null> {
    const room = await RoomModel.findOne({ id: roomId });
    if (!room || room.users.length === 0) return room;

    const hasAdmin = room.users.some((user) => user.role === 'admin');
    if (hasAdmin) return room;

    const nextAdminId = await RoomModel.getNextRoomAdminUserId(roomId, '');
    if (!nextAdminId) return room;

        return RoomModel.setRoomAdmin(roomId, nextAdminId);
  }

  static async updateColumnTitles(roomId: string, titles: string[]): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const current = await RoomModel.findOne({ id: roomId });
      if (!current) return null;
      const columnCount = getColumnCount(getRetroTemplate(current.template));
      if (titles.length !== columnCount || titles.some((title) => !title.trim())) {
        return null;
      }
      const normalized = titles.map((title) => title.trim());
      const room = await RoomModel.updateColumnTitles(roomId, normalized);
      return room ? this.convertToRoom(room) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updateColumnColors(roomId: string, colors: string[]): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const current = await RoomModel.findOne({ id: roomId });
      if (!current) return null;
      const template = getRetroTemplate(current.template);
      const normalized = normalizeColumnColors(colors, template);
      if (normalized.some((color, index) => color !== colors[index])) {
        return null;
      }
      const room = await RoomModel.updateColumnColors(roomId, normalized);
      return room ? this.convertToRoom(room) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updateRoomFeatures(roomId: string, features: Partial<RoomFeatures>): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const current = await RoomModel.findOne({ id: roomId });
      if (!current) return null;
      const merged = normalizeRoomFeatures({ ...current.features, ...features });
      const room = await RoomModel.updateRoomFeatures(roomId, merged);
      return room ? this.convertToRoom(room) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async validatePassword(roomId: string, password?: string): Promise<boolean> {
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) return false;
    if (!room.hasPassword) return true;
    const provided = password?.trim() || '';
    if (!provided) return false;
    return bcrypt.compare(provided, room.password);
  }

  static async findExistingUser(roomId: string, username: string): Promise<User | null> {
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) return null;
    
    const existingUser = room.users.find(user => user.name === username);
    if (existingUser) {
            return {
        ...existingUser,
        role: existingUser.role || 'user' as const
      };
    }
    return null;
  }

  static async addUser(roomId: string, user: User): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;

      const existingUser = await this.findExistingUser(roomId, user.name);
    
      if (existingUser) {
        const userWithRole = { 
          ...user, 
          role: existingUser.role || 'user' as const
        };
      
            
        const updatedRoom = await RoomModel.rebindUser(
          roomId,
          { name: user.name },
          { id: user.id, role: userWithRole.role }
        );
        return updatedRoom ? this.convertToRoom(updatedRoom) : null;
      }

      const userWithRole = { 
        ...user, 
        role: 'user' as const
      };
    
          const updatedRoom = await RoomModel.insertRoomUser(roomId, userWithRole);
      return updatedRoom ? this.convertToRoom(updatedRoom) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async removeUser(
    roomId: string,
    userId: string,
    userName?: string,
    preferUserNames?: string[]
  ): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;

      let leaveIndex = room.users.findIndex((user) => user.id === userId);
      let resolvedUserId = userId;
      if (leaveIndex === -1 && userName) {
        leaveIndex = room.users.findIndex((user) => user.name === userName);
        if (leaveIndex !== -1) {
          resolvedUserId = room.users[leaveIndex].id;
        }
      }
      if (leaveIndex === -1) return this.convertToRoom(room);

      const leavingUser = room.users[leaveIndex];
      const wasAdmin = this.isRoomAdmin(leavingUser, room.owner);
      const remainingUsers = room.users.filter((user) => user.id !== resolvedUserId);

      const updatedRoom = await RoomModel.deleteRoomUser(roomId, resolvedUserId);
      if (!updatedRoom) return null;

      if (wasAdmin && remainingUsers.length > 0) {
        const preferredNames = new Set(preferUserNames ?? []);
        const preferredAdmin = remainingUsers.find((user) => preferredNames.has(user.name));
        const nextAdminId = preferredAdmin?.id
          ?? await RoomModel.getNextRoomAdminUserId(roomId, resolvedUserId);
        if (nextAdminId) {
          const roomWithAdmin = await RoomModel.setRoomAdmin(roomId, nextAdminId);
          return roomWithAdmin ? this.convertToRoom(roomWithAdmin) : this.convertToRoom(updatedRoom);
        }
      }

      const healedRoom = await this.ensureRoomHasAdmin(roomId);
      return healedRoom ? this.convertToRoom(healedRoom) : this.convertToRoom(updatedRoom);
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async transferRoomAdmin(
    roomId: string,
    actorUserId: string,
    targetUserId: string,
    actorUserName?: string
  ): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;

      const actor = room.users.find((user) => user.id === actorUserId)
        ?? (actorUserName ? room.users.find((user) => user.name === actorUserName) : undefined);
      const target = room.users.find((user) => user.id === targetUserId);
      if (!actor || !this.isRoomAdmin(actor, room.owner) || !target || target.id === actor.id) {
        return null;
      }

      const updatedRoom = await RoomModel.setRoomAdmin(roomId, targetUserId);
      return updatedRoom ? this.convertToRoom(updatedRoom) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async addCard(roomId: string, card: Card): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    const stamp = RoomCache.generation(roomId);
    try {
      const room = await RoomModel.insertCard(roomId, card);
      const converted = room ? this.convertToRoom(room) : null;
      if (converted) RoomCache.set(roomId, converted, stamp);
      return converted;
    } catch (error) {
      RoomCache.invalidate(roomId);
      throw error;
    }
}

  static async updateCard(roomId: string, cardId: string, updates: Partial<Card>): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    const stamp = RoomCache.generation(roomId);
    try {
      const room = await RoomModel.patchCard(roomId, cardId, updates);
      const converted = room ? this.convertToRoom(room) : null;
      if (converted) RoomCache.set(roomId, converted, stamp);
      return converted;
    } catch (error) {
      RoomCache.invalidate(roomId);
      throw error;
    }
}

  static async deleteCard(roomId: string, cardId: string): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    const stamp = RoomCache.generation(roomId);
    try {
      await deleteCardMedia(roomId, cardId);
      const room = await RoomModel.deleteCardById(roomId, cardId);
      const converted = room ? this.convertToRoom(room) : null;
      if (converted) RoomCache.set(roomId, converted, stamp);
      return converted;
    } catch (error) {
      RoomCache.invalidate(roomId);
      throw error;
    }
}

  static async deleteAllCards(roomId: string): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      await deleteRoomCardMedia(roomId);
      await RoomModel.deleteAllCards(roomId);
      const room = await RoomModel.findOne({ id: roomId });
      return room ? this.convertToRoom(room) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async mergeCards(roomId: string, targetCardId: string, sourceCardId: string): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const current = await RoomModel.findOne({ id: roomId });
      const targetCard = current?.cards.find((card) => card.id === targetCardId);
      const sourceCard = current?.cards.find((card) => card.id === sourceCardId);
      if (sourceCard?.imageUrl && !targetCard?.imageUrl) {
        await reassignCardMedia(roomId, sourceCardId, targetCardId);
      } else {
        await deleteCardMedia(roomId, sourceCardId);
      }
      const room = await RoomModel.mergeCards(roomId, targetCardId, sourceCardId);
      return room ? this.convertToRoom(room) : null;
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async addCardComment(
    roomId: string,
    cardId: string,
    userId: string,
    userName: string,
    text: string
  ): Promise<{ card: Card; comment: CardComment } | null> {
    RoomCache.invalidate(roomId);
    try {
      const trimmed = text.trim();
      if (!trimmed) return null;

      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;
      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card) return null;

      const comment = await RoomModel.addCardComment({
        id: crypto.randomUUID(),
        cardId,
        userId,
        userName,
        text: trimmed,
        createdAt: new Date().toISOString()
      });

      return {
        card: {
          ...card,
          comments: [...(card.comments || []), comment]
        },
        comment
      };
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updateCardComment(
    roomId: string,
    cardId: string,
    commentId: string,
    userId: string,
    text: string
  ): Promise<CardComment | null> {
    RoomCache.invalidate(roomId);
    try {
      const trimmed = text.trim();
      if (!trimmed || typeof commentId !== 'string' || !commentId) return null;

      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;
      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card) return null;

      return RoomModel.updateCardComment(cardId, commentId, userId, trimmed);
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async toggleCardReaction(
    roomId: string,
    cardId: string,
    userId: string,
    userName: string,
    emoji: string
  ): Promise<Card | null> {
    RoomCache.invalidate(roomId);
    try {
      if (!CARD_REACTION_EMOJIS.includes(emoji as typeof CARD_REACTION_EMOJIS[number])) {
        return null;
      }

      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;
      const card = room.cards.find((currentCard) => currentCard.id === cardId);
      if (!card) return null;

      const reactions = await RoomModel.toggleCardReaction(cardId, userId, userName, emoji);
      return {
        ...card,
        reactions
      };
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updatePhase(
    roomId: string,
    phase: Phase,
    userId: string,
    userName?: string
  ): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      // Получаем комнату и проверяем существование
      const room = await RoomModel.findOne({ id: roomId });
      if (!room) return null;

      let user = userName ? room.users.find(u => u.name === userName) : undefined;
      if (!user) {
        user = room.users.find(u => u.id === userId);
      }
      if (!user) return null;

      const hasAdminRole = user.role === 'admin';
      const isRoomOwner = user.name === room.owner;
      if (!hasAdminRole && !isRoomOwner) return null;

      const updatedRoom = await RoomModel.setPhase(roomId, phase);
      if (!updatedRoom) return null;
      return this.convertToRoom(updatedRoom);
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updateCardVotes(
    roomId: string, 
    cardId: string, 
    userId: string, 
    voteType: 'like' | 'dislike'
  ): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    const stamp = RoomCache.generation(roomId);
    try {
      // Fetch current room to inspect existing votes
      const current = await RoomModel.findOne({ id: roomId });
      if (!current) return null;
      const card = current.cards.find(c => c.id === cardId);
      if (!card) return null;

      const features = normalizeRoomFeatures(current.features);
      if (voteType === 'dislike' && !features.dislikesEnabled) {
        throw new Error('Дизлайки отключены в этой комнате');
      }

      const likesLimit = features.likesPerUser;
      const dislikesLimit = features.dislikesPerUser;

      const likesUsed = current.cards.reduce((acc, currentCard) => {
        return acc + ((currentCard.likes || []).includes(userId) ? 1 : 0);
      }, 0);
      const dislikesUsed = current.cards.reduce((acc, currentCard) => {
        return acc + ((currentCard.dislikes || []).includes(userId) ? 1 : 0);
      }, 0);

      const alreadyLiked = (card.likes || []).includes(userId);
      const alreadyDisliked = (card.dislikes || []).includes(userId);

      // Vote limits per user across the room.
      if (voteType === 'like' && !alreadyLiked) {
        const nextLikesUsed = likesUsed + 1;
        if (nextLikesUsed > likesLimit) {
          throw new Error(`Вы можете поставить не более ${likesLimit} лайков`);
        }
      }
      if (voteType === 'dislike' && !alreadyDisliked) {
        const nextDislikesUsed = dislikesUsed + 1;
        if (nextDislikesUsed > dislikesLimit) {
          throw new Error(`Вы можете поставить не более ${dislikesLimit} дизлайков`);
        }
      }

      // If user clicks the same vote again → toggle off (remove only)
      if ((voteType === 'like' && alreadyLiked) || (voteType === 'dislike' && alreadyDisliked)) {
        await RoomModel.setCardVote(cardId, userId, null);
      } else {
        await RoomModel.setCardVote(cardId, userId, voteType);
      }
      const updated = await RoomModel.findOne({ id: roomId });
      const converted = updated ? this.convertToRoom(updated) : null;
      if (converted) RoomCache.set(roomId, converted, stamp);
      return converted;
    } catch (error) {
      RoomCache.invalidate(roomId);
      throw error;
    }
}

  static async deleteRoom(roomId: string): Promise<void> {
    RoomCache.invalidate(roomId);
    try {
      await deleteRoomMedia(roomId);
      await RoomModel.deleteOne({ id: roomId });
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async getAllRooms(teamId?: string): Promise<Room[]> {
    const rooms = await RoomModel.find(teamId ? { teamId } : undefined);
    return rooms.map(room => this.convertToRoom(room));
  }

  static async getAvailableRoomSummaries(teamId?: string) {
    return RoomModel.listSummaries(teamId ? { teamId } : undefined);
  }

  static async restoreSession(
    roomId: string,
    userId: string,
    newSocketId: string,
    username?: string
  ): Promise<{ room: Room | null, user: User | null }> {
    RoomCache.invalidate(roomId);
    try {
      const room = await RoomModel.findOne({ id: roomId });
      if (!room) {
              return { room: null, user: null };
      }

      let existingUser = room.users.find(user => user.id === userId);
      if (!existingUser && username) {
        existingUser = room.users.find(user => user.name === username);
      }
      if (!existingUser) {
              return { room: null, user: null };
      }

      const resolvedUser = existingUser;

          const role = resolvedUser.role || 'user' as const;

          // Update socket ID and role for the existing user
      const updatedRoom = await RoomModel.rebindUser(
        roomId,
        { name: resolvedUser.name },
        { id: newSocketId, role }
      );

      if (!updatedRoom) {
              return { room: null, user: null };
      }

      const healedRoom = await this.ensureRoomHasAdmin(roomId);
      const roomDoc = healedRoom ?? updatedRoom;
      const convertedRoom = this.convertToRoom(roomDoc);
          const convertedUser = convertedRoom.users.find((user) => user.name === resolvedUser.name);

      return {
        room: convertedRoom,
        user: convertedUser
          ? { ...convertedUser, id: newSocketId }
          : {
              id: newSocketId,
              name: resolvedUser.name,
              roomId,
              role
            }
      };
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updateUserReadyState(
    roomId: string,
    userId: string,
    isReady: boolean,
    userName?: string
  ): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      let room: RoomDocument | null = null;

      if (userName) {
        room = await RoomModel.rebindUser(roomId, { name: userName }, { isReady, id: userId });
      }

      if (!room) {
        room = await RoomModel.rebindUser(roomId, { id: userId }, { isReady });
      }

      if (!room) {
              return null;
      }

          return this.convertToRoom(room);
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async resetUsersReadyState(roomId: string): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
        
      const room = await RoomModel.resetReady(roomId);

      if (!room) {
              return null;
      }

          return this.convertToRoom(room);
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  static async updateUserMood(roomId: string, userId: string, mood: User['mood']): Promise<Room | null> {
    RoomCache.invalidate(roomId);
    try {
      const room = await RoomModel.rebindUser(roomId, { id: userId }, { mood });

      if (!room) return null;
      return this.convertToRoom(room);
      } finally {
      RoomCache.invalidate(roomId);
    }
}

  private static convertToRoom(doc: RoomDocument): Room {
    const { id, teamId, owner, phase, columnColors, createdAt, users, cards } = doc;
    const template = getRetroTemplate(doc.template);
    const features = normalizeRoomFeatures(doc.features);
    const hasAdmin = Boolean(users?.some((user) => user.role === 'admin'));
        
    const convertedRoom = {
      id,
      teamId,
      owner,
      phase,
      template: template.id,
      columnTitles: doc.columnTitles,
      columnColors: normalizeColumnColors(columnColors, template),
      features,
      createdAt,
      users: users ? users.map(user => ({
        id: user.id,
        name: user.name,
        roomId: id,
        role: user.role === 'admin' || (!hasAdmin && user.name === owner) ? ('admin' as const) : ('user' as const),
        isReady: user.isReady,
        mood: user.mood
      })) : [],
      cards: cards || []
    };

        return convertedRoom;
  }
} 