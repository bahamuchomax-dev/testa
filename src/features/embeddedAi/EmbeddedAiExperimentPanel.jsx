import { useState } from "react";
import {
  EMBEDDED_AI_EXPERIMENTAL,
  EMBEDDED_AI_INPUT_MAX_LENGTH,
  EMBEDDED_AI_WARNINGS,
} from "./embeddedAiConfig.js";
import {
  checkEmbeddedAiSupport,
  loadEmbeddedAiEngine,
  generateEmbeddedAiText,
  buildReviewSuggestionPrompt,
} from "./embeddedAiClient.js";

/* ============================================================
 * EmbeddedAiExperimentPanel — on-device AI EXPERIMENT (dev only)
 * ------------------------------------------------------------
 * NOT shown in normal navigation. EMBEDDED_AI_UI_ENABLED is false and this
 * component is not imported by src/main.js nor rendered by src/App.jsx. It
 * exists so the embedded-AI abstraction can be exercised during development.
 *
 * Safety:
 *   - the engine/library loads ONLY when the user presses the button (no load
 *     on render, no load on app start),
 *   - prompts are processed on-device; nothing is sent to an external AI API,
 *   - results render as plain {text}; no raw-HTML sinks are used,
 *   - any failure shows "この端末では使えません" instead of a white screen.
 * ============================================================ */

const UNSUPPORTED_MSG = "この端末では使えません。";

export default function EmbeddedAiExperimentPanel() {
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("idle"); // idle|checking|loading|generating|done|unsupported|error
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");

  const busy = status === "checking" || status === "loading" || status === "generating";

  const run = async () => {
    setResult("");
    setNote("");
    setStatus("checking");

    const support = await checkEmbeddedAiSupport();
    if (!support.supported) {
      setStatus("unsupported");
      setNote(UNSUPPORTED_MSG);
      return;
    }

    setStatus("loading");
    const loaded = await loadEmbeddedAiEngine();
    if (!loaded.ok) {
      setStatus("unsupported");
      setNote(UNSUPPORTED_MSG);
      return;
    }

    setStatus("generating");
    const gen = await generateEmbeddedAiText(buildReviewSuggestionPrompt(memo));
    if (!gen.ok) {
      setStatus("error");
      setNote(UNSUPPORTED_MSG);
      return;
    }

    setResult(gen.text);
    setStatus("done");
  };

  return (
    <div className="rx-home">
      <div className="rx-sec"><h3>端末内AI（実験）</h3></div>

      <ul className="rx-talk" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {EMBEDDED_AI_WARNINGS.map((w) => (
          <li className="rx-trow" key={w}>
            <div className="rx-trow-ls">{w}</div>
          </li>
        ))}
      </ul>

      <textarea
        className="rx-tf"
        style={{ marginTop: 12, minHeight: 90, whiteSpace: "pre-wrap" }}
        placeholder="今日の学習メモ"
        maxLength={EMBEDDED_AI_INPUT_MAX_LENGTH}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />

      <button className="rx-cta" style={{ marginTop: 10 }} onClick={run} disabled={busy}>
        <span className="l">
          {status === "loading"
            ? "モデル準備中…"
            : status === "generating"
              ? "生成中…"
              : "端末内AIを試す"}
        </span>
        <span>▶</span>
      </button>

      {note && (
        <div className="rx-support-msg" role="alert" style={{ color: "#d4574e" }}>{note}</div>
      )}

      {EMBEDDED_AI_EXPERIMENTAL && status === "done" && (
        <div className="rx-talk" style={{ marginTop: 12 }}>
          <div className="rx-trow">
            <div className="rx-trow-ls" style={{ whiteSpace: "pre-wrap" }}>{result}</div>
          </div>
        </div>
      )}
    </div>
  );
}
