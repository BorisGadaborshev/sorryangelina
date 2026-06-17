"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const Room_1 = require("../models/Room");
const types_1 = require("../types");
const roomFeatures_1 = require("../utils/roomFeatures");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const NO_ROOM_PASSWORD_MARKER = '__no_room_password__';
class RoomService {
    static createRoom(roomId, password, owner, username, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedPassword = (password === null || password === void 0 ? void 0 : password.trim()) || '';
            const hashSource = normalizedPassword || NO_ROOM_PASSWORD_MARKER;
            const hashedPassword = yield bcryptjs_1.default.hash(hashSource, 10);
            const user = {
                id: owner,
                name: username,
                roomId,
                role: 'admin',
                isReady: false
            };
            console.log('Creating room:', {
                roomId,
                teamId: options.teamId,
                owner: username,
                user
            });
            const room = yield Room_1.RoomModel.create({
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
        });
    }
    static getRoom(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            return room ? this.convertToRoom(room) : null;
        });
    }
    static updateColumnTitles(roomId, titles) {
        return __awaiter(this, void 0, void 0, function* () {
            if (titles.length !== types_1.COLUMN_COUNT || titles.some((title) => !title.trim())) {
                return null;
            }
            const normalized = titles.map((title) => title.trim());
            const room = yield Room_1.RoomModel.updateColumnTitles(roomId, normalized);
            return room ? this.convertToRoom(room) : null;
        });
    }
    static updateRoomFeatures(roomId, features) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!current)
                return null;
            const merged = (0, roomFeatures_1.normalizeRoomFeatures)(Object.assign(Object.assign({}, current.features), features));
            const room = yield Room_1.RoomModel.updateRoomFeatures(roomId, merged);
            return room ? this.convertToRoom(room) : null;
        });
    }
    static validatePassword(roomId, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return false;
            const isOpenRoom = (yield this.roomHasPassword(room.password)) === false;
            if (isOpenRoom)
                return true;
            const provided = (password === null || password === void 0 ? void 0 : password.trim()) || '';
            if (!provided)
                return false;
            return bcryptjs_1.default.compare(provided, room.password);
        });
    }
    static roomHasPassword(hashedPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            return !(yield bcryptjs_1.default.compare(NO_ROOM_PASSWORD_MARKER, hashedPassword));
        });
    }
    static findExistingUser(roomId, username) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const existingUser = room.users.find(user => user.name === username);
            if (existingUser) {
                console.log('Found existing user check:', {
                    username,
                    role: existingUser.role,
                    roomOwner: room.owner
                });
                return Object.assign(Object.assign({}, existingUser), { role: existingUser.role || 'user' });
            }
            return null;
        });
    }
    static addUser(roomId, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const existingUser = yield this.findExistingUser(roomId, user.name);
            if (existingUser) {
                const userWithRole = Object.assign(Object.assign({}, user), { role: existingUser.role || 'user' });
                console.log('Updating existing user:', {
                    user: userWithRole
                });
                const updatedRoom = yield Room_1.RoomModel.findOneAndUpdate({
                    id: roomId,
                    'users.name': user.name
                }, {
                    $set: {
                        'users.$.id': user.id,
                        'users.$.role': userWithRole.role
                    }
                }, { new: true });
                return updatedRoom ? this.convertToRoom(updatedRoom) : null;
            }
            const userWithRole = Object.assign(Object.assign({}, user), { role: 'user' });
            console.log('Adding new user:', {
                user: userWithRole,
                existingUsersCount: room.users.length
            });
            const updatedRoom = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, {
                $addToSet: { users: userWithRole }
            }, { new: true });
            return updatedRoom ? this.convertToRoom(updatedRoom) : null;
        });
    }
    static removeUser(roomId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const leaveIndex = room.users.findIndex((user) => user.id === userId);
            if (leaveIndex === -1)
                return this.convertToRoom(room);
            const wasAdmin = room.users[leaveIndex].role === 'admin';
            const remainingUsers = room.users.filter((user) => user.id !== userId);
            const updatedRoom = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, {
                $pull: { users: { id: userId } }
            }, { new: true });
            if (!updatedRoom)
                return null;
            if (wasAdmin && remainingUsers.length > 0) {
                const nextIndex = leaveIndex < remainingUsers.length ? leaveIndex : 0;
                const nextAdminId = remainingUsers[nextIndex].id;
                const roomWithAdmin = yield Room_1.RoomModel.setRoomAdmin(roomId, nextAdminId);
                return roomWithAdmin ? this.convertToRoom(roomWithAdmin) : this.convertToRoom(updatedRoom);
            }
            return this.convertToRoom(updatedRoom);
        });
    }
    static transferRoomAdmin(roomId, actorUserId, targetUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const actor = room.users.find((user) => user.id === actorUserId);
            const target = room.users.find((user) => user.id === targetUserId);
            if (!actor || actor.role !== 'admin' || !target || target.id === actorUserId) {
                return null;
            }
            const updatedRoom = yield Room_1.RoomModel.setRoomAdmin(roomId, targetUserId);
            return updatedRoom ? this.convertToRoom(updatedRoom) : null;
        });
    }
    static addCard(roomId, card) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, {
                $push: { cards: card }
            }, { new: true });
            return room ? this.convertToRoom(room) : null;
        });
    }
    static updateCard(roomId, cardId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOneAndUpdate({
                id: roomId,
                'cards.id': cardId
            }, {
                $set: Object.entries(updates).reduce((acc, [key, value]) => (Object.assign(Object.assign({}, acc), { [`cards.$.${key}`]: value })), {})
            }, { new: true });
            return room ? this.convertToRoom(room) : null;
        });
    }
    static deleteCard(roomId, cardId) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, {
                $pull: { cards: { id: cardId } }
            }, { new: true });
            return room ? this.convertToRoom(room) : null;
        });
    }
    static addCardComment(roomId, cardId, userId, userName, text) {
        return __awaiter(this, void 0, void 0, function* () {
            const trimmed = text.trim();
            if (!trimmed)
                return null;
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const card = room.cards.find((currentCard) => currentCard.id === cardId);
            if (!card)
                return null;
            const comment = yield Room_1.RoomModel.addCardComment({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                cardId,
                userId,
                userName,
                text: trimmed,
                createdAt: new Date().toISOString()
            });
            return {
                card: Object.assign(Object.assign({}, card), { comments: [...(card.comments || []), comment] }),
                comment
            };
        });
    }
    static toggleCardReaction(roomId, cardId, userId, userName, emoji) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!types_1.CARD_REACTION_EMOJIS.includes(emoji)) {
                return null;
            }
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const card = room.cards.find((currentCard) => currentCard.id === cardId);
            if (!card)
                return null;
            const reactions = yield Room_1.RoomModel.toggleCardReaction(cardId, userId, userName, emoji);
            return Object.assign(Object.assign({}, card), { reactions });
        });
    }
    static updatePhase(roomId, phase, userId, userName) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Attempting to update phase:', { roomId, phase, userId });
            // Получаем комнату и проверяем существование
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
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
            const updatedRoom = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, { $set: { phase } }, { new: true });
            if (!updatedRoom) {
                console.log('Failed to update room phase');
                return null;
            }
            console.log('Phase updated successfully:', {
                newPhase: updatedRoom.phase,
                roomId: updatedRoom.id
            });
            return this.convertToRoom(updatedRoom);
        });
    }
    static updateCardVotes(roomId, cardId, userId, voteType) {
        return __awaiter(this, void 0, void 0, function* () {
            // Fetch current room to inspect existing votes
            const current = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!current)
                return null;
            const card = current.cards.find(c => c.id === cardId);
            if (!card)
                return null;
            const features = (0, roomFeatures_1.normalizeRoomFeatures)(current.features);
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
                yield Room_1.RoomModel.updateOne({ id: roomId, 'cards.id': cardId }, {
                    $pull: {
                        [`cards.$.${voteType}s`]: userId
                    }
                });
                const updated = yield Room_1.RoomModel.findOne({ id: roomId });
                return updated ? this.convertToRoom(updated) : null;
            }
            // Otherwise switch the vote: remove from both, then add chosen
            yield Room_1.RoomModel.updateOne({ id: roomId, 'cards.id': cardId }, {
                $pull: {
                    'cards.$.likes': userId,
                    'cards.$.dislikes': userId
                }
            });
            const room = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId, 'cards.id': cardId }, {
                $addToSet: {
                    [`cards.$.${voteType}s`]: userId
                }
            }, { new: true });
            return room ? this.convertToRoom(room) : null;
        });
    }
    static deleteRoom(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Room_1.RoomModel.deleteOne({ id: roomId });
        });
    }
    static getAllRooms(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            const rooms = yield Room_1.RoomModel.find(teamId ? { teamId } : undefined);
            return rooms.map(room => this.convertToRoom(room));
        });
    }
    static getAvailableRoomSummaries(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            const rooms = yield Room_1.RoomModel.find(teamId ? { teamId } : undefined);
            return Promise.all(rooms.map((room) => __awaiter(this, void 0, void 0, function* () {
                const converted = this.convertToRoom(room);
                return {
                    id: converted.id,
                    teamId: converted.teamId,
                    usersCount: converted.users.length,
                    phase: converted.phase,
                    owner: converted.owner,
                    createdAt: converted.createdAt,
                    hasPassword: yield this.roomHasPassword(room.password)
                };
            })));
        });
    }
    static restoreSession(roomId, userId, newSocketId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Starting session restoration:', { roomId, userId, newSocketId });
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
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
            const role = existingUser.role || 'user';
            console.log('Role determination during restore:', {
                username: existingUser.name,
                assignedRole: role,
                currentRole: existingUser.role
            });
            // Update socket ID and role for the existing user
            const updatedRoom = yield Room_1.RoomModel.findOneAndUpdate({
                id: roomId,
                'users.id': userId
            }, {
                $set: {
                    'users.$.id': newSocketId,
                    'users.$.role': role
                }
            }, { new: true });
            if (!updatedRoom) {
                console.log('Failed to update room during session restoration');
                return { room: null, user: null };
            }
            const updatedUser = Object.assign(Object.assign({}, existingUser), { id: newSocketId, role });
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
        });
    }
    static clearDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Room_1.RoomModel.deleteMany();
            console.log('Database cleared successfully');
        });
    }
    static updateUserReadyState(roomId, userId, isReady) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Updating user ready state:', { roomId, userId, isReady });
            const room = yield Room_1.RoomModel.findOneAndUpdate({
                id: roomId,
                'users.id': userId
            }, {
                $set: {
                    'users.$.isReady': isReady
                }
            }, { new: true });
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
        });
    }
    static resetUsersReadyState(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Resetting ready states for room:', roomId);
            const room = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, {
                $set: {
                    'users.$[].isReady': false
                }
            }, { new: true });
            if (!room) {
                console.log('Room not found while resetting ready states');
                return null;
            }
            console.log('Ready states reset for room:', {
                roomId,
                users: room.users.map(u => ({ name: u.name, isReady: u.isReady }))
            });
            return this.convertToRoom(room);
        });
    }
    static updateUserMood(roomId, userId, mood) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOneAndUpdate({
                id: roomId,
                'users.id': userId
            }, {
                $set: {
                    'users.$.mood': mood
                }
            }, { new: true });
            if (!room)
                return null;
            return this.convertToRoom(room);
        });
    }
    static convertToRoom(doc) {
        const { id, teamId, owner, phase, columnTitles, createdAt, users, cards } = doc;
        const features = (0, roomFeatures_1.normalizeRoomFeatures)(doc.features);
        const hasAdmin = Boolean(users === null || users === void 0 ? void 0 : users.some((user) => user.role === 'admin'));
        console.log('Converting room document:', {
            teamId,
            owner,
            hasAdmin,
            originalUsers: users === null || users === void 0 ? void 0 : users.map(u => ({ name: u.name, role: u.role }))
        });
        const convertedRoom = {
            id,
            teamId,
            owner,
            phase,
            columnTitles: doc.columnTitles,
            features,
            createdAt,
            users: users ? users.map(user => ({
                id: user.id,
                name: user.name,
                roomId: id,
                role: user.role === 'admin' || (!hasAdmin && user.name === owner) ? 'admin' : 'user',
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
exports.RoomService = RoomService;
