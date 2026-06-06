'use strict';

/** Parses "1.2.3" into [1, 2, 3]; non-numeric suffixes are ignored. */
function parseSemver(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.trim().split('.').map((p) => parseInt(p.replace(/[^\d].*$/, ''), 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b. Invalid values compare as 0. */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

function isClientVersionAllowed(clientVersion, minVersion) {
  if (!minVersion) return true;
  if (!clientVersion) return false;
  return compareSemver(clientVersion, minVersion) >= 0;
}

module.exports = { compareSemver, isClientVersionAllowed };
