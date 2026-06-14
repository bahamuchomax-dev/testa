/* ============================================================
 * embeddedAiClient — EXPERIMENTAL on-device AI abstraction layer
 * ------------------------------------------------------------
 * A thin, swappable seam for running a small model ON THE DEVICE. In phase 1
 * it bundles NO model and NO AI library: the abstraction exists so a real
 * on-device inference engine can be plugged in LATER via
 * registerEmbeddedAiEngine() + a dynamic import that runs ONLY when the user
 * opts in. Concrete engine candidates are compared in docs/EMBEDDED_AI_PLAN.md,
 * not named here, so this module stays vendor-neutral.
 *
 * Hard rules:
 *   - nothing here talks to an external AI API; prompts never leave the device,
 *   - this module is NOT imported by src/main.js, so it never loads on startup,
 *   - the engine loads only when loadEmbeddedAiEngine() is called,
 *   - concurrent calls share one in-flight Promise (no double download),
 *   - any failure resolves to a graceful { ok:false } instead of throwing.
 *
 * Example of a future engine registration (NOT done in this phase — see
 * docs/EMBEDDED_AI_PLAN.md). The dynamic import lives inside the loader so the
 * library is fetched only on opt-in and is never in the initial bundle:
 *
 *   registerEmbeddedAiEngine(async () => {
 *     const mod = await import("some-in-browser-llm-lib");
 *     const e = await mod.createEngine({ ... });
 *     return { generate: (prompt) => e.run(prompt) };
 *   });
 * ============================================================ */
import { describeDevice } from "./embeddedAiDevice.js";

// A registered loader is an async function that returns an "engine" object
// exposing at least: async generate(prompt, options) -> string.
// Default: none -> the client reports "engine-not-bundled" (the phase-1 state).
let engineLoader = null;
let enginePromise = null;
let engine = null;

/* Plug a real engine loader in later. `loader` should dynamic-import its
 * library inside itself so nothing is added to the initial bundle. */
export function registerEmbeddedAiEngine(loader) {
  engineLoader = typeof loader === "function" ? loader : null;
}

/* Report whether on-device AI could work here. Never throws. */
export async function checkEmbeddedAiSupport() {
  const device = describeDevice();
  const hasEngine = typeof engineLoader === "function";
  const supported = !!device.usable && hasEngine;
  let reason = "ok";
  if (!hasEngine) reason = "engine-not-bundled";
  else if (!supported) reason = "device-unsupported";
  return { supported, hasEngine, device, reason };
}

/* Load the engine on demand. Shares one in-flight Promise; graceful on fail. */
export async function loadEmbeddedAiEngine(options = {}) {
  if (engine) return { ok: true, engine, cached: true };
  if (!engineLoader) {
    // Phase 1: no engine bundled. This is expected, not an error state.
    return { ok: false, reason: "engine-not-bundled" };
  }
  if (!enginePromise) {
    enginePromise = (async () => {
      const e = await engineLoader(options);
      if (!e || typeof e.generate !== "function") {
        throw new Error("invalid embedded AI engine");
      }
      return e;
    })();
  }
  try {
    engine = await enginePromise;
    return { ok: true, engine, cached: false };
  } catch (err) {
    enginePromise = null; // allow a later retry
    return { ok: false, reason: "load-failed", error: (err && err.message) || String(err) };
  }
}

/* Generate text on-device. Returns { ok, text } or { ok:false, reason }. */
export async function generateEmbeddedAiText(prompt, options = {}) {
  const text = typeof prompt === "string" ? prompt : "";
  if (!text.trim()) return { ok: false, reason: "empty-prompt" };
  const loaded = await loadEmbeddedAiEngine(options);
  if (!loaded.ok) return { ok: false, reason: loaded.reason, error: loaded.error };
  try {
    const out = await loaded.engine.generate(text, options);
    return { ok: true, text: typeof out === "string" ? out : String(out ?? "") };
  } catch (err) {
    return { ok: false, reason: "generate-failed", error: (err && err.message) || String(err) };
  }
}

/* Phase-1 experiment prompt: a short review suggestion from a study memo.
 * Tiny on purpose; no strict JSON output required. Input is clamped so long
 * prompts are not built or kept around. */
export function buildReviewSuggestionPrompt(memo) {
  const safeMemo = (typeof memo === "string" ? memo : "").slice(0, 800);
  return [
    "あなたは学習サポートの先生です。",
    "次の今日の学習メモから、明日やると良い短い復習提案を日本語で3行以内で出してください。",
    "メモ:",
    safeMemo,
  ].join("\n");
}

/* Test seam: forget any loaded engine / in-flight load / registered loader. */
export function resetEmbeddedAiForTests() {
  engineLoader = null;
  enginePromise = null;
  engine = null;
}
