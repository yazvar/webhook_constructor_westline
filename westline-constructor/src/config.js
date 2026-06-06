/* ============================================================
   Client-side configuration.
   API_URL points at the Westline backend. Override at build time
   with VITE_API_URL (see .env.example).
   Admin rights come only from the backend (/api/me → isAdmin).
   ============================================================ */

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

export const isDesktop = typeof window !== 'undefined' && !!window.westline?.isDesktop;
