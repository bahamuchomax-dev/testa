import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import LocalAiPage from "./LocalAiPage.jsx";
import "./localAi.css";

/* ============================================================
 * localAi/index — エクスポートとサイドカー実装
 * ------------------------------------------------------------
 * App.jsx（将来のReactシェル）からはタブとして <LocalAiPage/> を
 * 使う。現行アプリ（凍結された legacy バンドル）はそのままに、
 * mountLocalAiSidecar() で「ローカルAI」起動ボタン＋ドロワーを
 * 別ルートとして body に重ねる。バンドルには一切手を入れない。
 * ============================================================ */

export { default as LocalAiPage } from "./LocalAiPage.jsx";
export default LocalAiPage;

function Sidecar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lai-root">
      {!open && (
        <button className="lai-launch" onClick={() => setOpen(true)} aria-label="ローカルAIを開く">
          ✦ ローカルAI
        </button>
      )}
      {open && (
        <div
          className="lai-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="lai-drawer" role="dialog" aria-modal="true" aria-label="ローカルAI">
            <div className="lai-drawer-bar">
              <strong style={{ fontFamily: '"Zen Maru Gothic", sans-serif' }}>ローカルAI</strong>
              <button className="lai-close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
            </div>
            <LocalAiPage className="" />
          </div>
        </div>
      )}
    </div>
  );
}

/* 現行アプリに重ねてローカルAIを使えるようにする（冪等）。 */
export function mountLocalAiSidecar(opts = {}) {
  if (typeof document === "undefined") return null;
  const id = opts.id || "oriex-localai-sidecar";
  if (document.getElementById(id)) return null; // 二重マウント防止
  const host = document.createElement("div");
  host.id = id;
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <Sidecar />
    </StrictMode>
  );
  return {
    unmount() {
      root.unmount();
      host.remove();
    },
  };
}
