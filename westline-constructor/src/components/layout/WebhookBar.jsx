import { useEffect, useMemo, useState } from 'react';
import { useMessage } from '../../context/messageStore';
import { useSender } from '../../hooks/useSender';
import { useChannels } from '../../hooks/useChannels';
import { isValidWebhookUrl, buildPayload } from '../../utils/discord';
import { Button } from '../ui/Button';

/** Sticky action bar: webhook target (channel picker or URL), send, JSON utils. */
export function WebhookBar() {
  const { message, dispatch } = useMessage();
  const { status, message: statusMsg, send } = useSender();
  const {
    enabled,
    guilds,
    guildsLoading,
    channelsByGuild,
    channelsLoading,
    error: channelsError,
    loadGuilds,
    loadChannels,
    resolveWebhook,
  } = useChannels();
  const [copied, setCopied] = useState(false);

  const target = message.target || 'url';
  const urlOk = isValidWebhookUrl(message.webhookUrl);
  const urlTouched = message.webhookUrl.trim().length > 0;

  // Detect whether the bot-powered picker is available.
  useEffect(() => {
    loadGuilds();
  }, [loadGuilds]);

  // Once we know the bot is configured, default a blank draft to the picker.
  useEffect(() => {
    if (enabled === true && target === 'url' && !urlTouched && !message.channelId) {
      dispatch({ type: 'SET', key: 'target', value: 'channel' });
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load channels for whichever guild is selected/restored.
  useEffect(() => {
    if (target === 'channel' && message.guildId) {
      loadChannels(message.guildId);
    }
  }, [target, message.guildId, loadChannels]);

  const guildChannels = useMemo(
    () => channelsByGuild[message.guildId] || [],
    [channelsByGuild, message.guildId]
  );

  // Group channels by category for optgroup rendering, keeping server order.
  const channelGroups = useMemo(() => {
    const groups = [];
    const byLabel = new Map();
    for (const c of guildChannels) {
      const label = c.categoryName || 'Без категории';
      if (!byLabel.has(label)) {
        const g = { label, items: [] };
        byLabel.set(label, g);
        groups.push(g);
      }
      byLabel.get(label).items.push(c);
    }
    return groups;
  }, [guildChannels]);

  const setTarget = (value) => dispatch({ type: 'SET', key: 'target', value });

  const onGuildChange = (guildId) => {
    dispatch({ type: 'SET', key: 'guildId', value: guildId });
    dispatch({ type: 'SET', key: 'channelId', value: '' });
    dispatch({ type: 'SET', key: 'channelLabel', value: '' });
    if (guildId) loadChannels(guildId);
  };

  const onChannelChange = (channelId) => {
    const ch = guildChannels.find((c) => c.id === channelId);
    dispatch({ type: 'SET', key: 'channelId', value: channelId });
    dispatch({ type: 'SET', key: 'channelLabel', value: ch ? `#${ch.name}` : '' });
  };

  const channelOk = target === 'channel' && !!message.channelId;
  const canSend =
    status !== 'sending' && (target === 'channel' ? channelOk : urlOk);

  const onSend = () => {
    if (target === 'channel') {
      send(message, () => resolveWebhook(message.channelId, message.guildId));
    } else {
      send(message);
    }
  };

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
    if (window.confirm('Очистить всё сообщение? Адресат останется.')) {
      dispatch({ type: 'RESET' });
    }
  };

  const showPicker = enabled !== false;

  return (
    <div className="webhookbar">
      {showPicker && (
        <div className="webhookbar__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={target === 'channel'}
            className={`webhookbar__tab ${target === 'channel' ? 'is-active' : ''}`}
            onClick={() => setTarget('channel')}
          >
            Канал
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={target === 'url'}
            className={`webhookbar__tab ${target === 'url' ? 'is-active' : ''}`}
            onClick={() => setTarget('url')}
          >
            URL вебхука
          </button>
        </div>
      )}

      <div className="webhookbar__row">
        {target === 'channel' && showPicker ? (
          <div className="webhookbar__picker">
            <div className="webhookbar__field">
              <label className="ui-field__label" htmlFor="guild-select">
                Сервер
              </label>
              <select
                id="guild-select"
                className="ui-select"
                value={message.guildId || ''}
                disabled={guildsLoading}
                onChange={(e) => onGuildChange(e.target.value)}
              >
                <option value="">
                  {guildsLoading ? 'Загрузка…' : '— выберите сервер —'}
                </option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="webhookbar__field">
              <label className="ui-field__label" htmlFor="channel-select">
                Канал
              </label>
              <select
                id="channel-select"
                className="ui-select"
                value={message.channelId || ''}
                disabled={!message.guildId || channelsLoading}
                onChange={(e) => onChannelChange(e.target.value)}
              >
                <option value="">
                  {channelsLoading
                    ? 'Загрузка…'
                    : message.guildId
                      ? '— выберите канал —'
                      : 'сначала сервер'}
                </option>
                {channelGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        ) : (
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
        )}
        <Button variant="primary" disabled={!canSend} onClick={onSend}>
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
          {target === 'url' && urlTouched && !urlOk && status === 'idle' && 'Неверный формат URL вебхука'}
          {target === 'channel' && channelsError && status === 'idle' && channelsError}
          {statusMsg}
        </div>
      </div>
    </div>
  );
}
