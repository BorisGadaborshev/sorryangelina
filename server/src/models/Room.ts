// Postgres access helpers
import { pool } from '../config/database';
import { Room, RoomDocument, User, Card } from '../types';

export const RoomModel = {
  async create(doc: RoomDocument): Promise<RoomDocument> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `insert into rooms (id, password, owner, phase) values ($1,$2,$3,$4)
         on conflict (id) do nothing`,
        [doc.id, doc.password, doc.owner, doc.phase]
      );
      for (const user of doc.users || []) {
        await client.query(
          `insert into room_users (id, name, room_id, role, is_ready) values ($1,$2,$3,$4,$5)
           on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready`,
          [user.id, user.name, doc.id, user.role, user.isReady ?? false]
        );
      }
      await client.query('COMMIT');
      return doc;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async findOne(where: { id: string }): Promise<RoomDocument | null> {
    const { rows } = await pool.query('select id, password, owner, phase, created_at from rooms where id=$1', [where.id]);
    if (rows.length === 0) return null;
    const roomRow = rows[0] as { id: string; password: string; owner: string; phase: Room['phase']; created_at: string };
    const usersRes = await pool.query('select id, name, role, is_ready from room_users where room_id=$1', [where.id]);
    const cardsRes = await pool.query('select id, text, type, created_by, column_index from cards where room_id=$1', [where.id]);
    const cardRows = cardsRes.rows as Array<{ id: string; text: string; type: Card['type']; created_by: string; column_index: number }>;
    const votesRes = await pool.query('select card_id, user_id, vote from card_votes where card_id = any($1::text[])', [cardRows.map((r) => r.id)]);
    const cardIdToVotes = new Map<string, { likes: string[]; dislikes: string[] }>();
    for (const v of votesRes.rows as Array<{ card_id: string; user_id: string; vote: 'like' | 'dislike' }>) {
      const entry = cardIdToVotes.get(v.card_id) || { likes: [], dislikes: [] };
      entry[v.vote === 'like' ? 'likes' : 'dislikes'].push(v.user_id);
      cardIdToVotes.set(v.card_id, entry);
    }
    const userRows = usersRes.rows as Array<{ id: string; name: string; role: User['role']; is_ready: boolean }>;
    const users: User[] = userRows.map((r) => ({ id: r.id, name: r.name, roomId: roomRow.id, role: r.role, isReady: r.is_ready }));
    const cards: Card[] = cardRows.map((r) => ({ id: r.id, text: r.text, type: r.type, createdBy: r.created_by, likes: cardIdToVotes.get(r.id)?.likes || [], dislikes: cardIdToVotes.get(r.id)?.dislikes || [], column: r.column_index }));
    return {
      id: roomRow.id,
      password: roomRow.password,
      owner: roomRow.owner,
      phase: roomRow.phase,
      createdAt: roomRow.created_at,
      users,
      cards
    };
  },

  async findOneAndUpdate(filter: any, update: any, options?: { new?: boolean }): Promise<RoomDocument | null> {
    const roomId: string = filter.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Direct field updates (e.g., { phase })
      if (typeof update.phase !== 'undefined') {
        await client.query('update rooms set phase=$1, updated_at=now() where id=$2', [update.phase, roomId]);
      }

      if (update.$set) {
        if (typeof update.$set.phase !== 'undefined') {
          await client.query('update rooms set phase=$1, updated_at=now() where id=$2', [update.$set.phase, roomId]);
        }
        if (
          typeof update.$set['users.$.id'] !== 'undefined' ||
          typeof update.$set['users.$.role'] !== 'undefined' ||
          typeof update.$set['users.$.isReady'] !== 'undefined' ||
          typeof update.$set['users.$.is_ready'] !== 'undefined'
        ) {
          if (filter['users.id']) {
            const newId = update.$set['users.$.id'];
            const role = update.$set['users.$.role'];
            const isReady = typeof update.$set['users.$.isReady'] !== 'undefined' ? update.$set['users.$.isReady'] : update.$set['users.$.is_ready'];
            await client.query('update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready) where room_id=$4 and id=$5', [newId ?? null, role ?? null, typeof isReady === 'boolean' ? isReady : null, roomId, filter['users.id']]);
          } else if (filter['users.name']) {
            const newId = update.$set['users.$.id'];
            const role = update.$set['users.$.role'];
            await client.query('update room_users set id = coalesce($1, id), role = coalesce($2, role) where room_id=$3 and name=$4', [newId ?? null, role ?? null, roomId, filter['users.name']]);
          }
        }
        if (update.$set['cards.$.text'] || update.$set['cards.$.column']) {
          const cardId = filter['cards.id'];
          const text = update.$set['cards.$.text'];
          const column = update.$set['cards.$.column'];
          if (typeof text !== 'undefined') {
            await client.query('update cards set text=$1 where id=$2 and room_id=$3', [text, cardId, roomId]);
          }
          if (typeof column !== 'undefined') {
            await client.query('update cards set column_index=$1 where id=$2 and room_id=$3', [column, cardId, roomId]);
          }
        }
        if (update.$set['users.$[].isReady'] === false || update.$set['users.$[].is_ready'] === false) {
          await client.query('update room_users set is_ready=false where room_id=$1', [roomId]);
        }
      }

      if (update.$addToSet) {
        if (update.$addToSet.users) {
          const u: User = update.$addToSet.users;
          await client.query(
            `insert into room_users (id, name, room_id, role, is_ready) values ($1,$2,$3,$4,$5)
             on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready`,
            [u.id, u.name, roomId, u.role, u.isReady ?? false]
          );
        }
        if (update.$addToSet[`cards.$.likes`] || update.$addToSet[`cards.$.dislikes`]) {
          const cardId = filter['cards.id'];
          const userId = update.$addToSet[`cards.$.likes`] || update.$addToSet[`cards.$.dislikes`];
          const vote: 'like' | 'dislike' = update.$addToSet[`cards.$.likes`] ? 'like' : 'dislike';
          await client.query('insert into card_votes (card_id, user_id, vote) values ($1,$2,$3) on conflict (card_id, user_id) do update set vote=excluded.vote', [cardId, userId, vote]);
        }
      }

      if (update.$push?.cards) {
        const c: Card = update.$push.cards;
        await client.query(
          'insert into cards (id, room_id, text, type, created_by, column_index) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing',
          [c.id, roomId, c.text, c.type, c.createdBy, c.column]
        );
      }

      if (update.$pull?.users) {
        if (update.$pull.users.id) {
          await client.query('delete from room_users where room_id=$1 and id=$2', [roomId, update.$pull.users.id]);
        }
      }
      if (update.$pull?.cards) {
        if (update.$pull.cards.id) {
          await client.query('delete from cards where room_id=$1 and id=$2', [roomId, update.$pull.cards.id]);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return this.findOne({ id: roomId });
  },

  async updateOne(filter: any, update: any): Promise<void> {
    const roomId: string = filter.id;
    const cardId: string = filter['cards.id'];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (update.$pull) {
        const removeUserFromLikes = update.$pull[`cards.$.likes`];
        const removeUserFromDislikes = update.$pull[`cards.$.dislikes`];
        const userIdToRemove = removeUserFromLikes || removeUserFromDislikes;
        if (userIdToRemove) {
          await client.query('delete from card_votes where card_id=$1 and user_id=$2', [cardId, userIdToRemove]);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async deleteOne(where: { id: string }): Promise<void> {
    await pool.query('delete from rooms where id=$1', [where.id]);
  },

  async deleteMany(): Promise<void> {
    await pool.query('truncate table card_votes, cards, room_users, rooms restart identity cascade');
  },

  async find(): Promise<RoomDocument[]> {
    const { rows } = await pool.query('select id from rooms');
    const results: RoomDocument[] = [];
    for (const r of rows as Array<{ id: string }>) {
      const doc = await this.findOne({ id: r.id });
      if (doc) results.push(doc);
    }
    return results;
  }
};