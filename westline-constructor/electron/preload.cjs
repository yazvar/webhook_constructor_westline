/* ============================================================
   Preload script. Runs in an isolated context before the page
   loads. Nothing is exposed yet — the app is fully client-side
   (IndexedDB + fetch to Discord). Add bridges here later if
   native APIs are ever needed.
   ============================================================ */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('westline', {
  isDesktop: true,
  platform: process.platform,
});
