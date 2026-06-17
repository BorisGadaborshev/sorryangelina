import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;

export const pool = new Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl }
    : { ssl }
);

export const connectDB = async (): Promise<void> => {
  await pool.connect();

  await pool.query(`
    create table if not exists accounts (
      id bigserial primary key,
      name text not null,
      password_hash text not null,
      type text not null check (type in ('fixed', 'registered')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists teams (
      id text primary key,
      name text not null,
      password_hash text not null,
      owner text not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists team_members (
      team_id text not null references teams(id) on delete cascade,
      name text not null,
      role text not null check (role in ('admin','user')),
      created_at timestamptz default now(),
      primary key (team_id, name)
    );

    create table if not exists rooms (
      id text primary key,
      password text not null,
      team_id text references teams(id) on delete set null,
      owner text not null,
      phase text not null check (phase in ('creation','voting','discussion','rating')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists room_users (
      id text not null,
      name text not null,
      room_id text not null references rooms(id) on delete cascade,
      role text not null check (role in ('admin','user')),
      is_ready boolean default false,
      mood text,
      primary key (room_id, id)
    );

    create table if not exists cards (
      id text primary key,
      room_id text not null references rooms(id) on delete cascade,
      text text not null,
      type text not null check (type in ('liked','disliked','suggestion')),
      created_by text not null,
      column_index integer not null,
      image_url text
    );

    create table if not exists card_votes (
      card_id text not null references cards(id) on delete cascade,
      user_id text not null,
      vote text not null check (vote in ('like','dislike')),
      primary key (card_id, user_id)
    );

    create table if not exists card_comments (
      id text primary key,
      card_id text not null references cards(id) on delete cascade,
      user_id text not null,
      user_name text not null,
      text text not null,
      created_at timestamptz default now()
    );

    create table if not exists card_reactions (
      card_id text not null references cards(id) on delete cascade,
      user_id text not null,
      user_name text not null,
      emoji text not null,
      created_at timestamptz default now(),
      primary key (card_id, user_id, emoji)
    );

    alter table rooms add column if not exists team_id text references teams(id) on delete set null;
    alter table cards add column if not exists image_url text;
    alter table room_users add column if not exists mood text;
    alter table rooms add column if not exists column_titles jsonb;
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check check (phase in ('creation','voting','discussion','rating'));

    create index if not exists idx_cards_room on cards(room_id);
    create index if not exists idx_card_comments_card on card_comments(card_id);
    create index if not exists idx_card_reactions_card on card_reactions(card_id);
    create index if not exists idx_users_room on room_users(room_id);
    create unique index if not exists idx_accounts_name_ci on accounts ((lower(name)));
  `);

  await pool.query(`
    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public' and table_name = 'rooms' and column_name = 'team_id'
      ) then
        execute 'create index if not exists idx_rooms_team on rooms(team_id)';
      end if;
      if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = 'team_members'
      ) then
        execute 'create index if not exists idx_team_members_name on team_members(name)';
      end if;
    end $$;
  `);

  console.log('Connected to PostgreSQL and ensured schema');
};


