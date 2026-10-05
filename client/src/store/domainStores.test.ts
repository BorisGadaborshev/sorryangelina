import { describe, expect, it } from 'vitest';
import { Card, CARD_TEXT_SEGMENT_SEPARATOR, DEFAULT_ROOM_FEATURES, User } from '../types';
import { DiscussionStore } from './DiscussionStore';
import { ExtrasStore } from './ExtrasStore';
import { RoomStore } from './RoomStore';

const boardHost = {
  persistBoardState: () => {},
  commands: () => null
};

const member = (name: string, role: User['role'] = 'user'): User => ({
  id: name,
  name,
  roomId: 'room',
  role
});

const card = (createdBy: string, column = 0): Card => ({
  id: `${createdBy}-${column}`,
  text: 'text',
  type: 'liked',
  createdBy,
  likes: [],
  dislikes: [],
  column
});

describe('RoomStore', () => {
  it('lets the author and an admin edit a card', () => {
    const room = new RoomStore(boardHost);
    room.currentUser = member('Ann');
    room.roomFeatures = { ...DEFAULT_ROOM_FEATURES, cardEditingEnabled: true };
    expect(room.canEditCard(card('Ann'))).toBe(true);
    expect(room.canEditCard(card('Ben'))).toBe(false);

    room.currentUser = member('Ann', 'admin');
    expect(room.canEditCard(card('Ben'))).toBe(true);
  });

  it('hides other people cards during creation when that option is on', () => {
    const room = new RoomStore(boardHost);
    room.phase = 'creation';
    room.currentUser = member('Ann');
    room.roomFeatures = { ...DEFAULT_ROOM_FEATURES, hideCardTextDuringCreation: true };
    expect(room.isCardTextHidden(card('Ben'))).toBe(true);
    expect(room.isCardTextHidden(card('Ann'))).toBe(false);

    room.currentUser = member('Ann', 'admin');
    expect(room.isCardTextHidden(card('Ben'))).toBe(false);
  });

  it('shows a merged card to each author whose text was combined', () => {
    const room = new RoomStore(boardHost);
    room.phase = 'creation';
    room.roomFeatures = { ...DEFAULT_ROOM_FEATURES, hideCardTextDuringCreation: true };
    const merged: Card = {
      ...card('Ann'),
      text: `текст Анны${CARD_TEXT_SEGMENT_SEPARATOR}текст Бена`,
      segmentAuthors: ['Ann', 'Ben']
    };

    room.currentUser = member('Ben');
    expect(room.isCardTextHidden(merged)).toBe(false);

    room.currentUser = member('Cara');
    expect(room.isCardTextHidden(merged)).toBe(true);
  });

  it('remembers the source column when a card moves onto the roadmap', () => {
    const room = new RoomStore(boardHost);
    room.cards = [card('Ann', 1)];
    const columnCount = room.templateConfig.columns.length;
    room.moveCard(room.cards[0].id, columnCount);
    expect(room.cards[0].column).toBe(columnCount);
    expect(room.cards[0].originColumn).toBe(1);
  });
});

describe('DiscussionStore', () => {
  it('keeps the latest bursts and ignores an empty one', () => {
    const discussion = new DiscussionStore(() => undefined);
    discussion.addDiscussionBurst({ id: '', emoji: '😂', userName: 'Ann' });
    expect(discussion.discussionBursts).toHaveLength(0);

    for (let index = 0; index < 45; index += 1) {
      discussion.addDiscussionBurst({ id: String(index), emoji: '👍', userName: 'Ann' });
    }
    expect(discussion.discussionBursts).toHaveLength(40);
    expect(discussion.discussionBursts[0].id).toBe('5');
    expect(discussion.discussionBursts[39].id).toBe('44');
  });

  it('remembers the facilitator after discussion ends', () => {
    const discussion = new DiscussionStore(() => 'room-1');
    discussion.setFacilitatorAnnouncement({ userId: '1', userName: 'Мария', selectedAt: 10 }, false);
    expect(discussion.sessionFacilitatorName).toBe('Мария');
    expect(discussion.facilitatorAnnouncement).toBeNull();
    expect(discussion.isFacilitatorDialogOpen).toBe(false);

    discussion.facilitatorAnnouncement = { userId: '1', userName: 'Мария', selectedAt: 10 };
    discussion.leaveDiscussion();
    expect(discussion.facilitatorAnnouncement).toBeNull();
    expect(discussion.sessionFacilitatorName).toBe('Мария');

    discussion.sessionFacilitatorName = '';
    discussion.facilitatorAnnouncement = { userId: '2', userName: 'Иван', selectedAt: 11 };
    discussion.leaveDiscussion();
    expect(discussion.sessionFacilitatorName).toBe('Иван');

    discussion.clear();
    expect(discussion.sessionFacilitatorName).toBe('');
  });
});

describe('ExtrasStore', () => {
  it('caps chat history and skips a duplicate whiteboard stroke', () => {
    const extras = new ExtrasStore({
      roomId: () => 'room',
      userName: () => 'Ann',
      submitArkanoidScore: () => {}
    });
    for (let index = 0; index < 205; index += 1) {
      extras.addChatMessage({
        id: String(index),
        roomId: 'room',
        userName: 'Ann',
        text: 'hi',
        timestamp: index
      });
    }
    expect(extras.chatMessages).toHaveLength(200);
    expect(extras.chatMessages[0].id).toBe('5');
    expect(extras.unreadChatCount).toBe(0);

    extras.addChatMessage({
      id: 'other',
      roomId: 'room',
      userName: 'Ben',
      text: 'hey',
      timestamp: 300
    });
    expect(extras.unreadChatCount).toBe(1);
    extras.setChatPanelOpen(true);
    expect(extras.unreadChatCount).toBe(0);
    extras.addChatMessage({
      id: 'other-2',
      roomId: 'room',
      userName: 'Ben',
      text: 'again',
      timestamp: 301
    });
    expect(extras.unreadChatCount).toBe(0);

    const stroke = {
      id: 'stroke-1',
      userId: 'Ann',
      color: '#111',
      width: 2,
      tool: 'pen' as const,
      points: [{ x: 0, y: 0 }]
    };
    extras.addWhiteboardStroke(stroke);
    extras.addWhiteboardStroke(stroke);
    expect(extras.whiteboardStrokes).toHaveLength(1);
  });
});
