/* Tiny, safe localStorage helpers used by the Repository layer.
 * All reads/writes are JSON and never throw (private mode, quota, etc.).
 */
export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // surface this to the UI when it matters
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}
