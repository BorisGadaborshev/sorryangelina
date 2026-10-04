import { describe, expect, it } from 'vitest';
import { formatDuration } from '../components/PhaseTimer';
import { getApiBase } from './apiBase';

describe('formatDuration', () => {
  it('renders minutes and seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(-4)).toBe('00:00');
  });
});

describe('getApiBase', () => {
  it('uses the local server in development when no override is set', () => {
    expect(getApiBase()).toBe('http://localhost:3001');
  });
});
