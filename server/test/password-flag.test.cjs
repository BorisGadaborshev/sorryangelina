const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const OPEN_ROOM_MARKER = '__no_room_password__';

test('a real room password does not match the legacy open-room marker', async () => {
  const hash = await bcrypt.hash('room-secret', 4);
  assert.equal(await bcrypt.compare('room-secret', hash), true);
  assert.equal(await bcrypt.compare(OPEN_ROOM_MARKER, hash), false);
});

test('legacy open rooms are detected by comparing the marker against the stored hash', async () => {
  const hash = await bcrypt.hash(OPEN_ROOM_MARKER, 4);
  assert.equal(await bcrypt.compare(OPEN_ROOM_MARKER, hash), true);
});

test('migration modules export up and down', () => {
  const baseline = require('../migrations/1700000000001_baseline.js');
  const hasPassword = require('../migrations/1700000000002_room_has_password.js');
  assert.equal(typeof baseline.up, 'function');
  assert.equal(typeof baseline.down, 'function');
  assert.equal(typeof hasPassword.up, 'function');
  assert.equal(typeof hasPassword.down, 'function');
});
