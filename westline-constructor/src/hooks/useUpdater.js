import { useEffect, useState } from 'react';
import { isDesktop } from '../config';

/**
 * Surfaces electron-updater state to the UI.
 *  status: idle | available | downloading | downloaded | error
 * Only active in the packaged desktop app; a no-op on web/dev.
 */
export function useUpdater() {
  const [state, setState] = useState({ status: 'idle', version: null, percent: 0, error: null });

  useEffect(() => {
    if (!isDesktop || !window.westline?.onUpdateAvailable) return undefined;
    const w = window.westline;
    const offs = [
      w.onUpdateAvailable((d) => setState((s) => ({ ...s, status: 'available', version: d.version }))),
      w.onUpdateProgress((d) => setState((s) => ({ ...s, status: 'downloading', percent: d.percent }))),
      w.onUpdateDownloaded((d) => setState((s) => ({ ...s, status: 'downloaded', version: d.version }))),
      w.onUpdateError((d) => setState((s) => ({ ...s, status: 'error', error: d.message }))),
    ];
    return () => offs.forEach((off) => off && off());
  }, []);

  const install = () => window.westline?.installUpdate?.();
  const check = () => window.westline?.checkForUpdate?.();

  return { ...state, install, check };
}
