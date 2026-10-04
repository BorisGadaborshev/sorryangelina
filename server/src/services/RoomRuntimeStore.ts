import { pool } from '../config/database';
import { Phase } from '../types';
import { logger } from '../utils/logger';

export interface StoredTimer {
  phase: Phase;
  durationSeconds: number;
  endAt: number;
}

export interface StoredRating {
  votes: Array<[string, 1 | 2 | 3 | 4 | 5]>;
  resultsVisible: boolean;
}

export interface StoredFacilitator {
  userId: string;
  userName: string;
  selectedAt: number;
}

export interface StoredDiscussion {
  unviewedCardIds: string[];
  viewedCardIds: string[];
}

export interface StoredRoomRuntime {
  timer: StoredTimer | null;
  rating: StoredRating | null;
  facilitator: StoredFacilitator | null;
  discussion: StoredDiscussion | null;
}

const emptyRuntime = (): StoredRoomRuntime => ({
  timer: null,
  rating: null,
  facilitator: null,
  discussion: null
});

export const readRoomRuntime = async (roomId: string): Promise<StoredRoomRuntime> => {
  const { rows } = await pool.query(
    `select timer, rating, facilitator, discussion from room_runtime where room_id = $1`,
    [roomId]
  );
  if (rows.length === 0) return emptyRuntime();
  const row = rows[0] as {
    timer: StoredTimer | null;
    rating: StoredRating | null;
    facilitator: StoredFacilitator | null;
    discussion: StoredDiscussion | null;
  };
  return {
    timer: row.timer,
    rating: row.rating,
    facilitator: row.facilitator,
    discussion: row.discussion
  };
};

export const writeRoomRuntime = async (roomId: string, state: StoredRoomRuntime): Promise<void> => {
  try {
    await pool.query(
      `insert into room_runtime (room_id, timer, rating, facilitator, discussion, updated_at)
       values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, now())
       on conflict (room_id) do update set
         timer = excluded.timer,
         rating = excluded.rating,
         facilitator = excluded.facilitator,
         discussion = excluded.discussion,
         updated_at = now()`,
      [
        roomId,
        state.timer ? JSON.stringify(state.timer) : null,
        state.rating ? JSON.stringify(state.rating) : null,
        state.facilitator ? JSON.stringify(state.facilitator) : null,
        state.discussion ? JSON.stringify(state.discussion) : null
      ]
    );
  } catch (error) {
    logger.error({ err: error, roomId }, 'failed to persist room runtime');
  }
};
