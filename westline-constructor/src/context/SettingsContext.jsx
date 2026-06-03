import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsContext, DEFAULT_SETTINGS } from './settingsStore';

const STORAGE_KEY = 'westline:settings';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Pushes the chosen theme/accent onto <html> so all CSS reacts. */
function applySettings(settings) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.grid = settings.grid ? 'on' : 'off';

  const rgb = hexToRgb(settings.accent);
  if (rgb) {
    const [r, g, b] = rgb;
    root.style.setProperty('--accent', settings.accent);
    root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.16)`);
    root.style.setProperty('--accent-line', `rgba(${r}, ${g}, ${b}, 0.5)`);
  }
}

function init() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(init);

  useEffect(() => {
    applySettings(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const set = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo(() => ({ settings, set, reset }), [settings, set, reset]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
