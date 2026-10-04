const debugEnabled = import.meta.env.DEV;

export const log = {
  debug: (...args: unknown[]): void => {
    if (debugEnabled) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  }
};
