/* ============================================================
 * webLlmEngineLoader — Phase 3B WebLLM spike (WebGPU first candidate)
 * ------------------------------------------------------------
 * Wires a WebLLM engine into the WebGPU adapter seam. The heavy library is
 * NEVER imported at module top level: the import() lives inside the loader
 * function, which runs ONLY when loadWebGpuEmbeddedAiEngine() is called by an
 * explicit user action. Registering is cheap and imports nothing, so opening
 * the PoC page does not fetch the model or the library.
 *
 * Model / runtime are fetched from the engine provider (see sources below) and
 * cached on-device (IndexedDB / Cache Storage). That download is engine/weights
 * only — the user's input text is processed on-device and is never sent to an
 * external AI API.
 *
 * Verified against the installed @mlc-ai/web-llm 0.2.84:
 *   - export CreateMLCEngine(modelId, { initProgressCallback }) -> engine
 *   - engine.chat.completions.create({ messages, temperature, max_tokens })
 *   - WEBLLM_MODEL_ID exists in prebuiltAppConfig.model_list (0.5B class)
 * ============================================================ */
import { registerWebGpuEngineLoader } from "./webGpuEngineAdapter.js";

// Smallest practical instruct model from the installed prebuilt model list
// (verified, not guessed). 0.5B / q4f16, low_resource_required, ~945 MB VRAM.
export const WEBLLM_MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
export const WEBLLM_PACKAGE = "@mlc-ai/web-llm";

// Where the model weights / runtime are fetched from (engine provider). These
// are model/runtime sources, NOT external AI API endpoints; input is not sent.
export const WEBLLM_MODEL_WEIGHTS_SOURCE =
  "https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
export const WEBLLM_RUNTIME_SOURCE =
  "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/";

function toThreeLines(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

let wired = false;

/* Register the WebLLM engine with the adapter. Cheap + idempotent: stores a
 * loader function only. The heavy import() happens inside that loader. */
export function registerWebLlmEngine() {
  if (wired) return;
  wired = true;
  registerWebGpuEngineLoader(async (options = {}) => {
    // Dynamic import -> separate lazy chunk, fetched only on explicit load.
    const webllm = await import("@mlc-ai/web-llm");
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const engine = await webllm.CreateMLCEngine(WEBLLM_MODEL_ID, {
      initProgressCallback: (report) => {
        if (onProgress) {
          try {
            onProgress(report);
          } catch {
            /* ignore progress callback errors */
          }
        }
      },
    });
    return {
      generate: async (prompt) => {
        const reply = await engine.chat.completions.create({
          messages: [{ role: "user", content: String(prompt || "") }],
          temperature: 0.4,
          max_tokens: 200,
        });
        const content =
          reply && reply.choices && reply.choices[0] && reply.choices[0].message
            ? reply.choices[0].message.content
            : "";
        return toThreeLines(content);
      },
    };
  });
}

export function resetWebLlmEngineWiringForTests() {
  wired = false;
}
