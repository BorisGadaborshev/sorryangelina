import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_FEATURES, DEFAULT_TEAM_ROOM_SETTINGS, RETRO_TEMPLATES } from '../src/types';
import {
  changedRoomFeatures,
  normalizeTeamRoomSettings,
  patchTeamRoomFeatures,
  roomSettingsForNewRoom,
  withColumnColors,
  withColumnTitles
} from '../src/utils/teamRoomSettings';

describe('team room settings', () => {
  it('starts from the current room defaults', () => {
    const settings = normalizeTeamRoomSettings(null);
    expect(settings).toEqual(DEFAULT_TEAM_ROOM_SETTINGS);
    expect(settings.template).toBe('classic');
    expect(settings.columnTitles).toEqual(RETRO_TEMPLATES.classic.columns.map((column) => column.title));
    expect(settings.features).toEqual({ ...DEFAULT_ROOM_FEATURES, backgroundImage: '' });
  });

  it('keeps saved columns when the next room uses the same template', () => {
    const stored = normalizeTeamRoomSettings({
      template: 'sailboat',
      columnTitles: ['Ветер', 'Якоря', 'Рифы', 'Земля'],
      features: { likesPerUser: 8, backgroundImage: '/api/uploads/old.png' }
    });

    const next = roomSettingsForNewRoom(stored, 'sailboat');
    expect(next.templateChanged).toBe(false);
    expect(next.settings.columnTitles).toEqual(['Ветер', 'Якоря', 'Рифы', 'Земля']);
    expect(next.settings.features.likesPerUser).toBe(8);
    expect(next.settings.features.backgroundImage).toBe('');
  });

  it('switches template defaults without dropping the other settings', () => {
    const stored = normalizeTeamRoomSettings({
      template: 'classic',
      columnTitles: ['Плюс', 'Минус', 'Действия'],
      features: { musicEnabled: false }
    });

    const next = roomSettingsForNewRoom(stored, 'four-ls');
    expect(next.templateChanged).toBe(true);
    expect(next.settings.template).toBe('four-ls');
    expect(next.settings.columnTitles).toEqual(RETRO_TEMPLATES['four-ls'].columns.map((column) => column.title));
    expect(next.settings.features.musicEnabled).toBe(false);
    expect(next.settings.features.likesPerUser).toBe(DEFAULT_ROOM_FEATURES.likesPerUser);
  });

  it('saves only the feature that changed and ignores the room background', () => {
    const stored = normalizeTeamRoomSettings({ features: { likesPerUser: 3, chatEnabled: true } });
    const before = { ...stored.features, likesPerUser: 3 as const, backgroundImage: '' };
    const after = { ...before, likesPerUser: 9 as const, backgroundImage: '/api/uploads/room.png' };

    const patched = patchTeamRoomFeatures(stored, changedRoomFeatures(before, after));
    expect(patched.features.likesPerUser).toBe(9);
    expect(patched.features.chatEnabled).toBe(true);
    expect(patched.features.backgroundImage).toBe('');
    expect(patched.template).toBe('classic');
  });

  it('updates column names only for the template stored in the team config', () => {
    const stored = normalizeTeamRoomSettings(null);
    expect(withColumnTitles(stored, 'classic', ['Хорошо', 'Плохо', 'Дальше'])?.columnTitles).toEqual([
      'Хорошо',
      'Плохо',
      'Дальше'
    ]);
    expect(withColumnTitles(stored, 'sailboat', ['Паруса', 'Якоря', 'Рифы', 'Земля'])).toBeNull();
    expect(withColumnColors(stored, 'classic', ['green', 'pink', 'blue'])?.columnColors).toEqual([
      'green',
      'pink',
      'blue'
    ]);
  });
});
