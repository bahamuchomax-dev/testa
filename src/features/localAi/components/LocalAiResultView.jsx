/* ============================================================
 * LocalAiResultView — 生成結果の表示（ラッパー）
 * ------------------------------------------------------------
 * 旧 LocalAiPanel.jsx の ResultShell ＋ TextFallback ＋ useGenerate
 * をまとめたもの。挙動は同一。
 *   - 生成中: スピナー＋「生成中…」
 *   - エラー: .lai-err でメッセージ表示
 *   - 結果あり: note → 構造化結果(children) → 品質バッジ → アクション
 *   - JSON構造化に失敗したタスクは TextFallback でプレーン表示
 *
 * 各タスク固有の「構造化結果の中身」はデータ形状を知っている各panel
 * が children として渡す（タスクごとに形が違うため、ここには置かない）。
 *
 * useGenerate はこの View が表示する生成状態（busy/error/result）を
 * 作るフックなので、View と対で同居させている。各panelが利用する。
 * ============================================================ */

import { useEffect, useRef, useState } from "react";
import LocalAiQualityBadge from "./LocalAiQualityBadge.jsx";
import LocalAiCopyButtons from "./LocalAiCopyButtons.jsx";

/* 生成の実行・中断・状態管理。panelごとに1インスタンス使う。 */
export function useGenerate() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const ctrl = useRef(null);

  useEffect(() => () => ctrl.current && ctrl.current.abort(), []);

  const run = async (fn) => {
    setError("");
    setResult(null);
    setBusy(true);
    ctrl.current = new AbortController();
    try {
      const r = await fn(ctrl.current.signal);
      setResult(r);
    } catch (e) {
      setError((e && (e.userMessage || e.message)) || "エラーが発生しました。");
    } finally {
      setBusy(false);
      ctrl.current = null;
    }
  };
  const fail = (msg) => {
    setResult(null);
    setError(msg);
  };
  const clear = () => {
    setError("");
    setResult(null);
  };
  return { busy, error, result, run, fail, clear };
}

/* JSON構造化に失敗したときのプレーンテキスト表示。 */
export function TextFallback({ text }) {
  return <div className="lai-out text rx-selectable">{text}</div>;
}

export default function LocalAiResultView({
  busy,
  error,
  hasResult,
  note,
  copyText,
  copyBody,
  copyDetailed,
  filename,
  onClear,
  quality,
  children,
}) {
  if (busy) {
    return (
      <div className="lai-out text">
        <span className="lai-spin" />
        生成中…（この端末内のOllamaで処理しています）
      </div>
    );
  }
  if (error) return <div className="lai-err">{error}</div>;
  if (!hasResult) return null;
  return (
    <div>
      {note && <div className="lai-note">{note}</div>}
      {children}
      <LocalAiQualityBadge quality={quality} />
      <LocalAiCopyButtons
        getBody={copyBody || copyText}
        getDetailed={copyDetailed}
        filename={filename}
        onClear={onClear}
      />
    </div>
  );
}
