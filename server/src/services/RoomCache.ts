import { Room } from '../types';

const TTL_MS = 60 * 1000;

type Entry = {
  room: Room;
  generation: number;
  storedAt: number;
};

const rooms = new Map<string, Entry>();
const generations = new Map<string, number>();

export const RoomCache = {
  generation(roomId: string): number {
    return generations.get(roomId) ?? 0;
  },

  get(roomId: string): Room | null {
    const entry = rooms.get(roomId);
    if (!entry) return null;
    if (entry.generation !== this.generation(roomId) || Date.now() - entry.storedAt > TTL_MS) {
      rooms.delete(roomId);
      return null;
    }
    return entry.room;
  },

  set(roomId: string, room: Room, generation?: number): void {
    const current = this.generation(roomId);
    const stamp = generation ?? current;
    if (stamp !== current) return;
    rooms.set(roomId, { room, generation: stamp, storedAt: Date.now() });
  },

  invalidate(roomId: string): void {
    generations.set(roomId, this.generation(roomId) + 1);
    rooms.delete(roomId);
  },

  clear(): void {
    for (const roomId of new Set([...rooms.keys(), ...generations.keys()])) {
      this.invalidate(roomId);
    }
  }
};
