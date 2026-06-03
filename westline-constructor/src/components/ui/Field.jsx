import { useId } from 'react';

function Counter({ value, max }) {
  if (!max) return null;
  const len = (value || '').length;
  return (
    <span className={`ui-field__counter${len > max ? ' ui-field__counter--over' : ''}`}>
      {len}/{max}
    </span>
  );
}

/** Labelled single-line input with optional character counter. */
export function Input({ label, value, onChange, max, mono = false, ...props }) {
  const id = useId();
  return (
    <div className="ui-field">
      {label && (
        <div className="ui-field__head">
          <label className="ui-field__label" htmlFor={id}>
            {label}
          </label>
          <Counter value={value} max={max} />
        </div>
      )}
      <input
        id={id}
        className={`ui-input${mono ? ' ui-input--mono' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max ? max + 50 : undefined}
        {...props}
      />
    </div>
  );
}

/** Labelled multi-line textarea with optional character counter. */
export function TextArea({ label, value, onChange, max, rows = 4, ...props }) {
  const id = useId();
  return (
    <div className="ui-field">
      {label && (
        <div className="ui-field__head">
          <label className="ui-field__label" htmlFor={id}>
            {label}
          </label>
          <Counter value={value} max={max} />
        </div>
      )}
      <textarea
        id={id}
        className="ui-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </div>
  );
}

/** Color picker bound to a hex string, with a manual hex input. */
export function ColorField({ label, value, onChange }) {
  return (
    <div className="ui-field">
      {label && <span className="ui-field__label">{label}</span>}
      <div className="ui-color">
        <input
          type="color"
          className="ui-color__swatch"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <input
          className="ui-input ui-input--mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck="false"
        />
      </div>
    </div>
  );
}

/** Checkbox with a mono label. */
export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="ui-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
