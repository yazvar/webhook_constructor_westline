import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken } from '../utils/api';
import { API_URL, APP_VERSION } from '../config';

/**
 * Realtime sync with the backend over Server-Sent Events.
 *  - keeps the list of shared (admin-broadcast) presets up to date
 *  - exposes the latest announcement
 *  - bumps `usersRev` whenever the user roster / presence changes so
 *    the admin panel can refetch
 * Reconnects automatically; only runs while authenticated.
 */
export function useLive({ enabled }) {
  const [sharedPresets, setSharedPresets] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [usersRev, setUsersRev] = useState(0);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const retryRef = useRef(null);

  const loadPresets = useCallback(async () => {
    try {
      setSharedPresets(await api('/api/presets'));
    } catch {
      /* offline — will retry on reconnect */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let closed = false;
    loadPresets();

    const connect = () => {
      const token = getToken();
      if (!token || closed) return;
      const qs = new URLSearchParams({
        token,
        clientVersion: APP_VERSION,
      });
      const es = new EventSource(`${API_URL}/api/events?${qs.toString()}`);
      esRef.current = es;

      es.addEventListener('ready', () => setConnected(true));
      es.addEventListener('preset:new', (e) => {
        const p = JSON.parse(e.data);
        setSharedPresets((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
      });
      es.addEventListener('preset:update', (e) => {
        const p = JSON.parse(e.data);
        setSharedPresets((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      });
      es.addEventListener('preset:delete', (e) => {
        const { id } = JSON.parse(e.data);
        setSharedPresets((prev) => prev.filter((x) => x.id !== id));
      });
      es.addEventListener('announce', (e) => {
        setAnnouncement({ ...JSON.parse(e.data), key: Date.now() });
      });
      const bump = () => setUsersRev((n) => n + 1);
      es.addEventListener('user:joined', bump);
      es.addEventListener('user:banned', bump);
      es.addEventListener('user:unbanned', bump);
      es.addEventListener('presence', bump);

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!closed) {
          retryRef.current = setTimeout(connect, 5000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      setConnected(false);
      if (esRef.current) esRef.current.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [enabled, loadPresets]);

  return { sharedPresets, announcement, usersRev, connected, reloadPresets: loadPresets };
}
