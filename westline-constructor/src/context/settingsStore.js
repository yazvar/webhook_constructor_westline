import { createContext, useContext } from 'react';

export const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light' | 'black'
  accent: '#d71921',
  grid: true, // dotted background grid
};

export const THEMES = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
  { id: 'black', label: 'Чёрная' },
];

export const ACCENTS = [
  { id: '#d71921', label: 'Nothing Red' },
  { id: '#ededed', label: 'Mono' },
  { id: '#5865f2', label: 'Blurple' },
  { id: '#3ba55d', label: 'Green' },
  { id: '#faa61a', label: 'Amber' },
  { id: '#00a8fc', label: 'Cyan' },
];

export const SettingsContext = createContext(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
