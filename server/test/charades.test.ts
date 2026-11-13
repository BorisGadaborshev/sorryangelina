import { describe, expect, it } from 'vitest';
import {
  CHARADES_WARMUP_MARKER,
  isCharadesWarmup,
  isCorrectCharadesGuess,
  normalizeWarmupQuestions,
  visibleWarmupQuestions
} from '../src/types';
import { charadesDifficulty, pickCharadesFallbackWord } from '../src/services/CharadesWords';

describe('charades warmup', () => {
  it('keeps the charades marker as warmup', () => {
    expect(normalizeWarmupQuestions([CHARADES_WARMUP_MARKER])).toEqual([CHARADES_WARMUP_MARKER]);
    expect(isCharadesWarmup([CHARADES_WARMUP_MARKER])).toBe(true);
    expect(visibleWarmupQuestions([CHARADES_WARMUP_MARKER, 'Как дела?'])).toEqual(['Как дела?']);
  });

  it('accepts the first exact guess and ignores extra punctuation', () => {
    expect(isCorrectCharadesGuess('Кошка!', 'кошка')).toBe(true);
    expect(isCorrectCharadesGuess('это кошка', 'кошка')).toBe(true);
    expect(isCorrectCharadesGuess('кот', 'кошка')).toBe(false);
    expect(isCorrectCharadesGuess('воздушный шар?', 'воздушный шар')).toBe(true);
  });

  it('raises difficulty after more guessed words', () => {
    expect(charadesDifficulty(0)).toBe(1);
    expect(charadesDifficulty(3)).toBe(2);
    expect(charadesDifficulty(6)).toBe(3);
  });

  it('picks harder fallback words once several are guessed', () => {
    const easy = pickCharadesFallbackWord([], 0);
    const hard = pickCharadesFallbackWord([], 8);
    expect(easy.length).toBeGreaterThan(2);
    expect(hard.length).toBeGreaterThan(2);
    expect(pickCharadesFallbackWord(['ностальгия'], 8).toLocaleLowerCase('ru-RU')).not.toBe('ностальгия');
  });
});
