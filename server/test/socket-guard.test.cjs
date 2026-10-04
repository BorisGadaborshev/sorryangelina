const test = require('node:test');
const assert = require('node:assert/strict');
const { on } = require('../dist/realtime/on.js');

test('a socket event without a payload does not escape the handler', async () => {
  const emitted = [];
  const handlers = new Map();
  const socket = {
    on(event, callback) {
      handlers.set(event, callback);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    }
  };

  on(socket, 'add-card', async ({ text }) => {
    if (!text) {
      throw new Error('missing text');
    }
  });

  handlers.get('add-card')(undefined);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, 'error');
});
