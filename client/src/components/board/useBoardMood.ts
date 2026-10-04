import { useEffect, useRef, useState } from 'react';
import { RetroStore } from '../../store/RetroStore';
import { Mood } from '../../types';

export function useBoardMood(store: RetroStore) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const appliedSavedMoodRef = useRef<string | null>(null);

  const currentUserName = store.currentUser?.name;
  const currentRoomId = store.room?.id;
  const currentUserMood = currentUserName
    ? store.users.find((user) => user.name === currentUserName)?.mood
    : undefined;

  useEffect(() => {
    if (!currentRoomId || !currentUserName) return;

    if (currentUserMood) {
      setSelectedMood(currentUserMood);
      setIsOpen(false);
      store.saveUserMood(currentRoomId, currentUserName, currentUserMood);
      return;
    }

    const savedMood = store.getSavedUserMood(currentRoomId, currentUserName);
    if (savedMood) {
      setSelectedMood(savedMood);
      setIsOpen(false);
      const applyKey = `${currentRoomId}:${currentUserName}`;
      if (appliedSavedMoodRef.current !== applyKey) {
        appliedSavedMoodRef.current = applyKey;
        store.socketService?.setUserMood(savedMood);
      }
      return;
    }

    setSelectedMood(null);
    setIsOpen(true);
  }, [currentRoomId, currentUserName, currentUserMood, store]);

  const save = () => {
    if (!selectedMood || !currentUserName || !currentRoomId) return;
    store.saveUserMood(currentRoomId, currentUserName, selectedMood);
    store.socketService?.setUserMood(selectedMood);
    setIsOpen(false);
  };

  return { isOpen, selectedMood, select: setSelectedMood, close: () => setIsOpen(false), save };
}
