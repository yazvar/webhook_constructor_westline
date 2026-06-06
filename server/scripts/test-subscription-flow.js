'use strict';

/**
 * Integration smoke test for subscription login cycle.
 * Run while the server is up: node scripts/test-subscription-flow.js
 */

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const crypto = require('node:crypto');
const db = require('../src/db');
const { signToken } = require('../src/auth');
const { resolveLogin, hasAccess, getSubscriptionInfo } = require('../src/subscription');
const config = require('../src/config');

const BASE = `http://localhost:${config.port || 3001}`;
const TEST_USER = `test-${crypto.randomBytes(4).toString('hex')}`;
const CLIENT_VERSION = config.minClientVersion || '1.0.4';
const ADMIN_ID = config.adminIds[0];

const headers = (token) => ({
  'Content-Type': 'application/json',
  'X-Client-Version': CLIENT_VERSION,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

async function getJson(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(token) });
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function postJson(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

function seedTestUser(discordId, { withSubscription = false } = {}) {
  db.upsertUser({
    id: discordId,
    username: 'test_user',
    global_name: 'Test User',
    avatar: null,
    email: null,
  });
  if (withSubscription) {
    db.extendSubscription(discordId, config.subscriptionDays);
  } else {
    db.db.prepare('UPDATE users SET subscription_expires_at = NULL WHERE discord_id = ?').run(discordId);
  }
}

async function main() {
  console.log('\n=== Westline subscription flow test ===\n');

  // 1. Public access info
  {
    const { res, data } = await getJson('/api/access');
    assert(res.ok, `/api/access HTTP ${res.status}`);
    assert(data.subscriptionRequired === true, 'subscriptionRequired should be true');
    ok(`/api/access → subscriptionRequired=${data.subscriptionRequired}, days=${data.subscriptionDays}`);
  }

  // 2. User without subscription cannot access API
  {
    seedTestUser(TEST_USER, { withSubscription: false });
    const token = signToken(db.getUser(TEST_USER));
    const { res, data } = await getJson('/api/me', token);
    assert(res.status === 403, `/api/me without sub should be 403, got ${res.status}`);
    assert(data.error === 'subscription_expired', `expected subscription_expired, got ${data.error}`);
    ok('User without subscription rejected (403 subscription_expired)');
  }

  // 3. resolveLogin blocks without code
  {
    const login = resolveLogin(TEST_USER, '');
    assert(!login.ok, 'resolveLogin should fail without code');
    ok('Login without code rejected');
  }

  // 4. Admin creates subscription code via API
  let subCode;
  {
    seedTestUser(ADMIN_ID, { withSubscription: false });
    const adminToken = signToken(db.getUser(ADMIN_ID));
    const { res, data } = await postJson('/api/subscription-codes', {}, adminToken);
    assert(res.status === 201, `create code HTTP ${res.status}: ${JSON.stringify(data)}`);
    subCode = data.code;
    assert(subCode, 'code missing');
    ok(`Admin created subscription code: ${subCode}`);
  }

  // 5. Redeem code → 30 days access
  {
    const login = resolveLogin(TEST_USER, subCode);
    assert(login.ok, `resolveLogin with code failed: ${login.reason}`);
    assert(hasAccess(TEST_USER), 'hasAccess after redeem');
    const user = db.getUser(TEST_USER);
    const sub = getSubscriptionInfo(user, false);
    assert(sub.active, 'subscription should be active');
    assert(sub.daysLeft >= 29 && sub.daysLeft <= 30, `daysLeft=${sub.daysLeft}`);
    ok(`Code redeemed → ${sub.daysLeft} days left`);
  }

  // 6. Code is one-time only
  {
    const other = `other-${crypto.randomBytes(4).toString('hex')}`;
    seedTestUser(other, { withSubscription: false });
    const login = resolveLogin(other, subCode);
    assert(!login.ok, 'used code should not work again');
    assert(login.reason === 'invalid_subscription_code', login.reason);
    ok('Used code cannot be redeemed twice');
  }

  // 7. /api/me returns subscription info
  {
    const token = signToken(db.getUser(TEST_USER));
    const { res, data } = await getJson('/api/me', token);
    assert(res.ok, `/api/me HTTP ${res.status}`);
    assert(data.subscription?.active, 'subscription.active');
    assert(data.subscription.daysLeft >= 29, 'daysLeft in /api/me');
    ok(`/api/me → subscription active, ${data.subscription.daysLeft} days`);
  }

  // 8. Returning user with active sub can login without code
  {
    const login = resolveLogin(TEST_USER, '');
    assert(login.ok, 'returning user with active sub should login without code');
    ok('Returning user logs in without code');
  }

  // 9. Expired subscription kicks user out
  {
    const expired = `exp-${crypto.randomBytes(4).toString('hex')}`;
    seedTestUser(expired, { withSubscription: false });
    db.db.prepare('UPDATE users SET subscription_expires_at = ? WHERE discord_id = ?').run(
      Date.now() - 1000,
      expired
    );
    const token = signToken(db.getUser(expired));
    const { res, data } = await getJson('/api/me', token);
    assert(res.status === 403, `expired sub HTTP ${res.status}`);
    assert(data.error === 'subscription_expired', data.error);
    ok('Expired subscription → auto logout (403)');
  }

  // 10. OAuth start URL accepts invite param (subscription code)
  {
    const url = `${BASE}/auth/discord?redirect=http://127.0.0.1:9999/cb&invite=TESTCODE`;
    const res = await fetch(url, { redirect: 'manual' });
    assert(res.status === 302, `OAuth start HTTP ${res.status}`);
    const loc = res.headers.get('location') || '';
    assert(loc.includes('discord.com'), 'should redirect to Discord');
    ok('OAuth entry accepts code param and redirects to Discord');
  }

  // Cleanup test user codes
  try {
    db.deleteSubscriptionCode(subCode);
  } catch {
    /* already used — ok */
  }

  console.log('\n=== All checks passed ===\n');
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  console.error('Make sure the server is running: cd server && npm start\n');
  process.exit(1);
});
