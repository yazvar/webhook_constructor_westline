import { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { MessageProvider } from './context/MessageContext';
import { usePresets } from './hooks/usePresets';
import { Header } from './components/layout/Header';
import { WebhookBar } from './components/layout/WebhookBar';
import { MessageEditor } from './components/editor/MessageEditor';
import { DiscordPreview } from './components/preview/DiscordPreview';
import { Sidebar } from './components/sidebar/Sidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import './components/ui/ui.css';
import './App.css';

function App() {
  const presetsApi = usePresets();
  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <SettingsProvider>
      <MessageProvider>
        <div className="app-shell">
          {sidebarOpen && (
            <div className="sidebar__backdrop" onClick={() => setSidebarOpen(false)} />
          )}
          <Sidebar
            presetsApi={presetsApi}
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
            <Header onMenu={() => setSidebarOpen(true)} />
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
      </MessageProvider>
    </SettingsProvider>
  );
}

export default App;
