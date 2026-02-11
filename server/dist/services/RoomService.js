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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const PRIORITY_ADMIN_NAME = 'Коваль Ангелина Константиновна';
class RoomService {
    static createRoom(roomId, password, owner, username) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
            const user = {
                id: owner,
                name: username,
                roomId,
                role: 'admin',
                isReady: false
            };
            console.log('Creating room with admin user:', user);
            const room = yield Room_1.RoomModel.create({
                id: roomId,
                password: hashedPassword,
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
    static validatePassword(roomId, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return false;
            return bcryptjs_1.default.compare(password, room.password);
        });
    }
    static findExistingUser(roomId, username) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const existingUser = room.users.find(user => user.name === username);
            if (existingUser) {
                const adminName = this.getAdminName(room.owner, room.users.map((user) => user.name));
                console.log('Found existing user check:', {
                    username,
                    adminName,
                    roomOwner: room.owner
                });
                return Object.assign(Object.assign({}, existingUser), { role: username === adminName ? 'admin' : 'user' });
            }
            return null;
        });
    }
    static addUser(roomId, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room)
                return null;
            const userNamesAfterJoin = Array.from(new Set([...room.users.map((existingUser) => existingUser.name), user.name]));
            const adminName = this.getAdminName(room.owner, userNamesAfterJoin);
            const existingUser = yield this.findExistingUser(roomId, user.name);
            if (existingUser) {
                const userWithRole = Object.assign(Object.assign({}, user), { role: user.name === adminName ? 'admin' : 'user' });
                console.log('Updating existing user:', {
                    user: userWithRole,
                    adminName
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
            const userWithRole = Object.assign(Object.assign({}, user), { role: user.name === adminName ? 'admin' : 'user' });
            console.log('Adding new user:', {
                user: userWithRole,
                adminName,
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
            const room = yield Room_1.RoomModel.findOneAndUpdate({ id: roomId }, {
                $pull: { users: { id: userId } }
            }, { new: true });
            return room ? this.convertToRoom(room) : null;
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
    static updatePhase(roomId, phase, userId, userName) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Attempting to update phase:', { roomId, phase, userId });
            // Получаем комнату и проверяем существование
            const room = yield Room_1.RoomModel.findOne({ id: roomId });
            if (!room) {
                console.log('Room not found for phase update');
                return null;
            }
            // Находим пользователя по id, иначе по имени (на случай смены socket.id)
            let user = room.users.find(u => u.id === userId);
            if (!user && userName) {
                user = room.users.find(u => u.name === userName);
            }
            if (!user) {
                console.log('User not found for phase update:', { userId, userName, availableUsers: room.users });
                return null;
            }
            const adminName = this.getAdminName(room.owner, room.users.map((roomUser) => roomUser.name));
            const hasAdminRole = user.name === adminName;
            console.log('Checking phase update permissions:', {
                userName: user.name,
                userRole: user.role,
                adminName,
                hasAdminRole,
                currentPhase: room.phase,
                requestedPhase: phase
            });
            if (!hasAdminRole) {
                console.log('Permission denied: user is not admin');
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
    static getAllRooms() {
        return __awaiter(this, void 0, void 0, function* () {
            const rooms = yield Room_1.RoomModel.find();
            return rooms.map(room => this.convertToRoom(room));
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
            const adminName = this.getAdminName(room.owner, room.users.map((roomUser) => roomUser.name));
            const role = existingUser.name === adminName ? 'admin' : 'user';
            console.log('Role determination during restore:', {
                username: existingUser.name,
                adminName,
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
    static convertToRoom(doc) {
        const { id, owner, phase, createdAt, users, cards } = doc;
        const adminName = this.getAdminName(owner, (users || []).map((user) => user.name));
        console.log('Converting room document:', {
            owner,
            adminName,
            originalUsers: users === null || users === void 0 ? void 0 : users.map(u => ({ name: u.name, role: u.role }))
        });
        const convertedRoom = {
            id,
            owner,
            phase,
            createdAt,
            users: users ? users.map(user => ({
                id: user.id,
                name: user.name,
                roomId: id,
                role: user.name === adminName ? 'admin' : 'user',
                isReady: user.isReady
            })) : [],
            cards: cards || []
        };
        console.log('Room conversion result:', {
            convertedUsers: convertedRoom.users.map(u => ({ name: u.name, role: u.role }))
        });
        return convertedRoom;
    }
    static getAdminName(roomOwner, userNames) {
        return userNames.includes(PRIORITY_ADMIN_NAME) ? PRIORITY_ADMIN_NAME : roomOwner;
    }
}
exports.RoomService = RoomService;
