/* ============================================================
 * embeddedAiPocLog — copy-friendly PoC diagnostic builder
 * ------------------------------------------------------------
 * Builds a PLAIN-TEXT measurement log for the on-device PoC spike. It takes only
 * lengths and metrics — NEVER the input body. The caller passes `inputLength`
 * (a number), not the memo text, so personal data can never leak into the log.
 * The log is shown for manual copy only; it is not auto-saved or auto-sent.
 * ============================================================ */

export function buildPocDiagnostic(fields = {}) {
  const f = fields || {};
  const g = (k, d = "") => (f[k] === undefined || f[k] === null ? d : f[k]);
  return [
    "Oriex 埋め込みAI PoC 実機ログ（自動送信されません / 入力本文は含みません）",
    "timestamp: " + g("timestamp"),
    "device: " + g("deviceSummary"),
    "userAgent: " + g("userAgent"),
    "readiness: " + g("readiness"),
    "WebGPU: " + g("webgpu"),
    "IndexedDB: " + g("indexeddb"),
    "secureContext: " + g("secureContext"),
    "online: " + g("online"),
    "modelId: " + g("modelId"),
    "modelLoadStartedAt: " + g("loadStartedAt"),
    "modelLoadFinishedAt: " + g("loadFinishedAt"),
    "modelLoadDurationMs: " + g("loadMs"),
    "firstOrCachedLoad: " + g("firstOrCached"),
    "generationStartedAt: " + g("genStartedAt"),
    "generationFinishedAt: " + g("genFinishedAt"),
    "generationDurationMs: " + g("genMs"),
    "success: " + g("success"),
    "error: " + g("error"),
    "inputLength: " + g("inputLength"),
    "outputLength: " + g("outputLength"),
    "storageQuota: " + g("storageQuota"),
    "storageUsageBefore: " + g("storageUsageBefore"),
    "storageUsageAfter: " + g("storageUsageAfter"),
  ].join("\n");
}
