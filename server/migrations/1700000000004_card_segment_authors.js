/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('alter table cards add column if not exists segment_authors jsonb');
};

exports.down = (pgm) => {
  pgm.sql('alter table cards drop column if exists segment_authors');
};
