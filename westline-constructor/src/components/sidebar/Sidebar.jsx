import { useState } from 'react';
import { useMessage } from '../../context/messageStore';
import { IconButton, Button } from '../ui/Button';
import './sidebar.css';

/**
 * Left navigation: list of saved presets with load / save / rename /
 * duplicate / delete, plus an entry to the settings drawer.
 */
export function Sidebar({ presetsApi, activeId, setActiveId, onOpenSettings, onClose, open = false }) {
  const { message, dispatch } = useMessage();
  const { presets, loading, create, update, remove } = presetsApi;
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');

  const loadPreset = (preset) => {
    dispatch({ type: 'REPLACE', message: preset.message });
    setActiveId(preset.id);
    onClose?.();
  };

  const createPreset = async () => {
    const preset = await create(`Пресет ${presets.length + 1}`, message);
    setActiveId(preset.id);
    setEditingId(preset.id);
    setDraftName(preset.name);
  };

  const commitRename = (id) => {
    const name = draftName.trim();
    if (name) update(id, { name });
    setEditingId(null);
  };

  const saveCurrent = (id) => {
    update(id, { message });
    setActiveId(id);
  };

  const duplicate = async (preset) => {
    const copy = await create(`${preset.name} (копия)`, preset.message);
    setActiveId(copy.id);
  };

  const confirmDelete = (preset) => {
    if (window.confirm(`Удалить пресет «${preset.name}»?`)) {
      remove(preset.id);
      if (activeId === preset.id) setActiveId(null);
    }
  };

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar__head">
        <span className="sidebar__logo" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
        <div className="sidebar__head-text">
          <span className="dotmatrix sidebar__brand">Westline</span>
          <span className="eyebrow">Presets</span>
        </div>
        <IconButton className="sidebar__close" title="Закрыть" onClick={onClose}>
          ✕
        </IconButton>
      </div>

      <Button variant="primary" block onClick={createPreset}>
        + Новый пресет
      </Button>

      <div className="sidebar__list">
        {loading && <p className="sidebar__hint">Загрузка…</p>}
        {!loading && presets.length === 0 && (
          <p className="sidebar__hint">
            Пресетов нет. Соберите сообщение и сохраните его как пресет.
          </p>
        )}

        {presets.map((preset) => {
          const active = preset.id === activeId;
          const editing = preset.id === editingId;
          return (
            <div
              key={preset.id}
              className={`preset${active ? ' preset--active' : ''}`}
            >
              {editing ? (
                <input
                  className="preset__rename"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(preset.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(preset.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="preset__main"
                  onClick={() => loadPreset(preset)}
                  title="Загрузить пресет"
                >
                  <span className="preset__name">{preset.name}</span>
                  <span className="preset__meta">
                    {preset.message.embeds.length} эмбед(ов)
                    {preset.message.content?.trim() ? ' · текст' : ''}
                  </span>
                </button>
              )}

              <div className="preset__actions">
                <IconButton
                  title="Сохранить текущее сюда"
                  onClick={() => saveCurrent(preset.id)}
                >
                  ↻
                </IconButton>
                <IconButton
                  title="Переименовать"
                  onClick={() => {
                    setEditingId(preset.id);
                    setDraftName(preset.name);
                  }}
                >
                  ✎
                </IconButton>
                <IconButton title="Дублировать" onClick={() => duplicate(preset)}>
                  ⧉
                </IconButton>
                <IconButton danger title="Удалить" onClick={() => confirmDelete(preset)}>
                  ✕
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="sidebar__settings" onClick={onOpenSettings}>
        <span className="sidebar__settings-ico">⚙</span>
        <span>Настройки</span>
      </button>
    </aside>
  );
}
