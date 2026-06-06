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
 * Periodically re-checks /api/me so expired subscriptions log the user out.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | anon | authed | error
  const [error, setError] = useState(null);
  const handled = useRef(false);

  const forceLogout = useCallback((message) => {
    setToken(null);
    setUser(null);
    setStatus('anon');
    if (message) setError(message);
  }, []);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setStatus('anon');
      return;
    }
    try {
      const me = await api('/api/me');
      setUser(me);
      setStatus('authed');
      setError(null);
    } catch (err) {
      if (err.status === 401 || err.status === 403 || err.status === 426) {
        forceLogout(err.message);
      } else {
        setStatus('error');
        setError(err.message);
      }
    }
  }, [forceLogout]);

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

  // Re-check session every minute (catches expired subscriptions server-side).
  useEffect(() => {
    if (status !== 'authed') return undefined;
    const id = setInterval(() => loadMe(), 60_000);
    return () => clearInterval(id);
  }, [status, loadMe]);

  // Log out exactly when subscription expires (client-side timer).
  useEffect(() => {
    const sub = user?.subscription;
    if (status !== 'authed' || !sub || sub.permanent || !sub.expiresAt) return undefined;
    const ms = sub.expiresAt - Date.now();
    if (ms <= 0) {
      forceLogout('Подписка закончилась — войдите с новым кодом');
      return undefined;
    }
    const t = setTimeout(() => {
      loadMe();
    }, ms + 500);
    return () => clearTimeout(t);
  }, [user, status, loadMe, forceLogout]);

  const login = useCallback(async (accessCode) => {
    setError(null);
    const code = accessCode?.trim() || '';
    if (isDesktop && window.westline?.login) {
      const r = await window.westline.login(API_URL, code);
      if (!r?.ok) setError(r?.error || 'Не удалось открыть окно входа');
      return;
    }
    const redirect = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({ redirect });
    if (code) params.set('invite', code);
    window.location.href = `${API_URL}/auth/discord?${params.toString()}`;
  }, []);

  const logout = useCallback(() => {
    forceLogout(null);
  }, [forceLogout]);

  const value = useMemo(
    () => ({ user, status, error, login, logout, refresh: loadMe }),
    [user, status, error, login, logout, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
