import { useState } from 'react';
import { APP_VERSION, isDesktop } from '../../config';
import { IconButton } from '../ui/Button';

function subscriptionLabel(sub) {
  if (!sub || sub.permanent) return null;
  if (!sub.active) return { text: 'Подписка неактивна', tone: 'expired' };
  const days = sub.daysLeft;
  const word = days === 1 ? 'день' : days >= 2 && days <= 4 ? 'дня' : 'дней';
  return { text: `Подписка · ${days} ${word}`, tone: days <= 3 ? 'warn' : 'active' };
}

/** App header — the Nothing-style brand block + user/account controls. */
export function Header({ onMenu, user, isAdmin, onOpenAdmin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sub = subscriptionLabel(user?.subscription);
  const platform = isDesktop ? 'desktop' : 'web';

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <IconButton className="app-header__menu" title="Меню" onClick={onMenu}>
          ☰
        </IconButton>
        <span className="app-header__glyph" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
        <div>
          <h1 className="app-header__title dotmatrix">Westline</h1>
          <p className="app-header__sub eyebrow">Discord Webhook Constructor</p>
        </div>
      </div>

      <div className="app-header__right">
        {sub && (
          <span className={`app-header__sub-badge app-header__sub-badge--${sub.tone}`} title={sub.text}>
            {sub.text}
          </span>
        )}

        {isAdmin && (
          <button type="button" className="app-header__admin" onClick={onOpenAdmin}>
            <span className="app-header__admin-dot" />
            Админка
          </button>
        )}

        {user && (
          <div className="usermenu">
            <button
              type="button"
              className="usermenu__trigger"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            >
              <img className="usermenu__ava" src={user.avatarUrl} alt="" />
              <span className="usermenu__name">{user.globalName || user.username}</span>
            </button>
            {menuOpen && (
              <div className="usermenu__pop">
                <div className="usermenu__head">
                  <span className="usermenu__head-name">{user.globalName || user.username}</span>
                  <span className="usermenu__head-id">{user.id}</span>
                  {sub && <span className="usermenu__head-sub">{sub.text}</span>}
                </div>
                <button type="button" className="usermenu__item" onClick={onLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>
        )}

        <span className="app-header__ver eyebrow">
          v{APP_VERSION} · {platform}
        </span>
      </div>
    </header>
  );
}
