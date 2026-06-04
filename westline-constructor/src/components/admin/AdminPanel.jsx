import { useCallback, useEffect, useState } from 'react';
import { useMessage } from '../../context/messageStore';
import { api } from '../../utils/api';
import { Button, IconButton } from '../ui/Button';
import { Input, TextArea } from '../ui/Field';
import './admin.css';

const TABS = [
  { id: 'users', label: 'Пользователи' },
  { id: 'presets', label: 'Пресеты' },
  { id: 'broadcast', label: 'Объявление' },
];

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return `${Math.floor(s / 86400)} дн назад`;
}

/**
 * Admin drawer — visible only to admins (gated in the Header).
 * Tabs: registered users (+ ban/online), shared live presets
 * (create from the current draft / delete) and an announcement
 * broadcast to every connected client.
 */
export function AdminPanel({ open, onClose, sharedPresets, onReloadPresets, usersRev }) {
  const { message } = useMessage();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [announce, setAnnounce] = useState('');
  const [toast, setToast] = useState(null);

  const flash = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([api('/api/users'), api('/api/stats')]);
      setUsers(u);
      setStats(s);
    } catch {
      flash('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    if (open) loadUsers();
  }, [open, loadUsers]);

  // Live refresh when the roster/presence changes.
  useEffect(() => {
    if (open && usersRev) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersRev]);

  const createPreset = async () => {
    setBusy(true);
    try {
      await api('/api/presets', {
        method: 'POST',
        body: { name: presetName.trim() || 'Общий пресет', message },
      });
      setPresetName('');
      onReloadPresets?.();
      flash('Пресет разослан всем');
    } catch {
      flash('Ошибка создания пресета');
    } finally {
      setBusy(false);
    }
  };

  const deletePreset = async (id) => {
    if (!window.confirm('Удалить общий пресет у всех пользователей?')) return;
    try {
      await api(`/api/presets/${id}`, { method: 'DELETE' });
      onReloadPresets?.();
    } catch {
      flash('Не удалось удалить');
    }
  };

  const toggleBan = async (u) => {
    try {
      await api(`/api/users/${u.id}/ban`, { method: 'POST', body: { banned: !u.banned } });
      loadUsers();
    } catch {
      flash('Действие недоступно');
    }
  };

  const sendAnnounce = async () => {
    const text = announce.trim();
    if (!text) return;
    setBusy(true);
    try {
      await api('/api/announce', { method: 'POST', body: { text } });
      setAnnounce('');
      flash('Объявление отправлено');
    } catch {
      flash('Ошибка отправки');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`admin-backdrop${open ? ' admin-backdrop--open' : ''}`} onClick={onClose} />
      <aside className={`admin${open ? ' admin--open' : ''}`} aria-hidden={!open}>
        <header className="admin__head">
          <div>
            <span className="eyebrow">Только для админов</span>
            <h2 className="admin__title dotmatrix">Админ-панель</h2>
          </div>
          <IconButton title="Закрыть" onClick={onClose}>
            ✕
          </IconButton>
        </header>

        {stats && (
          <div className="admin__stats">
            <div className="admin-stat">
              <span className="admin-stat__num">{stats.totalUsers}</span>
              <span className="eyebrow">всего</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat__num admin-stat__num--accent">{stats.online}</span>
              <span className="eyebrow">онлайн</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat__num">{stats.activeToday}</span>
              <span className="eyebrow">за сутки</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat__num">{stats.presets}</span>
              <span className="eyebrow">пресетов</span>
            </div>
          </div>
        )}

        <div className="admin__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`admin__tab${tab === t.id ? ' admin__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin__body">
          {tab === 'users' && (
            <div className="admin__users">
              <div className="admin__row-head">
                <span>{users.length} пользователь(ей)</span>
                <IconButton title="Обновить" onClick={loadUsers}>
                  ↻
                </IconButton>
              </div>
              {loading && <p className="admin__hint">Загрузка…</p>}
              {users.map((u) => (
                <div key={u.id} className={`admin-user${u.banned ? ' admin-user--banned' : ''}`}>
                  <div className="admin-user__ava">
                    <img src={u.avatarUrl} alt="" loading="lazy" />
                    <span
                      className={`admin-user__dot${u.online ? ' admin-user__dot--on' : ''}`}
                      title={u.online ? 'Онлайн' : 'Не в сети'}
                    />
                  </div>
                  <div className="admin-user__info">
                    <span className="admin-user__name">
                      {u.globalName || u.username}
                      {u.isAdmin && <span className="admin-user__badge">ADMIN</span>}
                    </span>
                    <span className="admin-user__meta">
                      @{u.username} · был {timeAgo(u.lastSeen)}
                    </span>
                    <span className="admin-user__id">{u.id}</span>
                  </div>
                  {!u.isAdmin && (
                    <IconButton
                      danger={!u.banned}
                      title={u.banned ? 'Разбанить' : 'Забанить'}
                      onClick={() => toggleBan(u)}
                    >
                      {u.banned ? '↺' : '⊘'}
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'presets' && (
            <div className="admin__presets">
              <div className="admin__create">
                <Input
                  label="Название пресета"
                  value={presetName}
                  onChange={setPresetName}
                  placeholder="Например, Анонс ивента"
                />
                <p className="admin__hint">
                  Пресет соберётся из текущего черновика в редакторе и мгновенно
                  появится у всех пользователей.
                </p>
                <Button variant="primary" block onClick={createPreset} disabled={busy}>
                  {busy ? 'Отправка…' : '+ Создать live-пресет для всех'}
                </Button>
              </div>

              <div className="admin__row-head">
                <span>Общие пресеты ({sharedPresets.length})</span>
              </div>
              {sharedPresets.length === 0 && (
                <p className="admin__hint">Общих пресетов пока нет.</p>
              )}
              {sharedPresets.map((p) => (
                <div key={p.id} className="admin-preset">
                  <div className="admin-preset__info">
                    <span className="admin-preset__name">{p.name}</span>
                    <span className="admin-preset__meta">
                      {p.message?.embeds?.length || 0} эмбед(ов) · {timeAgo(p.createdAt)}
                    </span>
                  </div>
                  <IconButton danger title="Удалить у всех" onClick={() => deletePreset(p.id)}>
                    ✕
                  </IconButton>
                </div>
              ))}
            </div>
          )}

          {tab === 'broadcast' && (
            <div className="admin__broadcast">
              <TextArea
                label="Текст объявления"
                value={announce}
                onChange={setAnnounce}
                max={500}
                rows={5}
                placeholder="Сообщение появится у всех онлайн-пользователей"
              />
              <Button variant="primary" block onClick={sendAnnounce} disabled={busy}>
                {busy ? 'Отправка…' : 'Отправить всем онлайн'}
              </Button>
            </div>
          )}
        </div>

        {toast && <div className="admin__toast">{toast}</div>}
      </aside>
    </>
  );
}
