import { createContext, useContext } from 'react';

/** The shared message context. Provider lives in MessageContext.jsx. */
export const MessageContext = createContext(null);

/** Access the current message draft and its dispatch. */
export function useMessage() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('useMessage must be used within <MessageProvider>');
  return ctx;
}
