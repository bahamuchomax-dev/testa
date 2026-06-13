/* ============================================================
 * LocalAiCopyButtons — 結果アクション行（コピー2種 / 保存 / クリア）
 * ------------------------------------------------------------
 * v5-4: コピーを「本文だけ」と「詳細込み」に分離。
 *   - 本文だけコピー : 品質チェックや警告を含まない本文のみ
 *   - 詳細込みコピー : 本文＋品質チェック＋自己検査＋決定的チェック
 *                      （＋PDF根拠/警告）
 *   - ファイルに保存 : 本文だけ（先生がそのまま貼れる形）
 *   - クリア        : 親の onClear
 * getBody / getDetailed は本文/詳細テキストを返す関数（panel側で
 * localAiFormatters の formatBodyOnly / formatWithDetails を使う）。
 * クリップボード処理は従来どおり（失敗時 execCommand フォールバック）。
 * ============================================================ */

import { useState } from "react";

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || "");
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

function downloadText(name, text) {
  try {
    const blob = new Blob([text || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "oriex-ai.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* download is best-effort */
  }
}

function CopyButton({ label, doneLabel, getText, primary }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={"lai-btn" + (primary ? " primary" : " ghost")}
      onClick={async () => {
        const ok = await copyToClipboard(typeof getText === "function" ? getText() : "");
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? doneLabel : label}
    </button>
  );
}

export default function LocalAiCopyButtons({ getBody, getDetailed, getText, filename, onClear }) {
  // 後方互換: getText だけ渡された場合は本文として扱う。
  const body = getBody || getText || (() => "");
  const detailed = getDetailed || body;
  return (
    <div className="lai-actions">
      <CopyButton label="本文だけコピー" doneLabel="コピーしました" getText={body} primary />
      <CopyButton label="詳細込みコピー" doneLabel="コピーしました" getText={detailed} />
      <button className="lai-btn ghost" onClick={() => downloadText(filename, body())}>
        ファイルに保存
      </button>
      <button className="lai-btn ghost" onClick={onClear}>
        クリア
      </button>
    </div>
  );
}
