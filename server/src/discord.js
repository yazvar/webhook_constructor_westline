'use strict';

/* ============================================================
   Discord bot helpers (multi-bot).
   Uses one or many bot tokens (config.discordBotTokens) to:
     - discover the guilds every bot is a member of and remember
       which bot serves which guild (guild -> token index)
     - list the text channels of a guild (grouped by category)
     - get-or-create a reusable webhook for a channel

   Adding a new project = drop its bot token in the hosting vars.
   The webhook URL is what the desktop client actually posts to,
   so per-message username/avatar overrides keep working.
   ============================================================ */

const config = require('./config');

const API = 'https://discord.com/api/v10';
const WEBHOOK_NAME = 'Westline';

/** channelId -> { url, expires } cache so we don't re-create webhooks. */
const webhookCache = new Map();
const WEBHOOK_TTL = 30 * 60_000; // 30 min

/** guildId -> { id, name, iconUrl, token } built from every bot's guild list. */
let guildIndex = null;
let guildIndexExpires = 0;
const GUILD_TTL = 5 * 60_000; // 5 min

function isEnabled() {
  return config.discordBotTokens.length > 0;
}

async function botFetch(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
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

function notConfigured() {
  const err = new Error('bot_not_configured');
  err.status = 503;
  return err;
}

/** Build (and cache) the guild -> token index across all bots. */
async function buildGuildIndex(force = false) {
  if (!isEnabled()) throw notConfigured();
  if (guildIndex && !force && guildIndexExpires > Date.now()) return guildIndex;

  const map = new Map();
  for (const token of config.discordBotTokens) {
    try {
      const guilds = await botFetch(token, '/users/@me/guilds');
      for (const g of guilds || []) {
        if (map.has(g.id)) continue; // first bot that has it wins
        map.set(g.id, {
          id: g.id,
          name: g.name,
          iconUrl: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
            : null,
          token,
        });
      }
    } catch (err) {
      // A single bad/expired token shouldn't kill the whole index.
      console.error('[discord] guild list failed for one bot:', err.message);
    }
  }
  guildIndex = map;
  guildIndexExpires = Date.now() + GUILD_TTL;
  return guildIndex;
}

/** All guilds reachable by any bot: [{ id, name, iconUrl }] (no tokens). */
async function listAllGuilds(force = false) {
  const index = await buildGuildIndex(force);
  return [...index.values()]
    .map(({ id, name, iconUrl }) => ({ id, name, iconUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function tokenForGuild(guildId) {
  const index = await buildGuildIndex();
  const entry = index.get(String(guildId));
  return entry ? entry.token : null;
}

// Channel types we can post a normal message into via a webhook.
const TEXT_TYPES = new Set([0, 5]); // GUILD_TEXT, GUILD_ANNOUNCEMENT
const CATEGORY_TYPE = 4;

/**
 * Text channels of a guild, each annotated with its category name and ordered
 * the way they appear in Discord (category position, then channel position).
 */
async function listChannels(guildId) {
  const token = await tokenForGuild(guildId);
  if (!token) {
    const err = new Error('guild_not_available');
    err.status = 404;
    throw err;
  }
  const channels = await botFetch(token, `/guilds/${guildId}/channels`);
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
async function getOrCreateWebhook(channelId, guildId) {
  const cached = cacheGet(channelId);
  if (cached) return cached;

  const token = await tokenForGuild(guildId);
  if (!token) {
    const err = new Error('guild_not_available');
    err.status = 404;
    throw err;
  }

  const existing = await botFetch(token, `/channels/${channelId}/webhooks`);
  const mine = (existing || []).find(
    (w) => w.name === WEBHOOK_NAME && w.token
  );
  let hook = mine;
  if (!hook) {
    hook = await botFetch(token, `/channels/${channelId}/webhooks`, {
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
  listAllGuilds,
  listChannels,
  getOrCreateWebhook,
  refreshGuilds: () => buildGuildIndex(true),
};
