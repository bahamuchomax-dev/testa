/* ============================================================
 * webGpuEngineAdapter — EXPERIMENTAL WebGPU on-device engine seam
 * ------------------------------------------------------------
 * Phase 3A PoC adapter. It bundles NO model and NO heavy library: the real
 * WebGPU-based in-browser engine is intentionally DEFERRED to phase 3B (see
 * docs/EMBEDDED_AI_PLAN.md for the reasoning and the entry conditions).
 *
 * This adapter is the swap point. A future real engine is wired in by calling
 * registerWebGpuEngineLoader(loader), where `loader` does a dynamic import() of
 * its library so nothing lands in the initial bundle. Example shape (NOT done
 * here):
 *
 *   registerWebGpuEngineLoader(async () => {
 *     const mod = await import("some-webgpu-in-browser-llm-lib"); // lazy chunk
 *     const e = await mod.createEngine({ ...small model id... });
 *     return { generate: (prompt) => e.run(prompt) };
 *   });
 *
 * Hard rules:
 *   - no static import of any engine library (keeps the initial bundle clean),
 *   - the engine loads only on explicit opt-in via loadWebGpuEmbeddedAiEngine(),
 *   - concurrent loads share one in-flight Promise (no double download),
 *   - device is gated on WebGPU + IndexedDB before any load is attempted,
 *   - nothing talks to an external AI API; prompts never leave the device,
 *   - any failure resolves to a graceful { ok:false, reason } (no white screen),
 *   - input is short text only; output is plain text only (never HTML).
 * ============================================================ */
import { describeDevice } from "../embeddedAiDevice.js";

// Phase-3A use case keeps input small (chars). Prevents long prompts from being
// built or kept around.
export const WEBGPU_PROMPT_MAX_LENGTH = 800;

let engineLoader = null; // future real engine loader (dynamic-imports its lib)
let enginePromise = null;
let engine = null;

/* Wire a real WebGPU engine later. `loader` must dynamic-import its library
 * inside itself so the initial bundle is unaffected. */
export function registerWebGpuEngineLoader(loader) {
  engineLoader = typeof loader === "function" ? loader : null;
}

/* Load the WebGPU engine on demand. Device-gated, shared in-flight, graceful. */
export async function loadWebGpuEmbeddedAiEngine(options = {}) {
  const device = describeDevice();
  if (!device.webgpu) return { ok: false, reason: "no-webgpu" };
  if (!device.indexeddb) return { ok: false, reason: "no-indexeddb" };

  if (engine) return { ok: true, engine, cached: true };
  if (!engineLoader) {
    // Phase 3A: no real WebGPU engine/library is bundled yet (deferred to 3B).
    // Expected state, not a crash.
    return { ok: false, reason: "engine-not-bundled" };
  }
  if (!enginePromise) {
    enginePromise = (async () => {
      const e = await engineLoader(options);
      if (!e || typeof e.generate !== "function") {
        throw new Error("invalid webgpu engine");
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

/* Generate short text on-device. Clamps input; returns { ok, text } or a
 * graceful { ok:false, reason }. */
export async function generateWithWebGpuEmbeddedAi(prompt, options = {}) {
  const text = typeof prompt === "string" ? prompt.slice(0, WEBGPU_PROMPT_MAX_LENGTH) : "";
  if (!text.trim()) return { ok: false, reason: "empty-prompt" };
  const loaded = await loadWebGpuEmbeddedAiEngine(options);
  if (!loaded.ok) return { ok: false, reason: loaded.reason, error: loaded.error };
  try {
    const out = await loaded.engine.generate(text, options);
    return { ok: true, text: typeof out === "string" ? out : String(out ?? "") };
  } catch (err) {
    return { ok: false, reason: "generate-failed", error: (err && err.message) || String(err) };
  }
}

/* Human-readable reason text for the PoC UI (plain text, never HTML). */
export function describeWebGpuReason(reason) {
  switch (reason) {
    case "no-webgpu":
      return "この端末/ブラウザは WebGPU に対応していません。";
    case "no-indexeddb":
      return "IndexedDB が使えないため、モデルを保持できません。";
    case "engine-not-bundled":
      return "実エンジンはまだ未導入です（Phase 3A はadapterのみ）。";
    case "load-failed":
      return "エンジンの読み込みに失敗しました。";
    case "generate-failed":
      return "生成に失敗しました。";
    case "empty-prompt":
      return "メモを入力してください。";
    default:
      return "この端末では使えません。";
  }
}

/* Test seam. */
export function resetWebGpuEmbeddedAiEngineForTests() {
  engineLoader = null;
  enginePromise = null;
  engine = null;
}
