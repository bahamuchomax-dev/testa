import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPocDiagnostic } from "../src/features/embeddedAi/embeddedAiPocLog.js";

const SAMPLE = "今日は英単語を20個覚えた。数学は二次関数のグラフを復習した。明日は確認テストをしたい。";
const PANEL = readFileSync("src/features/embeddedAi/EmbeddedAiPocPanel.jsx", "utf8");

describe("embeddedAiPocLog.buildPocDiagnostic", () => {
  it("includes metrics and lengths but never the input body", () => {
    const log = buildPocDiagnostic({
      timestamp: "2026-06-14T00:00:00.000Z",
      deviceSummary: "mobile/android/chrome",
      readiness: "likely",
      webgpu: true,
      indexeddb: true,
      modelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      loadMs: 12345,
      genMs: 678,
      success: true,
      inputLength: SAMPLE.length,
      outputLength: 42,
    });
    expect(log).toContain("inputLength: " + SAMPLE.length);
    expect(log).toContain("outputLength: 42");
    expect(log).toContain("modelLoadDurationMs: 12345");
    expect(log).toContain("generationDurationMs: 678");
    expect(log).toContain("readiness: likely");
    // the actual input text must NOT appear anywhere in the log
    expect(log).not.toContain(SAMPLE);
    expect(log).not.toContain("英単語");
    // states it is not auto-sent and excludes the body
    expect(log).toMatch(/自動送信されません/);
    expect(log).toMatch(/入力本文は含みません/);
  });

  it("is plain text (no HTML)", () => {
    const log = buildPocDiagnostic({ inputLength: 0 });
    expect(log).not.toMatch(/<[a-z]/i);
  });
});

describe("PoC panel logs lengths, not the memo body", () => {
  it("feeds inputLength (a length) into the diagnostic, not the memo text", () => {
    // the diagnostic merge must use a clamped length, never the raw memo
    expect(PANEL).toMatch(/inputLength:\s*clamped\.length/);
    // the memo is only used for the input field and the on-device prompt
    expect(PANEL).toContain("buildPocPrompt(memo)");
    // no memo body pushed into the diagnostic/log
    expect(PANEL).not.toMatch(/buildPocDiagnostic[\s\S]{0,200}\bmemo\b/);
  });
});
