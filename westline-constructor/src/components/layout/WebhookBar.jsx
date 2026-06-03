import { useState } from 'react';
import { useMessage } from '../../context/messageStore';
import { useSender } from '../../hooks/useSender';
import { isValidWebhookUrl, buildPayload } from '../../utils/discord';
import { Button } from '../ui/Button';

/** Sticky action bar: webhook target, send, and JSON utilities. */
export function WebhookBar() {
  const { message, dispatch } = useMessage();
  const { status, message: statusMsg, send } = useSender();
  const [copied, setCopied] = useState(false);

  const urlOk = isValidWebhookUrl(message.webhookUrl);
  const urlTouched = message.webhookUrl.trim().length > 0;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildPayload(message), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const clearAll = () => {
    if (window.confirm('Очистить всё сообщение? Вебхук останется.')) {
      dispatch({ type: 'RESET' });
    }
  };

  return (
    <div className="webhookbar">
      <div className="webhookbar__row">
        <div className="webhookbar__field">
          <label className="ui-field__label" htmlFor="webhook-url">
            Webhook URL
          </label>
          <input
            id="webhook-url"
            className="ui-input ui-input--mono"
            value={message.webhookUrl}
            placeholder="https://discord.com/api/webhooks/…"
            spellCheck="false"
            onChange={(e) => dispatch({ type: 'SET', key: 'webhookUrl', value: e.target.value })}
            style={{
              borderColor: urlTouched ? (urlOk ? 'var(--line-strong)' : 'var(--accent-line)') : undefined,
            }}
          />
        </div>
        <Button
          variant="primary"
          disabled={!urlOk || status === 'sending'}
          onClick={() => send(message)}
        >
          {status === 'sending' ? 'Отправка…' : 'Отправить ▶'}
        </Button>
      </div>

      <div className="webhookbar__row webhookbar__row--meta">
        <div className="webhookbar__tools">
          <Button variant="ghost" onClick={copyJson}>
            {copied ? 'Скопировано ✓' : 'Копировать JSON'}
          </Button>
          <Button variant="ghost" onClick={clearAll}>
            Очистить
          </Button>
        </div>
        <div className={`webhookbar__status webhookbar__status--${status}`}>
          {urlTouched && !urlOk && status === 'idle' && 'Неверный формат URL вебхука'}
          {statusMsg}
        </div>
      </div>
    </div>
  );
}
