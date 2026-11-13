import { Socket } from 'socket.io';
import { on, rejectAction } from '../on';
import { logger } from '../../utils/logger';
import { RealtimeSession } from '../session';
import { RoomService } from '../../services/RoomService';
import { assertNoProfanity, ContentModerationError } from '../../services/ContentModeration';
import { isRoomAdmin, moderateRoomText } from '../access';
import {
  CHARADES_WARMUP_MARKER,
  EMPTY_CHARADES_STATE,
  isCharadesWarmup,
  normalizeWarmupAnswers,
  normalizeWarmupQuestions,
  visibleWarmupQuestions
} from '../../types';
import { ensureCharadesPlaying } from '../charades';
import {
  emitWarmupStateToRoom,
  getWarmupRoomState,
  io,
  maybeRevealWarmup,
  persistRoomEphemeral,
  resolveSocketActor
} from '../runtime';

export function registerWarmupHandlers(socket: Socket, session: RealtimeSession): void {
  on(socket, 'set-warmup-questions', async ({ warmupQuestions }) => {
    const actor = await resolveSocketActor(socket, session.currentUser);
    if (actor?.roomId) session.currentUser = actor;
    if (!actor?.roomId) {
      rejectAction(socket, 'Не удалось обновить разминку: сессия не восстановлена');
      return;
    }

    try {
      const room = await RoomService.getRoom(actor.roomId);
      if (!room || !isRoomAdmin(room, actor.name)) return;

      const normalized = normalizeWarmupQuestions(warmupQuestions);
      const toModerate = normalized.filter((question) => question !== CHARADES_WARMUP_MARKER);
      if (toModerate.length > 0) {
        await assertNoProfanity(toModerate.map((text) => ({ kind: 'card' as const, text })));
      }

      const updated = await RoomService.updateWarmupQuestions(actor.roomId, normalized);
      if (!updated) {
        rejectAction(socket, 'Не удалось обновить разминку');
        return;
      }

      const warmup = getWarmupRoomState(updated.id);
      warmup.answers = new Map();
      warmup.resultsVisible = false;

      const hasWarmup = visibleWarmupQuestions(updated.warmupQuestions || []).length > 0
        || isCharadesWarmup(updated.warmupQuestions);
      let roomState = updated;
      if (updated.phase === 'warmup' && !hasWarmup) {
        const nextRoom = await RoomService.updatePhase(updated.id, 'creation', actor.id, actor.name);
        if (nextRoom) {
          roomState = nextRoom;
          io.to(updated.id).emit('phase-changed', { phase: nextRoom.phase, cards: nextRoom.cards });
          io.to(updated.id).emit('state-updated', {
            cards: nextRoom.cards,
            phase: nextRoom.phase,
            users: nextRoom.users
          });
        }
      }

      io.to(roomState.id).emit('warmup-questions-updated', {
        warmupQuestions: roomState.warmupQuestions || []
      });
      await persistRoomEphemeral(roomState.id);
      await emitWarmupStateToRoom(roomState.id);
      if (isCharadesWarmup(roomState.warmupQuestions) && roomState.phase === 'warmup') {
        await ensureCharadesPlaying(roomState.id);
      } else if (!isCharadesWarmup(roomState.warmupQuestions)) {
        io.to(roomState.id).emit('charades-state', EMPTY_CHARADES_STATE);
      }
    } catch (error) {
      if (error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to update warmup questions');
      rejectAction(socket, 'Не удалось обновить разминку');
    }
  });

  on(socket, 'submit-warmup-answers', async ({ answers }) => {
    if (!session.currentUser?.roomId) return;

    try {
      const room = await RoomService.getRoom(session.currentUser.roomId);
      if (!room || room.phase !== 'warmup') return;
      if (isCharadesWarmup(room.warmupQuestions)) return;
      const questions = visibleWarmupQuestions(normalizeWarmupQuestions(room.warmupQuestions));
      if (questions.length === 0) {
        rejectAction(socket, 'В этой комнате нет разминки');
        return;
      }

      const normalized = normalizeWarmupAnswers(answers, questions.length);
      if (!normalized) {
        rejectAction(socket, 'Ответьте на все вопросы разминки');
        return;
      }

      for (const answer of normalized) {
        await moderateRoomText(room, answer);
      }

      const warmup = getWarmupRoomState(room.id);
      if (!warmup.answers.has(session.currentUser.name)) {
        warmup.answers.set(session.currentUser.name, normalized);
      }
      maybeRevealWarmup(room);
      await persistRoomEphemeral(room.id);
      await emitWarmupStateToRoom(room.id);
    } catch (error) {
      if (error instanceof ContentModerationError) {
        rejectAction(socket, error.message);
        return;
      }
      logger.error({ err: error }, 'failed to submit warmup answers');
      rejectAction(socket, 'Failed to submit warmup answers');
    }
  });
}
