export type WeatherKind = 'clouds' | 'rain' | 'snow';

export interface BoardWeather {
  kind: WeatherKind;
  isDay: boolean;
}

interface OpenMeteoCurrent {
  weather_code?: number;
  is_day?: number;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
}

interface IpWhoResponse {
  success?: boolean;
  latitude?: number;
  longitude?: number;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const WEATHER_TTL_MS = 20 * 60 * 1000;
const GEO_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT = 'SorryAngelina/1.21 (board-weather)';

const weatherCache = new Map<string, { expiresAt: number; value: BoardWeather }>();
const geoCache = new Map<string, { expiresAt: number; value: { lat: number; lon: number } | null }>();

export const weatherKindFromCode = (code: number): WeatherKind => {
  if (!Number.isFinite(code)) return 'clouds';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
    return 'rain';
  }
  return 'clouds';
};

export const parseCoordinate = (value: unknown, min: number, max: number): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

export const roundCoord = (value: number): number => Math.round(value * 100) / 100;

const isPrivateIp = (ip: string): boolean => {
  const value = ip.replace(/^::ffff:/, '');
  if (!value || value === '::1' || value === '127.0.0.1') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.') || value.startsWith('127.')) return true;
  const match = /^172\.(\d+)\./.exec(value);
  if (match) {
    const octet = Number(match[1]);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
};

const fetchJson = async <T>(url: string, fetchImpl: FetchLike): Promise<T> => {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`Weather HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const resetWeatherCaches = (): void => {
  weatherCache.clear();
  geoCache.clear();
};

export const locateByIp = async (
  ip: string,
  fetchImpl: FetchLike = fetch
): Promise<{ lat: number; lon: number } | null> => {
  if (isPrivateIp(ip)) {
    if (process.env.NODE_ENV === 'development') {
      return { lat: 55.75, lon: 37.62 };
    }
    return null;
  }

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const payload = await fetchJson<IpWhoResponse>(`https://ipwho.is/${encodeURIComponent(ip)}`, fetchImpl);
    const lat = parseCoordinate(payload.latitude, -90, 90);
    const lon = parseCoordinate(payload.longitude, -180, 180);
    const value = payload.success === false || lat === null || lon === null ? null : { lat, lon };
    geoCache.set(ip, { expiresAt: Date.now() + GEO_TTL_MS, value });
    return value;
  } catch {
    geoCache.set(ip, { expiresAt: Date.now() + 10 * 60 * 1000, value: null });
    return null;
  }
};

export const fetchBoardWeather = async (
  lat: number,
  lon: number,
  fetchImpl: FetchLike = fetch
): Promise<BoardWeather> => {
  const key = `${roundCoord(lat)},${roundCoord(lon)}`;
  const cached = weatherCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(roundCoord(lat)))}&longitude=${encodeURIComponent(String(roundCoord(lon)))}&current=weather_code,is_day&forecast_days=1`;
  const payload = await fetchJson<OpenMeteoResponse>(url, fetchImpl);
  const code = Number(payload.current?.weather_code);
  const value: BoardWeather = {
    kind: weatherKindFromCode(code),
    isDay: payload.current?.is_day !== 0
  };
  weatherCache.set(key, { expiresAt: Date.now() + WEATHER_TTL_MS, value });
  return value;
};
