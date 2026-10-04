/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists room_runtime (
      room_id text primary key references rooms(id) on delete cascade,
      timer jsonb,
      rating jsonb,
      facilitator jsonb,
      discussion jsonb,
      updated_at timestamptz not null default now()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql('drop table if exists room_runtime');
};
