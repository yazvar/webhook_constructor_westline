import { Button } from '../ui/Button';
import './connection.css';

/**
 * Blocking overlay shown whenever the app can't reach the internet
 * / backend. The whole product requires a connection, so we gate it.
 */
export function ConnectionOverlay({ checking, onRetry }) {
  return (
    <div className="conn">
      <div className="conn__card">
        <span className="conn__icon" aria-hidden="true">⚡</span>
        <h2 className="conn__title dotmatrix">Нет соединения</h2>
        <p className="conn__text">
          Westline требует подключения к интернету. Проверьте сеть —
          переподключение произойдёт автоматически.
        </p>
        <Button variant="primary" onClick={onRetry} disabled={checking}>
          {checking ? 'Проверяем…' : 'Повторить'}
        </Button>
      </div>
    </div>
  );
}
