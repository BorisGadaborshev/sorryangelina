import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../utils/apiFetch';
import { getApiBase } from '../utils/apiBase';
import {
  BOARD_WEATHER_VISIBILITY_EVENT,
  readBoardWeatherEnabled,
  readBoardWeatherPreview,
  setActiveBoardWeatherKind,
  type BoardWeatherKind,
  type BoardWeatherPreview
} from './boardWeatherPreference';
import './BoardWeather.css';

interface WeatherPayload {
  kind: BoardWeatherKind;
}

interface Props {
  themeMode: 'light' | 'dark';
}

const REFRESH_MS = 30 * 60 * 1000;

const weatherFromPreview = (preview: BoardWeatherPreview): WeatherPayload | null => {
  if (preview === 'auto') return null;
  return { kind: preview };
};

const CLOUD_PATHS = [
  'M18 58c0-10 8-16 18-14 2-14 22-22 36-10 8-12 28-10 34 4 14-2 26 8 22 20 8 2 10 16-2 18H26c-12 0-16-8-8-18z',
  'M20 56c-12-2-16-16-4-22 4-14 26-18 34-6 8-14 30-16 38-2 12-8 28 0 26 14 12 2 12 18-2 20H30c-10 2-16-2-10-4z',
  'M16 60c-6-8 0-20 14-20 2-16 26-24 40-10 12-14 36-10 40 6 14 0 20 14 10 22-2 10-18 14-28 8-8 8-26 10-40 4-12 4-30 2-36-10z'
];

const seeded = (count: number, salt: number) => Array.from({ length: count }, (_, index) => {
  const n = ((index + 1) * 37 + salt * 17) % 1000;
  return {
    left: `${n % 100}%`,
    top: `${(n * 3) % 70}%`,
    delay: `${((n % 23) / 10).toFixed(1)}s`,
    duration: `${(1.4 + (n % 9) * 0.18).toFixed(2)}s`,
    size: 92 + (n % 88),
    height: 9 + (n % 8),
    variant: index % CLOUD_PATHS.length
  };
});

const CloudMark: React.FC<{ path: string; width: number }> = ({ path, width }) => (
  <svg viewBox="0 0 120 72" width={width} aria-hidden="true">
    <path className="board-weather__cloud-fill" d={path} />
    <ellipse className="board-weather__cloud-lit" cx="58" cy="28" rx="22" ry="9" />
  </svg>
);

const readGrantedCoords = async (): Promise<{ lat: number; lon: number } | null> => {
  if (!navigator.geolocation || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state !== 'granted') return null;
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
        () => resolve(null),
        { maximumAge: 30 * 60 * 1000, timeout: 4000 }
      );
    });
  } catch {
    return null;
  }
};

const BoardWeather: React.FC<Props> = ({ themeMode }) => {
  const [enabled, setEnabled] = useState(readBoardWeatherEnabled);
  const [preview, setPreview] = useState(readBoardWeatherPreview);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const clouds = useMemo(() => seeded(12, 3), []);
  const drops = useMemo(() => seeded(28, 8), []);
  const flakes = useMemo(() => seeded(36, 13), []);

  useEffect(() => {
    const sync = () => {
      setEnabled(readBoardWeatherEnabled());
      setPreview(readBoardWeatherPreview());
    };
    window.addEventListener(BOARD_WEATHER_VISIBILITY_EVENT, sync);
    return () => window.removeEventListener(BOARD_WEATHER_VISIBILITY_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setWeather(null);
      return;
    }

    const localWeather = weatherFromPreview(preview);
    if (localWeather) {
      setWeather(localWeather);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const coords = await readGrantedCoords();
        const query = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : '';
        const response = await apiFetch(`${getApiBase()}/api/weather${query}`, { timeoutMs: 9000 });
        if (cancelled || response.status === 204) return;
        if (!response.ok) return;
        const payload = await response.json() as WeatherPayload;
        if (payload?.kind !== 'clouds' && payload?.kind !== 'rain' && payload?.kind !== 'snow') return;
        setWeather({ kind: payload.kind });
      } catch {
        if (!cancelled) setWeather(null);
      }
    };

    void load();
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, preview]);

  useEffect(() => {
    setActiveBoardWeatherKind(enabled && weather ? weather.kind : null);
  }, [enabled, weather]);

  useEffect(() => () => setActiveBoardWeatherKind(null), []);

  if (!enabled || !weather) return null;

  const showRain = weather.kind === 'rain';
  const showSnow = weather.kind === 'snow';

  return (
    <div className="board-weather" data-theme={themeMode} data-kind={weather.kind} aria-hidden="true">
      <div className="board-weather__layer board-weather__layer--clouds">
        {clouds.map((cloud, index) => (
          <span
            key={`cloud-${index}`}
            className="board-weather__cloud"
            style={{
              left: cloud.left,
              top: cloud.top,
              width: cloud.size,
              animationDuration: `${18 + (index % 8) * 4}s`,
              animationDelay: cloud.delay
            }}
          >
            <CloudMark path={CLOUD_PATHS[cloud.variant]} width={cloud.size} />
          </span>
        ))}
      </div>
      {showRain ? (
        <div className="board-weather__layer">
          {drops.map((drop, index) => (
            <span
              key={`drop-${index}`}
              className="board-weather__drop"
              style={{
                left: drop.left,
                height: drop.height,
                animationDuration: drop.duration,
                animationDelay: drop.delay
              }}
            />
          ))}
        </div>
      ) : null}
      {showSnow ? (
        <div className="board-weather__layer">
          {flakes.map((flake, index) => (
            <span
              key={`flake-${index}`}
              className="board-weather__flake"
              style={{
                left: flake.left,
                width: 4 + (index % 4),
                height: 4 + (index % 4),
                animationDuration: `${6.2 + (index % 8) * 0.7}s`,
                animationDelay: flake.delay
              }}
            />
          ))}
        </div>
      ) : null}
      {showSnow
        ? createPortal(
          <div className="board-weather-snowfloor" data-theme={themeMode} aria-hidden="true">
            <svg className="board-weather-snowfloor__bank" viewBox="0 0 1200 28" preserveAspectRatio="none">
              <path d="M0 28V15C28 6 58 17 92 10C128 3 158 16 198 9C238 3 268 16 310 10C348 5 378 17 420 11C458 6 488 16 528 10C568 4 598 16 640 9C678 4 708 16 748 11C788 5 818 17 860 10C898 5 928 16 968 11C1008 5 1038 17 1080 10C1118 6 1148 15 1200 12V28Z" />
            </svg>
          </div>,
          document.body
        )
        : null}
    </div>
  );
};

export default BoardWeather;
