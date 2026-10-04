import { Socket } from 'socket.io';

export const on = (
  socket: Socket,
  event: string,
  handler: (payload: any) => Promise<void> | void
): void => {
  socket.on(event, (payload: unknown) => {
    void Promise.resolve()
      .then(() => handler(payload ?? {}))
      .catch((error) => {
        console.error(`Socket handler ${event} failed:`, error);
        socket.emit('error', 'Не удалось выполнить действие');
      });
  });
};
