import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './authStore';
import { api, getToken, setToken } from '../utils/api';
import { API_URL, isDesktop } from '../config';

/**
 * Handles the Discord sign-in lifecycle:
 *  - desktop: window.westline.login() opens the browser and the
 *    main process pushes the JWT back through 'auth:token'
 *  - web: full-page redirect to the backend, token arrives as ?token=
 * Persists the token and resolves the current user via /api/me.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | anon | authed | error
  const [error, setError] = useState(null);
  const handled = useRef(false);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setStatus('anon');
      return;
    }
    try {
      const me = await api('/api/me');
      setUser(me);
      setStatus('authed');
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setToken(null);
        setUser(null);
        setStatus('anon');
      } else {
        setStatus('error');
        setError(err.message);
      }
    }
  }, []);

  const acceptToken = useCallback(
    (token) => {
      if (!token) return;
      setToken(token);
      setStatus('loading');
      loadMe();
    },
    [loadMe]
  );

  // Capture token from a web redirect (?token=...) on first mount.
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      params.delete('token');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
    loadMe();
  }, [loadMe]);

  // Desktop: receive the token pushed by the Electron main process.
  useEffect(() => {
    if (!isDesktop || !window.westline?.onAuthToken) return undefined;
    return window.westline.onAuthToken((token) => acceptToken(token));
  }, [acceptToken]);

  const login = useCallback(async () => {
    setError(null);
    if (isDesktop && window.westline?.login) {
      const r = await window.westline.login(API_URL);
      if (!r?.ok) setError(r?.error || 'Не удалось открыть окно входа');
      return;
    }
    // Web fallback: redirect back to this page with the token attached.
    const redirect = window.location.origin + window.location.pathname;
    window.location.href = `${API_URL}/auth/discord?redirect=${encodeURIComponent(redirect)}`;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo(
    () => ({ user, status, error, login, logout, refresh: loadMe }),
    [user, status, error, login, logout, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
