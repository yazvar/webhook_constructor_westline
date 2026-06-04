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
`);

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
};
