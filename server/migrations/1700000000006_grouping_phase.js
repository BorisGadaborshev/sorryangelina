/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check
      check (phase in ('creation','grouping','voting','discussion','roadmap','rating'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    update rooms set phase = 'creation' where phase = 'grouping';
    alter table rooms drop constraint if exists rooms_phase_check;
    alter table rooms add constraint rooms_phase_check
      check (phase in ('creation','voting','discussion','roadmap','rating'));
  `);
};
