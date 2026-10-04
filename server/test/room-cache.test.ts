import { describe, expect, it } from 'vitest';
import { RoomCache } from '../src/services/RoomCache';
import { Room } from '../src/types';

const room = (id: string): Room => ({ id, users: [], cards: [], owner: 'Ann', phase: 'creation' });

describe('RoomCache', () => {
  it('stores and drops a room by id', () => {
    const cached = room('cache-room');
    RoomCache.invalidate(cached.id);
    expect(RoomCache.get(cached.id)).toBeNull();
    RoomCache.set(cached.id, cached);
    expect(RoomCache.get(cached.id)).toBe(cached);
    RoomCache.invalidate(cached.id);
    expect(RoomCache.get(cached.id)).toBeNull();
  });

  it('drops a room loaded before a later write', () => {
    const cached = room('stale-room');
    const generation = RoomCache.generation(cached.id);
    RoomCache.invalidate(cached.id);
    RoomCache.set(cached.id, cached, generation);
    expect(RoomCache.get(cached.id)).toBeNull();
  });
});
