const ENABLED_KEY = 'floorCatEnabled';
export const FLOOR_CAT_VISIBILITY_EVENT = 'floor-cat-visibility';

let arkanoidActive = false;

const notify = () => {
  window.dispatchEvent(new CustomEvent(FLOOR_CAT_VISIBILITY_EVENT));
};

export const readFloorCatEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
};

export const setFloorCatEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore private-mode storage failures.
  }
  notify();
};

export const setFloorCatArkanoidActive = (active: boolean) => {
  if (arkanoidActive === active) return;
  arkanoidActive = active;
  notify();
};

export const isFloorCatVisible = (): boolean => readFloorCatEnabled() && !arkanoidActive;
