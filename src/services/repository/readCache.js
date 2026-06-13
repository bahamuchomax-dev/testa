/* ============================================================
 * readCache — 読み取り削減のための軽量TTLキャッシュ
 * ------------------------------------------------------------
 * 同じ画面内/短時間での同一データ再取得を防ぐ。Firestore を有効化
 * したとき、各 repository の getDoc/getDocs をこのキャッシュ越しに
 * 呼ぶことで読み取り回数を抑える。
 *   - get(key, fetchFn): TTL内ならキャッシュ値、超過なら fetchFn() を実行
 *   - invalidate(key) / invalidatePrefix(prefix): 保存・削除後に該当だけ無効化
 *   - peek(key): 取得せずに現在値を見る（無ければ undefined）
 * 計画確認の20秒ポーリングはこのTTLの例外（planCheckPoller 側で制御）。
 * ============================================================ */

export const CACHE_TTL_MS = 60_000;

export function createReadCache(opts = {}) {
  const ttl = opts.ttl == null ? CACHE_TTL_MS : opts.ttl;
  const now = opts.now || (() => Date.now());
  const store = new Map(); // key -> { at, value }

  function fresh(entry) {
    return entry && now() - entry.at < ttl;
  }

  async function get(key, fetchFn) {
    const hit = store.get(key);
    if (fresh(hit)) return hit.value;
    const value = await fetchFn();
    store.set(key, { at: now(), value });
    return value;
  }

  function peek(key) {
    const hit = store.get(key);
    return fresh(hit) ? hit.value : undefined;
  }

  function set(key, value) {
    store.set(key, { at: now(), value });
    return value;
  }

  function invalidate(key) {
    store.delete(key);
  }

  function invalidatePrefix(prefix) {
    for (const k of Array.from(store.keys())) {
      if (String(k).indexOf(prefix) === 0) store.delete(k);
    }
  }

  function clear() {
    store.clear();
  }

  function size() {
    return store.size;
  }

  return { get, peek, set, invalidate, invalidatePrefix, clear, size };
}
