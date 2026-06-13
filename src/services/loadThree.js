/* ============================================================
 * loadThree — three.js を「必要時だけ」読み込む遅延ローダ
 * ------------------------------------------------------------
 * 方針（bug-fix phase 4）:
 *   - index.html の同期 <script src="/three.min.js"> を廃止し、初期表示を
 *     ブロックしないようにする。代わりに本ローダで必要時に読み込む。
 *   - すでに window.THREE があれば即 resolve（再読み込みしない）。
 *   - 読み込み中の Promise を共有し、二重に <script> を追加しない。
 *   - script src は `${import.meta.env.BASE_URL}three.min.js`（GitHub Pages の
 *     サブパス配置に対応）。script.async = true。
 *   - load 成功で resolve(window.THREE)、失敗で reject（呼び出し側は握りつぶす）。
 *   - 外部送信は一切しない（同一オリジンの three.min.js のみ）。
 *
 * テスト容易性のため win/doc/baseUrl を注入できる（既定はグローバル）。
 * ============================================================ */

let inflight = null;

function resolveBaseUrl(override) {
  if (override != null) return override;
  try {
    if (import.meta && import.meta.env && import.meta.env.BASE_URL) {
      return import.meta.env.BASE_URL;
    }
  } catch {
    /* import.meta 不在環境では既定値へ */
  }
  return "/";
}

/* テスト用: ローダ状態をリセット（本番では基本使わない）。 */
export function resetThreeLoader() {
  inflight = null;
}

export function loadThree(opts = {}) {
  const win = opts.win || (typeof window !== "undefined" ? window : undefined);
  const doc = opts.doc || (typeof document !== "undefined" ? document : undefined);

  // すでに読み込み済みなら即返す（再読み込みしない）。
  if (win && win.THREE) return Promise.resolve(win.THREE);
  // 読み込み中なら同じ Promise を共有（二重 script を防ぐ）。
  if (inflight) return inflight;

  inflight = new Promise((resolve, reject) => {
    if (!doc || typeof doc.createElement !== "function") {
      inflight = null;
      reject(new Error("DOMが無いためthree.jsを読み込めません。"));
      return;
    }

    const onload = () => {
      if (win && win.THREE) {
        resolve(win.THREE);
      } else {
        inflight = null; // 次回リトライできるよう解放
        reject(new Error("three.min.jsを読み込めましたが window.THREE がありません。"));
      }
    };
    const onerror = () => {
      inflight = null; // 失敗時は解放してリトライ可能に
      reject(new Error("three.min.jsの読み込みに失敗しました。"));
    };

    // 既に <script data-oriex-three> があれば再利用（多重追加しない）。
    let script = doc.querySelector ? doc.querySelector("script[data-oriex-three]") : null;
    if (script) {
      script.addEventListener("load", onload);
      script.addEventListener("error", onerror);
      return;
    }

    script = doc.createElement("script");
    script.src = `${resolveBaseUrl(opts.baseUrl)}three.min.js`;
    script.async = true;
    script.setAttribute("data-oriex-three", "");
    script.addEventListener("load", onload);
    script.addEventListener("error", onerror);
    const mount = doc.head || doc.documentElement || doc.body;
    mount.appendChild(script);
  });

  return inflight;
}
