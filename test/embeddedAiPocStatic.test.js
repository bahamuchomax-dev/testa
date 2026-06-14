import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

import {
  EMBEDDED_AI_POC_ENABLED,
  EMBEDDED_AI_UI_ENABLED,
  EMBEDDED_AI_PROBE_ENABLED,
} from "../src/features/embeddedAi/embeddedAiConfig.js";
import { isEmbeddedAiPocUrl } from "../src/features/embeddedAi/embeddedAiPocRoute.js";

const DIR = "src/features/embeddedAi";
const ADAPTER_PATH = `${DIR}/engines/webGpuEngineAdapter.js`;
const POC_PANEL_PATH = `${DIR}/EmbeddedAiPocPanel.jsx`;
const MOUNT_POC_PATH = `${DIR}/mountPoc.jsx`;
const POC_ROUTE_PATH = `${DIR}/embeddedAiPocRoute.js`;
const PLAN_PATH = "docs/EMBEDDED_AI_PLAN.md";

const MAIN = readFileSync("src/main.js", "utf8");
const APP = readFileSync("src/App.jsx", "utf8");
const ADAPTER = readFileSync(ADAPTER_PATH, "utf8");
const POC_PANEL = readFileSync(POC_PANEL_PATH, "utf8");

const loc = (over = {}) => ({ search: "", hash: "", ...over });

describe("Embedded AI phase 3A — WebGPU PoC (static)", () => {
  it("has the adapter and PoC scaffold files", () => {
    expect(existsSync(ADAPTER_PATH)).toBe(true);
    expect(existsSync(POC_PANEL_PATH)).toBe(true);
    expect(existsSync(MOUNT_POC_PATH)).toBe(true);
    expect(existsSync(POC_ROUTE_PATH)).toBe(true);
  });

  it("keeps UI and probe flags false (POC may be true on the device-spike branch)", () => {
    // Phase 3C temporarily enables the PoC on the verification branch. The
    // production-facing flags must stay false regardless, and the PoC remains
    // hidden-URL only (asserted elsewhere). POC_ENABLED is intentionally not
    // asserted false here so the spike branch can run; it must be reset to
    // false before merging to main.
    expect(EMBEDDED_AI_UI_ENABLED).toBe(false);
    expect(EMBEDDED_AI_PROBE_ENABLED).toBe(false);
    expect(typeof EMBEDDED_AI_POC_ENABLED).toBe("boolean");
  });

  it("does not statically import a heavy engine library in the adapter", () => {
    // no static import of an engine lib; the future engine is loaded lazily.
    expect(ADAPTER).not.toMatch(
      /import\s[^;]*from\s+["'][^"']*(web-llm|transformers|mediapipe|onnxruntime|llama|tvmjs)/i,
    );
    // the adapter documents/uses a dynamic-import + register seam
    expect(ADAPTER).toContain("registerWebGpuEngineLoader");
    expect(ADAPTER).toMatch(/dynamic import|import\(\)/i);
  });

  it("does not add an external AI endpoint or vendor name in the PoC source", () => {
    const externalRe = /openai|anthropic|gemini|googleapis/i;
    const apiKeyRe = /api[_-]?key/i;
    for (const src of [ADAPTER, POC_PANEL, readFileSync(POC_ROUTE_PATH, "utf8")]) {
      expect(src).not.toMatch(externalRe);
      expect(src).not.toMatch(apiKeyRe);
    }
  });

  it("does not store prompts or send results from the PoC", () => {
    for (const src of [ADAPTER, POC_PANEL]) {
      expect(src).not.toMatch(/localStorage/);
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/firebase|firestore/i);
      expect(src).not.toMatch(/sendBeacon|XMLHttpRequest/);
    }
  });

  it("renders PoC output without raw-HTML sinks", () => {
    expect(POC_PANEL).not.toContain("dangerouslySetInnerHTML");
    expect(POC_PANEL).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);
    expect(POC_PANEL).toContain("{result}");
  });

  it("clamps the PoC input to 800 chars", () => {
    expect(POC_PANEL).toMatch(/maxLength=\{WEBGPU_PROMPT_MAX_LENGTH\}/);
  });

  it("is reachable only via the hidden PoC URL, never normal nav", () => {
    expect(APP).not.toMatch(/embeddedAiPoc|EmbeddedAiPocPanel|mountPoc|webGpuEngineAdapter/);
    expect(MAIN).toContain("isEmbeddedAiPocUrl");
    expect(MAIN).toMatch(/import\(\s*["'][^"']*mountPoc/);
    expect(MAIN).not.toMatch(/import\s+[^;]*from\s+["'][^"']*mountPoc/);
    // legacy boot preserved for normal visits
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
    expect(MAIN).not.toMatch(/createRoot\(/);
  });

  it("matches the hidden PoC URL forms and rejects the probe/normal forms", () => {
    expect(isEmbeddedAiPocUrl(loc({ search: "?oriexProbe=embedded-ai-poc" }))).toBe(true);
    expect(isEmbeddedAiPocUrl(loc({ hash: "#embedded-ai-poc" }))).toBe(true);
    expect(isEmbeddedAiPocUrl(loc())).toBe(false);
    expect(isEmbeddedAiPocUrl(loc({ search: "?oriexProbe=embedded-ai" }))).toBe(false);
    expect(isEmbeddedAiPocUrl(null)).toBe(false);
  });

  it("documents the phase 3A direction and model-fetch vs input-send distinction", () => {
    const plan = readFileSync(PLAN_PATH, "utf8");
    expect(plan).toMatch(/Phase 3A/);
    expect(plan).toMatch(/WebGPU/);
    expect(plan).toMatch(/外部AI API/);
    expect(plan).toMatch(/モデル取得/);
  });
});
