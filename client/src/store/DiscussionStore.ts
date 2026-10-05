import { makeAutoObservable } from 'mobx';
import {
  DiscussionBurst,
  DiscussionHand,
  DiscussionNavigationState,
  FacilitatorAnnouncement,
  RetroRatingState
} from '../types';
import { readStoredSession } from '../services/session';

const EMPTY_RATING: RetroRatingState = {
  hasVoted: false,
  votesCount: 0,
  totalCount: 0,
  resultsVisible: false
};

export class DiscussionStore {
  facilitatorAnnouncement: FacilitatorAnnouncement | null = null;
  sessionFacilitatorName = '';
  isFacilitatorDialogOpen = false;
  discussionNavigation: DiscussionNavigationState | null = null;
  discussionHands: string[] = [];
  discussionBursts: DiscussionBurst[] = [];
  retroRating: RetroRatingState = { ...EMPTY_RATING };

  constructor(private readonly joinedRoomId: () => string | undefined) {
    makeAutoObservable(this, { joinedRoomId: false } as object, { autoBind: true });
  }

  private roomId(): string | undefined {
    return this.joinedRoomId() ?? readStoredSession()?.roomId;
  }

  private facilitatorSeenKey(roomId: string): string {
    return `facilitatorSeen:${roomId}`;
  }

  private seenFacilitatorSelectedAt(roomId: string): number | null {
    const raw = localStorage.getItem(this.facilitatorSeenKey(roomId));
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  private markFacilitatorSeen(roomId: string, selectedAt: number) {
    localStorage.setItem(this.facilitatorSeenKey(roomId), String(selectedAt));
  }

  setRetroRating(rating: RetroRatingState) {
    this.retroRating = rating;
  }

  setFacilitatorAnnouncement(announcement: FacilitatorAnnouncement | null, announce = true) {
    const name = announcement?.userName?.trim();
    if (name) this.sessionFacilitatorName = name;
    if (announcement && !announce) return;

    this.facilitatorAnnouncement = announcement;
    if (!announcement) {
      this.isFacilitatorDialogOpen = false;
      return;
    }

    const roomId = this.roomId();
    const alreadySeen = roomId
      ? this.seenFacilitatorSelectedAt(roomId) === announcement.selectedAt
      : false;
    this.isFacilitatorDialogOpen = !alreadySeen;
  }

  dismissFacilitatorDialog() {
    const announcement = this.facilitatorAnnouncement;
    const roomId = this.roomId();
    if (announcement && roomId) {
      this.markFacilitatorSeen(roomId, announcement.selectedAt);
    }
    this.isFacilitatorDialogOpen = false;
  }

  setDiscussionNavigation(state: DiscussionNavigationState | null) {
    this.discussionNavigation = state;
  }

  setDiscussionHands(hands: DiscussionHand[]) {
    this.discussionHands = hands
      .map((hand) => hand.userName?.trim())
      .filter((name): name is string => Boolean(name));
  }

  addDiscussionBurst(burst: DiscussionBurst) {
    if (!burst?.id || !burst.emoji) return;
    this.discussionBursts = [...this.discussionBursts, burst].slice(-40);
  }

  isFacilitator(userName: string | undefined): boolean {
    if (!userName || !this.facilitatorAnnouncement) return false;
    return this.facilitatorAnnouncement.userName === userName;
  }

  clearPresence() {
    this.discussionHands = [];
    this.discussionBursts = [];
  }

  leaveDiscussion() {
    const name = this.facilitatorAnnouncement?.userName?.trim();
    if (name) this.sessionFacilitatorName = name;
    this.discussionNavigation = null;
    this.facilitatorAnnouncement = null;
    this.isFacilitatorDialogOpen = false;
    this.discussionHands = [];
    this.discussionBursts = [];
  }

  clear() {
    this.sessionFacilitatorName = '';
    this.leaveDiscussion();
    this.retroRating = { ...EMPTY_RATING };
  }
}
