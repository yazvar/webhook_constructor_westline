import { useState } from 'react';

/** Accordion section. Header shows a title, chevron and optional actions. */
export function Collapsible({ title, actions, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ui-collapse">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className="ui-collapse__head"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className={`ui-collapse__chev${open ? ' ui-collapse__chev--open' : ''}`}>
            ▶
          </span>
          <span className="ui-collapse__title">{title}</span>
        </button>
        {actions && (
          <div style={{ display: 'flex', gap: 6, paddingRight: 12 }}>{actions}</div>
        )}
      </div>
      {open && <div className="ui-collapse__body">{children}</div>}
    </div>
  );
}
