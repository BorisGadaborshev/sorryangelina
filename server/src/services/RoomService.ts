import { RoomModel } from '../models/Room';
import { Room, RoomDocument, User, Card, Phase, CreateRoomOptions } from '../types';
import bcrypt from 'bcryptjs';

export class RoomService {
  static async createRoom(roomId: string, password: string, owner: string, username: string, options: CreateRoomOptions = {}): Promise<Room> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = {
      id: owner,
      name: username,
      roomId,
      role: options.userRole || 'user',
      isReady: false
    };
    
    console.log('Creating room:', {
      roomId,
      teamId: options.teamId,
      owner: username,
      user
    });
    
    const room = await RoomModel.create({
      id: roomId,
      password: hashedPassword,
      teamId: options.teamId,
      owner: username,
      phase: 'creation',
      users: [user],
      cards: []
    });

    const convertedRoom = this.convertToRoom(room);
    console.log('Room created and converted:', {
      originalUsers: room.users,
      convertedUsers: convertedRoom.users
    });

    return convertedRoom;
  }

  static async getRoom(roomId: string): Promise<Room | null> {
    const room = await RoomModel.findOne({ id: roomId });
    return room ? this.convertToRoom(room) : null;
  }

  static async validatePassword(roomId: string, password: string): Promise<boolean> {
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) return false;
    return bcrypt.compare(password, room.password);
  }

  static async findExistingUser(roomId: string, username: string): Promise<User | null> {
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) return null;
    
    const existingUser = room.users.find(user => user.name === username);
    if (existingUser) {
      console.log('Found existing user check:', { 
        username,
        role: existingUser.role,
        roomOwner: room.owner
      });

      return {
        ...existingUser,
        role: existingUser.role || 'user' as const
      };
    }
    return null;
  }

  static async addUser(roomId: string, user: User): Promise<Room | null> {
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) return null;

    const existingUser = await this.findExistingUser(roomId, user.name);
    
    if (existingUser) {
      const userWithRole = { 
        ...user, 
        role: existingUser.role || 'user' as const
      };
      
      console.log('Updating existing user:', {
        user: userWithRole
      });
      
      const updatedRoom = await RoomModel.findOneAndUpdate(
        { 
          id: roomId,
          'users.name': user.name 
        },
        { 
          $set: { 
            'users.$.id': user.id,
            'users.$.role': userWithRole.role
          }
        },
        { new: true }
      );
      return updatedRoom ? this.convertToRoom(updatedRoom) : null;
    }

    const userWithRole = { 
      ...user, 
      role: 'user' as const
    };
    
    console.log('Adding new user:', {
      user: userWithRole,
      existingUsersCount: room.users.length
    });

    const updatedRoom = await RoomModel.findOneAndUpdate(
      { id: roomId },
      { 
        $addToSet: { users: userWithRole }
      },
      { new: true }
    );
    return updatedRoom ? this.convertToRoom(updatedRoom) : null;
  }

  static async removeUser(roomId: string, userId: string): Promise<Room | null> {
    const room = await RoomModel.findOneAndUpdate(
      { id: roomId },
      { 
        $pull: { users: { id: userId } }
      },
      { new: true }
    );
    return room ? this.convertToRoom(room) : null;
  }

  static async addCard(roomId: string, card: Card): Promise<Room | null> {
    const room = await RoomModel.findOneAndUpdate(
      { id: roomId },
      { 
        $push: { cards: card }
      },
      { new: true }
    );
    return room ? this.convertToRoom(room) : null;
  }

  static async updateCard(roomId: string, cardId: string, updates: Partial<Card>): Promise<Room | null> {
    const room = await RoomModel.findOneAndUpdate(
      { 
        id: roomId,
        'cards.id': cardId
      },
      { 
        $set: Object.entries(updates).reduce((acc, [key, value]) => ({
          ...acc,
          [`cards.$.${key}`]: value
        }), {})
      },
      { new: true }
    );
    return room ? this.convertToRoom(room) : null;
  }

  static async deleteCard(roomId: string, cardId: string): Promise<Room | null> {
    const room = await RoomModel.findOneAndUpdate(
      { id: roomId },
      { 
        $pull: { cards: { id: cardId } }
      },
      { new: true }
    );
    return room ? this.convertToRoom(room) : null;
  }

  static async updatePhase(
    roomId: string,
    phase: Phase,
    userId: string,
    userName?: string
  ): Promise<Room | null> {
    console.log('Attempting to update phase:', { roomId, phase, userId });
    
    // Получаем комнату и проверяем существование
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) {
      console.log('Room not found for phase update');
      return null;
    }

    // Находим пользователя по имени, иначе по id (на случай смены socket.id)
    let user = userName ? room.users.find(u => u.name === userName) : undefined;
    if (!user) {
      user = room.users.find(u => u.id === userId);
    }

    if (!user) {
      console.log('User not found for phase update:', { userId, userName, availableUsers: room.users });
      return null;
    }

    const hasAdminRole = user.role === 'admin';
    const isRoomOwner = user.name === room.owner;

    console.log('Checking phase update permissions:', {
      userName: user.name,
      userRole: user.role,
      hasAdminRole,
      isRoomOwner,
      currentPhase: room.phase,
      requestedPhase: phase
    });

    if (!hasAdminRole && !isRoomOwner) {
      console.log('Permission denied: user is not admin or room owner');
      return null;
    }

    // Обновляем фазу
    const updatedRoom = await RoomModel.findOneAndUpdate(
      { id: roomId },
      { $set: { phase } },
      { new: true }
    );

    if (!updatedRoom) {
      console.log('Failed to update room phase');
      return null;
    }

    console.log('Phase updated successfully:', {
      newPhase: updatedRoom.phase,
      roomId: updatedRoom.id
    });

    return this.convertToRoom(updatedRoom);
  }

  static async updateCardVotes(
    roomId: string, 
    cardId: string, 
    userId: string, 
    voteType: 'like' | 'dislike'
  ): Promise<Room | null> {
    // Fetch current room to inspect existing votes
    const current = await RoomModel.findOne({ id: roomId });
    if (!current) return null;
    const card = current.cards.find(c => c.id === cardId);
    if (!card) return null;

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
      if (nextLikesUsed > 3) {
        throw new Error('Вы можете поставить не более 3 лайков');
      }
    }
    if (voteType === 'dislike' && !alreadyDisliked) {
      const nextDislikesUsed = dislikesUsed + 1;
      if (nextDislikesUsed > 3) {
        throw new Error('Вы можете поставить не более 3 дизлайков');
      }
    }

    // If user clicks the same vote again → toggle off (remove only)
    if ((voteType === 'like' && alreadyLiked) || (voteType === 'dislike' && alreadyDisliked)) {
      await RoomModel.updateOne(
        { id: roomId, 'cards.id': cardId },
        { 
          $pull: {
            [`cards.$.${voteType}s`]: userId
          }
        }
      );
      const updated = await RoomModel.findOne({ id: roomId });
      return updated ? this.convertToRoom(updated) : null;
    }

    // Otherwise switch the vote: remove from both, then add chosen
    await RoomModel.updateOne(
      { id: roomId, 'cards.id': cardId },
      { 
        $pull: {
          'cards.$.likes': userId,
          'cards.$.dislikes': userId
        }
      }
    );

    const room = await RoomModel.findOneAndUpdate(
      { id: roomId, 'cards.id': cardId },
      { 
        $addToSet: {
          [`cards.$.${voteType}s`]: userId
        }
      },
      { new: true }
    );
    return room ? this.convertToRoom(room) : null;
  }

  static async deleteRoom(roomId: string): Promise<void> {
    await RoomModel.deleteOne({ id: roomId });
  }

  static async getAllRooms(teamId?: string): Promise<Room[]> {
    const rooms = await RoomModel.find(teamId ? { teamId } : undefined);
    return rooms.map(room => this.convertToRoom(room));
  }

  static async restoreSession(roomId: string, userId: string, newSocketId: string): Promise<{ room: Room | null, user: User | null }> {
    console.log('Starting session restoration:', { roomId, userId, newSocketId });
    const room = await RoomModel.findOne({ id: roomId });
    if (!room) {
      console.log('Room not found during session restoration');
      return { room: null, user: null };
    }

    const existingUser = room.users.find(user => user.id === userId);
    if (!existingUser) {
      console.log('User not found during session restoration');
      return { room: null, user: null };
    }

    console.log('Found existing user:', existingUser);

    const role = existingUser.role || 'user' as const;

    console.log('Role determination during restore:', {
      username: existingUser.name,
      assignedRole: role,
      currentRole: existingUser.role
    });

    // Update socket ID and role for the existing user
    const updatedRoom = await RoomModel.findOneAndUpdate(
      { 
        id: roomId,
        'users.id': userId 
      },
      { 
        $set: { 
          'users.$.id': newSocketId,
          'users.$.role': role
        }
      },
      { new: true }
    );

    if (!updatedRoom) {
      console.log('Failed to update room during session restoration');
      return { room: null, user: null };
    }

    const updatedUser = {
      ...existingUser,
      id: newSocketId,
      role
    };

    console.log('Session restoration complete:', {
      user: updatedUser,
      userRole: updatedUser.role,
      roomUsers: updatedRoom.users.map(u => ({ name: u.name, role: u.role }))
    });

    const convertedRoom = this.convertToRoom(updatedRoom);
    console.log('Converted room after restoration:', {
      users: convertedRoom.users.map(u => ({ name: u.name, role: u.role }))
    });

    return {
      room: convertedRoom,
      user: updatedUser
    };
  }

  static async clearDatabase(): Promise<void> {
    await RoomModel.deleteMany();
    console.log('Database cleared successfully');
  }

  static async updateUserReadyState(roomId: string, userId: string, isReady: boolean): Promise<Room | null> {
    console.log('Updating user ready state:', { roomId, userId, isReady });
    
    const room = await RoomModel.findOneAndUpdate(
      { 
        id: roomId,
        'users.id': userId 
      },
      { 
        $set: { 
          'users.$.isReady': isReady 
        }
      },
      { new: true }
    );

    if (!room) {
      console.log('Room or user not found while updating ready state');
      return null;
    }

    console.log('User ready state updated:', {
      userId,
      isReady,
      allUsers: room.users.map(u => ({ name: u.name, isReady: u.isReady }))
    });

    return this.convertToRoom(room);
  }

  static async resetUsersReadyState(roomId: string): Promise<Room | null> {
    console.log('Resetting ready states for room:', roomId);
    
    const room = await RoomModel.findOneAndUpdate(
      { id: roomId },
      { 
        $set: { 
          'users.$[].isReady': false 
        }
      },
      { new: true }
    );

    if (!room) {
      console.log('Room not found while resetting ready states');
      return null;
    }

    console.log('Ready states reset for room:', {
      roomId,
      users: room.users.map(u => ({ name: u.name, isReady: u.isReady }))
    });

    return this.convertToRoom(room);
  }

  static async updateUserMood(roomId: string, userId: string, mood: User['mood']): Promise<Room | null> {
    const room = await RoomModel.findOneAndUpdate(
      {
        id: roomId,
        'users.id': userId
      },
      {
        $set: {
          'users.$.mood': mood
        }
      },
      { new: true }
    );

    if (!room) return null;
    return this.convertToRoom(room);
  }

  private static convertToRoom(doc: RoomDocument): Room {
    const { id, teamId, owner, phase, createdAt, users, cards } = doc;
    const hasAdmin = Boolean(users?.some((user) => user.role === 'admin'));
    console.log('Converting room document:', {
      teamId,
      owner,
      hasAdmin,
      originalUsers: users?.map(u => ({ name: u.name, role: u.role }))
    });
    
    const convertedRoom = {
      id,
      teamId,
      owner,
      phase,
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

    console.log('Room conversion result:', {
      convertedUsers: convertedRoom.users.map(u => ({ name: u.name, role: u.role }))
    });

    return convertedRoom;
  }
} 