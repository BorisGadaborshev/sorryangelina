import { useEffect, useRef, useState } from 'react';
import { Phase } from '../../types';

export function useAllReadyPrompt(allUsersReady: boolean, phase: Phase) {
  const [isOpen, setIsOpen] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (allUsersReady) {
      if (!dismissedRef.current) {
        setIsOpen(true);
      }
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      dismissedRef.current = false;
      setIsOpen(false);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [allUsersReady, phase]);

  const dismiss = () => {
    dismissedRef.current = true;
    setIsOpen(false);
  };

  return { isOpen, dismiss };
}
