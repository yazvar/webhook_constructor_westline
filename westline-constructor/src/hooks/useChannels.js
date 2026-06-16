import { useCallback, useRef, useState } from 'react';
import { api } from '../utils/api';

/**
 * Talks to the bot-powered channel endpoints on the backend:
 *   - lists the guilds the bot is in
 *   - lists a guild's text channels (cached per guild)
 *   - resolves a channel id to a postable webhook URL
 *
 * `enabled` is null until the first guild load tells us whether the backend
 * has a bot token configured (bot_not_configured → false).
 */
export function useChannels() {
  const [enabled, setEnabled] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [error, setError] = useState('');
  const [channelsByGuild, setChannelsByGuild] = useState({});
  const [channelsLoading, setChannelsLoading] = useState(false);
  const loadedGuilds = useRef(false);

  const loadGuilds = useCallback(async (force = false) => {
    if (loadedGuilds.current && !force) return;
    loadedGuilds.current = true;
    setGuildsLoading(true);
    setError('');
    try {
      const list = await api('/api/discord/guilds');
      setGuilds(list || []);
      setEnabled(true);
    } catch (err) {
      if (err.code === 'bot_not_configured') {
        setEnabled(false);
      } else {
        setEnabled(true);
        setError(err.message || 'Не удалось загрузить серверы');
        loadedGuilds.current = false; // allow a retry
      }
    } finally {
      setGuildsLoading(false);
    }
  }, []);

  const loadChannels = useCallback(
    async (guildId, force = false) => {
      if (!guildId) return [];
      if (channelsByGuild[guildId] && !force) return channelsByGuild[guildId];
      setChannelsLoading(true);
      setError('');
      try {
        const list = await api(`/api/discord/guilds/${guildId}/channels`);
        setChannelsByGuild((prev) => ({ ...prev, [guildId]: list || [] }));
        return list || [];
      } catch (err) {
        setError(err.message || 'Не удалось загрузить каналы');
        return [];
      } finally {
        setChannelsLoading(false);
      }
    },
    [channelsByGuild]
  );

  const resolveWebhook = useCallback(async (channelId, guildId) => {
    const data = await api('/api/discord/resolve-webhook', {
      method: 'POST',
      body: { channelId, guildId },
    });
    return data && data.url;
  }, []);

  return {
    enabled,
    guilds,
    guildsLoading,
    channelsByGuild,
    channelsLoading,
    error,
    loadGuilds,
    loadChannels,
    resolveWebhook,
  };
}
