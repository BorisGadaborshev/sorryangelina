const ENABLED_KEY = 'boardWeatherEnabled';
const PREVIEW_KEY = 'boardWeatherPreview';
export const BOARD_WEATHER_VISIBILITY_EVENT = 'board-weather-visibility';
export const BOARD_WEATHER_KIND_EVENT = 'board-weather-kind';

export type BoardWeatherKind = 'clouds' | 'rain' | 'snow';

let activeKind: BoardWeatherKind | null = null;

export const BOARD_WEATHER_PREVIEWS = ['auto', 'clouds', 'rain', 'snow'] as const;
export type BoardWeatherPreview = (typeof BOARD_WEATHER_PREVIEWS)[number];

const notify = () => {
  window.dispatchEvent(new CustomEvent(BOARD_WEATHER_VISIBILITY_EVENT));
};

const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore private-mode storage failures.
  }
};

export const readBoardWeatherEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
};

export const setBoardWeatherEnabled = (enabled: boolean) => {
  writeLocal(ENABLED_KEY, enabled ? '1' : '0');
  notify();
};

export const readBoardWeatherPreview = (): BoardWeatherPreview => {
  try {
    const value = localStorage.getItem(PREVIEW_KEY);
    if (value && (BOARD_WEATHER_PREVIEWS as readonly string[]).includes(value)) {
      return value as BoardWeatherPreview;
    }
  } catch {
    // Ignore private-mode storage failures.
  }
  return 'auto';
};

export const setBoardWeatherPreview = (preview: BoardWeatherPreview) => {
  writeLocal(PREVIEW_KEY, preview);
  notify();
};

export const readActiveBoardWeatherKind = (): BoardWeatherKind | null => activeKind;

export const setActiveBoardWeatherKind = (kind: BoardWeatherKind | null) => {
  if (activeKind === kind) return;
  activeKind = kind;
  window.dispatchEvent(new CustomEvent(BOARD_WEATHER_KIND_EVENT));
};
