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
const roomFeatures_1 = require("../utils/roomFeatures");
const mapCommentRow = (row) => (Object.assign({ id: row.id, cardId: row.card_id, userId: row.user_id, userName: row.user_name, text: row.text, createdAt: row.created_at }, (row.updated_at ? { updatedAt: row.updated_at } : {})));
const attachSocialDataToCards = (cards) => __awaiter(void 0, void 0, void 0, function* () {
    if (cards.length === 0)
        return cards;
    const cardIds = cards.map((card) => card.id);
    const commentsRes = yield database_1.pool.query('select id, card_id, user_id, user_name, text, created_at, updated_at from card_comments where card_id = any($1::text[]) order by created_at asc', [cardIds]);
    const reactionsRes = yield database_1.pool.query('select card_id, user_id, user_name, emoji from card_reactions where card_id = any($1::text[])', [cardIds]);
    const commentsByCard = new Map();
    for (const row of commentsRes.rows) {
        const entry = commentsByCard.get(row.card_id) || [];
        entry.push(mapCommentRow(row));
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
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                yield client.query(`insert into rooms (id, password, team_id, owner, phase, template) values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do nothing`, [doc.id, doc.password, (_a = doc.teamId) !== null && _a !== void 0 ? _a : null, doc.owner, doc.phase, (_b = doc.template) !== null && _b !== void 0 ? _b : 'classic']);
                for (const user of doc.users || []) {
                    yield client.query(`insert into room_users (id, name, room_id, role, is_ready, mood, joined_at) values ($1,$2,$3,$4,$5,$6, now())
           on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`, [user.id, user.name, doc.id, user.role, (_c = user.isReady) !== null && _c !== void 0 ? _c : false, (_d = user.mood) !== null && _d !== void 0 ? _d : null]);
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
            const { rows } = yield database_1.pool.query('select id, password, team_id, owner, phase, template, created_at, column_titles, column_colors, features from rooms where id=$1', [where.id]);
            if (rows.length === 0)
                return null;
            const roomRow = rows[0];
            const template = (0, types_1.getRetroTemplate)(roomRow.template);
            const usersRes = yield database_1.pool.query('select id, name, role, is_ready, mood from room_users where room_id=$1 order by joined_at asc nulls last, name asc', [where.id]);
            const cardsRes = yield database_1.pool.query('select id, text, type, created_by, column_index, origin_column, image_url from cards where room_id=$1', [where.id]);
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
                var _a, _b, _c, _d;
                return ({
                    id: r.id,
                    text: r.text,
                    type: r.type,
                    createdBy: r.created_by,
                    likes: ((_a = cardIdToVotes.get(r.id)) === null || _a === void 0 ? void 0 : _a.likes) || [],
                    dislikes: ((_b = cardIdToVotes.get(r.id)) === null || _b === void 0 ? void 0 : _b.dislikes) || [],
                    column: r.column_index,
                    originColumn: (_c = r.origin_column) !== null && _c !== void 0 ? _c : undefined,
                    imageUrl: (_d = r.image_url) !== null && _d !== void 0 ? _d : undefined
                });
            }));
            return {
                id: roomRow.id,
                password: roomRow.password,
                teamId: (_a = roomRow.team_id) !== null && _a !== void 0 ? _a : undefined,
                owner: roomRow.owner,
                phase: roomRow.phase,
                template: template.id,
                columnTitles: Array.isArray(roomRow.column_titles) && roomRow.column_titles.length === (0, types_1.getColumnCount)(template)
                    ? roomRow.column_titles
                    : undefined,
                columnColors: (0, types_1.normalizeColumnColors)(roomRow.column_colors, template),
                features: (0, roomFeatures_1.normalizeRoomFeatures)(roomRow.features),
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
    updateColumnColors(roomId, colors) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('update rooms set column_colors=$1::jsonb, updated_at=now() where id=$2', [
                JSON.stringify(colors),
                roomId
            ]);
            return this.findOne({ id: roomId });
        });
    },
    updateRoomFeatures(roomId, features) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('update rooms set features=$1::jsonb, updated_at=now() where id=$2', [
                JSON.stringify(features),
                roomId
            ]);
            return this.findOne({ id: roomId });
        });
    },
    mergeCards(roomId, targetCardId, sourceCardId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (targetCardId === sourceCardId)
                return null;
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                const { rows } = yield client.query('select id, text, image_url from cards where room_id=$1 and id = any($2::text[]) for update', [roomId, [targetCardId, sourceCardId]]);
                const targetCard = rows.find((row) => row.id === targetCardId);
                const sourceCard = rows.find((row) => row.id === sourceCardId);
                if (!targetCard || !sourceCard) {
                    yield client.query('ROLLBACK');
                    return null;
                }
                const mergedText = (0, types_1.mergeCardTexts)(targetCard.text, sourceCard.text);
                const mergedImageUrl = targetCard.image_url || sourceCard.image_url || null;
                yield client.query('update cards set text=$1, image_url=$2 where room_id=$3 and id=$4', [mergedText, mergedImageUrl, roomId, targetCardId]);
                yield client.query('update card_comments set card_id=$1 where card_id=$2', [targetCardId, sourceCardId]);
                yield client.query(`insert into card_reactions (card_id, user_id, user_name, emoji)
         select $1, user_id, user_name, emoji
         from card_reactions
         where card_id=$2
         on conflict (card_id, user_id, emoji) do nothing`, [targetCardId, sourceCardId]);
                yield client.query('delete from cards where room_id=$1 and id=$2', [roomId, sourceCardId]);
                yield client.query('COMMIT');
            }
            catch (error) {
                yield client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
            return this.findOne({ id: roomId });
        });
    },
    addCardComment(comment) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('insert into card_comments (id, card_id, user_id, user_name, text) values ($1,$2,$3,$4,$5)', [comment.id, comment.cardId, comment.userId, comment.userName, comment.text]);
            const { rows } = yield database_1.pool.query('select id, card_id, user_id, user_name, text, created_at, updated_at from card_comments where id=$1', [comment.id]);
            return mapCommentRow(rows[0]);
        });
    },
    updateCardComment(cardId, commentId, userId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query(`update card_comments
       set text=$1, updated_at=now()
       where id=$2 and card_id=$3 and user_id=$4
       returning id, card_id, user_id, user_name, text, created_at, updated_at`, [text, commentId, cardId, userId]);
            const row = rows[0];
            return row ? mapCommentRow(row) : null;
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
        var _a, _b, _c, _d, _e, _f, _g, _h;
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
                        if (filter['users.id'] || filter['users.name']) {
                            const newId = update.$set['users.$.id'];
                            const role = update.$set['users.$.role'];
                            const isReady = typeof update.$set['users.$.isReady'] !== 'undefined' ? update.$set['users.$.isReady'] : update.$set['users.$.is_ready'];
                            const mood = update.$set['users.$.mood'];
                            const previousUser = filter['users.id']
                                ? yield client.query('select id from room_users where room_id=$1 and id=$2', [roomId, filter['users.id']])
                                : yield client.query('select id from room_users where room_id=$1 and name=$2', [roomId, filter['users.name']]);
                            const previousId = (_a = previousUser.rows[0]) === null || _a === void 0 ? void 0 : _a.id;
                            const result = filter['users.id']
                                ? yield client.query('update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and id=$6', [newId !== null && newId !== void 0 ? newId : null, role !== null && role !== void 0 ? role : null, typeof isReady === 'boolean' ? isReady : null, mood !== null && mood !== void 0 ? mood : null, roomId, filter['users.id']])
                                : yield client.query('update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and name=$6', [newId !== null && newId !== void 0 ? newId : null, role !== null && role !== void 0 ? role : null, typeof isReady === 'boolean' ? isReady : null, mood !== null && mood !== void 0 ? mood : null, roomId, filter['users.name']]);
                            if (typeof newId === 'string' && previousId && previousId !== newId) {
                                yield client.query(`update card_votes as target
                 set user_id = $1
                 where target.user_id = $2
                   and target.card_id in (select id from cards where room_id = $3)
                   and not exists (
                     select 1 from card_votes existing
                     where existing.card_id = target.card_id and existing.user_id = $1
                   )`, [newId, previousId, roomId]);
                                yield client.query('update card_comments set user_id = $1 where user_id = $2 and card_id in (select id from cards where room_id = $3)', [newId, previousId, roomId]);
                                yield client.query(`update card_reactions as target
                 set user_id = $1
                 where target.user_id = $2
                   and target.card_id in (select id from cards where room_id = $3)
                   and not exists (
                     select 1 from card_reactions existing
                     where existing.card_id = target.card_id
                       and existing.user_id = $1
                       and existing.emoji = target.emoji
                   )`, [newId, previousId, roomId]);
                            }
                            if (((_b = result.rowCount) !== null && _b !== void 0 ? _b : 0) === 0) {
                                yield client.query('ROLLBACK');
                                return null;
                            }
                        }
                    }
                    if (typeof update.$set['cards.$.text'] !== 'undefined' ||
                        typeof update.$set['cards.$.column'] !== 'undefined' ||
                        typeof update.$set['cards.$.type'] !== 'undefined' ||
                        typeof update.$set['cards.$.originColumn'] !== 'undefined' ||
                        typeof update.$set['cards.$.imageUrl'] !== 'undefined') {
                        const cardId = filter['cards.id'];
                        const text = update.$set['cards.$.text'];
                        const column = update.$set['cards.$.column'];
                        const type = update.$set['cards.$.type'];
                        const originColumn = update.$set['cards.$.originColumn'];
                        const imageUrl = update.$set['cards.$.imageUrl'];
                        if (typeof text !== 'undefined') {
                            yield client.query('update cards set text=$1 where id=$2 and room_id=$3', [text, cardId, roomId]);
                        }
                        if (typeof column !== 'undefined') {
                            yield client.query('update cards set column_index=$1 where id=$2 and room_id=$3', [column, cardId, roomId]);
                        }
                        if (typeof type !== 'undefined') {
                            yield client.query('update cards set type=$1 where id=$2 and room_id=$3', [type, cardId, roomId]);
                        }
                        if (typeof originColumn !== 'undefined') {
                            yield client.query('update cards set origin_column=$1 where id=$2 and room_id=$3', [originColumn, cardId, roomId]);
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
                        yield client.query(`insert into room_users (id, name, room_id, role, is_ready, mood, joined_at) values ($1,$2,$3,$4,$5,$6, now())
             on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`, [u.id, u.name, roomId, u.role, (_c = u.isReady) !== null && _c !== void 0 ? _c : false, (_d = u.mood) !== null && _d !== void 0 ? _d : null]);
                    }
                    if (update.$addToSet[`cards.$.likes`] || update.$addToSet[`cards.$.dislikes`]) {
                        const cardId = filter['cards.id'];
                        const userId = update.$addToSet[`cards.$.likes`] || update.$addToSet[`cards.$.dislikes`];
                        const vote = update.$addToSet[`cards.$.likes`] ? 'like' : 'dislike';
                        yield client.query('insert into card_votes (card_id, user_id, vote) values ($1,$2,$3) on conflict (card_id, user_id) do update set vote=excluded.vote', [cardId, userId, vote]);
                    }
                }
                if ((_e = update.$push) === null || _e === void 0 ? void 0 : _e.cards) {
                    const c = update.$push.cards;
                    yield client.query('insert into cards (id, room_id, text, type, created_by, column_index, image_url, origin_column) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing', [c.id, roomId, c.text, c.type, c.createdBy, c.column, c.imageUrl || null, (_f = c.originColumn) !== null && _f !== void 0 ? _f : null]);
                }
                if ((_g = update.$pull) === null || _g === void 0 ? void 0 : _g.users) {
                    if (update.$pull.users.id) {
                        yield client.query('delete from room_users where room_id=$1 and id=$2', [roomId, update.$pull.users.id]);
                    }
                }
                if ((_h = update.$pull) === null || _h === void 0 ? void 0 : _h.cards) {
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
    deleteAllCards(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('delete from cards where room_id=$1', [roomId]);
        });
    },
    getNextRoomAdminUserId(roomId, leavingUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query(`select id from room_users
       where room_id = $1 and id != $2
       order by joined_at asc nulls last, name asc
       limit 1`, [roomId, leavingUserId]);
            return rows.length > 0 ? rows[0].id : null;
        });
    },
    setRoomAdmin(roomId, adminUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                yield client.query(`update room_users set role = 'user' where room_id = $1`, [roomId]);
                const { rowCount } = yield client.query(`update room_users set role = 'admin' where room_id = $1 and id = $2`, [roomId, adminUserId]);
                if (!rowCount) {
                    yield client.query('ROLLBACK');
                    return null;
                }
                yield client.query('COMMIT');
                return this.findOne({ id: roomId });
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
    deleteMany() {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('truncate table card_votes, card_comments, card_reactions, cards, room_users, room_media, rooms restart identity cascade');
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
