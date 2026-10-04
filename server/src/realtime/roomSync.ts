import { Server } from 'socket.io';

const versions = new Map<string, number>();

let io: Server | null = null;

export const bindRoomSync = (server: Server): void => {
  io = server;
};

export const currentRoomVersion = (roomId: string): number => versions.get(roomId) ?? 0;

export const bumpRoomVersion = (roomId: string): number => {
  const version = currentRoomVersion(roomId) + 1;
  versions.set(roomId, version);
  io?.to(roomId).emit('room-version', { version });
  return version;
};

export const clearRoomVersion = (roomId: string): void => {
  versions.delete(roomId);
};
