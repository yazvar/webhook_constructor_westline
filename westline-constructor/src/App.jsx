import { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { MessageProvider } from './context/MessageContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/authStore';
import { usePresets } from './hooks/usePresets';
import { useConnection } from './hooks/useConnection';
import { useUpdater } from './hooks/useUpdater';
import { useLive } from './hooks/useLive';
import { Header } from './components/layout/Header';
import { WebhookBar } from './components/layout/WebhookBar';
import { MessageEditor } from './components/editor/MessageEditor';
import { DiscordPreview } from './components/preview/DiscordPreview';
import { Sidebar } from './components/sidebar/Sidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { LoginScreen } from './components/auth/LoginScreen';
import { ConnectionOverlay } from './components/connection/ConnectionOverlay';
import { UpdateBanner } from './components/update/UpdateBanner';
import { AnnounceToast } from './components/announce/AnnounceToast';
import './components/ui/ui.css';
import './App.css';

/** The authenticated workspace (constructor + live sync + admin). */
function Workspace({ user }) {
  const presetsApi = usePresets();
  const isAdmin = !!user.isAdmin;
  const { sharedPresets, announcement, usersRev, reloadPresets } = useLive({ enabled: true });
  const { logout } = useAuth();

  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <MessageProvider>
      <div className="app-shell">
        {sidebarOpen && (
          <div className="sidebar__backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar
          presetsApi={presetsApi}
          sharedPresets={sharedPresets}
          activeId={activeId}
          setActiveId={setActiveId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => {
            setSettingsOpen(true);
            setSidebarOpen(false);
          }}
        />

        <div className="app">
          <Header
            onMenu={() => setSidebarOpen(true)}
            user={user}
            isAdmin={isAdmin}
            onOpenAdmin={() => setAdminOpen(true)}
            onLogout={logout}
          />
          <WebhookBar />
          <main className="app__grid">
            <div className="app__col app__col--editor">
              <MessageEditor />
            </div>
            <div className="app__col app__col--preview">
              <DiscordPreview />
            </div>
          </main>
          <footer className="app__footer">
            <span className="eyebrow">Westline Constructor</span>
            <span className="eyebrow">Сделано в стиле Nothing OS</span>
          </footer>
        </div>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {isAdmin && (
        <AdminPanel
          open={adminOpen}
          onClose={() => setAdminOpen(false)}
          sharedPresets={sharedPresets}
          onReloadPresets={reloadPresets}
          usersRev={usersRev}
        />
      )}

      <AnnounceToast announcement={announcement} />
    </MessageProvider>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="splash__dots">
        <i />
        <i />
        <i />
      </div>
      <span className="splash__text eyebrow">Загрузка…</span>
    </div>
  );
}

/** Routes between splash / login / workspace and overlays update + offline UI. */
function AppGate() {
  const { user, status } = useAuth();
  const { online, checking, check } = useConnection();
  const updater = useUpdater();

  return (
    <>
      {status === 'loading' && <Splash />}
      {status === 'anon' && <LoginScreen />}
      {status === 'error' && (
        <div className="splash">
          <span className="splash__text eyebrow">Ошибка соединения с сервером</span>
        </div>
      )}
      {status === 'authed' && user && <Workspace user={user} />}

      {!online && <ConnectionOverlay checking={checking} onRetry={check} />}
      <UpdateBanner updater={updater} />
    </>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
