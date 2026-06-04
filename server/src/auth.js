'use strict';

const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

const TOKEN_TTL = '30d';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.discord_id,
      username: user.username,
      avatar: user.avatar,
      global_name: user.global_name,
    },
    config.jwtSecret,
    { expiresIn: TOKEN_TTL }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

/** Pulls a bearer token from header OR ?token= query (needed for EventSource). */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.query && typeof req.query.token === 'string') return req.query.token;
  return null;
}

/** Express middleware: requires a valid session and a non-banned user. */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });

  const user = db.getUser(payload.sub);
  if (!user) return res.status(401).json({ error: 'unknown_user' });
  if (user.banned) return res.status(403).json({ error: 'banned' });

  req.user = user;
  req.isAdmin = config.isAdmin(user.discord_id);
  next();
}

/** Express middleware: requires the authed user to be an admin. */
function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = { signToken, verifyToken, extractToken, requireAuth, requireAdmin };
