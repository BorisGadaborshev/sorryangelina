import { makeAutoObservable } from 'mobx';
import { ArkanoidScoreEntry, ChatMessage, SprintVipState, WhiteboardStroke } from '../types';
import { ExtrasHost } from './hosts';

const ARKANOID_STATS_KEY_PREFIX = 'arkanoidBest:';
export const ARKANOID_HITS_TO_BREAK = 3;
export const ARKANOID_POINTS_PER_HIT = 10;

export class ExtrasStore {
  chatMessages: ChatMessage[] = [];
  whiteboardStrokes: WhiteboardStroke[] = [];
  sprintVip: SprintVipState = { voteCount: 0 };
  arkanoidActive = false;
  arkanoidHits = new Map<string, number>();
  arkanoidScore = 0;
  arkanoidCardsBroken = 0;
  arkanoidBestScore = 0;
  arkanoidBestCardsBroken = 0;
  arkanoidHasPlayed = false;
  arkanoidScores: ArkanoidScoreEntry[] = [];
  private arkanoidStatsKey: string | null = null;

  constructor(private readonly host: ExtrasHost) {
    makeAutoObservable(this, { host: false } as object, { autoBind: true });
  }

  setChatHistory(messages: ChatMessage[]) {
    this.chatMessages = messages;
  }

  addChatMessage(message: ChatMessage) {
    this.chatMessages.push(message);
    if (this.chatMessages.length > 200) {
      this.chatMessages = this.chatMessages.slice(-200);
    }
  }

  setWhiteboardHistory(strokes: WhiteboardStroke[]) {
    this.whiteboardStrokes = strokes;
  }

  addWhiteboardStroke(stroke: WhiteboardStroke) {
    if (this.whiteboardStrokes.some((current) => current.id === stroke.id)) {
      return;
    }
    this.whiteboardStrokes.push(stroke);
    if (this.whiteboardStrokes.length > 5000) {
      this.whiteboardStrokes = this.whiteboardStrokes.slice(-5000);
    }
  }

  clearWhiteboard() {
    this.whiteboardStrokes = [];
  }

  setSprintVip(state: SprintVipState) {
    this.sprintVip = state;
  }

  private storageKey(): string | null {
    const roomId = this.host.roomId();
    const name = this.host.userName()?.trim();
    if (!roomId || !name) return null;
    return `${roomId}:${name}`;
  }

  ensureArkanoidStats() {
    const key = this.storageKey();
    if (!key || this.arkanoidStatsKey === key) return;
    this.arkanoidStatsKey = key;
    try {
      const raw = localStorage.getItem(`${ARKANOID_STATS_KEY_PREFIX}${key}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { bestScore?: number; bestCardsBroken?: number };
      const savedBest = Math.max(0, Math.floor(Number(parsed.bestScore) || 0));
      if (savedBest > this.arkanoidBestScore) {
        this.arkanoidBestScore = savedBest;
        this.arkanoidBestCardsBroken = Math.max(0, Math.floor(Number(parsed.bestCardsBroken) || 0));
      }
    } catch {
      localStorage.removeItem(`${ARKANOID_STATS_KEY_PREFIX}${key}`);
    }
  }

  private persistArkanoidStats() {
    const key = this.storageKey();
    if (!key || this.arkanoidBestScore <= 0) return;
    this.arkanoidStatsKey = key;
    try {
      localStorage.setItem(`${ARKANOID_STATS_KEY_PREFIX}${key}`, JSON.stringify({
        bestScore: this.arkanoidBestScore,
        bestCardsBroken: this.arkanoidBestCardsBroken
      }));
    } catch {
      // Ignore quota errors.
    }
  }

  beginArkanoidRound() {
    this.ensureArkanoidStats();
    this.arkanoidActive = true;
    this.arkanoidHasPlayed = true;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
    const sharedScore = this.arkanoidBestScore > 0 ? this.arkanoidBestScore : 0;
    const sharedBroken = sharedScore > 0 ? this.arkanoidBestCardsBroken : 0;
    this.host.submitArkanoidScore(sharedScore, sharedBroken);
  }

  restartArkanoidRound() {
    this.arkanoidActive = true;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
  }

  finishArkanoidRound() {
    this.arkanoidActive = false;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
  }

  recordArkanoidHit(cardId: string): number {
    const previous = this.arkanoidHits.get(cardId) || 0;
    if (previous >= ARKANOID_HITS_TO_BREAK) return previous;
    const next = previous + 1;
    this.arkanoidHits.set(cardId, next);
    this.arkanoidScore += ARKANOID_POINTS_PER_HIT;
    if (next >= ARKANOID_HITS_TO_BREAK) {
      this.arkanoidCardsBroken += 1;
    }
    if (this.arkanoidScore > this.arkanoidBestScore) {
      this.arkanoidBestScore = this.arkanoidScore;
      this.arkanoidBestCardsBroken = this.arkanoidCardsBroken;
      this.persistArkanoidStats();
    }
    this.host.submitArkanoidScore(this.arkanoidScore, this.arkanoidCardsBroken);
    return next;
  }

  setArkanoidScores(scores: ArkanoidScoreEntry[]) {
    const myName = this.host.userName()?.trim();
    const list = Array.isArray(scores) ? scores : [];
    const mine = myName ? list.find((entry) => entry.userName.trim() === myName) : undefined;
    const localBest = this.arkanoidBestScore;
    this.arkanoidScores = list;
    if (mine && mine.score > this.arkanoidBestScore) {
      this.arkanoidBestScore = Math.floor(mine.score);
      this.arkanoidBestCardsBroken = Math.max(0, Math.floor(mine.cardsBroken || 0));
    }
    if (mine && mine.score > localBest) {
      this.persistArkanoidStats();
      return;
    }
    if (myName && localBest > (mine?.score || 0)) {
      this.host.submitArkanoidScore(localBest, this.arkanoidBestCardsBroken);
    }
  }

  resetScores() {
    this.arkanoidStatsKey = null;
    this.arkanoidActive = false;
    this.arkanoidHits.clear();
    this.arkanoidScore = 0;
    this.arkanoidCardsBroken = 0;
    this.arkanoidBestScore = 0;
    this.arkanoidBestCardsBroken = 0;
    this.arkanoidHasPlayed = false;
    this.arkanoidScores = [];
  }

  clear() {
    this.chatMessages = [];
    this.whiteboardStrokes = [];
    this.sprintVip = { voteCount: 0 };
    this.resetScores();
  }
}
