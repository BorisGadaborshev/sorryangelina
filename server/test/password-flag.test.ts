import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';

const require = createRequire(fileURLToPath(import.meta.url));
const OPEN_ROOM_MARKER = '__no_room_password__';

describe('room passwords', () => {
  it('does not treat a real password as the legacy open-room marker', async () => {
    const hash = await bcrypt.hash('room-secret', 4);
    expect(await bcrypt.compare('room-secret', hash)).toBe(true);
    expect(await bcrypt.compare(OPEN_ROOM_MARKER, hash)).toBe(false);
  });

  it('detects a legacy open room by the stored marker hash', async () => {
    const hash = await bcrypt.hash(OPEN_ROOM_MARKER, 4);
    expect(await bcrypt.compare(OPEN_ROOM_MARKER, hash)).toBe(true);
  });

  it('exports up and down from the SQL migrations', () => {
    const baseline = require('../migrations/1700000000001_baseline.js');
    const hasPassword = require('../migrations/1700000000002_room_has_password.js');
    const runtime = require('../migrations/1700000000003_room_runtime.js');
    expect(typeof baseline.up).toBe('function');
    expect(typeof baseline.down).toBe('function');
    expect(typeof hasPassword.up).toBe('function');
    expect(typeof hasPassword.down).toBe('function');
    expect(typeof runtime.up).toBe('function');
    expect(typeof runtime.down).toBe('function');
  });
});
