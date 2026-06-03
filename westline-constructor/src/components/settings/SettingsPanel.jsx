import { useSettings, THEMES, ACCENTS } from '../../context/settingsStore';
import { Button, IconButton } from '../ui/Button';
import { Checkbox } from '../ui/Field';
import './settings.css';

/** Slide-in drawer for app settings: theme, accent and grid. */
export function SettingsPanel({ open, onClose }) {
  const { settings, set, reset } = useSettings();

  return (
    <>
      <div
        className={`settings-backdrop${open ? ' settings-backdrop--open' : ''}`}
        onClick={onClose}
      />
      <aside className={`settings${open ? ' settings--open' : ''}`} aria-hidden={!open}>
        <header className="settings__head">
          <div>
            <span className="eyebrow">Конфигурация</span>
            <h2 className="settings__title dotmatrix">Настройки</h2>
          </div>
          <IconButton title="Закрыть" onClick={onClose}>
            ✕
          </IconButton>
        </header>

        <section className="settings__section">
          <span className="ui-field__label">Тема</span>
          <div className="settings__segment">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`seg${settings.theme === t.id ? ' seg--active' : ''}`}
                onClick={() => set('theme', t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings__section">
          <span className="ui-field__label">Акцентный цвет</span>
          <div className="settings__swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.label}
                className={`swatch${settings.accent.toLowerCase() === a.id.toLowerCase() ? ' swatch--active' : ''}`}
                style={{ background: a.id }}
                onClick={() => set('accent', a.id)}
              />
            ))}
            <label className="swatch swatch--custom" title="Свой цвет">
              <input
                type="color"
                value={settings.accent}
                onChange={(e) => set('accent', e.target.value)}
              />
              +
            </label>
          </div>
        </section>

        <section className="settings__section">
          <span className="ui-field__label">Интерфейс</span>
          <Checkbox
            label="Точечная сетка фона"
            checked={settings.grid}
            onChange={(v) => set('grid', v)}
          />
        </section>

        <div className="settings__footer">
          <Button variant="ghost" block onClick={reset}>
            Сбросить настройки
          </Button>
        </div>
      </aside>
    </>
  );
}
