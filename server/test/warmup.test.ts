import { describe, expect, it } from 'vitest';
import {
  collectAnonymousWarmupAnswers,
  normalizeWarmupAnswers,
  normalizeWarmupQuestions
} from '../src/types';

describe('warmup questions', () => {
  it('does not treat charades rooms as question warmup', () => {
    expect(normalizeWarmupQuestions(['__charades__'])).toEqual(['__charades__']);
  });

  it('keeps trimmed unique questions', () => {
    expect(normalizeWarmupQuestions(['  Как дела?  ', '', 'как дела?', 'Что нового?', 12])).toEqual([
      'Как дела?',
      'Что нового?'
    ]);
  });

  it('rejects incomplete answers', () => {
    expect(normalizeWarmupAnswers(['да', '  '], 2)).toBeNull();
    expect(normalizeWarmupAnswers(['да'], 2)).toBeNull();
    expect(normalizeWarmupAnswers(['да', ' нет '], 2)).toEqual(['да', 'нет']);
  });

  it('returns answers without tying them to a person', () => {
    const anonymous = collectAnonymousWarmupAnswers(2, [
      ['Анна про спринт', 'кофе'],
      ['Бен про релиз', 'чай']
    ]);
    expect(anonymous).toHaveLength(2);
    expect([...anonymous[0]].sort()).toEqual(['Анна про спринт', 'Бен про релиз']);
    expect([...anonymous[1]].sort()).toEqual(['кофе', 'чай']);
  });
});
