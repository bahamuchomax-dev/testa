import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  EMBEDDED_AI_UI_ENABLED,
  EMBEDDED_AI_EXPERIMENTAL,
  EMBEDDED_AI_INPUT_MAX_LENGTH,
  EMBEDDED_AI_PROBE_ENABLED,
} from "../src/features/embeddedAi/embeddedAiConfig.js";
import * as client from "../src/features/embeddedAi/embeddedAiClient.js";
import { buildReviewSuggestionPrompt } from "../src/features/embeddedAi/embeddedAiClient.js";

const DIR = "src/features/embeddedAi";
const CONFIG_PATH = `${DIR}/embeddedAiConfig.js`;
const CLIENT_PATH = `${DIR}/embeddedAiClient.js`;
const DEVICE_PATH = `${DIR}/embeddedAiDevice.js`;
const PANEL_PATH = `${DIR}/EmbeddedAiExperimentPanel.jsx`;
const PLAN_PATH = "docs/EMBEDDED_AI_PLAN.md";

const MAIN = readFileSync("src/main.js", "utf8");
const APP = readFileSync("src/App.jsx", "utf8");

function embeddedAiSourceFiles(dir = DIR) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...embeddedAiSourceFiles(full));
    } else if (/\.(js|jsx)$/.test(name)) {
      out.push({ name, path: full, text: readFileSync(full, "utf8") });
    }
  }
  return out;
}

/* ------------------------------------------------------------------
 * Static guards for the embedded-AI experiment foundation.
 * ------------------------------------------------------------------ */
describe("Embedded AI experiment — static guards", () => {
  it("keeps the experiment UI disabled and marked experimental", () => {
    expect(EMBEDDED_AI_UI_ENABLED).toBe(false);
    expect(EMBEDDED_AI_EXPERIMENTAL).toBe(true);
    // the literal flag must be false in source too, not just at runtime
    expect(readFileSync(CONFIG_PATH, "utf8")).toMatch(/EMBEDDED_AI_UI_ENABLED\s*=\s*false/);
  });

  it("has the abstraction-layer files", () => {
    expect(existsSync(CONFIG_PATH)).toBe(true);
    expect(existsSync(CLIENT_PATH)).toBe(true);
    expect(existsSync(DEVICE_PATH)).toBe(true);
    expect(existsSync(PANEL_PATH)).toBe(true);
  });

  it("exposes the swappable client API", () => {
    expect(typeof client.checkEmbeddedAiSupport).toBe("function");
    expect(typeof client.loadEmbeddedAiEngine).toBe("function");
    expect(typeof client.generateEmbeddedAiText).toBe("function");
    expect(typeof client.resetEmbeddedAiForTests).toBe("function");
    expect(typeof client.registerEmbeddedAiEngine).toBe("function");
  });

  it("does not load the embedded AI on a normal startup", () => {
    // App.jsx (still unmounted) must not reference the embedded AI at all.
    expect(APP).not.toMatch(/embeddedAi/i);
    // main.js may reference ONLY the tiny URL matcher statically; it must not
    // statically import the experiment/client/config/device/panel into startup.
    expect(MAIN).not.toMatch(
      /import\s+[^;]*from\s+["'][^"']*embeddedAi(Client|Config|Device|ExperimentPanel)/,
    );
    expect(MAIN).not.toMatch(/import\s+[^;]*from\s+["'][^"']*EmbeddedAi\w*Panel/);
    expect(MAIN).not.toMatch(/import\s+[^;]*from\s+["'][^"']*mountProbe/);
  });

  it("does not statically import an in-browser LLM library in any feature file", () => {
    const libRe = /import\s[^;]*from\s+["'][^"']*(web-llm|transformers|mediapipe|onnxruntime|llama|tvmjs)/i;
    for (const f of embeddedAiSourceFiles()) {
      expect(f.text, `${f.name} must not statically import an LLM library`).not.toMatch(libRe);
    }
  });

  it("does not add an external AI endpoint or vendor name in the feature source", () => {
    const externalRe = /openai|anthropic|gemini|googleapis/i;
    for (const f of embeddedAiSourceFiles()) {
      expect(f.text, `${f.name} must not name an external AI endpoint/vendor`).not.toMatch(externalRe);
    }
  });

  it("does not use raw-HTML sinks in the panel", () => {
    const panel = readFileSync(PANEL_PATH, "utf8");
    expect(panel).not.toContain("dangerouslySetInnerHTML");
    expect(panel).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);
    // result rendered as plain {text}
    expect(panel).toContain("{result}");
  });

  it("loads the engine only from the opt-in handler, not on render", () => {
    const panel = readFileSync(PANEL_PATH, "utf8");
    expect(panel).toContain("onClick={run}");
    expect(panel).toContain("loadEmbeddedAiEngine");
    // no top-level/immediate engine load call
    expect(panel).not.toMatch(/^\s*loadEmbeddedAiEngine\(/m);
  });

  it("documents the experiment plan", () => {
    expect(existsSync(PLAN_PATH)).toBe(true);
    const plan = readFileSync(PLAN_PATH, "utf8");
    expect(plan).toContain("実験"); // 実験機能 / experiment wording
    expect(plan).toContain("外部AI APIへ送信しない");
  });
});

/* ------------------------------------------------------------------
 * Phase 1.5: src stays vendor-neutral; concrete engine candidates and the
 * phase-2 entry criteria live in the docs instead.
 * ------------------------------------------------------------------ */
describe("Embedded AI phase 1.5 — vendor-neutral src + engine docs", () => {
  it("keeps engine/vendor names out of the general feature source", () => {
    // Concrete engine candidates must be named in docs, not src — EXCEPT the
    // engines/ adapters/loaders, which are exactly where a chosen engine
    // (e.g. the phase-3B WebLLM loader) is allowed to name its package.
    const engineNameRe = /web-?llm|transformers|mediapipe|onnxruntime|tvmjs|\bllama\b|ollama/i;
    for (const f of embeddedAiSourceFiles()) {
      const rel = f.path.replace(/\\/g, "/");
      // engines/ holds the chosen engine; the PoC panel is the engine spike UI.
      if (rel.includes("/engines/") || f.name === "EmbeddedAiPocPanel.jsx") continue;
      expect(f.text, `${f.name} should be vendor-neutral`).not.toMatch(engineNameRe);
    }
  });

  it("does not put an AI API key name in the feature source", () => {
    const apiKeyRe = /api[_-]?key/i;
    for (const f of embeddedAiSourceFiles()) {
      expect(f.text, `${f.name} should not name an AI API key`).not.toMatch(apiKeyRe);
    }
  });

  it("keeps the swappable-engine policy described neutrally in the client", () => {
    const c = readFileSync(CLIENT_PATH, "utf8");
    expect(c).toContain("registerEmbeddedAiEngine");
    expect(c).toMatch(/dynamic import|opt in|opt-in/i);
  });

  it("compares concrete engine candidates in the docs", () => {
    const plan = readFileSync(PLAN_PATH, "utf8");
    expect(plan).toContain("## Engine Candidates");
    expect(plan).toContain("WebLLM");
    expect(plan).toContain("Transformers.js");
    expect(plan).toContain("MediaPipe");
    // the "stay abstraction-only" option must remain on the table
    expect(plan).toMatch(/abstraction[- ]only/i);
  });

  it("documents the phase 2 entry criteria in the docs", () => {
    const plan = readFileSync(PLAN_PATH, "utf8");
    expect(plan).toContain("## Phase 2 Entry Criteria");
    expect(plan).toMatch(/WebGPU/);
    expect(plan).toMatch(/initial bundle/i);
    expect(plan).toMatch(/外部AI API/);
  });

  it("keeps the experiment disabled and unimported by the live entries", () => {
    expect(EMBEDDED_AI_UI_ENABLED).toBe(false);
    expect(APP).not.toMatch(/embeddedAi/i);
    // the experiment panel/client are never imported by the startup entry
    expect(MAIN).not.toMatch(/EmbeddedAiExperimentPanel/);
    expect(MAIN).not.toMatch(/embeddedAiClient/);
  });
});

/* ------------------------------------------------------------------
 * Phase 2: a device-readiness probe is added as a diagnostic only.
 * It must stay out of the normal UI and must not send/save anything.
 * ------------------------------------------------------------------ */
describe("Embedded AI phase 2 — device probe (static)", () => {
  const PROBE_PATH = `${DIR}/embeddedAiProbe.js`;
  const PROBE_PANEL_PATH = `${DIR}/EmbeddedAiProbePanel.jsx`;

  it("has the probe module and an unmounted probe panel", () => {
    expect(existsSync(PROBE_PATH)).toBe(true);
    expect(existsSync(PROBE_PANEL_PATH)).toBe(true);
  });

  it("keeps the probe disabled and only reachable via the gated URL route", () => {
    expect(EMBEDDED_AI_PROBE_ENABLED).toBe(false);
    // not in the React shell at all
    expect(APP).not.toMatch(/embeddedAiProbe|EmbeddedAiProbePanel|mountProbe/);
    // main.js loads the probe ONLY behind the URL gate, via dynamic import
    expect(MAIN).toContain("isEmbeddedAiProbeUrl");
    expect(MAIN).toMatch(/import\(\s*["'][^"']*mountProbe/);
    // and never as a static import
    expect(MAIN).not.toMatch(/import\s+[^;]*from\s+["'][^"']*mountProbe/);
    // legacy boot is preserved for normal visits
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
  });

  it("does not send the probe report anywhere", () => {
    const probe = readFileSync(PROBE_PATH, "utf8");
    const panel = readFileSync(PROBE_PANEL_PATH, "utf8");
    for (const src of [probe, panel]) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/XMLHttpRequest/);
      expect(src).not.toMatch(/sendBeacon/);
      expect(src).not.toMatch(/firebase|firestore/i);
    }
  });

  it("does not auto-save the probe report", () => {
    const probe = readFileSync(PROBE_PATH, "utf8");
    const panel = readFileSync(PROBE_PANEL_PATH, "utf8");
    for (const src of [probe, panel]) {
      expect(src).not.toMatch(/localStorage/);
      expect(src).not.toMatch(/\.put\s*\(|\.add\s*\(|setItem\s*\(/);
    }
  });

  it("does not request sensitive device permissions", () => {
    const probe = readFileSync(PROBE_PATH, "utf8");
    expect(probe).not.toMatch(/getUserMedia|geolocation|getCurrentPosition|Notification\.requestPermission/);
  });

  it("renders the probe report without raw-HTML sinks", () => {
    const panel = readFileSync(PROBE_PANEL_PATH, "utf8");
    expect(panel).not.toContain("dangerouslySetInnerHTML");
    expect(panel).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);
  });

  it("documents the device probe and manual checklist in the plan", () => {
    const plan = readFileSync(PLAN_PATH, "utf8");
    expect(plan).toContain("## Phase 2 Device Probe");
    expect(plan).toContain("## Manual Device Checklist");
    expect(plan).toMatch(/iPhone Safari/);
    expect(plan).toMatch(/Android Chrome/);
    expect(plan).toMatch(/自動送信/);
  });
});

/* ------------------------------------------------------------------
 * Behavioural unit tests: graceful, pluggable, no-throw, shared load.
 * ------------------------------------------------------------------ */
describe("embeddedAiClient — behaviour", () => {
  beforeEach(() => {
    client.resetEmbeddedAiForTests();
  });

  it("reports engine-not-bundled by default and never throws", async () => {
    const support = await client.checkEmbeddedAiSupport();
    expect(support.hasEngine).toBe(false);
    expect(support.supported).toBe(false);
    expect(support.reason).toBe("engine-not-bundled");

    const loaded = await client.loadEmbeddedAiEngine();
    expect(loaded.ok).toBe(false);
    expect(loaded.reason).toBe("engine-not-bundled");
  });

  it("rejects an empty prompt without loading anything", async () => {
    const res = await client.generateEmbeddedAiText("   ");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("empty-prompt");
  });

  it("uses a registered engine and returns its text", async () => {
    client.registerEmbeddedAiEngine(async () => ({
      generate: async (p) => "提案: " + p.slice(0, 4),
    }));
    const res = await client.generateEmbeddedAiText("英語の長文読解");
    expect(res.ok).toBe(true);
    expect(res.text).toContain("提案:");
  });

  it("shares one in-flight load Promise (no double download)", async () => {
    let calls = 0;
    client.registerEmbeddedAiEngine(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return { generate: async () => "ok" };
    });
    const [a, b] = await Promise.all([
      client.loadEmbeddedAiEngine(),
      client.loadEmbeddedAiEngine(),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("fails gracefully (no throw) when the loader throws", async () => {
    client.registerEmbeddedAiEngine(async () => {
      throw new Error("boom");
    });
    const loaded = await client.loadEmbeddedAiEngine();
    expect(loaded.ok).toBe(false);
    expect(loaded.reason).toBe("load-failed");
  });

  it("builds a clamped review-suggestion prompt that includes the memo", () => {
    const prompt = buildReviewSuggestionPrompt("今日は不定詞を復習した");
    expect(prompt).toContain("今日は不定詞を復習した");
    const longMemo = "あ".repeat(2000);
    const longPrompt = buildReviewSuggestionPrompt(longMemo);
    // the memo portion is clamped to 800 chars before being embedded
    expect(longPrompt).not.toContain("あ".repeat(801));
    expect(EMBEDDED_AI_INPUT_MAX_LENGTH).toBe(800);
  });
});
