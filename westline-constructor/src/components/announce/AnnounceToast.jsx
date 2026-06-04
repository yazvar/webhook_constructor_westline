import { useEffect, useState } from 'react';
import './announce.css';

/** Transient toast shown to everyone when an admin broadcasts a message. */
export function AnnounceToast({ announcement }) {
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (!announcement) return undefined;
    setItem(announcement);
    const t = setTimeout(() => setItem(null), 9000);
    return () => clearTimeout(t);
  }, [announcement]);

  if (!item) return null;

  return (
    <div className="announce" role="alert" key={item.key}>
      <span className="announce__bar" aria-hidden="true" />
      <div className="announce__body">
        <span className="eyebrow">Объявление · {item.from}</span>
        <p className="announce__text">{item.text}</p>
      </div>
      <button type="button" className="announce__close" onClick={() => setItem(null)}>
        ✕
      </button>
    </div>
  );
}
