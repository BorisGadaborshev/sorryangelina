// Postgres access helpers
import crypto from 'crypto';
import { pool } from '../config/database';
import { Room, RoomDocument, User, Card, CardComment, CardReaction, RoomFeatures, ColumnColorId, mergeCardTexts, mergeSegmentAuthors, alignSegmentAuthors, getCardTextSegments, getColumnCount, getRetroTemplate, normalizeColumnColors } from '../types';
import { normalizeRoomFeatures } from '../utils/roomFeatures';
import { CARDS_PER_PERSON_PER_ROOM, CARD_LIMIT_MESSAGE, lockAndAssertCardSlot, reserveCreationSlot, UsageLimitError } from '../services/UsageLimits';

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
        'segment_authors', c.segment_authors,
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

const readSegmentAuthors = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const authors = value.map((item) => (typeof item === 'string' ? item : ''));
  return authors.some((author) => author.trim()) ? authors : undefined;
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
  segment_authors: unknown;
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
        `insert into rooms (id, password, has_password, team_id, owner, phase, template, column_titles, column_colors, features)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)
         on conflict (id) do nothing
         returning id`,
        [
          doc.id,
          doc.password,
          doc.hasPassword,
          doc.teamId ?? null,
          doc.owner,
          doc.phase,
          doc.template ?? 'classic',
          JSON.stringify(doc.columnTitles ?? null),
          JSON.stringify(doc.columnColors ?? null),
          JSON.stringify(doc.features ?? null)
        ]
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
      segmentAuthors: readSegmentAuthors(cardRow.segment_authors),
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
        'select id, text, image_url, created_by, segment_authors from cards where room_id=$1 and id = any($2::text[]) for update',
        [roomId, [targetCardId, sourceCardId]]
      );
      const targetCard = rows.find((row: { id: string }) => row.id === targetCardId) as { id: string; text: string; image_url: string | null; created_by: string; segment_authors: unknown } | undefined;
      const sourceCard = rows.find((row: { id: string }) => row.id === sourceCardId) as { id: string; text: string; image_url: string | null; created_by: string; segment_authors: unknown } | undefined;

      if (!targetCard || !sourceCard) {
        await client.query('ROLLBACK');
        return null;
      }

      const mergedText = mergeCardTexts(targetCard.text, sourceCard.text);
      const mergedAuthors = mergeSegmentAuthors(
        targetCard.text,
        targetCard.created_by,
        readSegmentAuthors(targetCard.segment_authors),
        sourceCard.text,
        sourceCard.created_by,
        readSegmentAuthors(sourceCard.segment_authors)
      );
      const mergedImageUrl = targetCard.image_url || sourceCard.image_url || null;
      await client.query(
        'update cards set text=$1, image_url=$2, segment_authors=$3::jsonb where room_id=$4 and id=$5',
        [mergedText, mergedImageUrl, JSON.stringify(mergedAuthors), roomId, targetCardId]
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

  async unmergeCard(roomId: string, cardId: string): Promise<RoomDocument | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'select id, text, type, created_by, column_index, origin_column, segment_authors from cards where room_id=$1 and id=$2 for update',
        [roomId, cardId]
      );
      const card = rows[0] as {
        id: string;
        text: string;
        type: Card['type'];
        created_by: string;
        column_index: number;
        origin_column: number | null;
        segment_authors: unknown;
      } | undefined;

      if (!card) {
        await client.query('ROLLBACK');
        return null;
      }

      const segments = getCardTextSegments(card.text);
      if (segments.length < 2) {
        await client.query('ROLLBACK');
        return null;
      }

      const authors = alignSegmentAuthors(card.text, card.created_by, readSegmentAuthors(card.segment_authors));
      const extras = segments.slice(1).map((text, index) => ({
        text,
        createdBy: authors[index + 1] || card.created_by
      }));
      const extraCounts = new Map<string, number>();
      extras.forEach((extra) => {
        extraCounts.set(extra.createdBy, (extraCounts.get(extra.createdBy) || 0) + 1);
      });

      for (const author of [...extraCounts.keys()].sort()) {
        await client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [`card:${roomId}:${author}`]);
        const countResult = await client.query(
          'select count(*)::int as count from cards where room_id = $1 and created_by = $2',
          [roomId, author]
        );
        const count = Number((countResult.rows[0] as { count?: number } | undefined)?.count ?? 0);
        if (count + (extraCounts.get(author) || 0) > CARDS_PER_PERSON_PER_ROOM) {
          await client.query('ROLLBACK');
          throw new UsageLimitError(CARD_LIMIT_MESSAGE);
        }
      }

      await client.query(
        'update cards set text=$1, segment_authors=null where room_id=$2 and id=$3',
        [segments[0], roomId, cardId]
      );

      for (const extra of extras) {
        await client.query(
          `insert into cards (id, room_id, text, type, created_by, column_index, image_url, origin_column)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [crypto.randomUUID(), roomId, extra.text, card.type, extra.createdBy, card.column_index, null, card.origin_column]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The transaction may already be closed after an explicit rollback.
      }
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

  async rebindUser(
    roomId: string,
    match: { name?: string; id?: string },
    updates: { id?: string; role?: User['role']; isReady?: boolean; mood?: User['mood'] | null }
  ): Promise<RoomDocument | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const previousUser = match.id
        ? await client.query('select id from room_users where room_id=$1 and id=$2', [roomId, match.id])
        : await client.query('select id from room_users where room_id=$1 and name=$2', [roomId, match.name]);
      const previousId = previousUser.rows[0]?.id as string | undefined;
      const params = [
        updates.id ?? null,
        updates.role ?? null,
        typeof updates.isReady === 'boolean' ? updates.isReady : null,
        updates.mood ?? null,
        roomId,
        match.id ?? match.name
      ];
      const result = match.id
        ? await client.query(
          'update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and id=$6',
          params
        )
        : await client.query(
          'update room_users set id = coalesce($1, id), role = coalesce($2, role), is_ready = coalesce($3, is_ready), mood = coalesce($4, mood) where room_id=$5 and name=$6',
          params
        );
      if ((result.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      if (typeof updates.id === 'string' && previousId && previousId !== updates.id) {
        await client.query(
          `update card_votes as target
           set user_id = $1
           where target.user_id = $2
             and target.card_id in (select id from cards where room_id = $3)
             and not exists (
               select 1 from card_votes existing
               where existing.card_id = target.card_id and existing.user_id = $1
             )`,
          [updates.id, previousId, roomId]
        );
        await client.query(
          'update card_comments set user_id = $1 where user_id = $2 and card_id in (select id from cards where room_id = $3)',
          [updates.id, previousId, roomId]
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
          [updates.id, previousId, roomId]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.findOne({ id: roomId });
  },

  async insertRoomUser(roomId: string, user: User): Promise<RoomDocument | null> {
    const { rowCount } = await pool.query(
      `insert into room_users (id, name, room_id, role, is_ready, mood, joined_at) values ($1,$2,$3,$4,$5,$6, now())
       on conflict (room_id, id) do update set name = excluded.name, role = excluded.role, is_ready = excluded.is_ready, mood = excluded.mood`,
      [user.id, user.name, roomId, user.role, user.isReady ?? false, user.mood ?? null]
    );
    if (!rowCount) return null;
    return this.findOne({ id: roomId });
  },

  async deleteRoomUser(roomId: string, userId: string): Promise<RoomDocument | null> {
    await pool.query('delete from room_users where room_id=$1 and id=$2', [roomId, userId]);
    return this.findOne({ id: roomId });
  },

  async patchCard(roomId: string, cardId: string, updates: Partial<Card>): Promise<RoomDocument | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    };
    if (typeof updates.text !== 'undefined') set('text', updates.text);
    if (typeof updates.column !== 'undefined') set('column_index', updates.column);
    if (typeof updates.type !== 'undefined') set('type', updates.type);
    if (typeof updates.originColumn !== 'undefined') set('origin_column', updates.originColumn);
    if (typeof updates.imageUrl !== 'undefined') set('image_url', updates.imageUrl || null);
    if (typeof updates.authorRevealed !== 'undefined') set('author_revealed', Boolean(updates.authorRevealed));
    if (Object.prototype.hasOwnProperty.call(updates, 'segmentAuthors')) {
      const authors = updates.segmentAuthors;
      params.push(authors && authors.length > 0 ? JSON.stringify(authors) : null);
      assignments.push(`segment_authors = $${params.length}::jsonb`);
    }
    if (assignments.length === 0) return this.findOne({ id: roomId });
    params.push(cardId, roomId);
    const { rowCount } = await pool.query(
      `update cards set ${assignments.join(', ')} where id = $${params.length - 1} and room_id = $${params.length}`,
      params
    );
    if (!rowCount) return null;
    return this.findOne({ id: roomId });
  },

  async deleteCardById(roomId: string, cardId: string): Promise<RoomDocument | null> {
    await pool.query('delete from cards where room_id=$1 and id=$2', [roomId, cardId]);
    return this.findOne({ id: roomId });
  },

  async setPhase(roomId: string, phase: Room['phase']): Promise<RoomDocument | null> {
    const { rowCount } = await pool.query(
      'update rooms set phase=$1, updated_at=now() where id=$2',
      [phase, roomId]
    );
    if (!rowCount) return null;
    return this.findOne({ id: roomId });
  },

  async resetReady(roomId: string): Promise<RoomDocument | null> {
    await pool.query('update room_users set is_ready=false where room_id=$1', [roomId]);
    return this.findOne({ id: roomId });
  },

  async setCardVote(cardId: string, userId: string, vote: 'like' | 'dislike' | null): Promise<void> {
    if (vote === null) {
      await pool.query('delete from card_votes where card_id=$1 and user_id=$2', [cardId, userId]);
      return;
    }
    await pool.query(
      `insert into card_votes (card_id, user_id, vote) values ($1,$2,$3)
       on conflict (card_id, user_id) do update set vote = excluded.vote`,
      [cardId, userId, vote]
    );
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