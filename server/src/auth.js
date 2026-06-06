'use strict';

const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');
const { isClientVersionAllowed } = require('./version');
const { hasAccess } = require('./subscription');

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

function getClientVersion(req) {
  const header = req.headers['x-client-version'];
  if (header) return header;
  if (req.query && typeof req.query.clientVersion === 'string') return req.query.clientVersion;
  return null;
}

function clientVersionError(req) {
  if (!config.minClientVersion) return null;
  if (!isClientVersionAllowed(getClientVersion(req), config.minClientVersion)) {
    return { status: 426, body: { error: 'client_outdated', minVersion: config.minClientVersion } };
  }
  return null;
}

/** Express middleware: rejects outdated desktop/web clients. */
function requireClientVersion(req, res, next) {
  const err = clientVersionError(req);
  if (err) return res.status(err.status).json(err.body);
  next();
}

function accessError() {
  if (config.subscriptionRequired) return 'subscription_expired';
  return 'not_whitelisted';
}

/** Express middleware: requires a valid session and a non-banned user. */
function requireAuth(req, res, next) {
  const versionErr = clientVersionError(req);
  if (versionErr) return res.status(versionErr.status).json(versionErr.body);

  const token = extractToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });

  const user = db.getUser(payload.sub);
  if (!user) return res.status(401).json({ error: 'unknown_user' });
  if (user.banned) return res.status(403).json({ error: 'banned' });
  if (!hasAccess(user.discord_id)) {
    return res.status(403).json({ error: accessError() });
  }

  req.user = user;
  req.isAdmin = config.isAdmin(user.discord_id);
  next();
}

/** Express middleware: requires the authed user to be an admin. */
function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = {
  signToken,
  verifyToken,
  extractToken,
  requireClientVersion,
  requireAuth,
  requireAdmin,
  hasAccess,
  clientVersionError,
};
