import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = 'CATETAN_DUIT_USER_NAME';
let currentUserName = 'Boss';

// Load initial value on web if available
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      currentUserName = saved.trim();
    }
  } catch {
    // Ignore storage errors
  }
}

const listeners = new Set<(name: string) => void>();

export const ProfileService = {
  getUserName: () => currentUserName,
  setUserName: (name: string) => {
    const clean = name.trim() || 'Boss';
    currentUserName = clean;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, clean);
      } catch {
        // Ignore storage errors
      }
    }
    listeners.forEach((listener) => listener(clean));
  },
};

export function useUserName() {
  const [userName, setUserNameState] = useState(currentUserName);

  useEffect(() => {
    const listener = (newName: string) => setUserNameState(newName);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [userName, ProfileService.setUserName] as const;
}
