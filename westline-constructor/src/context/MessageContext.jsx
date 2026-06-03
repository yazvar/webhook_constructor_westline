import { useEffect, useMemo, useReducer } from 'react';
import { messageReducer, initialMessage } from './messageReducer';
import { MessageContext } from './messageStore';
import { createMessage } from '../utils/discord';

const STORAGE_KEY = 'westline:message';

function init() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createMessage(), ...JSON.parse(raw) };
  } catch {
    /* ignore corrupted storage */
  }
  return initialMessage;
}

export function MessageProvider({ children }) {
  const [message, dispatch] = useReducer(messageReducer, undefined, init);

  // Persist the draft (debounced) so a refresh keeps your work.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
      } catch {
        /* storage unavailable */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [message]);

  const value = useMemo(() => ({ message, dispatch }), [message]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}
