/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('alter table cards add column if not exists task jsonb');
};

exports.down = (pgm) => {
  pgm.sql('alter table cards drop column if exists task');
};
