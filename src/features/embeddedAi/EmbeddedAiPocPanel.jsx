import { useEffect, useRef, useState } from "react";
import { EMBEDDED_AI_POC_ENABLED } from "./embeddedAiConfig.js";
import {
  WEBGPU_PROMPT_MAX_LENGTH,
  loadWebGpuEmbeddedAiEngine,
  generateWithWebGpuEmbeddedAi,
  describeWebGpuReason,
} from "./engines/webGpuEngineAdapter.js";
import { registerWebLlmEngine, WEBLLM_MODEL_ID } from "./engines/webLlmEngineLoader.js";
import { collectEmbeddedAiProbeReport, summarizeEmbeddedAiReadiness } from "./embeddedAiProbe.js";
import { buildPocDiagnostic } from "./embeddedAiPocLog.js";

/* ============================================================
 * EmbeddedAiPocPanel — WebGPU/WebLLM PoC (dev only, hidden URL)
 * ------------------------------------------------------------
 * Reachable ONLY via the hidden PoC URL (see embeddedAiPocRoute.js). Not in
 * App.jsx, not in normal navigation. The WebLLM engine is registered on mount
 * (cheap; imports nothing). The heavy library + model are fetched ONLY when the
 * user presses "モデルを読み込む" — never on page open.
 *
 * Phase 3C device spike: with EMBEDDED_AI_POC_ENABLED true (verification branch
 * only) the load/generate buttons work so timings can be measured on a real
 * phone. Prompts are built locally, clamped, processed on-device, and never
 * sent to an external AI API. Output renders as plain {text}; no raw-HTML
 * sinks. The diagnostic log contains lengths/metrics only — never the input
 * body — and is not persisted to browser storage or sent to any backend.
 * ============================================================ */

const NOTICES = [
  "これは実験機能です。",
  "初回モデル取得に時間がかかる可能性があります。",
  "通信量と電池を使う可能性があります。",
  "入力文は外部AI APIへ送信しません。",
  "結果は自動保存されません。",
  "失敗しても学習データは失われません。",
  "個人情報・生徒情報・先生メモ全文は入力しないでください。",
];

function buildPocPrompt(memo) {
  const safeMemo = (typeof memo === "string" ? memo : "").slice(0, WEBGPU_PROMPT_MAX_LENGTH);
  return [
    "次の学習メモをもとに、今日やるべき復習を3つ以内で短く提案してください。",
    "入力にない個人情報は推測しないでください。",
    "メモ:",
    safeMemo,
  ].join("\n");
}

function deviceSummary(r) {
  if (!r) return "unknown";
  const parts = [];
  if (r.isLikelyMobile) parts.push("mobile");
  if (r.isLikelyIos) parts.push("ios");
  if (r.isLikelyAndroid) parts.push("android");
  if (r.isLikelySafari) parts.push("safari");
  if (r.isLikelyChrome) parts.push("chrome");
  return parts.join("/") || "unknown";
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export default function EmbeddedAiPocPanel() {
  const [memo, setMemo] = useState("");
  const [loadState, setLoadState] = useState("idle"); // idle|loading|ready|error
  const [genState, setGenState] = useState("idle"); // idle|running|done|error
  const [progress, setProgress] = useState("");
  const [loadMs, setLoadMs] = useState(null);
  const [genMs, setGenMs] = useState(null);
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const fieldsRef = useRef({ modelId: WEBLLM_MODEL_ID });
  const [diag, setDiag] = useState("");

  // Register the engine seam on mount. Cheap: stores a loader, imports nothing.
  useEffect(() => {
    registerWebLlmEngine();
  }, []);

  const merge = (patch) => {
    fieldsRef.current = { ...fieldsRef.current, ...patch };
    setDiag(buildPocDiagnostic(fieldsRef.current));
  };

  const loadModel = async () => {
    if (!EMBEDDED_AI_POC_ENABLED) return;
    setNote("");
    setProgress("");
    setLoadState("loading");

    const before = await collectEmbeddedAiProbeReport();
    const readiness = summarizeEmbeddedAiReadiness(before);
    const startedAt = new Date().toISOString();
    const t0 = nowMs();
    const res = await loadWebGpuEmbeddedAiEngine({
      onProgress: (report) => {
        const text = report && typeof report.text === "string" ? report.text : "";
        const pct =
          report && typeof report.progress === "number" ? Math.round(report.progress * 100) + "%" : "";
        setProgress([pct, text].filter(Boolean).join(" "));
      },
    });
    const ms = Math.round(nowMs() - t0);
    const finishedAt = new Date().toISOString();
    const after = await collectEmbeddedAiProbeReport();
    setLoadMs(ms);

    merge({
      timestamp: new Date().toISOString(),
      deviceSummary: deviceSummary(before),
      userAgent: before.userAgent,
      readiness: readiness.level,
      webgpu: before.hasWebGpu,
      indexeddb: before.hasIndexedDb,
      secureContext: before.secureContext,
      online: before.online,
      modelId: WEBLLM_MODEL_ID,
      loadStartedAt: startedAt,
      loadFinishedAt: finishedAt,
      loadMs: ms,
      firstOrCached: res.cached ? "cached" : "first",
      storageQuota: before.storageEstimate ? before.storageEstimate.quota : null,
      storageUsageBefore: before.storageEstimate ? before.storageEstimate.usage : null,
      storageUsageAfter: after.storageEstimate ? after.storageEstimate.usage : null,
      success: res.ok,
      error: res.ok ? "" : res.reason + (res.error ? " " + res.error : ""),
    });

    if (!res.ok) {
      setLoadState("error");
      setNote(describeWebGpuReason(res.reason));
      return;
    }
    setLoadState("ready");
  };

  const generate = async () => {
    if (!EMBEDDED_AI_POC_ENABLED) return;
    setNote("");
    setResult("");
    setGenState("running");

    const clamped = (typeof memo === "string" ? memo : "").slice(0, WEBGPU_PROMPT_MAX_LENGTH);
    const startedAt = new Date().toISOString();
    const t0 = nowMs();
    const res = await generateWithWebGpuEmbeddedAi(buildPocPrompt(memo));
    const ms = Math.round(nowMs() - t0);
    const finishedAt = new Date().toISOString();
    setGenMs(ms);

    // NOTE: only lengths are logged here, never the memo body or the result.
    merge({
      genStartedAt: startedAt,
      genFinishedAt: finishedAt,
      genMs: ms,
      inputLength: clamped.length,
      outputLength: res.ok && typeof res.text === "string" ? res.text.length : 0,
      success: res.ok,
      error: res.ok ? "" : res.reason + (res.error ? " " + res.error : ""),
    });

    if (!res.ok) {
      setGenState("error");
      setNote(describeWebGpuReason(res.reason));
      return;
    }
    setResult(res.text);
    setGenState("done");
  };

  const busy = loadState === "loading" || genState === "running";

  return (
    <div className="rx-home">
      <div className="rx-sec"><h3>端末内AI PoC（WebGPU / WebLLM / 実験 / dev）</h3></div>

      <ul className="rx-talk" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {NOTICES.map((n) => (
          <li className="rx-trow" key={n}>
            <div className="rx-trow-ls">{n}</div>
          </li>
        ))}
      </ul>

      <div className="rx-talk" style={{ marginTop: 10 }}>
        <div className="rx-trow"><div className="rx-trow-ls">モデルID: {WEBLLM_MODEL_ID}</div></div>
      </div>

      {!EMBEDDED_AI_POC_ENABLED && (
        <div className="rx-support-msg" role="note" style={{ marginTop: 10 }}>
          PoCは無効です（EMBEDDED_AI_POC_ENABLED = false）。検証用ブランチで一時的に有効化した場合のみ動作します。
        </div>
      )}

      <button
        className="rx-cta"
        style={{ marginTop: 10 }}
        onClick={loadModel}
        disabled={!EMBEDDED_AI_POC_ENABLED || busy}
      >
        <span className="l">{loadState === "loading" ? "モデル読み込み中…" : "モデルを読み込む"}</span>
        <span>▶</span>
      </button>

      {progress && (
        <div className="rx-support-msg" role="status" style={{ marginTop: 8 }}>進捗: {progress}</div>
      )}
      {loadMs !== null && (
        <div className="rx-support-msg" role="status" style={{ marginTop: 4 }}>読み込み時間: {loadMs} ms</div>
      )}

      <textarea
        className="rx-tf"
        style={{ marginTop: 12, minHeight: 100, whiteSpace: "pre-wrap" }}
        placeholder="今日の学習メモ（800文字以内・個人情報は入れない）"
        maxLength={WEBGPU_PROMPT_MAX_LENGTH}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />

      <button
        className="rx-cta"
        style={{ marginTop: 10 }}
        onClick={generate}
        disabled={!EMBEDDED_AI_POC_ENABLED || busy || loadState !== "ready"}
      >
        <span className="l">{genState === "running" ? "生成中…" : "復習提案を生成（実験）"}</span>
        <span>▶</span>
      </button>

      {genMs !== null && (
        <div className="rx-support-msg" role="status" style={{ marginTop: 4 }}>生成時間: {genMs} ms</div>
      )}
      {note && (
        <div className="rx-support-msg" role="alert" style={{ color: "#d4574e", marginTop: 10 }}>{note}</div>
      )}

      {genState === "done" && (
        <div className="rx-talk" style={{ marginTop: 12 }}>
          <div className="rx-trow">
            <div className="rx-trow-ls" style={{ whiteSpace: "pre-wrap" }}>{result}</div>
          </div>
        </div>
      )}

      {diag && (
        <textarea
          className="rx-tf"
          readOnly
          style={{ marginTop: 12, minHeight: 200, whiteSpace: "pre-wrap" }}
          value={diag}
        />
      )}
    </div>
  );
}
