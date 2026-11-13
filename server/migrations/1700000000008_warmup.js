/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check
      check (phase in ('warmup','creation','grouping','voting','discussion','roadmap','rating'));
    alter table rooms add column if not exists warmup_questions jsonb;
    alter table room_runtime add column if not exists warmup jsonb;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    update rooms set phase = 'creation' where phase = 'warmup';
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check
      check (phase in ('creation','grouping','voting','discussion','roadmap','rating'));
    alter table rooms drop column if exists warmup_questions;
    alter table room_runtime drop column if exists warmup;
  `);
};
