const debugEnabled = process.env.NODE_ENV === 'development';

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
