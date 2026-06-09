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
exports.connectDB = exports.pool = void 0;
const pg_1 = require("pg");
const DATABASE_URL = process.env.DATABASE_URL;
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;
exports.pool = new pg_1.Pool(DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl }
    : { ssl });
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    yield exports.pool.connect();
    yield exports.pool.query(`
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

    alter table rooms add column if not exists team_id text references teams(id) on delete set null;
    alter table cards add column if not exists image_url text;
    alter table room_users add column if not exists mood text;
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check check (phase in ('creation','voting','discussion','rating'));

    create index if not exists idx_cards_room on cards(room_id);
    create index if not exists idx_users_room on room_users(room_id);
    create index if not exists idx_rooms_team on rooms(team_id);
    create index if not exists idx_team_members_name on team_members(name);
    create unique index if not exists idx_accounts_name_ci on accounts ((lower(name)));
  `);
    console.log('Connected to PostgreSQL and ensured schema');
});
exports.connectDB = connectDB;
