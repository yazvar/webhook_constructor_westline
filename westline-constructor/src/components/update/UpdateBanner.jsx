import { useState } from 'react';
import { Button, IconButton } from '../ui/Button';
import './update.css';

/**
 * Slim banner pinned to the bottom-right. Reacts to electron-updater
 * state: announces an available update, shows download progress and
 * offers a one-click restart-to-install once downloaded.
 */
export function UpdateBanner({ updater }) {
  const [dismissed, setDismissed] = useState(false);
  const { status, version, percent, install } = updater;

  if (dismissed) return null;
  if (status !== 'available' && status !== 'downloading' && status !== 'downloaded') {
    return null;
  }

  return (
    <div className="update" role="status">
      <span className="update__pulse" aria-hidden="true" />
      <div className="update__body">
        <span className="eyebrow">Обновление</span>
        {status === 'available' && (
          <p className="update__text">Доступна новая версия {version && `v${version}`}. Загружаем…</p>
        )}
        {status === 'downloading' && (
          <>
            <p className="update__text">Загрузка обновления… {percent}%</p>
            <div className="update__bar">
              <span style={{ width: `${percent}%` }} />
            </div>
          </>
        )}
        {status === 'downloaded' && (
          <p className="update__text">
            Версия {version && `v${version}`} готова к установке.
          </p>
        )}
      </div>

      {status === 'downloaded' ? (
        <Button variant="primary" onClick={install}>
          Перезапустить
        </Button>
      ) : (
        <IconButton title="Скрыть" onClick={() => setDismissed(true)}>
          ✕
        </IconButton>
      )}
    </div>
  );
}
