import { IconButton } from '../ui/Button';

/** App header — the Nothing-style brand block. */
export function Header({ onMenu }) {
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
      <span className="app-header__ver eyebrow">v1.0 · local</span>
    </header>
  );
}
