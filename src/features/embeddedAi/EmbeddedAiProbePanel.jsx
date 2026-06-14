import { useState } from "react";
import {
  collectEmbeddedAiProbeReport,
  summarizeEmbeddedAiReadiness,
  formatEmbeddedAiProbeReport,
} from "./embeddedAiProbe.js";

/* ============================================================
 * EmbeddedAiProbePanel — on-device readiness DIAGNOSTIC (dev only)
 * ------------------------------------------------------------
 * Approach A: this component is NOT mounted. It is not imported by
 * src/main.js nor rendered by src/App.jsx, so it never appears in the normal
 * UI. A developer can render it temporarily to read device capabilities on a
 * real phone.
 *
 * It loads NO AI model and NO AI library. It only reads capability flags.
 * Results are shown as plain text for manual copy — never auto-saved, never
 * sent anywhere. No raw-HTML sinks are used.
 * ============================================================ */

const NOTICES = [
  "これは実験用診断画面です。",
  "AIモデルは読み込みません。",
  "入力文や学習データは送信しません。",
  "診断結果は自動保存 / 自動送信しません。",
  "端末機能の有無だけを確認します。",
  "結果をコピーして手動で共有できます。",
];

export default function EmbeddedAiProbePanel() {
  const [report, setReport] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await collectEmbeddedAiProbeReport();
      setReport(r);
      setText(formatEmbeddedAiProbeReport(r));
    } finally {
      setBusy(false);
    }
  };

  const readiness = report ? summarizeEmbeddedAiReadiness(report) : null;

  return (
    <div className="rx-home">
      <div className="rx-sec"><h3>端末内AI 実機診断（実験 / dev）</h3></div>

      <ul className="rx-talk" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {NOTICES.map((n) => (
          <li className="rx-trow" key={n}>
            <div className="rx-trow-ls">{n}</div>
          </li>
        ))}
      </ul>

      <button className="rx-cta" style={{ marginTop: 10 }} onClick={run} disabled={busy}>
        <span className="l">{busy ? "診断中…" : "端末を診断する"}</span>
        <span>▶</span>
      </button>

      {readiness && (
        <div className="rx-talk" style={{ marginTop: 12 }}>
          <div className="rx-trow">
            <div className="rx-trow-ls">判定: {readiness.level}</div>
          </div>
        </div>
      )}

      {text && (
        <textarea
          className="rx-tf"
          readOnly
          style={{ marginTop: 12, minHeight: 220, whiteSpace: "pre-wrap" }}
          value={text}
        />
      )}
    </div>
  );
}
