/* eslint-disable camelcase */

exports.shorthands = undefined;

// Idempotent copy of the schema previously applied on every server start.
// Safe to run against an existing production database.
const BASELINE_SQL = `
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
      template text not null default 'classic',
      phase text not null check (phase in ('creation','voting','discussion','roadmap','rating')),
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
      origin_column integer,
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
    alter table teams add column if not exists password_version integer not null default 1;
    alter table team_members add column if not exists unlocked_password_version integer;
    alter table cards add column if not exists image_url text;
    alter table card_comments add column if not exists updated_at timestamptz;
    alter table room_users add column if not exists mood text;
    alter table room_users add column if not exists joined_at timestamptz default now();
    alter table rooms add column if not exists column_titles jsonb;
    alter table rooms add column if not exists column_colors jsonb;
    alter table rooms add column if not exists features jsonb;
    alter table rooms add column if not exists template text not null default 'classic';
    alter table cards add column if not exists origin_column integer;
    alter table cards add column if not exists author_revealed boolean not null default false;
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check check (phase in ('creation','voting','discussion','roadmap','rating'));

    create table if not exists room_media (
      id text primary key,
      room_id text not null references rooms(id) on delete cascade,
      kind text not null check (kind in ('card', 'background')),
      card_id text,
      public_url text not null,
      file_name text,
      created_at timestamptz default now()
    );

    create index if not exists idx_cards_room on cards(room_id);
    create index if not exists idx_card_comments_card on card_comments(card_id);
    create index if not exists idx_card_reactions_card on card_reactions(card_id);
    create index if not exists idx_users_room on room_users(room_id);
    create unique index if not exists idx_accounts_name_ci on accounts ((lower(name)));
    create index if not exists idx_room_media_created on room_media(created_at);
    create index if not exists idx_room_media_room on room_media(room_id);

    create table if not exists creation_events (
      id bigserial primary key,
      actor_name text not null,
      kind text not null check (kind in ('team', 'room')),
      subject_id text not null,
      created_at timestamptz not null default now(),
      unique (kind, subject_id)
    );

    create index if not exists idx_creation_events_daily
      on creation_events (kind, actor_name, created_at);

    insert into creation_events (actor_name, kind, subject_id, created_at)
    select owner, 'team', id, created_at
    from teams
    where id <> 'cards-partners'
    on conflict (kind, subject_id) do nothing;

    insert into creation_events (actor_name, kind, subject_id, created_at)
    select owner, 'room', id, created_at
    from rooms
    on conflict (kind, subject_id) do nothing;
`;

const INDEX_SQL = `
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
`;

exports.up = (pgm) => {
  pgm.sql(BASELINE_SQL);
  pgm.sql(INDEX_SQL);
};

exports.down = (pgm) => {
  pgm.sql(`
    drop table if exists creation_events;
    drop table if exists room_media;
    drop table if exists card_reactions;
    drop table if exists card_comments;
    drop table if exists card_votes;
    drop table if exists cards;
    drop table if exists room_users;
    drop table if exists rooms;
    drop table if exists team_members;
    drop table if exists teams;
    drop table if exists accounts;
  `);
};
