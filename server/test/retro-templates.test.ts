import { describe, expect, it } from 'vitest';
import {
  COLUMN_COLOR_IDS,
  RETRO_TEMPLATE_IDS,
  RETRO_TEMPLATE_PICKER,
  RETRO_TEMPLATES,
  isRetroTemplateChoice,
  isRetroTemplateId,
  resolveRetroTemplateId
} from '../src/types';

describe('retro templates', () => {
  it('defines every catalog id with columns, description and valid colors', () => {
    expect(Object.keys(RETRO_TEMPLATES).sort()).toEqual([...RETRO_TEMPLATE_IDS].sort());

    for (const id of RETRO_TEMPLATE_IDS) {
      const template = RETRO_TEMPLATES[id];
      expect(template.id).toBe(id);
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(template.description.trim().length).toBeGreaterThan(0);
      expect(template.columns.length).toBeGreaterThanOrEqual(2);
      expect(new Set(template.columns.map((column) => column.title)).size).toBe(template.columns.length);
      for (const column of template.columns) {
        expect(COLUMN_COLOR_IDS).toContain(column.color);
        expect(['positive', 'negative', 'suggestion']).toContain(column.kind);
      }
    }
  });

  it('ends the picker with a random surprise option', () => {
    const last = RETRO_TEMPLATE_PICKER[RETRO_TEMPLATE_PICKER.length - 1];
    expect(last?.id).toBe('random');
    expect(last?.columns).toEqual([]);
    expect(isRetroTemplateChoice('random')).toBe(true);
    expect(isRetroTemplateId('random')).toBe(false);
  });

  it('resolves random into a real board template', () => {
    const picked = new Set(Array.from({ length: 40 }, () => resolveRetroTemplateId('random')));
    expect([...picked].every((id) => isRetroTemplateId(id))).toBe(true);
    expect(picked.size).toBeGreaterThan(1);
  });
});
