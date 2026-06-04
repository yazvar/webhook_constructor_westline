/* ============================================================
   Electron main process.
   - Loads the Vite dev server in development and the built static
     files in production (renderer stays sandboxed).
   - Hosts a temporary loopback HTTP server to capture the Discord
     OAuth token handed back by the backend.
   - Wires electron-updater so packaged builds can notify the user
     about new GitHub releases and install them on demand.
   ============================================================ */

const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const http = require('node:http');

const isDev = !app.isPackaged;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5180';

let mainWindow = null;
let loopbackServer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    title: 'Westline Constructor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ---- Discord OAuth via loopback ----------------------------- */
/*
   Renderer asks us to log in. We spin up a tiny local server on an
   ephemeral port, open the system browser at:
       <backend>/auth/discord?redirect=http://127.0.0.1:<port>/cb
   The backend completes the Discord handshake and redirects the
   browser back to our loopback URL with ?token=<jwt>, which we then
   forward to the renderer.
*/
function startLogin(backendUrl) {
  closeLoopback();

  return new Promise((resolve, reject) => {
    loopbackServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, 'http://127.0.0.1');
      if (!reqUrl.pathname.startsWith('/cb')) {
        res.writeHead(404).end();
        return;
      }
      const token = reqUrl.searchParams.get('token');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(resultPage(!!token));

      if (token && mainWindow) {
        mainWindow.webContents.send('auth:token', token);
        if (!mainWindow.isFocused()) mainWindow.show();
        mainWindow.focus();
      }
      setTimeout(closeLoopback, 500);
    });

    loopbackServer.on('error', reject);
    loopbackServer.listen(0, '127.0.0.1', () => {
      const { port } = loopbackServer.address();
      const redirect = `http://127.0.0.1:${port}/cb`;
      const authUrl = `${backendUrl.replace(/\/$/, '')}/auth/discord?redirect=${encodeURIComponent(redirect)}`;
      shell.openExternal(authUrl);
      resolve({ port });
    });
  });
}

function closeLoopback() {
  if (loopbackServer) {
    try {
      loopbackServer.close();
    } catch {
      /* ignore */
    }
    loopbackServer = null;
  }
}

function resultPage(ok) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>Westline</title><style>
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
background:#0a0a0a;color:#ededed;font-family:system-ui,sans-serif;
background-image:radial-gradient(#262626 1px,transparent 1px);background-size:22px 22px}
.card{text-align:center;padding:32px;border:1px solid #262626;background:#121212;border-radius:8px}
h1{letter-spacing:.06em;text-transform:uppercase}.a{color:#d71921}p{color:#8a8a8a}
</style></head><body><div class="card">
<h1><span class="a">●</span> ${ok ? 'Вход выполнен' : 'Не удалось войти'}</h1>
<p>${ok ? 'Можно вернуться в приложение Westline и закрыть эту вкладку.' : 'Попробуйте ещё раз.'}</p>
</div></body></html>`;
}

ipcMain.handle('auth:login', async (_e, backendUrl) => {
  try {
    await startLogin(backendUrl);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

/* ---- Auto updates (electron-updater) ------------------------ */
function setupUpdater() {
  if (isDev) return; // updater only works on packaged builds
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return; // dependency not installed yet
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('update-available', (info) =>
    send('update:available', { version: info.version, notes: info.releaseNotes })
  );
  autoUpdater.on('update-not-available', () => send('update:none', {}));
  autoUpdater.on('download-progress', (p) =>
    send('update:progress', { percent: Math.round(p.percent), bytesPerSecond: p.bytesPerSecond })
  );
  autoUpdater.on('update-downloaded', (info) =>
    send('update:downloaded', { version: info.version })
  );
  autoUpdater.on('error', (err) => send('update:error', { message: String(err) }));

  ipcMain.handle('update:check', async () => {
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, version: r?.updateInfo?.version };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  // Check shortly after launch, then every 6 hours.
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600_000).unref?.();
}

ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  setupUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeLoopback();
  if (process.platform !== 'darwin') app.quit();
});
