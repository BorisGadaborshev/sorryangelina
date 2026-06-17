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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomModel = void 0;
// Postgres access helpers
const database_1 = require("../config/database");
const types_1 = require("../types");
const attachSocialDataToCards = (cards) => __awaiter(void 0, void 0, void 0, function* () {
    if (cards.length === 0)
        return cards;
    const cardIds = cards.map((card) => card.id);
    const commentsRes = yield database_1.pool.query('select id, card_id, user_id, user_name, text, created_at from card_comments where card_id = any($1::text[]) order by created_at asc', [cardIds]);
    const reactionsRes = yield database_1.pool.query('select card_id, user_id, user_name, emoji from card_reactions where card_id = any($1::text[])', [cardIds]);
    const commentsByCard = new Map();
    for (const row of commentsRes.rows) {
        const entry = commentsByCard.get(row.card_id) || [];
        entry.push({
            id: row.id,
            cardId: row.card_id,
            userId: row.user_id,
            userName: row.user_name,
            text: row.text,
            createdAt: row.created_at
        });
        commentsByCard.set(row.card_id, entry);
    }
    const reactionsByCard = new Map();
    for (const row of reactionsRes.rows) {
        const entry = reactionsByCard.get(row.card_id) || [];
        entry.push({
            emoji: row.emoji,
            userId: row.user_id,
            userName: row.user_name
        });
        reactionsByCard.set(row.card_id, entry);
    }
    return cards.map((card) => (Object.assign(Object.assign({}, card), { comments: commentsByCard.get(card.id) || [], reactions: reactionsByCard.get(card.id) || [] })));
});
exports.RoomModel = {
    create(doc) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                yield client.query(`insert into rooms (id, password, team_id, owner, phase) values ($1,$2,$3,$4,$5)
         on conflict (id) do nothing`, [doc.id, doc.password, (_a = doc.teamId) !== null && _a !== void 0 ? _a : null, doc.owner, doc.phase]);
                for (const user of doc.users || []) {
                    yield client.query(`insert into room_users (id, name, room_id, role, is_ready, mood) values ($1,$2,$3,$4,$5,$6)
           on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`, [user.id, user.name, doc.id, user.role, (_b = user.isReady) !== null && _b !== void 0 ? _b : false, (_c = user.mood) !== null && _c !== void 0 ? _c : null]);
                }
                yield client.query('COMMIT');
                return doc;
            }
            catch (e) {
                yield client.query('ROLLBACK');
                throw e;
            }
            finally {
                client.release();
            }
        });
    },
    findOne(where) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query('select id, password, team_id, owner, phase, created_at, column_titles from rooms where id=$1', [where.id]);
            if (rows.length === 0)
                return null;
            const roomRow = rows[0];
            const usersRes = yield database_1.pool.query('select id, name, role, is_ready, mood from room_users where room_id=$1', [where.id]);
            const cardsRes = yield database_1.pool.query('select id, text, type, created_by, column_index, image_url from cards where room_id=$1', [where.id]);
            const cardRows = cardsRes.rows;
            const votesRes = yield database_1.pool.query('select card_id, user_id, vote from card_votes where card_id = any($1::text[])', [cardRows.map((r) => r.id)]);
            const cardIdToVotes = new Map();
            for (const v of votesRes.rows) {
                const entry = cardIdToVotes.get(v.card_id) || { likes: [], dislikes: [] };
                entry[v.vote === 'like' ? 'likes' : 'dislikes'].push(v.user_id);
                cardIdToVotes.set(v.card_id, entry);
            }
            const userRows = usersRes.rows;
            const users = userRows.map((r) => { var _a; return ({ id: r.id, name: r.name, roomId: roomRow.id, role: r.role, isReady: r.is_ready, mood: (_a = r.mood) !== null && _a !== void 0 ? _a : undefined }); });
            const cards = yield attachSocialDataToCards(cardRows.map((r) => {
                var _a, _b, _c;
                return ({
                    id: r.id,
                    text: r.text,
                    type: r.type,
                    createdBy: r.created_by,
                    likes: ((_a = cardIdToVotes.get(r.id)) === null || _a === void 0 ? void 0 : _a.likes) || [],
                    dislikes: ((_b = cardIdToVotes.get(r.id)) === null || _b === void 0 ? void 0 : _b.dislikes) || [],
                    column: r.column_index,
                    imageUrl: (_c = r.image_url) !== null && _c !== void 0 ? _c : undefined
                });
            }));
            return {
                id: roomRow.id,
                password: roomRow.password,
                teamId: (_a = roomRow.team_id) !== null && _a !== void 0 ? _a : undefined,
                owner: roomRow.owner,
                phase: roomRow.phase,
                columnTitles: Array.isArray(roomRow.column_titles) && roomRow.column_titles.length === types_1.COLUMN_COUNT
                    ? roomRow.column_titles
                    : undefined,
                createdAt: roomRow.created_at,
                users,
                cards
            };
        });
    },
    updateColumnTitles(roomId, titles) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('update rooms set column_titles=$1::jsonb, updated_at=now() where id=$2', [
                JSON.stringify(titles),
                roomId
            ]);
            return this.findOne({ id: roomId });
        });
    },
    addCardComment(comment) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('insert into card_comments (id, card_id, user_id, user_name, text) values ($1,$2,$3,$4,$5)', [comment.id, comment.cardId, comment.userId, comment.userName, comment.text]);
            const { rows } = yield database_1.pool.query('select id, card_id, user_id, user_name, text, created_at from card_comments where id=$1', [comment.id]);
            const row = rows[0];
            return {
                id: row.id,
                cardId: row.card_id,
                userId: row.user_id,
                userName: row.user_name,
                text: row.text,
                createdAt: row.created_at
            };
        });
    },
    getCardReactions(cardId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query('select card_id, user_id, user_name, emoji from card_reactions where card_id=$1', [cardId]);
            return rows.map((row) => ({
                emoji: row.emoji,
                userId: row.user_id,
                userName: row.user_name
            }));
        });
    },
    toggleCardReaction(cardId, userId, userName, emoji) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield database_1.pool.query('select 1 from card_reactions where card_id=$1 and user_id=$2 and emoji=$3', [cardId, userId, emoji]);
            if (existing.rows.length > 0) {
                yield database_1.pool.query('delete from card_reactions where card_id=$1 and user_id=$2 and emoji=$3', [cardId, userId, emoji]);
            }
            else {
                yield database_1.pool.query('insert into card_reactions (card_id, user_id, user_name, emoji) values ($1,$2,$3,$4)', [cardId, userId, userName, emoji]);
            }
            return this.getCardReactions(cardId);
        });
    },
    findOneAndUpdate(filter, update, options) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            const roomId = filter.id;
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                // Direct field updates (e.g., { phase })
                if (typeof update.phase !== 'undefined') {
                    yield client.query('update rooms set phase=$1, updated_at=now() where id=$2', [update.phase, roomId]);
                }
                if (update.$set) {
                    if (typeof update.$set.phase !== 'undefined') {
                        yield client.query('update rooms set phase=$1, updated_at=now() where id=$2', [update.$set.phase, roomId]);
                    }
                    if (typeof update.$set['users.$.id'] !== 'undefined' ||
                        typeof update.$set['users.$.role'] !== 'undefined' ||
                        typeof update.$set['users.$.isReady'] !== 'undefined' ||
                        typeof update.$set['users.$.is_ready'] !== 'undefined' ||
                        typeof update.$set['users.$.mood'] !== 'undefined') {
                        if (filter['users.id']) {
                            const newId = update.$set['users.$.id'];
                            const role = update.$set['users.$.role'];
                            const isReady = typeof update.$set['users.$.isReady'] !== 'undefined' ? update.$set['users.$.isReady'] : update.$set['users.$.is_ready'];
                            const mood = update.$set['users.$.mood'];
                            yield client.query('update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and id=$6', [newId !== null && newId !== void 0 ? newId : null, role !== null && role !== void 0 ? role : null, typeof isReady === 'boolean' ? isReady : null, mood !== null && mood !== void 0 ? mood : null, roomId, filter['users.id']]);
                        }
                        else if (filter['users.name']) {
                            const newId = update.$set['users.$.id'];
                            const role = update.$set['users.$.role'];
                            const mood = update.$set['users.$.mood'];
                            yield client.query('update room_users set id = coalesce($1, id), role = coalesce($2, role), mood = coalesce($3, mood) where room_id=$4 and name=$5', [newId !== null && newId !== void 0 ? newId : null, role !== null && role !== void 0 ? role : null, mood !== null && mood !== void 0 ? mood : null, roomId, filter['users.name']]);
                        }
                    }
                    if (typeof update.$set['cards.$.text'] !== 'undefined' ||
                        typeof update.$set['cards.$.column'] !== 'undefined' ||
                        typeof update.$set['cards.$.imageUrl'] !== 'undefined') {
                        const cardId = filter['cards.id'];
                        const text = update.$set['cards.$.text'];
                        const column = update.$set['cards.$.column'];
                        const imageUrl = update.$set['cards.$.imageUrl'];
                        if (typeof text !== 'undefined') {
                            yield client.query('update cards set text=$1 where id=$2 and room_id=$3', [text, cardId, roomId]);
                        }
                        if (typeof column !== 'undefined') {
                            yield client.query('update cards set column_index=$1 where id=$2 and room_id=$3', [column, cardId, roomId]);
                        }
                        if (typeof imageUrl !== 'undefined') {
                            yield client.query('update cards set image_url=$1 where id=$2 and room_id=$3', [imageUrl || null, cardId, roomId]);
                        }
                    }
                    if (update.$set['users.$[].isReady'] === false || update.$set['users.$[].is_ready'] === false) {
                        yield client.query('update room_users set is_ready=false where room_id=$1', [roomId]);
                    }
                }
                if (update.$addToSet) {
                    if (update.$addToSet.users) {
                        const u = update.$addToSet.users;
                        yield client.query(`insert into room_users (id, name, room_id, role, is_ready, mood) values ($1,$2,$3,$4,$5,$6)
             on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`, [u.id, u.name, roomId, u.role, (_a = u.isReady) !== null && _a !== void 0 ? _a : false, (_b = u.mood) !== null && _b !== void 0 ? _b : null]);
                    }
                    if (update.$addToSet[`cards.$.likes`] || update.$addToSet[`cards.$.dislikes`]) {
                        const cardId = filter['cards.id'];
                        const userId = update.$addToSet[`cards.$.likes`] || update.$addToSet[`cards.$.dislikes`];
                        const vote = update.$addToSet[`cards.$.likes`] ? 'like' : 'dislike';
                        yield client.query('insert into card_votes (card_id, user_id, vote) values ($1,$2,$3) on conflict (card_id, user_id) do update set vote=excluded.vote', [cardId, userId, vote]);
                    }
                }
                if ((_c = update.$push) === null || _c === void 0 ? void 0 : _c.cards) {
                    const c = update.$push.cards;
                    yield client.query('insert into cards (id, room_id, text, type, created_by, column_index, image_url) values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing', [c.id, roomId, c.text, c.type, c.createdBy, c.column, c.imageUrl || null]);
                }
                if ((_d = update.$pull) === null || _d === void 0 ? void 0 : _d.users) {
                    if (update.$pull.users.id) {
                        yield client.query('delete from room_users where room_id=$1 and id=$2', [roomId, update.$pull.users.id]);
                    }
                }
                if ((_e = update.$pull) === null || _e === void 0 ? void 0 : _e.cards) {
                    if (update.$pull.cards.id) {
                        yield client.query('delete from cards where room_id=$1 and id=$2', [roomId, update.$pull.cards.id]);
                    }
                }
                yield client.query('COMMIT');
            }
            catch (e) {
                yield client.query('ROLLBACK');
                throw e;
            }
            finally {
                client.release();
            }
            return this.findOne({ id: roomId });
        });
    },
    updateOne(filter, update) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomId = filter.id;
            const cardId = filter['cards.id'];
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                if (update.$pull) {
                    const removeUserFromLikes = update.$pull[`cards.$.likes`];
                    const removeUserFromDislikes = update.$pull[`cards.$.dislikes`];
                    const userIdToRemove = removeUserFromLikes || removeUserFromDislikes;
                    if (userIdToRemove) {
                        yield client.query('delete from card_votes where card_id=$1 and user_id=$2', [cardId, userIdToRemove]);
                    }
                }
                yield client.query('COMMIT');
            }
            catch (e) {
                yield client.query('ROLLBACK');
                throw e;
            }
            finally {
                client.release();
            }
        });
    },
    deleteOne(where) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('delete from rooms where id=$1', [where.id]);
        });
    },
    deleteMany() {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('truncate table card_votes, cards, room_users, rooms restart identity cascade');
        });
    },
    find(where) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = [];
            let query = 'select id from rooms';
            if (where === null || where === void 0 ? void 0 : where.teamId) {
                params.push(where.teamId);
                query += ' where team_id=$1';
            }
            const { rows } = yield database_1.pool.query(query, params);
            const results = [];
            for (const r of rows) {
                const doc = yield this.findOne({ id: r.id });
                if (doc)
                    results.push(doc);
            }
            return results;
        });
    }
};
