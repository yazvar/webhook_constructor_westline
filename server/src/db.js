/* ============================================================
   SQLite storage layer for the Westline backend.
   Two tables:
     users   — every person who signed in via Discord
     presets — shared "live" presets created by admins and
               broadcast to every connected client
   ============================================================ */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/westline.db';
const resolved = path.resolve(process.cwd(), DB_PATH);

fs.mkdirSync(path.dirname(resolved), { recursive: true });

const db = new Database(resolved);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id    TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    global_name   TEXT,
    avatar        TEXT,
    email         TEXT,
    created_at    INTEGER NOT NULL,
    last_seen     INTEGER NOT NULL,
    login_count   INTEGER NOT NULL DEFAULT 1,
    banned        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS presets (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    message     TEXT NOT NULL,
    author_id   TEXT,
    "order"     INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS whitelist (
    discord_id  TEXT PRIMARY KEY,
    added_by    TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    code        TEXT PRIMARY KEY,
    uses_left   INTEGER NOT NULL,
    created_by  TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscription_codes (
    code          TEXT PRIMARY KEY,
    duration_days INTEGER NOT NULL DEFAULT 30,
    used_by       TEXT,
    used_at       INTEGER,
    created_by    TEXT,
    created_at    INTEGER NOT NULL
  );
`);

for (const sql of ['ALTER TABLE users ADD COLUMN subscription_expires_at INTEGER']) {
  try {
    db.exec(sql);
  } catch {
    /* column already exists */
  }
}

/* ---- Users ------------------------------------------------- */

const upsertUserStmt = db.prepare(`
  INSERT INTO users (discord_id, username, global_name, avatar, email, created_at, last_seen, login_count)
  VALUES (@discord_id, @username, @global_name, @avatar, @email, @now, @now, 1)
  ON CONFLICT(discord_id) DO UPDATE SET
    username    = excluded.username,
    global_name = excluded.global_name,
    avatar      = excluded.avatar,
    email       = excluded.email,
    last_seen   = excluded.last_seen,
    login_count = users.login_count + 1
`);

function upsertUser(profile) {
  const now = Date.now();
  upsertUserStmt.run({
    discord_id: profile.id,
    username: profile.username,
    global_name: profile.global_name || null,
    avatar: profile.avatar || null,
    email: profile.email || null,
    now,
  });
  return getUser(profile.id);
}

const getUserStmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
function getUser(id) {
  return getUserStmt.get(id);
}

const touchUserStmt = db.prepare('UPDATE users SET last_seen = ? WHERE discord_id = ?');
function touchUser(id) {
  touchUserStmt.run(Date.now(), id);
}

const allUsersStmt = db.prepare('SELECT * FROM users ORDER BY last_seen DESC');
function allUsers() {
  return allUsersStmt.all();
}

const setBanStmt = db.prepare('UPDATE users SET banned = ? WHERE discord_id = ?');
function setBanned(id, banned) {
  setBanStmt.run(banned ? 1 : 0, id);
  return getUser(id);
}

/* ---- Subscriptions ----------------------------------------- */

const MS_DAY = 86400000;

function hasActiveSubscription(id) {
  const user = getUser(id);
  if (!user?.subscription_expires_at) return false;
  return user.subscription_expires_at > Date.now();
}

const setSubscriptionExpiryStmt = db.prepare(
  'UPDATE users SET subscription_expires_at = ? WHERE discord_id = ?'
);

function extendSubscription(discordId, durationDays) {
  const user = getUser(discordId);
  const now = Date.now();
  const base =
    user?.subscription_expires_at && user.subscription_expires_at > now
      ? user.subscription_expires_at
      : now;
  const expires = base + durationDays * MS_DAY;
  setSubscriptionExpiryStmt.run(expires, String(discordId));
  return expires;
}

const getSubCodeStmt = db.prepare('SELECT * FROM subscription_codes WHERE code = ?');
const markSubCodeUsedStmt = db.prepare(`
  UPDATE subscription_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL
`);

function consumeSubscriptionCode(code, discordId) {
  const normalized = String(code).trim().toUpperCase();
  const row = getSubCodeStmt.get(normalized);
  if (!row || row.used_by) return false;

  return db.transaction(() => {
    const info = markSubCodeUsedStmt.run(String(discordId), Date.now(), normalized);
    if (!info.changes) return false;
    extendSubscription(discordId, row.duration_days);
    return true;
  })();
}

const insertSubCodeStmt = db.prepare(`
  INSERT INTO subscription_codes (code, duration_days, created_by, created_at)
  VALUES (@code, @duration_days, @created_by, @created_at)
`);

function createSubscriptionCode({ code, durationDays = 30, createdBy = null }) {
  const now = Date.now();
  const normalized = String(code).trim().toUpperCase();
  insertSubCodeStmt.run({
    code: normalized,
    duration_days: Math.max(1, Number(durationDays) || 30),
    created_by: createdBy,
    created_at: now,
  });
  return getSubCodeStmt.get(normalized);
}

const allSubCodesStmt = db.prepare(
  'SELECT * FROM subscription_codes ORDER BY created_at DESC'
);
function allSubscriptionCodes() {
  return allSubCodesStmt.all();
}

const deleteSubCodeStmt = db.prepare('DELETE FROM subscription_codes WHERE code = ?');
function deleteSubscriptionCode(code) {
  deleteSubCodeStmt.run(String(code).trim().toUpperCase());
}

/* ---- Presets ----------------------------------------------- */

function rowToPreset(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    message: JSON.parse(row.message),
    authorId: row.author_id,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const allPresetsStmt = db.prepare('SELECT * FROM presets ORDER BY "order" ASC, created_at ASC');
function allPresets() {
  return allPresetsStmt.all().map(rowToPreset);
}

const getPresetStmt = db.prepare('SELECT * FROM presets WHERE id = ?');
function getPreset(id) {
  return rowToPreset(getPresetStmt.get(id));
}

const maxOrderStmt = db.prepare('SELECT COALESCE(MAX("order"), -1) AS m FROM presets');
const insertPresetStmt = db.prepare(`
  INSERT INTO presets (id, name, message, author_id, "order", created_at, updated_at)
  VALUES (@id, @name, @message, @author_id, @order, @created_at, @updated_at)
`);

function createPreset({ id, name, message, authorId }) {
  const now = Date.now();
  const order = maxOrderStmt.get().m + 1;
  insertPresetStmt.run({
    id,
    name,
    message: JSON.stringify(message),
    author_id: authorId || null,
    order,
    created_at: now,
    updated_at: now,
  });
  return getPreset(id);
}

const updatePresetStmt = db.prepare(`
  UPDATE presets SET name = @name, message = @message, updated_at = @updated_at WHERE id = @id
`);

function updatePreset(id, { name, message }) {
  const existing = getPreset(id);
  if (!existing) return null;
  updatePresetStmt.run({
    id,
    name: name ?? existing.name,
    message: JSON.stringify(message ?? existing.message),
    updated_at: Date.now(),
  });
  return getPreset(id);
}

const deletePresetStmt = db.prepare('DELETE FROM presets WHERE id = ?');
function deletePreset(id) {
  deletePresetStmt.run(id);
}

/* ---- Whitelist / invite-only -------------------------------- */

const isWhitelistedStmt = db.prepare('SELECT 1 FROM whitelist WHERE discord_id = ?');
function isWhitelisted(id) {
  return !!isWhitelistedStmt.get(String(id));
}

const insertWhitelistStmt = db.prepare(`
  INSERT INTO whitelist (discord_id, added_by, created_at)
  VALUES (@discord_id, @added_by, @created_at)
  ON CONFLICT(discord_id) DO NOTHING
`);
function addToWhitelist(discordId, addedBy = null) {
  insertWhitelistStmt.run({
    discord_id: String(discordId),
    added_by: addedBy,
    created_at: Date.now(),
  });
  return isWhitelisted(String(discordId));
}

const removeWhitelistStmt = db.prepare('DELETE FROM whitelist WHERE discord_id = ?');
function removeFromWhitelist(discordId) {
  removeWhitelistStmt.run(String(discordId));
}

const allWhitelistStmt = db.prepare('SELECT * FROM whitelist ORDER BY created_at DESC');
function allWhitelist() {
  return allWhitelistStmt.all();
}

const getInviteStmt = db.prepare('SELECT * FROM invite_codes WHERE code = ?');
const decrementInviteStmt = db.prepare(`
  UPDATE invite_codes SET uses_left = uses_left - 1 WHERE code = ? AND uses_left > 0
`);
const deleteInviteIfEmptyStmt = db.prepare('DELETE FROM invite_codes WHERE code = ? AND uses_left <= 0');

function consumeInviteCode(code, discordId) {
  const row = getInviteStmt.get(String(code).trim());
  if (!row || row.uses_left <= 0) return false;
  const ok = db.transaction(() => {
    decrementInviteStmt.run(row.code);
    addToWhitelist(discordId, 'invite');
    deleteInviteIfEmptyStmt.run(row.code);
    return true;
  })();
  return ok;
}

const insertInviteStmt = db.prepare(`
  INSERT INTO invite_codes (code, uses_left, created_by, created_at)
  VALUES (@code, @uses_left, @created_by, @created_at)
`);
function createInviteCode({ code, usesLeft = 1, createdBy = null }) {
  const now = Date.now();
  insertInviteStmt.run({
    code: String(code),
    uses_left: Math.max(1, Number(usesLeft) || 1),
    created_by: createdBy,
    created_at: now,
  });
  return getInviteStmt.get(String(code));
}

const allInvitesStmt = db.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC');
function allInviteCodes() {
  return allInvitesStmt.all();
}

const deleteInviteStmt = db.prepare('DELETE FROM invite_codes WHERE code = ?');
function deleteInviteCode(code) {
  deleteInviteStmt.run(String(code));
}

function seedWhitelist(ids) {
  for (const id of ids) addToWhitelist(id, 'seed');
}

module.exports = {
  db,
  upsertUser,
  getUser,
  touchUser,
  allUsers,
  setBanned,
  allPresets,
  getPreset,
  createPreset,
  updatePreset,
  deletePreset,
  isWhitelisted,
  addToWhitelist,
  removeFromWhitelist,
  allWhitelist,
  consumeInviteCode,
  createInviteCode,
  allInviteCodes,
  deleteInviteCode,
  seedWhitelist,
  hasActiveSubscription,
  extendSubscription,
  consumeSubscriptionCode,
  createSubscriptionCode,
  allSubscriptionCodes,
  deleteSubscriptionCode,
};
