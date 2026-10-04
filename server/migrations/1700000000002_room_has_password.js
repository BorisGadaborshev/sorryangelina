/* eslint-disable camelcase */

const bcrypt = require('bcrypt');

exports.shorthands = undefined;

const OPEN_ROOM_MARKER = '__no_room_password__';

exports.up = async (pgm) => {
  await pgm.db.query('alter table rooms add column if not exists has_password boolean');

  const { rows } = await pgm.db.query(
    'select id, password from rooms where has_password is null'
  );

  for (const row of rows) {
    let isOpenRoom = false;
    try {
      isOpenRoom = await bcrypt.compare(OPEN_ROOM_MARKER, row.password);
    } catch {
      isOpenRoom = false;
    }
    await pgm.db.query('update rooms set has_password = $1 where id = $2', [!isOpenRoom, row.id]);
  }

  await pgm.db.query(`
    alter table rooms alter column has_password set default true;
    update rooms set has_password = true where has_password is null;
    alter table rooms alter column has_password set not null;
  `);
};

exports.down = (pgm) => {
  pgm.sql('alter table rooms drop column if exists has_password');
};
