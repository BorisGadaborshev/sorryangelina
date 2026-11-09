import { isNewYearSeason } from '../utils/newYearSeason';

const PREVIEW_KEY = 'newYearThemePreview';
export const NEW_YEAR_THEME_EVENT = 'new-year-theme';

export const NEW_YEAR_THEME_PREVIEWS = ['auto', 'on', 'off'] as const;
export type NewYearThemePreview = (typeof NEW_YEAR_THEME_PREVIEWS)[number];

const notify = () => {
  window.dispatchEvent(new CustomEvent(NEW_YEAR_THEME_EVENT));
};

export const readNewYearThemePreview = (): NewYearThemePreview => {
  try {
    const value = localStorage.getItem(PREVIEW_KEY);
    if (value && (NEW_YEAR_THEME_PREVIEWS as readonly string[]).includes(value)) {
      return value as NewYearThemePreview;
    }
  } catch {
    // Ignore private-mode storage failures.
  }
  return 'auto';
};

export const setNewYearThemePreview = (preview: NewYearThemePreview) => {
  try {
    localStorage.setItem(PREVIEW_KEY, preview);
  } catch {
    // Ignore private-mode storage failures.
  }
  notify();
};

export const isNewYearThemeActive = (date: Date = new Date()): boolean => {
  const preview = readNewYearThemePreview();
  if (preview === 'on') return true;
  if (preview === 'off') return false;
  return isNewYearSeason(date);
};
