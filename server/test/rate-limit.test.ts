import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { authRateLimit } from '../src/http/rateLimit';
import {
  clearRoomPasswordAttempts,
  registerInvalidRoomPassword,
  roomPasswordRetryAfterMs
} from '../src/realtime/runtime';

const post = (port: number, forwardedFor: string) => fetch(`http://127.0.0.1:${port}/limited`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Forwarded-For': forwardedFor
  },
  body: '{}'
});

describe('rate limits', () => {
  it('keeps the auth limit per client address when the proxy is trusted', async () => {
    const { app } = createApp();
    app.post('/limited', authRateLimit, (_req, res) => {
      res.json({ ok: true });
    });

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await post(port, '203.0.113.10');
        expect(response.status).toBe(200);
        expect(response.headers.get('x-powered-by')).toBeNull();
      }

      const blocked = await post(port, '203.0.113.10');
      expect(blocked.status).toBe(429);

      const otherClient = await post(port, '203.0.113.20');
      expect(otherClient.status).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('locks a socket for a minute after five wrong room passwords', () => {
    const socketId = `pwd-${Date.now()}`;
    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        expect(registerInvalidRoomPassword(socketId)).toBe(0);
      }
      expect(registerInvalidRoomPassword(socketId)).toBeGreaterThan(0);
      expect(roomPasswordRetryAfterMs(socketId)).toBeGreaterThan(0);
    } finally {
      clearRoomPasswordAttempts(socketId);
      expect(roomPasswordRetryAfterMs(socketId)).toBe(0);
    }
  });
});
