/* ============================================================
   Thin fetch wrapper around the Westline backend.
   Attaches the bearer token and normalises errors.
   ============================================================ */

import { API_URL, APP_VERSION } from '../config';

const TOKEN_KEY = 'westline:token';

const ERROR_MESSAGES = {
  unauthorized: 'Сессия истекла — войдите снова',
  banned: 'Аккаунт заблокирован',
  not_whitelisted: 'Нет доступа. Нужно приглашение от администратора',
  subscription_expired: 'Подписка закончилась — войдите с новым кодом',
  client_outdated: 'Устаревшая версия приложения — обновите Westline Constructor',
  forbidden: 'Действие недоступно',
};

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Client-Version': APP_VERSION,
  };
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    signal,
    headers: {
      ...baseHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data && data.error;
    const err = new Error(ERROR_MESSAGES[code] || code || `HTTP ${res.status}`);
    if (res.status === 404 && !code) {
      err.message = 'Эндпоинт не найден — обновите сервер на Railway';
    }
    err.status = res.status;
    err.code = code;
    err.data = data;
    throw err;
  }
  return data;
}

/** Public access policy (invite-only flag, min client version). */
export async function fetchAccessInfo(timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}/api/access`, { signal: ctrl.signal });
    if (!res.ok) return { inviteOnly: false, subscriptionRequired: false, minClientVersion: null };
    return res.json();
  } catch {
    return { inviteOnly: false, subscriptionRequired: false, minClientVersion: null };
  } finally {
    clearTimeout(t);
  }
}

/** Quick reachability probe used by the connection guard. */
export async function pingBackend(timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
