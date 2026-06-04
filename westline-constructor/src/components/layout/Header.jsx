import { useState } from 'react';
import { IconButton } from '../ui/Button';

const APP_VERSION = window.westline?.isDesktop ? 'desktop' : 'web';

/** App header — the Nothing-style brand block + user/account controls. */
export function Header({ onMenu, user, isAdmin, onOpenAdmin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
                </div>
                <button type="button" className="usermenu__item" onClick={onLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>
        )}

        <span className="app-header__ver eyebrow">v1.0 · {APP_VERSION}</span>
      </div>
    </header>
  );
}
