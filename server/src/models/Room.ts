// Postgres access helpers
import { pool } from '../config/database';
import { Room, RoomDocument, User, Card, CardComment, CardReaction, RoomFeatures, ColumnColorId, mergeCardTexts, getColumnCount, getRetroTemplate, normalizeColumnColors } from '../types';
import { normalizeRoomFeatures } from '../utils/roomFeatures';
import { lockAndAssertCardSlot, reserveCreationSlot } from '../services/UsageLimits';

type CommentRow = {
  id: string;
  card_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
  updated_at?: string | null;
};

const mapCommentRow = (row: CommentRow): CardComment => ({
  id: row.id,
  cardId: row.card_id,
  userId: row.user_id,
  userName: row.user_name,
  text: row.text,
  createdAt: row.created_at,
  ...(row.updated_at ? { updatedAt: row.updated_at } : {})
});

const ROOM_WITH_CHILDREN_SQL = `
  select
    r.id,
    r.password,
    r.has_password,
    r.team_id,
    r.owner,
    r.phase,
    r.template,
    r.created_at,
    r.column_titles,
    r.column_colors,
    r.features,
    coalesce((
      select json_agg(json_build_object(
        'id', u.id,
        'name', u.name,
        'role', u.role,
        'is_ready', u.is_ready,
        'mood', u.mood
      ) order by u.joined_at asc nulls last, u.name asc)
      from room_users u
      where u.room_id = r.id
    ), '[]'::json) as users,
    coalesce((
      select json_agg(json_build_object(
        'id', c.id,
        'text', c.text,
        'type', c.type,
        'created_by', c.created_by,
        'column_index', c.column_index,
        'origin_column', c.origin_column,
        'image_url', c.image_url,
        'author_revealed', c.author_revealed,
        'likes', coalesce((
          select json_agg(v.user_id) from card_votes v where v.card_id = c.id and v.vote = 'like'
        ), '[]'::json),
        'dislikes', coalesce((
          select json_agg(v.user_id) from card_votes v where v.card_id = c.id and v.vote = 'dislike'
        ), '[]'::json),
        'comments', coalesce((
          select json_agg(json_build_object(
            'id', cm.id,
            'card_id', cm.card_id,
            'user_id', cm.user_id,
            'user_name', cm.user_name,
            'text', cm.text,
            'created_at', cm.created_at,
            'updated_at', cm.updated_at
          ) order by cm.created_at asc)
          from card_comments cm
          where cm.card_id = c.id
        ), '[]'::json),
        'reactions', coalesce((
          select json_agg(json_build_object(
            'emoji', cr.emoji,
            'user_id', cr.user_id,
            'user_name', cr.user_name
          ))
          from card_reactions cr
          where cr.card_id = c.id
        ), '[]'::json)
      ))
      from cards c
      where c.room_id = r.id
    ), '[]'::json) as cards
  from rooms r
  where r.id = $1
`;

type RoomUserJson = {
  id: string;
  name: string;
  role: User['role'];
  is_ready: boolean;
  mood: User['mood'] | null;
};

type RoomCardJson = {
  id: string;
  text: string;
  type: Card['type'];
  created_by: string;
  column_index: number;
  origin_column: number | null;
  image_url: string | null;
  author_revealed: boolean;
  likes: string[] | null;
  dislikes: string[] | null;
  comments: CommentRow[] | null;
  reactions: Array<{ emoji: string; user_id: string; user_name: string }> | null;
};

export const RoomModel = {
  async create(doc: RoomDocument): Promise<RoomDocument> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedRoom = await client.query(
        `insert into rooms (id, password, has_password, team_id, owner, phase, template) values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do nothing
         returning id`,
        [doc.id, doc.password, doc.hasPassword, doc.teamId ?? null, doc.owner, doc.phase, doc.template ?? 'classic']
      );
      if (insertedRoom.rows.length > 0) {
        await reserveCreationSlot(client, doc.owner, 'room', doc.id);
      }
      for (const user of doc.users || []) {
        await client.query(
          `insert into room_users (id, name, room_id, role, is_ready, mood, joined_at) values ($1,$2,$3,$4,$5,$6, now())
           on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`,
          [user.id, user.name, doc.id, user.role, user.isReady ?? false, user.mood ?? null]
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
    const { rows } = await pool.query(ROOM_WITH_CHILDREN_SQL, [where.id]);
    if (rows.length === 0) return null;
    const roomRow = rows[0] as {
      id: string;
      password: string;
      has_password: boolean;
      team_id: string | null;
      owner: string;
      phase: Room['phase'];
      template: string | null;
      created_at: string;
      column_titles: string[] | null;
      column_colors: string[] | null;
      features: RoomFeatures | null;
      users: RoomUserJson[];
      cards: RoomCardJson[];
    };
    const template = getRetroTemplate(roomRow.template);
    const users: User[] = (roomRow.users || []).map((userRow) => ({
      id: userRow.id,
      name: userRow.name,
      roomId: roomRow.id,
      role: userRow.role,
      isReady: userRow.is_ready,
      mood: userRow.mood ?? undefined
    }));
    const cards: Card[] = (roomRow.cards || []).map((cardRow) => ({
      id: cardRow.id,
      text: cardRow.text,
      type: cardRow.type,
      createdBy: cardRow.created_by,
      likes: cardRow.likes || [],
      dislikes: cardRow.dislikes || [],
      column: cardRow.column_index,
      originColumn: cardRow.origin_column ?? undefined,
      imageUrl: cardRow.image_url ?? undefined,
      authorRevealed: Boolean(cardRow.author_revealed),
      comments: (cardRow.comments || []).map(mapCommentRow),
      reactions: (cardRow.reactions || []).map((reaction): CardReaction => ({
        emoji: reaction.emoji,
        userId: reaction.user_id,
        userName: reaction.user_name
      }))
    }));
    return {
      id: roomRow.id,
      password: roomRow.password,
      hasPassword: roomRow.has_password,
      teamId: roomRow.team_id ?? undefined,
      owner: roomRow.owner,
      phase: roomRow.phase,
      template: template.id,
      columnTitles: Array.isArray(roomRow.column_titles) && roomRow.column_titles.length === getColumnCount(template)
        ? roomRow.column_titles
        : undefined,
      columnColors: normalizeColumnColors(roomRow.column_colors, template),
      features: normalizeRoomFeatures(roomRow.features),
      createdAt: roomRow.created_at,
      users,
      cards
    };
  },

  async updateColumnTitles(roomId: string, titles: string[]): Promise<RoomDocument | null> {
    await pool.query('update rooms set column_titles=$1::jsonb, updated_at=now() where id=$2', [
      JSON.stringify(titles),
      roomId
    ]);
    return this.findOne({ id: roomId });
  },

  async updateColumnColors(roomId: string, colors: ColumnColorId[]): Promise<RoomDocument | null> {
    await pool.query('update rooms set column_colors=$1::jsonb, updated_at=now() where id=$2', [
      JSON.stringify(colors),
      roomId
    ]);
    return this.findOne({ id: roomId });
  },

  async updateRoomFeatures(roomId: string, features: RoomFeatures): Promise<RoomDocument | null> {
    await pool.query('update rooms set features=$1::jsonb, updated_at=now() where id=$2', [
      JSON.stringify(features),
      roomId
    ]);
    return this.findOne({ id: roomId });
  },

  async mergeCards(roomId: string, targetCardId: string, sourceCardId: string): Promise<RoomDocument | null> {
    if (targetCardId === sourceCardId) return null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'select id, text, image_url from cards where room_id=$1 and id = any($2::text[]) for update',
        [roomId, [targetCardId, sourceCardId]]
      );
      const targetCard = rows.find((row: { id: string }) => row.id === targetCardId) as { id: string; text: string; image_url: string | null } | undefined;
      const sourceCard = rows.find((row: { id: string }) => row.id === sourceCardId) as { id: string; text: string; image_url: string | null } | undefined;

      if (!targetCard || !sourceCard) {
        await client.query('ROLLBACK');
        return null;
      }

      const mergedText = mergeCardTexts(targetCard.text, sourceCard.text);
      const mergedImageUrl = targetCard.image_url || sourceCard.image_url || null;
      await client.query(
        'update cards set text=$1, image_url=$2 where room_id=$3 and id=$4',
        [mergedText, mergedImageUrl, roomId, targetCardId]
      );
      await client.query(
        'update card_comments set card_id=$1 where card_id=$2',
        [targetCardId, sourceCardId]
      );
      await client.query(
        `insert into card_reactions (card_id, user_id, user_name, emoji)
         select $1, user_id, user_name, emoji
         from card_reactions
         where card_id=$2
         on conflict (card_id, user_id, emoji) do nothing`,
        [targetCardId, sourceCardId]
      );
      await client.query(
        'delete from cards where room_id=$1 and id=$2',
        [roomId, sourceCardId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.findOne({ id: roomId });
  },

  async addCardComment(comment: CardComment): Promise<CardComment> {
    await pool.query(
      'insert into card_comments (id, card_id, user_id, user_name, text) values ($1,$2,$3,$4,$5)',
      [comment.id, comment.cardId, comment.userId, comment.userName, comment.text]
    );
    const { rows } = await pool.query(
      'select id, card_id, user_id, user_name, text, created_at, updated_at from card_comments where id=$1',
      [comment.id]
    );
    return mapCommentRow(rows[0] as CommentRow);
  },

  async updateCardComment(cardId: string, commentId: string, userId: string, text: string): Promise<CardComment | null> {
    const { rows } = await pool.query(
      `update card_comments
       set text=$1, updated_at=now()
       where id=$2 and card_id=$3 and user_id=$4
       returning id, card_id, user_id, user_name, text, created_at, updated_at`,
      [text, commentId, cardId, userId]
    );
    const row = rows[0] as CommentRow | undefined;
    return row ? mapCommentRow(row) : null;
  },

  async getCardReactions(cardId: string): Promise<CardReaction[]> {
    const { rows } = await pool.query(
      'select card_id, user_id, user_name, emoji from card_reactions where card_id=$1',
      [cardId]
    );
    return (rows as Array<{ card_id: string; user_id: string; user_name: string; emoji: string }>).map((row) => ({
      emoji: row.emoji,
      userId: row.user_id,
      userName: row.user_name
    }));
  },

  async toggleCardReaction(cardId: string, userId: string, userName: string, emoji: string): Promise<CardReaction[]> {
    const existing = await pool.query(
      'select 1 from card_reactions where card_id=$1 and user_id=$2 and emoji=$3',
      [cardId, userId, emoji]
    );
    if (existing.rows.length > 0) {
      await pool.query('delete from card_reactions where card_id=$1 and user_id=$2 and emoji=$3', [cardId, userId, emoji]);
    } else {
      await pool.query(
        'insert into card_reactions (card_id, user_id, user_name, emoji) values ($1,$2,$3,$4)',
        [cardId, userId, userName, emoji]
      );
    }
    return this.getCardReactions(cardId);
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
          typeof update.$set['users.$.is_ready'] !== 'undefined' ||
          typeof update.$set['users.$.mood'] !== 'undefined'
        ) {
          if (filter['users.id'] || filter['users.name']) {
            const newId = update.$set['users.$.id'];
            const role = update.$set['users.$.role'];
            const isReady = typeof update.$set['users.$.isReady'] !== 'undefined' ? update.$set['users.$.isReady'] : update.$set['users.$.is_ready'];
            const mood = update.$set['users.$.mood'];
            const previousUser = filter['users.id']
              ? await client.query('select id from room_users where room_id=$1 and id=$2', [roomId, filter['users.id']])
              : await client.query('select id from room_users where room_id=$1 and name=$2', [roomId, filter['users.name']]);
            const previousId = previousUser.rows[0]?.id as string | undefined;
            const result = filter['users.id']
              ? await client.query(
                  'update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and id=$6',
                  [newId ?? null, role ?? null, typeof isReady === 'boolean' ? isReady : null, mood ?? null, roomId, filter['users.id']]
                )
              : await client.query(
                  'update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and name=$6',
                  [newId ?? null, role ?? null, typeof isReady === 'boolean' ? isReady : null, mood ?? null, roomId, filter['users.name']]
                );
            if (typeof newId === 'string' && previousId && previousId !== newId) {
              await client.query(
                `update card_votes as target
                 set user_id = $1
                 where target.user_id = $2
                   and target.card_id in (select id from cards where room_id = $3)
                   and not exists (
                     select 1 from card_votes existing
                     where existing.card_id = target.card_id and existing.user_id = $1
                   )`,
                [newId, previousId, roomId]
              );
              await client.query(
                'update card_comments set user_id = $1 where user_id = $2 and card_id in (select id from cards where room_id = $3)',
                [newId, previousId, roomId]
              );
              await client.query(
                `update card_reactions as target
                 set user_id = $1
                 where target.user_id = $2
                   and target.card_id in (select id from cards where room_id = $3)
                   and not exists (
                     select 1 from card_reactions existing
                     where existing.card_id = target.card_id
                       and existing.user_id = $1
                       and existing.emoji = target.emoji
                   )`,
                [newId, previousId, roomId]
              );
            }
            if ((result.rowCount ?? 0) === 0) {
              await client.query('ROLLBACK');
              return null;
            }
          }
        }
        if (
          typeof update.$set['cards.$.text'] !== 'undefined' ||
          typeof update.$set['cards.$.column'] !== 'undefined' ||
          typeof update.$set['cards.$.type'] !== 'undefined' ||
          typeof update.$set['cards.$.originColumn'] !== 'undefined' ||
          typeof update.$set['cards.$.imageUrl'] !== 'undefined' ||
          typeof update.$set['cards.$.authorRevealed'] !== 'undefined'
        ) {
          const cardId = filter['cards.id'];
          const text = update.$set['cards.$.text'];
          const column = update.$set['cards.$.column'];
          const type = update.$set['cards.$.type'];
          const originColumn = update.$set['cards.$.originColumn'];
          const imageUrl = update.$set['cards.$.imageUrl'];
          const authorRevealed = update.$set['cards.$.authorRevealed'];
          if (typeof text !== 'undefined') {
            await client.query('update cards set text=$1 where id=$2 and room_id=$3', [text, cardId, roomId]);
          }
          if (typeof column !== 'undefined') {
            await client.query('update cards set column_index=$1 where id=$2 and room_id=$3', [column, cardId, roomId]);
          }
          if (typeof type !== 'undefined') {
            await client.query('update cards set type=$1 where id=$2 and room_id=$3', [type, cardId, roomId]);
          }
          if (typeof originColumn !== 'undefined') {
            await client.query('update cards set origin_column=$1 where id=$2 and room_id=$3', [originColumn, cardId, roomId]);
          }
          if (typeof imageUrl !== 'undefined') {
            await client.query('update cards set image_url=$1 where id=$2 and room_id=$3', [imageUrl || null, cardId, roomId]);
          }
          if (typeof authorRevealed !== 'undefined') {
            await client.query('update cards set author_revealed=$1 where id=$2 and room_id=$3', [Boolean(authorRevealed), cardId, roomId]);
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
            `insert into room_users (id, name, room_id, role, is_ready, mood, joined_at) values ($1,$2,$3,$4,$5,$6, now())
             on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`,
            [u.id, u.name, roomId, u.role, u.isReady ?? false, u.mood ?? null]
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
          'insert into cards (id, room_id, text, type, created_by, column_index, image_url, origin_column) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing',
          [c.id, roomId, c.text, c.type, c.createdBy, c.column, c.imageUrl || null, c.originColumn ?? null]
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

  async insertCard(roomId: string, card: Card): Promise<RoomDocument | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const roomExists = await client.query('select 1 from rooms where id = $1', [roomId]);
      if (roomExists.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      await lockAndAssertCardSlot(client, roomId, card.createdBy);
      await client.query(
        `insert into cards (id, room_id, text, type, created_by, column_index, image_url, origin_column)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (id) do nothing`,
        [card.id, roomId, card.text, card.type, card.createdBy, card.column, card.imageUrl || null, card.originColumn ?? null]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.findOne({ id: roomId });
  },

  async deleteOne(where: { id: string }): Promise<void> {
    await pool.query('delete from rooms where id=$1', [where.id]);
  },

  async deleteAllCards(roomId: string): Promise<void> {
    await pool.query('delete from cards where room_id=$1', [roomId]);
  },

  async getNextRoomAdminUserId(roomId: string, leavingUserId: string): Promise<string | null> {
    const { rows } = await pool.query(
      `select id from room_users
       where room_id = $1 and id != $2
       order by joined_at asc nulls last, name asc
       limit 1`,
      [roomId, leavingUserId]
    );
    return rows.length > 0 ? (rows[0] as { id: string }).id : null;
  },

  async setRoomAdmin(roomId: string, adminUserId: string): Promise<RoomDocument | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`update room_users set role = 'user' where room_id = $1`, [roomId]);
      const { rowCount } = await client.query(
        `update room_users set role = 'admin' where room_id = $1 and id = $2`,
        [roomId, adminUserId]
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('COMMIT');
      return this.findOne({ id: roomId });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async listSummaries(where?: { teamId?: string }): Promise<Array<{
    id: string;
    teamId?: string;
    usersCount: number;
    phase: Room['phase'];
    owner: string;
    createdAt: string;
    hasPassword: boolean;
  }>> {
    const params: string[] = [];
    let filter = '';
    if (where?.teamId) {
      params.push(where.teamId);
      filter = 'where r.team_id = $1';
    }
    const { rows } = await pool.query(
      `select r.id, r.team_id, r.owner, r.phase, r.created_at, r.has_password,
              (select count(*)::int from room_users u where u.room_id = r.id) as users_count
       from rooms r
       ${filter}
       order by r.created_at desc`,
      params
    );
    return (rows as Array<{
      id: string;
      team_id: string | null;
      owner: string;
      phase: Room['phase'];
      created_at: string;
      has_password: boolean;
      users_count: number;
    }>).map((row) => ({
      id: row.id,
      teamId: row.team_id ?? undefined,
      usersCount: row.users_count,
      phase: row.phase,
      owner: row.owner,
      createdAt: row.created_at,
      hasPassword: row.has_password
    }));
  },

  async find(where?: { teamId?: string }): Promise<RoomDocument[]> {
    const params: string[] = [];
    let query = 'select id from rooms';
    if (where?.teamId) {
      params.push(where.teamId);
      query += ' where team_id=$1';
    }
    const { rows } = await pool.query(query, params);
    const results: RoomDocument[] = [];
    for (const r of rows as Array<{ id: string }>) {
      const doc = await this.findOne({ id: r.id });
      if (doc) results.push(doc);
    }
    return results;
  }
};