/* ============================================================
   Westline backend — Express entry point.
   Responsibilities:
     - Discord OAuth2 login (authorization code flow)
     - Issue/verify session JWTs
     - Users registry + admin endpoints
     - Shared "live" presets with realtime broadcast (SSE)
     - Health check for the client connection guard
   ============================================================ */

'use strict';

const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const db = require('./db');
const { signToken, requireAuth, requireAdmin, extractToken, verifyToken, hasAccess, clientVersionError } = require('./auth');
const { resolveLogin, accessDeniedMessage, getSubscriptionInfo } = require('./subscription');
const events = require('./events');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use(
  cors({
    origin(origin, cb) {
      // Desktop renderer sends no Origin (file://) → allow.
      if (!origin) return cb(null, true);
      if (config.corsOrigins.length === 0) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  })
);

/* ---- OAuth state store (short-lived, in memory) ------------- */
const stateStore = new Map(); // state -> { redirect, invite, expires }
function rememberState(redirect, invite) {
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, {
    redirect,
    invite: invite || null,
    expires: Date.now() + 10 * 60_000,
  });
  return state;
}
function consumeState(state) {
  const entry = stateStore.get(state);
  if (!entry) return null;
  stateStore.delete(state);
  if (entry.expires < Date.now()) return null;
  return entry;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of stateStore) if (v.expires < now) stateStore.delete(k);
}, 60_000).unref?.();

/* ---- Health & public access info ----------------------------- */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get('/api/access', (_req, res) => {
  res.json({
    inviteOnly: config.inviteOnly,
    subscriptionRequired: config.subscriptionRequired,
    subscriptionDays: config.subscriptionDays,
    minClientVersion: config.minClientVersion || null,
  });
});

/* ---- OAuth: start ------------------------------------------- */
app.get('/auth/discord', (req, res) => {
  // `redirect` is the loopback URL the desktop app is listening on.
  const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : '';
  const invite = typeof req.query.invite === 'string' ? req.query.invite.trim() : '';
  const state = rememberState(redirect, invite);

  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
    prompt: 'consent',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

/* ---- OAuth: callback ---------------------------------------- */
app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  const entry = consumeState(String(state || ''));
  if (!code || !entry) {
    return res.status(400).send(renderResult('Ошибка входа', 'Неверный или просроченный запрос. Попробуйте снова.'));
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: config.redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new Error(`user fetch failed: ${userRes.status}`);
    const profile = await userRes.json();

    const discordId = String(profile.id);
    const user = db.upsertUser(profile);
    const login = resolveLogin(discordId, entry.invite);
    if (!login.ok) {
      return res
        .status(403)
        .send(renderResult('Доступ закрыт', accessDeniedMessage(login.reason)));
    }

    const fresh = db.getUser(discordId);
    const token = signToken(fresh);

    events.broadcast('user:joined', publicUser(fresh));

    // Hand the token back to the desktop app's loopback server.
    if (entry.redirect) {
      const url = new URL(entry.redirect);
      url.searchParams.set('token', token);
      return res.redirect(url.toString());
    }
    // Web fallback: show the token so it can be pasted manually.
    return res.send(renderResult('Готово', 'Можно вернуться в приложение Westline.', token));
  } catch (err) {
    console.error('[oauth]', err);
    return res.status(500).send(renderResult('Ошибка', 'Не удалось завершить вход. Попробуйте ещё раз.'));
  }
});

/* ---- Current user ------------------------------------------- */
app.get('/api/me', requireAuth, (req, res) => {
  db.touchUser(req.user.discord_id);
  const fresh = db.getUser(req.user.discord_id);
  res.json({
    ...publicUser(fresh),
    isAdmin: req.isAdmin,
    subscription: getSubscriptionInfo(fresh, req.isAdmin),
  });
});

/* ---- Shared presets (everyone can read) --------------------- */
app.get('/api/presets', requireAuth, (_req, res) => {
  res.json(db.allPresets());
});

app.post('/api/presets', requireAuth, requireAdmin, (req, res) => {
  const { name, message } = req.body || {};
  if (!message || typeof message !== 'object') {
    return res.status(400).json({ error: 'message_required' });
  }
  const id = `shared-${crypto.randomBytes(8).toString('hex')}`;
  const preset = db.createPreset({
    id,
    name: (name || 'Новый пресет').toString().slice(0, 120),
    message,
    authorId: req.user.discord_id,
  });
  events.broadcast('preset:new', preset);
  res.status(201).json(preset);
});

app.put('/api/presets/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, message } = req.body || {};
  const preset = db.updatePreset(req.params.id, { name, message });
  if (!preset) return res.status(404).json({ error: 'not_found' });
  events.broadcast('preset:update', preset);
  res.json(preset);
});

app.delete('/api/presets/:id', requireAuth, requireAdmin, (req, res) => {
  const existing = db.getPreset(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  db.deletePreset(req.params.id);
  events.broadcast('preset:delete', { id: req.params.id });
  res.json({ ok: true });
});

/* ---- Admin: users ------------------------------------------- */
app.get('/api/users', requireAuth, requireAdmin, (_req, res) => {
  const online = events.onlineIds();
  const users = db.allUsers().map((u) => {
    const isAdmin = config.isAdmin(u.discord_id);
    return {
      ...publicUser(u),
      email: u.email,
      loginCount: u.login_count,
      banned: !!u.banned,
      isAdmin,
      subscription: getSubscriptionInfo(u, isAdmin),
      online: online.has(u.discord_id),
    };
  });
  res.json(users);
});

app.get('/api/stats', requireAuth, requireAdmin, (_req, res) => {
  const users = db.allUsers();
  const online = events.onlineIds();
  const dayAgo = Date.now() - 24 * 3600_000;
  res.json({
    totalUsers: users.length,
    online: online.size,
    activeToday: users.filter((u) => u.last_seen >= dayAgo).length,
    presets: db.allPresets().length,
  });
});

app.post('/api/users/:id/ban', requireAuth, requireAdmin, (req, res) => {
  if (config.isAdmin(req.params.id)) {
    return res.status(400).json({ error: 'cannot_ban_admin' });
  }
  const banned = !!(req.body && req.body.banned);
  const user = db.setBanned(req.params.id, banned);
  if (!user) return res.status(404).json({ error: 'not_found' });
  events.broadcast(banned ? 'user:banned' : 'user:unbanned', { id: req.params.id });
  res.json(publicUser(user));
});

/* ---- Admin: broadcast announcement to all clients ----------- */
app.post('/api/announce', requireAuth, requireAdmin, (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'text_required' });
  events.broadcast('announce', {
    text: text.slice(0, 500),
    from: req.user.global_name || req.user.username,
    at: Date.now(),
  });
  res.json({ ok: true });
});

/* ---- Admin: whitelist & invite codes ------------------------ */
app.get('/api/whitelist', requireAuth, requireAdmin, (_req, res) => {
  res.json(
    db.allWhitelist().map((row) => ({
      discordId: row.discord_id,
      addedBy: row.added_by,
      createdAt: row.created_at,
    }))
  );
});

app.post('/api/whitelist', requireAuth, requireAdmin, (req, res) => {
  const discordId = req.body && req.body.discordId ? String(req.body.discordId).trim() : '';
  if (!discordId) return res.status(400).json({ error: 'discord_id_required' });
  db.addToWhitelist(discordId, req.user.discord_id);
  res.status(201).json({ ok: true, discordId });
});

app.delete('/api/whitelist/:id', requireAuth, requireAdmin, (req, res) => {
  if (config.isAdmin(req.params.id)) {
    return res.status(400).json({ error: 'cannot_remove_admin' });
  }
  db.removeFromWhitelist(req.params.id);
  res.json({ ok: true });
});

app.get('/api/invites', requireAuth, requireAdmin, (_req, res) => {
  res.json(
    db.allInviteCodes().map((row) => ({
      code: row.code,
      usesLeft: row.uses_left,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }))
  );
});

app.post('/api/invites', requireAuth, requireAdmin, (req, res) => {
  const usesLeft = req.body && req.body.usesLeft != null ? Number(req.body.usesLeft) : 1;
  const custom = req.body && req.body.code ? String(req.body.code).trim() : '';
  const code = custom || crypto.randomBytes(6).toString('hex').toUpperCase();
  if (code.length < 4 || code.length > 32) {
    return res.status(400).json({ error: 'invalid_code' });
  }
  try {
    const row = db.createInviteCode({
      code,
      usesLeft,
      createdBy: req.user.discord_id,
    });
    res.status(201).json({ code: row.code, usesLeft: row.uses_left, createdAt: row.created_at });
  } catch {
    res.status(409).json({ error: 'code_exists' });
  }
});

app.delete('/api/invites/:code', requireAuth, requireAdmin, (req, res) => {
  db.deleteInviteCode(req.params.code);
  res.json({ ok: true });
});

/* ---- Admin: subscription codes (one-time, grants N days) ------ */
app.get('/api/subscription-codes', requireAuth, requireAdmin, (_req, res) => {
  res.json(
    db.allSubscriptionCodes().map((row) => ({
      code: row.code,
      durationDays: row.duration_days,
      usedBy: row.used_by,
      usedAt: row.used_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      used: !!row.used_by,
    }))
  );
});

app.post('/api/subscription-codes', requireAuth, requireAdmin, (req, res) => {
  const custom = req.body && req.body.code ? String(req.body.code).trim() : '';
  const code = custom || crypto.randomBytes(8).toString('hex').toUpperCase();
  const durationDays =
    req.body && req.body.durationDays != null
      ? Number(req.body.durationDays)
      : config.subscriptionDays;
  if (code.length < 4 || code.length > 32) {
    return res.status(400).json({ error: 'invalid_code' });
  }
  try {
    const row = db.createSubscriptionCode({
      code,
      durationDays,
      createdBy: req.user.discord_id,
    });
    res.status(201).json({
      code: row.code,
      durationDays: row.duration_days,
      createdAt: row.created_at,
    });
  } catch {
    res.status(409).json({ error: 'code_exists' });
  }
});

app.delete('/api/subscription-codes/:code', requireAuth, requireAdmin, (req, res) => {
  db.deleteSubscriptionCode(req.params.code);
  res.json({ ok: true });
});

/* ---- Realtime stream (SSE) ---------------------------------- */
app.get('/api/events', (req, res) => {
  const versionErr = clientVersionError(req);
  if (versionErr) return res.status(versionErr.status).json(versionErr.body);

  const token = extractToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).end();
  const user = db.getUser(payload.sub);
  if (!user || user.banned) return res.status(403).end();
  if (!hasAccess(user.discord_id)) return res.status(403).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`event: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);

  db.touchUser(user.discord_id);
  const wasOnline = events.onlineIds().has(user.discord_id);
  const id = events.addClient(res, user.discord_id);
  if (!wasOnline) events.broadcast('presence', { id: user.discord_id, online: true });

  req.on('close', () => {
    events.removeClient(id);
    if (!events.onlineIds().has(user.discord_id)) {
      events.broadcast('presence', { id: user.discord_id, online: false });
    }
  });
});

/* ---- helpers ------------------------------------------------ */
function defaultAvatarIndex(discordId) {
  try {
    return Number(BigInt(discordId) % 5n);
  } catch {
    return 0;
  }
}

function publicUser(u) {
  return {
    id: u.discord_id,
    username: u.username,
    globalName: u.global_name,
    avatar: u.avatar,
    avatarUrl: u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex(u.discord_id)}.png`,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
  };
}

function renderResult(title, text, token) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Westline</title>
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0a0a0a;color:#ededed;font-family:'Space Grotesk',system-ui,sans-serif;
    background-image:radial-gradient(#262626 1px,transparent 1px);background-size:22px 22px}
  .card{max-width:420px;text-align:center;padding:32px;border:1px solid #262626;background:#121212;border-radius:8px}
  h1{font-size:20px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 12px}
  p{color:#8a8a8a;margin:0 0 16px}
  code{display:block;word-break:break-all;background:#161616;border:1px solid #262626;padding:12px;
    border-radius:4px;font-family:'Space Mono',monospace;font-size:11px;color:#8a8a8a}
  .accent{color:#d71921}
</style></head><body><div class="card">
  <h1><span class="accent">●</span> ${title}</h1>
  <p>${text}</p>
  ${token ? `<code>${token}</code>` : ''}
</div></body></html>`;
}

events.startHeartbeat();
if (config.seedWhitelistIds.length) db.seedWhitelist(config.seedWhitelistIds);
app.listen(config.port, () => {
  console.log(`[westline] backend on ${config.publicUrl} (port ${config.port})`);
  console.log(`[westline] redirect URI: ${config.redirectUri}`);
  console.log(`[westline] admins: ${config.adminIds.join(', ') || '(none)'}`);
  console.log(`[westline] invite-only: ${config.inviteOnly}`);
  console.log(`[westline] subscription required: ${config.subscriptionRequired}`);
  if (config.subscriptionRequired) {
    console.log(`[westline] subscription period: ${config.subscriptionDays} days`);
  }
  if (config.minClientVersion) {
    console.log(`[westline] min client version: ${config.minClientVersion}`);
  }
});
