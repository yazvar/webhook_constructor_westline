import { useCallback, useEffect, useState } from 'react';
import { useMessage } from '../../context/messageStore';
import { api } from '../../utils/api';
import { Button, IconButton } from '../ui/Button';
import { Input, TextArea } from '../ui/Field';
import './admin.css';

const TABS = [
  { id: 'users', label: 'Пользователи' },
  { id: 'access', label: 'Доступ' },
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

function formatSubscription(sub) {
  if (!sub) return '—';
  if (sub.permanent) return 'бессрочно';
  if (!sub.active) return 'истекла';
  return `${sub.daysLeft} дн.`;
}

/**
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
  const [whitelist, setWhitelist] = useState([]);
  const [invites, setInvites] = useState([]);
  const [subCodes, setSubCodes] = useState([]);
  const [newWhitelistId, setNewWhitelistId] = useState('');
  const [inviteUses, setInviteUses] = useState('1');

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

  const loadAccess = useCallback(async () => {
    setLoading(true);
    try {
      const [w, i, s] = await Promise.all([
        api('/api/whitelist'),
        api('/api/invites'),
        api('/api/subscription-codes'),
      ]);
      setWhitelist(w);
      setInvites(i);
      setSubCodes(s);
    } catch {
      flash('Не удалось загрузить доступ');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    if (open) {
      if (tab === 'access') loadAccess();
      else loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

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

  const addWhitelist = async () => {
    const discordId = newWhitelistId.trim();
    if (!discordId) return;
    setBusy(true);
    try {
      await api('/api/whitelist', { method: 'POST', body: { discordId } });
      setNewWhitelistId('');
      loadAccess();
      flash('Пользователь добавлен в whitelist');
    } catch {
      flash('Не удалось добавить');
    } finally {
      setBusy(false);
    }
  };

  const removeWhitelist = async (discordId) => {
    try {
      await api(`/api/whitelist/${discordId}`, { method: 'DELETE' });
      loadAccess();
    } catch {
      flash('Не удалось удалить');
    }
  };

  const createInvite = async () => {
    setBusy(true);
    try {
      const row = await api('/api/invites', {
        method: 'POST',
        body: { usesLeft: Number(inviteUses) || 1 },
      });
      loadAccess();
      flash(`Код: ${row.code}`);
    } catch (err) {
      flash(err.message || 'Не удалось создать код');
    } finally {
      setBusy(false);
    }
  };

  const deleteInvite = async (code) => {
    try {
      await api(`/api/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
      loadAccess();
    } catch {
      flash('Не удалось удалить код');
    }
  };

  const createSubCode = async () => {
    setBusy(true);
    try {
      const row = await api('/api/subscription-codes', { method: 'POST', body: {} });
      loadAccess();
      flash(`Код подписки: ${row.code}`);
    } catch (err) {
      flash(err.message || 'Не удалось создать код');
    } finally {
      setBusy(false);
    }
  };

  const deleteSubCode = async (code) => {
    try {
      await api(`/api/subscription-codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
      loadAccess();
    } catch {
      flash('Не удалось удалить код');
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
                      @{u.username} · подписка: {formatSubscription(u.subscription)} · был{' '}
                      {timeAgo(u.lastSeen)}
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

          {tab === 'access' && (
            <div className="admin__access">
              <div className="admin__create">
                <p className="admin__hint">
                  Одноразовый код подписки — 30 дней доступа. После использования код сгорает.
                </p>
                <Button variant="primary" block onClick={createSubCode} disabled={busy}>
                  {busy ? 'Создание…' : '+ Создать код подписки (1 месяц)'}
                </Button>
              </div>

              <div className="admin__row-head">
                <span>Коды подписки ({subCodes.length})</span>
                <IconButton title="Обновить" onClick={loadAccess}>
                  ↻
                </IconButton>
              </div>
              {loading && <p className="admin__hint">Загрузка…</p>}
              {subCodes.length === 0 && !loading && (
                <p className="admin__hint">Активных кодов пока нет.</p>
              )}
              {subCodes.map((row) => (
                <div key={row.code} className="admin-preset">
                  <div className="admin-preset__info">
                    <span className="admin-preset__name">{row.code}</span>
                    <span className="admin-preset__meta">
                      {row.used
                        ? `использован · ${row.usedBy || '—'}`
                        : `${row.durationDays} дн. · свободен`}
                      {' · '}
                      {timeAgo(row.createdAt)}
                    </span>
                  </div>
                  {!row.used && (
                    <IconButton danger title="Удалить код" onClick={() => deleteSubCode(row.code)}>
                      ✕
                    </IconButton>
                  )}
                </div>
              ))}

              <div className="admin__create" style={{ marginTop: 20 }}>
                <Input
                  label="Discord ID для whitelist"
                  value={newWhitelistId}
                  onChange={setNewWhitelistId}
                  placeholder="123456789012345678"
                />
                <Button variant="primary" block onClick={addWhitelist} disabled={busy}>
                  Добавить в whitelist
                </Button>
              </div>

              <div className="admin__row-head">
                <span>Whitelist ({whitelist.length})</span>
                <IconButton title="Обновить" onClick={loadAccess}>
                  ↻
                </IconButton>
              </div>
              {loading && <p className="admin__hint">Загрузка…</p>}
              {whitelist.length === 0 && !loading && (
                <p className="admin__hint">Whitelist пуст — при INVITE_ONLY=true никто не войдёт без кода.</p>
              )}
              {whitelist.map((row) => (
                <div key={row.discordId} className="admin-preset">
                  <div className="admin-preset__info">
                    <span className="admin-preset__name">{row.discordId}</span>
                    <span className="admin-preset__meta">
                      {row.addedBy || '—'} · {timeAgo(row.createdAt)}
                    </span>
                  </div>
                  <IconButton danger title="Убрать из whitelist" onClick={() => removeWhitelist(row.discordId)}>
                    ✕
                  </IconButton>
                </div>
              ))}

              <div className="admin__create" style={{ marginTop: 16 }}>
                <Input
                  label="Использований инвайт-кода"
                  value={inviteUses}
                  onChange={setInviteUses}
                  placeholder="1"
                />
                <Button variant="primary" block onClick={createInvite} disabled={busy}>
                  {busy ? 'Создание…' : '+ Создать инвайт-код'}
                </Button>
              </div>

              <div className="admin__row-head">
                <span>Инвайт-коды ({invites.length})</span>
              </div>
              {invites.map((row) => (
                <div key={row.code} className="admin-preset">
                  <div className="admin-preset__info">
                    <span className="admin-preset__name">{row.code}</span>
                    <span className="admin-preset__meta">
                      осталось {row.usesLeft} · {timeAgo(row.createdAt)}
                    </span>
                  </div>
                  <IconButton danger title="Удалить код" onClick={() => deleteInvite(row.code)}>
                    ✕
                  </IconButton>
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
