import { useCallback, useState } from 'react';
import { sendToWebhook } from '../utils/discord';

/**
 * Wraps sendToWebhook with status state for the UI.
 * status: 'idle' | 'sending' | 'success' | 'error'
 */
export function useSender() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const send = useCallback(async (draft) => {
    setStatus('sending');
    setMessage('');
    try {
      await sendToWebhook(draft);
      setStatus('success');
      setMessage('Сообщение отправлено.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Не удалось отправить сообщение.');
    }
    setTimeout(() => setStatus((s) => (s === 'sending' ? s : 'idle')), 4000);
  }, []);

  return { status, message, send };
}
