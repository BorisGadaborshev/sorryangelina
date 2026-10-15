import { describe, expect, it } from 'vitest';
import { formatSprintRef, parseSprintRef, sprintOptions, sprintYearOptions } from './sprintPicker';

describe('sprintPicker', () => {
  it('formats and parses year.superSprint.sprint', () => {
    const ref = { year: 2026, superSprint: 6, sprint: 3 };
    expect(formatSprintRef(ref)).toBe('2026.6.3');
    expect(parseSprintRef('2026.6.3')).toEqual(ref);
    expect(parseSprintRef('2026.5.4')).toEqual({ year: 2026, superSprint: 5, sprint: 4 });
  });

  it('parses the previous labelled format', () => {
    expect(parseSprintRef('2026 · СС2 · Спринт 6')).toEqual({
      year: 2026,
      superSprint: 2,
      sprint: 6
    });
  });

  it('rejects sprint numbers outside a super sprint', () => {
    expect(parseSprintRef('2026.1.7')).toBeNull();
    expect(parseSprintRef('2026.7.1')).toBeNull();
  });

  it('lists dotted sprints for nearby years', () => {
    const now = new Date('2026-10-15');
    expect(sprintYearOptions(now)).toEqual([2025, 2026, 2027]);
    const options = sprintOptions(now);
    expect(options).toContain('2026.6.3');
    expect(options).toContain('2026.5.4');
    expect(options.filter((item) => item.startsWith('2026.')).length).toBe(36);
  });
});
