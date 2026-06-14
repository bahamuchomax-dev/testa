/* ============================================================
 * readCache - lightweight read reduction for repository fetches.
 * ------------------------------------------------------------
 * Use this in front of Firestore getDoc/getDocs when Firebase is enabled.
 * It reduces billed reads by:
 *   - reusing fresh values within CACHE_TTL_MS
 *   - sharing same-key in-flight reads
 *   - invalidating cache after writes/deletes
 *   - preventing stale in-flight reads from repopulating invalidated cache
 * ============================================================ */

export const CACHE_TTL_MS = 60_000;

export function createReadCache(opts = {}) {
  const ttl = opts.ttl == null ? CACHE_TTL_MS : opts.ttl;
  const now = opts.now || (() => Date.now());
  const store = new Map(); // key -> { at, value }
  const pending = new Map(); // key -> Promise
  const versions = new Map(); // key -> invalidation generation

  function fresh(entry) {
    return entry && now() - entry.at < ttl;
  }

  function versionOf(key) {
    return versions.get(key) || 0;
  }

  function bump(key) {
    versions.set(key, versionOf(key) + 1);
  }

  async function get(key, fetchFn) {
    const hit = store.get(key);
    if (fresh(hit)) return hit.value;
    const current = pending.get(key);
    if (current) return current;
    const startedAtVersion = versionOf(key);
    const request = Promise.resolve()
      .then(fetchFn)
      .then(
        (value) => {
          if (versionOf(key) === startedAtVersion) {
            store.set(key, { at: now(), value });
          }
          if (pending.get(key) === request) pending.delete(key);
          return value;
        },
        (err) => {
          if (pending.get(key) === request) pending.delete(key);
          throw err;
        }
      );
    pending.set(key, request);
    return request;
  }

  function peek(key) {
    const hit = store.get(key);
    return fresh(hit) ? hit.value : undefined;
  }

  function set(key, value) {
    bump(key);
    pending.delete(key);
    store.set(key, { at: now(), value });
    return value;
  }

  function invalidate(key) {
    bump(key);
    store.delete(key);
    pending.delete(key);
  }

  function invalidatePrefix(prefix) {
    const keys = new Set([...store.keys(), ...pending.keys()]);
    for (const k of keys) {
      if (String(k).indexOf(prefix) === 0) {
        bump(k);
        store.delete(k);
        pending.delete(k);
      }
    }
  }

  function clear() {
    const keys = new Set([...store.keys(), ...pending.keys()]);
    for (const k of keys) bump(k);
    store.clear();
    pending.clear();
  }

  function size() {
    return store.size;
  }

  return { get, peek, set, invalidate, invalidatePrefix, clear, size };
}
