import { useEffect, useRef, useState } from 'react';

/**
 * State persisted to localStorage. Reads once on mount, writes on change.
 * Writes are debounced so rapid typing doesn't hammer storage.
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or unavailable — ignore */
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [key, value]);

  return [value, setValue];
}
