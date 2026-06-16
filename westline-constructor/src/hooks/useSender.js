import { useCallback, useState } from 'react';
import { sendToWebhook } from '../utils/discord';

/**
 * Wraps sendToWebhook with status state for the UI.
 * status: 'idle' | 'sending' | 'success' | 'error'
 */
export function useSender() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  /**
   * Send a draft. When `resolveUrl` is given it runs first (e.g. to turn a
   * picked channel into a webhook URL) and its result overrides webhookUrl.
   */
  const send = useCallback(async (draft, resolveUrl) => {
    setStatus('sending');
    setMessage(resolveUrl ? 'Подготовка канала…' : '');
    try {
      let finalDraft = draft;
      if (resolveUrl) {
        const url = await resolveUrl();
        if (!url) throw new Error('Не удалось получить вебхук для канала.');
        finalDraft = { ...draft, webhookUrl: url };
      }
      await sendToWebhook(finalDraft);
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
