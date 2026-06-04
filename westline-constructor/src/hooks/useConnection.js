import { useCallback, useEffect, useRef, useState } from 'react';
import { pingBackend } from '../utils/api';

/**
 * Tracks whether the user is online. Combines the browser's
 * navigator.onLine signal with an active probe to the backend so we
 * also catch "connected to wifi but no real internet / server down".
 */
export function useConnection() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [checking, setChecking] = useState(false);
  const timer = useRef(null);

  const check = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOnline(false);
      return false;
    }
    setChecking(true);
    const ok = await pingBackend();
    setOnline(ok);
    setChecking(false);
    return ok;
  }, []);

  useEffect(() => {
    check();
    const onUp = () => check();
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);

    // Re-probe periodically (more often while offline).
    const tick = () => {
      check();
      timer.current = setTimeout(tick, online ? 30_000 : 7_000);
    };
    timer.current = setTimeout(tick, online ? 30_000 : 7_000);

    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return { online, checking, check };
}
