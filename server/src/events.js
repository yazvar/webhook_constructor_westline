/* ============================================================
   Server-Sent Events hub.
   Every connected client holds one open SSE response. Admins
   push preset / announcement events that fan out to everyone in
   real time. Also tracks who is currently online.
   ============================================================ */

'use strict';

let nextId = 1;
// id -> { res, userId }
const clients = new Map();

function addClient(res, userId) {
  const id = nextId++;
  clients.set(id, { res, userId });
  return id;
}

function removeClient(id) {
  clients.delete(id);
}

/** Push a named event with a JSON payload to every connected client. */
function broadcast(type, data) {
  const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { res } of clients.values()) {
    try {
      res.write(frame);
    } catch {
      /* dead socket — cleaned up on its own 'close' */
    }
  }
}

/** Set of discord ids that currently hold at least one open stream. */
function onlineIds() {
  const set = new Set();
  for (const { userId } of clients.values()) if (userId) set.add(userId);
  return set;
}

/** Keep proxies from closing idle SSE connections. */
function startHeartbeat() {
  setInterval(() => {
    for (const { res } of clients.values()) {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* ignore */
      }
    }
  }, 25_000).unref?.();
}

module.exports = { addClient, removeClient, broadcast, onlineIds, startHeartbeat };
