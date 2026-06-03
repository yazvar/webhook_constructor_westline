/* ============================================================
   IndexedDB storage layer.
   Presets survive restarts here (far more robust than
   localStorage: larger quota, structured records, indexes).
   A localStorage mirror is kept as a read fallback in case
   IndexedDB is unavailable (private mode, old browsers).
   ============================================================ */

const DB_NAME = 'westline';
const DB_VERSION = 1;
const STORE = 'presets';
const MIRROR_KEY = 'westline:presets-mirror';

let dbPromise = null;

function hasIDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('order', 'order');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  return dbPromise;
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---- localStorage mirror (fallback) ----------------------- */
function readMirror() {
  try {
    return JSON.parse(window.localStorage.getItem(MIRROR_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeMirror(list) {
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(list));
  } catch {
    /* quota / unavailable */
  }
}

/* ---- Public API ------------------------------------------- */

/** Returns all presets ordered by their `order` field. */
export async function getAllPresets() {
  if (!hasIDB()) return readMirror().sort((a, b) => a.order - b.order);
  try {
    const db = await openDB();
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const all = await reqToPromise(store.getAll());
    all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    writeMirror(all);
    return all;
  } catch {
    return readMirror().sort((a, b) => a.order - b.order);
  }
}

/** Insert or update a preset (keyed by id). */
export async function savePreset(preset) {
  if (hasIDB()) {
    try {
      const db = await openDB();
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      await reqToPromise(store.put(preset));
    } catch {
      /* fall through to mirror only */
    }
  }
  const list = readMirror().filter((p) => p.id !== preset.id);
  list.push(preset);
  writeMirror(list);
  return preset;
}

/** Remove a preset by id. */
export async function deletePreset(id) {
  if (hasIDB()) {
    try {
      const db = await openDB();
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      await reqToPromise(store.delete(id));
    } catch {
      /* fall through */
    }
  }
  writeMirror(readMirror().filter((p) => p.id !== id));
}

/** Persist a new ordering (array of ids). */
export async function reorderPresets(orderedList) {
  const stamped = orderedList.map((p, i) => ({ ...p, order: i }));
  if (hasIDB()) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      stamped.forEach((p) => store.put(p));
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch {
      /* fall through */
    }
  }
  writeMirror(stamped);
  return stamped;
}
