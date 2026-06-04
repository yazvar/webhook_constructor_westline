'use strict';

require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[config] Missing required env var: ${name}`);
  }
  return v || '';
}

const config = {
  port: Number(process.env.PORT || 3001),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3001').replace(/\/$/, ''),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordClientSecret: required('DISCORD_CLIENT_SECRET'),
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  adminIds: (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

config.redirectUri = `${config.publicUrl}/auth/discord/callback`;

config.isAdmin = (discordId) => config.adminIds.includes(String(discordId));

module.exports = config;
