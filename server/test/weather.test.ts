import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBoardWeather,
  locateByIp,
  resetWeatherCaches,
  weatherKindFromCode
} from '../src/services/Weather';

afterEach(() => {
  resetWeatherCaches();
  vi.unstubAllEnvs();
});

describe('weatherKindFromCode', () => {
  it('maps clear codes to clouds', () => {
    expect(weatherKindFromCode(0)).toBe('clouds');
    expect(weatherKindFromCode(1)).toBe('clouds');
  });

  it('maps rain, showers and thunder to rain', () => {
    expect(weatherKindFromCode(61)).toBe('rain');
    expect(weatherKindFromCode(80)).toBe('rain');
    expect(weatherKindFromCode(95)).toBe('rain');
  });

  it('maps snowfall to snow', () => {
    expect(weatherKindFromCode(71)).toBe('snow');
    expect(weatherKindFromCode(77)).toBe('snow');
    expect(weatherKindFromCode(85)).toBe('snow');
  });

  it('maps overcast and fog to clouds', () => {
    expect(weatherKindFromCode(2)).toBe('clouds');
    expect(weatherKindFromCode(3)).toBe('clouds');
    expect(weatherKindFromCode(45)).toBe('clouds');
    expect(weatherKindFromCode(Number.NaN)).toBe('clouds');
  });
});

describe('fetchBoardWeather', () => {
  it('reads the current Open-Meteo code and caches the result', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      current: { weather_code: 73, is_day: 0 }
    }), { status: 200 }));

    const first = await fetchBoardWeather(55.751, 37.618, fetchImpl);
    const second = await fetchBoardWeather(55.75, 37.62, fetchImpl);

    expect(first).toEqual({ kind: 'snow', isDay: false });
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('locateByIp', () => {
  it('uses a Moscow fallback for private addresses in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const fetchImpl = vi.fn();
    await expect(locateByIp('127.0.0.1', fetchImpl)).resolves.toEqual({ lat: 55.75, lon: 37.62 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not geolocate private addresses in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fetchImpl = vi.fn();
    await expect(locateByIp('192.168.1.20', fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
