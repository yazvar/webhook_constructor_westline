/* ============================================================
   Preload script. Runs in an isolated context before the page
   loads and exposes a minimal, audited bridge to the renderer:
     - desktop flags
     - Discord login (opens system browser, returns the JWT)
     - auto-update events / actions
   ============================================================ */

const { contextBridge, ipcRenderer } = require('electron');

function on(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('westline', {
  isDesktop: true,
  platform: process.platform,

  getVersion: () => ipcRenderer.invoke('app:version'),

  // --- auth ---
  login: (backendUrl) => ipcRenderer.invoke('auth:login', backendUrl),
  onAuthToken: (cb) => on('auth:token', cb),

  // --- updates ---
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (cb) => on('update:available', cb),
  onUpdateNone: (cb) => on('update:none', cb),
  onUpdateProgress: (cb) => on('update:progress', cb),
  onUpdateDownloaded: (cb) => on('update:downloaded', cb),
  onUpdateError: (cb) => on('update:error', cb),
});
