import { pool } from '../config/database';

type DbQueryable = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: Array<{ count?: number }> }>;
};

export class UsageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

export const DAILY_TEAM_LIMIT = 5;
export const DAILY_ROOM_LIMIT = 5;
export const CARDS_PER_PERSON_PER_ROOM = 100;

export const DAILY_TEAM_LIMIT_MESSAGE = 'Можно создать не больше 5 команд в день';
export const DAILY_ROOM_LIMIT_MESSAGE = 'Можно создать не больше 5 комнат в день';
export const CARD_LIMIT_MESSAGE = 'В одной комнате можно добавить не больше 100 карточек';

const DAY_TIMEZONE = 'Europe/Moscow';

export type CreationKind = 'team' | 'room';

const limitFor = (kind: CreationKind): number => (kind === 'team' ? DAILY_TEAM_LIMIT : DAILY_ROOM_LIMIT);

const messageFor = (kind: CreationKind): string => (
  kind === 'team' ? DAILY_TEAM_LIMIT_MESSAGE : DAILY_ROOM_LIMIT_MESSAGE
);

const countCreationsToday = async (
  queryable: DbQueryable,
  actorName: string,
  kind: CreationKind
): Promise<number> => {
  const { rows } = await queryable.query(
    `select count(*)::int as count
     from creation_events
     where actor_name = $1
       and kind = $2
       and created_at >= (date_trunc('day', now() at time zone $3) at time zone $3)`,
    [actorName, kind, DAY_TIMEZONE]
  );
  return Number((rows[0] as { count: number } | undefined)?.count ?? 0);
};

export const assertCreationSlotAvailable = async (actorName: string, kind: CreationKind): Promise<void> => {
  const count = await countCreationsToday(pool, actorName, kind);
  if (count >= limitFor(kind)) {
    throw new UsageLimitError(messageFor(kind));
  }
};

export const reserveCreationSlot = async (
  client: DbQueryable,
  actorName: string,
  kind: CreationKind,
  subjectId: string
): Promise<void> => {
  await client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [`${kind}:${actorName}`]);
  const count = await countCreationsToday(client, actorName, kind);
  if (count >= limitFor(kind)) {
    throw new UsageLimitError(messageFor(kind));
  }
  await client.query(
    `insert into creation_events (actor_name, kind, subject_id)
     values ($1, $2, $3)
     on conflict (kind, subject_id) do nothing`,
    [actorName, kind, subjectId]
  );
};

export const assertCardSlotAvailable = async (roomId: string, createdBy: string): Promise<void> => {
  const { rows } = await pool.query(
    'select count(*)::int as count from cards where room_id = $1 and created_by = $2',
    [roomId, createdBy]
  );
  const count = Number((rows[0] as { count: number } | undefined)?.count ?? 0);
  if (count >= CARDS_PER_PERSON_PER_ROOM) {
    throw new UsageLimitError(CARD_LIMIT_MESSAGE);
  }
};

export const lockAndAssertCardSlot = async (
  client: DbQueryable,
  roomId: string,
  createdBy: string
): Promise<void> => {
  await client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [`card:${roomId}:${createdBy}`]);
  const { rows } = await client.query(
    'select count(*)::int as count from cards where room_id = $1 and created_by = $2',
    [roomId, createdBy]
  );
  const count = Number((rows[0] as { count: number } | undefined)?.count ?? 0);
  if (count >= CARDS_PER_PERSON_PER_ROOM) {
    throw new UsageLimitError(CARD_LIMIT_MESSAGE);
  }
};
