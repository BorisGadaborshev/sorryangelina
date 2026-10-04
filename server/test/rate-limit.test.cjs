const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app.js');
const { authRateLimit } = require('../dist/http/rateLimit.js');
const {
  clearRoomPasswordAttempts,
  registerInvalidRoomPassword,
  roomPasswordRetryAfterMs
} = require('../dist/realtime/runtime.js');

const post = (port, forwardedFor) => fetch(`http://127.0.0.1:${port}/limited`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Forwarded-For': forwardedFor
  },
  body: '{}'
});

test('trust proxy keeps the auth rate limit per client address', async () => {
  const { app } = createApp();
  app.post('/limited', authRateLimit, (_req, res) => {
    res.json({ ok: true });
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await post(port, '203.0.113.10');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-powered-by'), null);
    }

    const blocked = await post(port, '203.0.113.10');
    assert.equal(blocked.status, 429);

    const otherClient = await post(port, '203.0.113.20');
    assert.equal(otherClient.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('five wrong room passwords lock that socket for a minute', () => {
  const socketId = `pwd-${Date.now()}`;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.equal(registerInvalidRoomPassword(socketId), 0);
    }
    assert.ok(registerInvalidRoomPassword(socketId) > 0);
    assert.ok(roomPasswordRetryAfterMs(socketId) > 0);
  } finally {
    clearRoomPasswordAttempts(socketId);
    assert.equal(roomPasswordRetryAfterMs(socketId), 0);
  }
});
