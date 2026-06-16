'use strict';

require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[config] Missing required env var: ${name}`);
  }
  return v || '';
}

function normalizeUrl(raw) {
  let url = (raw || 'http://localhost:3001').trim().replace(/\/$/, '');
  // Tolerate PUBLIC_URL set without a scheme (common Railway mistake).
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

const config = {
  port: Number(process.env.PORT || 3001),
  publicUrl: normalizeUrl(process.env.PUBLIC_URL),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordClientSecret: required('DISCORD_CLIENT_SECRET'),
  // Bot token used to enumerate guild channels and create per-channel webhooks
  // so the desktop app can pick a destination channel. Optional — when empty,
  // the in-app channel picker is disabled and only manual webhook URLs work.
  discordBotToken: (process.env.DISCORD_BOT_TOKEN || '').trim(),
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  adminIds: (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // When true, only admins and whitelisted Discord IDs may use the app.
  inviteOnly: process.env.INVITE_ONLY === 'true',
  // Reject API calls from older desktop builds (semver, e.g. "1.0.3"). Empty = disabled.
  minClientVersion: (process.env.MIN_CLIENT_VERSION || '').trim(),
  // Seed whitelist on startup (comma-separated Discord IDs).
  seedWhitelistIds: (process.env.WHITELIST_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // When true, users need an active subscription (from a one-time code) to use the app.
  subscriptionRequired: process.env.SUBSCRIPTION_REQUIRED === 'true',
  // Default subscription length granted by a single-use code.
  subscriptionDays: Math.max(1, Number(process.env.SUBSCRIPTION_DAYS || 30)),
};

config.redirectUri = `${config.publicUrl}/auth/discord/callback`;

config.isAdmin = (discordId) => config.adminIds.includes(String(discordId));

module.exports = config;
