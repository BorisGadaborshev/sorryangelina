const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomCache } = require('../dist/services/RoomCache.js');

test('room cache stores and drops a room by id', () => {
  const room = { id: 'cache-room', users: [], cards: [] };
  RoomCache.invalidate(room.id);
  assert.equal(RoomCache.get(room.id), null);
  RoomCache.set(room.id, room);
  assert.equal(RoomCache.get(room.id), room);
  RoomCache.invalidate(room.id);
  assert.equal(RoomCache.get(room.id), null);
});

test('a room loaded before a write is not cached afterwards', () => {
  const room = { id: 'stale-room', users: [], cards: [] };
  const generation = RoomCache.generation(room.id);
  RoomCache.invalidate(room.id);
  RoomCache.set(room.id, room, generation);
  assert.equal(RoomCache.get(room.id), null);
});
