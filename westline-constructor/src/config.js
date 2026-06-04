/* ============================================================
   Client-side configuration.
   API_URL points at the Westline backend. Override at build time
   with VITE_API_URL (see .env.example). ADMIN_IDS only controls
   client-side visibility of the admin tab — the backend enforces
   the real authorization on every admin endpoint.
   ============================================================ */

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const ADMIN_IDS = ['1202701219081224273', '743400950646964264'];

export const isDesktop = typeof window !== 'undefined' && !!window.westline?.isDesktop;

export function isAdminId(id) {
  return ADMIN_IDS.includes(String(id));
}
