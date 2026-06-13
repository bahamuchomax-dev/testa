/* ============================================================
 * planCheckPoller — 計画確認の20秒ポーリング（唯一許可される定期取得）
 * ------------------------------------------------------------
 * 仕様で「計画確認だけは20秒に1回取得」を維持。それを安全に行う:
 *   - 間隔は PLAN_CHECK_INTERVAL_MS (20s) 固定
 *   - start() は冪等（二重 setInterval を作らない）
 *   - 画面が非表示(document.hidden)のときは取得をスキップ（無駄読み防止）
 *   - stop() で必ず clearInterval（コンポーネント unmount 時に呼ぶ）
 * setInterval/clearInterval/可視判定はテストのため注入可能。
 *
 * 使い方（React）:
 *   const poller = createPlanCheckPoller(() => repo.fetchTodaysPlan(uid));
 *   useEffect(() => { poller.start(); return () => poller.stop(); }, []);
 * ============================================================ */

export const PLAN_CHECK_INTERVAL_MS = 20_000;

export function createPlanCheckPoller(onTick, opts = {}) {
  const intervalMs = opts.intervalMs || PLAN_CHECK_INTERVAL_MS;
  const setIv =
    opts.setInterval || (typeof setInterval !== "undefined" ? setInterval.bind(null) : null);
  const clearIv =
    opts.clearInterval || (typeof clearInterval !== "undefined" ? clearInterval.bind(null) : null);
  const isVisible =
    opts.isVisible ||
    (() => (typeof document === "undefined" ? true : document.visibilityState !== "hidden"));

  let timer = null;

  function tick() {
    if (!isVisible()) return; // 非表示のときは取得しない
    try {
      onTick();
    } catch {
      /* poll errors must not break the interval */
    }
  }

  function start() {
    if (timer != null) return false; // 既に動作中 → 二重起動しない
    if (!setIv) return false;
    timer = setIv(tick, intervalMs);
    return true;
  }

  function stop() {
    if (timer != null && clearIv) clearIv(timer);
    timer = null;
  }

  function isRunning() {
    return timer != null;
  }

  return { start, stop, isRunning, tick, intervalMs };
}
