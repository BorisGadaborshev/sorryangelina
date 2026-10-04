import { AsyncLocalStorage } from 'async_hooks';
import type { ClientEventName, ClientEventPayload } from '@sorryangelina/shared';
import { Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { eventSchemas, maxEventsPerSecond, skipsIdentityCheck, skipsRateLimit } from './schemas';

export type ActionAck = (response: { ok: true } | { ok: false; error: string }) => void;

type AckState = {
  ack?: ActionAck;
  settled: boolean;
};

const ackContext = new AsyncLocalStorage<AckState>();
const hits = new Map<string, number[]>();

const isAck = (value: unknown): value is ActionAck => typeof value === 'function';

export const clearEventRateLimit = (socketId: string): void => {
  const prefix = `${socketId}:`;
  for (const key of hits.keys()) {
    if (key.startsWith(prefix)) hits.delete(key);
  }
};

const allowEvent = (socketId: string, event: string): boolean => {
  const now = Date.now();
  const key = `${socketId}:${event}`;
  const recent = (hits.get(key) || []).filter((timestamp) => now - timestamp < 1000);
  if (recent.length >= maxEventsPerSecond(event)) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
};

const identityError = (socket: Socket, event: string): string | null => {
  if (skipsIdentityCheck(event)) return null;
  const auth = socket.data?.auth as { name?: unknown } | undefined;
  const userName = socket.data?.userName;
  if (!auth || typeof auth.name !== 'string' || typeof userName !== 'string') return null;
  if (auth.name !== userName) return 'Unauthorized: token does not match user';
  return null;
};

const settle = (response: { ok: true } | { ok: false; error: string }): void => {
  const state = ackContext.getStore();
  if (!state || state.settled) return;
  state.settled = true;
  state.ack?.(response);
};

export const rejectAction = (socket: Socket, message: string): void => {
  settle({ ok: false, error: message });
  socket.emit('error', message);
};

const schemaInput = (event: string, payload: unknown): unknown => {
  if (event === 'disconnect') {
    return typeof payload === 'string' ? payload : '';
  }
  if (payload == null) return {};
  return payload;
};

export const on = <E extends ClientEventName>(
  socket: Socket,
  event: E,
  handler: (payload: ClientEventPayload<E>) => Promise<void> | void
): void => {
  const listen = socket.on.bind(socket) as (
    eventName: string,
    listener: (payload: unknown, ack?: unknown) => void
  ) => void;
  listen(event, (payload: unknown, ack?: unknown) => {
    const state: AckState = { ack: isAck(ack) ? ack : undefined, settled: false };
    void ackContext.run(state, () => Promise.resolve()
      .then(async () => {
        if (!skipsRateLimit(event) && !allowEvent(socket.id, event)) {
          rejectAction(socket, 'Слишком много действий, подождите секунду');
          return;
        }

        const mismatched = identityError(socket, event);
        if (mismatched) {
          rejectAction(socket, mismatched);
          return;
        }

        const schema = eventSchemas[event];
        const input = schemaInput(event, payload);
        let parsed: unknown = input;
        if (schema) {
          const result = schema.safeParse(input);
          if (!result.success) {
            rejectAction(socket, 'Некорректные данные');
            return;
          }
          parsed = result.data;
        }

        await handler(parsed as ClientEventPayload<E>);
        settle({ ok: true });
      })
      .catch((error) => {
        logger.error({ err: error, event, socketId: socket.id }, 'socket handler failed');
        if (!state.settled) {
          rejectAction(socket, 'Не удалось выполнить действие');
        }
      }));
  });
};
