/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('alter table teams add column if not exists room_settings jsonb');
};

exports.down = (pgm) => {
  pgm.sql('alter table teams drop column if exists room_settings');
};
