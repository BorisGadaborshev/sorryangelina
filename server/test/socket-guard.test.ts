import { describe, expect, it } from 'vitest';
import { on } from '../src/realtime/on';

const listen = () => {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const handlers = new Map<string, (payload: unknown, ack?: (response: unknown) => void) => void>();
  const socket = {
    id: 'socket-test',
    data: {} as { auth?: { name: string }; userName?: string },
    on(event: string, callback: (payload: unknown, ack?: (response: unknown) => void) => void) {
      handlers.set(event, callback);
    },
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
    }
  };
  return { socket, handlers, emitted };
};

describe('socket guard', () => {
  it('does not let a missing payload escape the handler', async () => {
    const { socket, handlers, emitted } = listen();
    on(socket as never, 'add-card', async ({ text }) => {
      if (!text) throw new Error('missing text');
    });

    handlers.get('add-card')?.(undefined);
    await new Promise((resolve) => setImmediate(resolve));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('error');
  });

  it('rejects an invalid add-card payload and acknowledges it', async () => {
    const { socket, handlers, emitted } = listen();
    on(socket as never, 'add-card', async () => {});

    let acked: { ok: boolean } | null = null;
    handlers.get('add-card')?.({ text: 'hello' }, (response) => {
      acked = response as { ok: boolean };
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(acked).toEqual({ ok: false, error: 'Некорректные данные' });
    expect(emitted[0]).toMatchObject({ event: 'error', payload: 'Некорректные данные' });
  });

  it('rate limits add-card per socket', async () => {
    const { socket, handlers, emitted } = listen();
    socket.id = 'socket-rate';
    let accepted = 0;
    on(socket as never, 'add-card', async () => {
      accepted += 1;
    });

    for (let index = 0; index < 5; index += 1) {
      handlers.get('add-card')?.({ text: 'card', column: 0 });
    }
    await new Promise((resolve) => setImmediate(resolve));

    expect(accepted).toBe(4);
    expect(emitted).toHaveLength(1);
    expect(String(emitted[0].payload)).toMatch(/Слишком много/);
  });
});
