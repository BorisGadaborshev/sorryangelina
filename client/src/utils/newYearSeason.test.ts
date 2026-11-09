import { describe, expect, it } from 'vitest';
import { isNewYearSeason } from './newYearSeason';

describe('isNewYearSeason', () => {
  it('starts on 1 December', () => {
    expect(isNewYearSeason(new Date(2026, 10, 30))).toBe(false);
    expect(isNewYearSeason(new Date(2026, 11, 1))).toBe(true);
  });

  it('covers New Year and ends on 15 January', () => {
    expect(isNewYearSeason(new Date(2027, 0, 1))).toBe(true);
    expect(isNewYearSeason(new Date(2027, 0, 15))).toBe(true);
    expect(isNewYearSeason(new Date(2027, 0, 16))).toBe(false);
  });
});
