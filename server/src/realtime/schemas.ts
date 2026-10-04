import type { ClientEventName } from '@sorryangelina/shared';
import { z } from 'zod';
import { CARD_REACTION_EMOJIS, COLUMN_COLOR_IDS, DISCUSSION_BURST_EMOJIS } from '../types';

const id = z.string().trim().min(1).max(200);
const shortText = z.string().max(500);
const cardText = z.string().max(1000);
const imageRef = z.string().max(4 * 1024 * 1024);

export const eventSchemas: Record<ClientEventName, z.ZodTypeAny> = {
  'restore-session': z.object({
    roomId: id,
    userId: id,
    username: z.string().max(80).optional(),
    token: z.string().max(4000).optional()
  }).passthrough(),
  'create-room': z.object({
    roomId: id,
    password: z.string().max(200).optional(),
    username: z.string().max(80).optional(),
    token: z.string().max(4000).optional(),
    teamId: z.string().max(200).optional(),
    template: z.string().max(40).optional()
  }).passthrough(),
  'join-room': z.object({
    roomId: id,
    password: z.string().max(200).optional(),
    username: z.string().max(80).optional(),
    token: z.string().max(4000).optional()
  }).passthrough(),
  'leave-room': z.object({}).passthrough(),
  disconnect: z.string(),
  error: z.unknown(),
  'add-card': z.object({
    text: cardText.optional(),
    type: z.enum(['liked', 'disliked', 'suggestion']).optional(),
    column: z.number().int(),
    imageUrl: imageRef.optional()
  }).passthrough(),
  'update-card': z.object({
    cardId: id,
    text: cardText.optional(),
    imageUrl: imageRef.nullish()
  }).passthrough(),
  'delete-card': z.object({ cardId: id }).passthrough(),
  'delete-all-cards': z.object({}).passthrough(),
  'merge-cards': z.object({ targetCardId: id, sourceCardId: id }).passthrough(),
  'move-card': z.object({ cardId: id, column: z.number().int() }).passthrough(),
  'vote-card': z.object({
    cardId: id,
    voteType: z.enum(['like', 'dislike'])
  }).passthrough(),
  'update-ready-state': z.object({
    isReady: z.boolean(),
    token: z.string().max(4000).optional(),
    roomId: z.string().max(200).optional()
  }).passthrough(),
  'set-card-author-reveal': z.object({
    cardId: id,
    revealed: z.boolean()
  }).passthrough(),
  'add-card-comment': z.object({ cardId: id, text: shortText }).passthrough(),
  'update-card-comment': z.object({
    cardId: id,
    commentId: id,
    text: shortText
  }).passthrough(),
  'toggle-card-reaction': z.object({
    cardId: id,
    emoji: z.enum(CARD_REACTION_EMOJIS)
  }).passthrough(),
  'change-phase': z.object({
    phase: z.enum(['creation', 'voting', 'discussion', 'roadmap', 'rating'])
  }).passthrough(),
  'set-column-titles': z.object({
    titles: z.array(z.string().trim().min(1).max(80)).min(1).max(12)
  }).passthrough(),
  'set-column-colors': z.object({
    colors: z.array(z.enum(COLUMN_COLOR_IDS)).min(1).max(12)
  }).passthrough(),
  'set-room-features': z.object({
    features: z.record(z.unknown())
  }).passthrough(),
  'set-phase-timer': z.object({
    durationSeconds: z.union([
      z.literal(60),
      z.literal(180),
      z.literal(300),
      z.literal(600),
      z.literal(900)
    ])
  }).passthrough(),
  'reset-phase-timer': z.object({}).passthrough(),
  'set-discussion-navigation': z.object({
    unviewedCardIds: z.array(id).max(500),
    viewedCardIds: z.array(id).max(500)
  }).passthrough(),
  'discussion-burst': z.object({
    emoji: z.enum(DISCUSSION_BURST_EMOJIS)
  }).passthrough(),
  'toggle-discussion-hand': z.object({}).passthrough(),
  'submit-retro-rating': z.object({
    value: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
  }).passthrough(),
  'show-retro-rating-results': z.object({}).passthrough(),
  'vote-sprint-vip': z.object({ userName: z.string().trim().min(1).max(80) }).passthrough(),
  'arkanoid-score': z.object({
    score: z.number().finite().min(0).max(1_000_000),
    cardsBroken: z.number().finite().min(0).max(100_000)
  }).passthrough(),
  'set-user-mood': z.object({
    mood: z.enum(['great', 'good', 'neutral', 'bad', 'awful'])
  }).passthrough(),
  'send-chat-message': z.object({ text: shortText }).passthrough(),
  'whiteboard-stroke': z.object({}).passthrough(),
  'clear-whiteboard': z.object({}).passthrough(),
  'set-room-background': z.object({
    backgroundImage: z.string().max(4 * 1024 * 1024)
  }).passthrough(),
  'transfer-room-admin': z.object({ userId: id }).passthrough(),
  'kick-user': z.object({ userId: id }).passthrough(),
  'delete-room': z.object({}).passthrough(),
  'sync-room': z.object({}).passthrough()
};

const IDENTITY_SKIP = new Set([
  'restore-session',
  'create-room',
  'join-room',
  'leave-room',
  'disconnect',
  'error'
]);

const RATE_SKIP = new Set(['disconnect', 'error']);

const MAX_PER_SECOND: Record<string, number> = {
  'whiteboard-stroke': 30,
  'discussion-burst': 6,
  'arkanoid-score': 4,
  'add-card': 4,
  'vote-card': 8,
  'send-chat-message': 4,
  'toggle-card-reaction': 8,
  'add-card-comment': 4
};

export const maxEventsPerSecond = (event: string): number => MAX_PER_SECOND[event] ?? 15;

export const skipsIdentityCheck = (event: string): boolean => IDENTITY_SKIP.has(event);

export const skipsRateLimit = (event: string): boolean => RATE_SKIP.has(event);
