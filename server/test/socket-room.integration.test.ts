import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, Socket } from 'socket.io-client';

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const databaseName = (url: string): string => {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.includes('test')) {
    throw new Error('INTEGRATION_DATABASE_URL must use a database name that contains "test"');
  }
  return name;
};

describe.skipIf(!databaseUrl)('socket room against Postgres', () => {
  const sockets: Socket[] = [];
  let httpServer: ReturnType<typeof createServer> | null = null;
  let realtime: Server | null = null;
  let poolEnd: (() => Promise<void>) | null = null;

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await new Promise<void>((resolve) => {
      if (!realtime) {
        resolve();
        return;
      }
      realtime.close(() => resolve());
    });
    await poolEnd?.();
  });

  it('joins a seeded room and broadcasts a new card', async () => {
    const url = databaseUrl as string;
    databaseName(url);
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'test';

    await execFileAsync(
      process.execPath,
      [
        path.join(path.dirname(createRequire(import.meta.url).resolve('node-pg-migrate/package.json', { paths: [serverRoot] })), 'bin/node-pg-migrate.js'),
        'up',
        '--migrations-dir',
        'migrations'
      ],
      { cwd: serverRoot, env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' } }
    );

    const [{ pool }, { signAuthToken }, { createApp }, { attachRealtime }] = await Promise.all([
      import('../src/config/database'),
      import('../src/config/jwt'),
      import('../src/app'),
      import('../src/realtime/io')
    ]);
    poolEnd = () => pool.end();

    const actor = `Интеграция ${Date.now()}`;
    const teamId = `it-team-${Date.now()}`;
    const roomId = `it-room-${Date.now()}`;
    await pool.query(
      'insert into teams (id, name, password_hash, owner) values ($1, $2, $3, $4)',
      [teamId, 'Команда теста', 'not-used', actor]
    );
    await pool.query(
      'insert into team_members (team_id, name, role) values ($1, $2, $3)',
      [teamId, actor, 'admin']
    );
    await pool.query(
      `insert into rooms (id, password, team_id, owner, phase, has_password)
       values ($1, '', $2, $3, 'creation', false)`,
      [roomId, teamId, actor]
    );

    const { app } = createApp();
    httpServer = createServer(app);
    realtime = new Server(httpServer, { cors: { origin: true }, path: '/socket.io' });
    attachRealtime(realtime);
    await new Promise<void>((resolve) => httpServer?.listen(0, '127.0.0.1', () => resolve()));
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const { token } = signAuthToken(actor, 'registered');

    const socket = ioClient(`http://127.0.0.1:${port}`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token }
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });

    const joined = new Promise<void>((resolve, reject) => {
      socket.once('room-joined', () => resolve());
      socket.once('error', (message) => reject(new Error(String(message))));
    });
    socket.emit('join-room', { roomId, token });
    await joined;

    const added = new Promise<{ text: string; column: number }>((resolve) => {
      socket.once('card-added', (card) => resolve(card));
    });
    socket.emit('add-card', { text: 'Заметка со стенда', column: 0 });
    await expect(added).resolves.toMatchObject({ text: 'Заметка со стенда', column: 0 });

    const stored = await pool.query('select text from cards where room_id = $1', [roomId]);
    expect(stored.rows).toEqual([{ text: 'Заметка со стенда' }]);

    await pool.query('delete from rooms where id = $1', [roomId]);
    await pool.query('delete from teams where id = $1', [teamId]);
  });
});
