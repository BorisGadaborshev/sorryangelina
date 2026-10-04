import { describe, expect, it } from 'vitest';
import { Card, DEFAULT_ROOM_FEATURES, User } from '../types';
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
