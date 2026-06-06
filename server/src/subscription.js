'use strict';

const config = require('./config');
const db = require('./db');

const MS_DAY = 86400000;

function hasActiveSubscription(discordId) {
  return db.hasActiveSubscription(discordId);
}

/** Whether the user may call protected API routes right now. */
function hasAccess(discordId) {
  if (config.isAdmin(discordId)) return true;
  if (db.isWhitelisted(discordId)) return true;
  if (config.subscriptionRequired) return hasActiveSubscription(discordId);
  if (config.inviteOnly) return db.isWhitelisted(discordId);
  return true;
}

function getSubscriptionInfo(user, isAdmin) {
  if (isAdmin || db.isWhitelisted(user.discord_id)) {
    return { active: true, permanent: true, daysLeft: null, expiresAt: null };
  }
  const expires = user.subscription_expires_at;
  const now = Date.now();
  if (!expires || expires <= now) {
    return { active: false, permanent: false, daysLeft: 0, expiresAt: expires || null };
  }
  return {
    active: true,
    permanent: false,
    daysLeft: Math.max(1, Math.ceil((expires - now) / MS_DAY)),
    expiresAt: expires,
  };
}

/** Validates Discord login after profile upsert; may consume a one-time access code. */
function resolveLogin(discordId, code) {
  if (hasAccess(discordId)) return { ok: true };

  const trimmed = code ? String(code).trim() : '';
  if (!trimmed) {
    return { ok: false, reason: config.subscriptionRequired ? 'subscription' : 'invite' };
  }

  if (config.subscriptionRequired) {
    if (db.consumeSubscriptionCode(trimmed, discordId)) return { ok: true };
    return { ok: false, reason: 'invalid_subscription_code' };
  }

  if (config.inviteOnly && db.consumeInviteCode(trimmed, discordId)) {
    return { ok: true };
  }

  return { ok: false, reason: config.inviteOnly ? 'invalid_invite' : 'subscription' };
}

function accessDeniedMessage(reason) {
  if (reason === 'invalid_subscription_code') {
    return 'Неверный или уже использованный код подписки.';
  }
  if (reason === 'subscription') {
    return 'Приложение работает по подписке. Введите одноразовый код при входе.';
  }
  return 'Приложение работает по приглашениям. Попросите администратора или используйте код при входе.';
}

module.exports = {
  hasAccess,
  hasActiveSubscription,
  getSubscriptionInfo,
  resolveLogin,
  accessDeniedMessage,
};
