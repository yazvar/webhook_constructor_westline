'use strict';

/* ============================================================
   Discord bot helpers.
   Uses the bot token (config.discordBotToken) to:
     - list the guilds the bot is a member of
     - list the text channels of a guild (grouped by category)
     - get-or-create a reusable webhook for a channel

   The webhook URL is what the desktop client actually posts to,
   so per-message username/avatar overrides keep working.
   ============================================================ */

const config = require('./config');

const API = 'https://discord.com/api/v10';
const WEBHOOK_NAME = 'Westline';

/** channelId -> { url, expires } cache so we don't re-create webhooks. */
const webhookCache = new Map();
const WEBHOOK_TTL = 30 * 60_000; // 30 min

function isEnabled() {
  return !!config.discordBotToken;
}

async function botFetch(path, init = {}) {
  if (!isEnabled()) {
    const err = new Error('bot_not_configured');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${config.discordBotToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.message) detail = `${detail} — ${data.message}`;
    } catch {
      /* no JSON body */
    }
    const err = new Error(detail);
    err.status = res.status === 429 ? 429 : 502;
    err.discordStatus = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** Guilds the bot is in: [{ id, name, iconUrl }]. */
async function listGuilds() {
  const guilds = await botFetch('/users/@me/guilds');
  return (guilds || [])
    .map((g) => ({
      id: g.id,
      name: g.name,
      iconUrl: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Channel types we can post a normal message into via a webhook.
const TEXT_TYPES = new Set([0, 5]); // GUILD_TEXT, GUILD_ANNOUNCEMENT
const CATEGORY_TYPE = 4;

/**
 * Text channels of a guild, each annotated with its category name and ordered
 * the way they appear in Discord (category position, then channel position).
 */
async function listChannels(guildId) {
  const channels = await botFetch(`/guilds/${guildId}/channels`);
  const categories = new Map();
  for (const c of channels) {
    if (c.type === CATEGORY_TYPE) {
      categories.set(c.id, { name: c.name, position: c.position });
    }
  }

  const textChannels = channels
    .filter((c) => TEXT_TYPES.has(c.type))
    .map((c) => {
      const cat = c.parent_id ? categories.get(c.parent_id) : null;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        categoryId: c.parent_id || null,
        categoryName: cat ? cat.name : null,
        categoryPosition: cat ? cat.position : -1,
        position: c.position,
      };
    });

  textChannels.sort(
    (a, b) =>
      a.categoryPosition - b.categoryPosition || a.position - b.position
  );
  return textChannels;
}

function cacheGet(channelId) {
  const hit = webhookCache.get(channelId);
  if (hit && hit.expires > Date.now()) return hit.url;
  if (hit) webhookCache.delete(channelId);
  return null;
}

function cacheSet(channelId, url) {
  webhookCache.set(channelId, { url, expires: Date.now() + WEBHOOK_TTL });
}

/** Find an existing Westline webhook in the channel or create a fresh one. */
async function getOrCreateWebhook(channelId) {
  const cached = cacheGet(channelId);
  if (cached) return cached;

  const existing = await botFetch(`/channels/${channelId}/webhooks`);
  const mine = (existing || []).find(
    (w) => w.name === WEBHOOK_NAME && w.token
  );
  let hook = mine;
  if (!hook) {
    hook = await botFetch(`/channels/${channelId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify({ name: WEBHOOK_NAME }),
    });
  }
  if (!hook || !hook.id || !hook.token) {
    const err = new Error('webhook_unavailable');
    err.status = 502;
    throw err;
  }
  const url = `https://discord.com/api/webhooks/${hook.id}/${hook.token}`;
  cacheSet(channelId, url);
  return url;
}

module.exports = {
  isEnabled,
  listGuilds,
  listChannels,
  getOrCreateWebhook,
};
