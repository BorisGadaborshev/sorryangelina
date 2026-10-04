import { useEffect, useRef, useState } from 'react';

export function useCopyFlag(durationMs = 2000) {
  const [value, setValue] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    setValue(false);
  };

  const flash = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    setValue(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setValue(false);
    }, durationMs);
  };

  return { value, clear, flash };
}
