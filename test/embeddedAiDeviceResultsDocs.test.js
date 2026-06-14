import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const RESULTS_PATH = "docs/EMBEDDED_AI_DEVICE_RESULTS.md";
const RESULTS = existsSync(RESULTS_PATH) ? readFileSync(RESULTS_PATH, "utf8") : "";
const README = readFileSync("README.md", "utf8");
const PLAN = readFileSync("docs/EMBEDDED_AI_PLAN.md", "utf8");

describe("Embedded AI device-results template", () => {
  it("exists", () => {
    expect(existsSync(RESULTS_PATH)).toBe(true);
    expect(RESULTS).toContain("# Embedded AI Device Probe Results");
  });

  it("lists both probe URLs", () => {
    expect(RESULTS).toContain("oriexProbe=embedded-ai");
    expect(RESULTS).toContain("#embedded-ai-probe");
  });

  it("has recording rows for iPhone Safari / Android Chrome / PC Chrome", () => {
    expect(RESULTS).toMatch(/\|\s*iPhone\s*\|\s*Safari\s*\|/);
    expect(RESULTS).toMatch(/\|\s*Android\s*\|\s*Chrome\s*\|/);
    expect(RESULTS).toMatch(/\|\s*PC\s*\|\s*Chrome\s*\|/);
  });

  it("has Readiness / WebGPU / IndexedDB / Storage columns", () => {
    for (const col of ["Readiness", "WebGPU", "IndexedDB", "Storage quota", "Storage usage", "Secure context"]) {
      expect(RESULTS).toContain(col);
    }
  });

  it("warns against pasting personal information", () => {
    expect(RESULTS).toMatch(/個人情報/);
    expect(RESULTS).toMatch(/生徒情報/);
    expect(RESULTS).toMatch(/自動送信されません/);
    expect(RESULTS).toMatch(/自動保存されません/);
  });

  it("documents the phase 3 decision criteria", () => {
    expect(RESULTS).toContain("How to Decide Phase 3");
    expect(RESULTS).toMatch(/likely/);
    expect(RESULTS).toMatch(/limited/);
    expect(RESULTS).toMatch(/unlikely/);
    expect(RESULTS).toMatch(/unknown/);
  });

  it("is linked from README or the embedded AI plan", () => {
    const linked =
      README.includes("EMBEDDED_AI_DEVICE_RESULTS.md") || PLAN.includes("EMBEDDED_AI_DEVICE_RESULTS.md");
    expect(linked).toBe(true);
  });
});

describe("Embedded AI device-results — recorded phase 2.7 results", () => {
  it("records the Android Chrome result", () => {
    expect(RESULTS).toMatch(/Android Chrome/);
    expect(RESULTS).toMatch(/Pixel 9/);
  });

  it("records the iPhone Safari result", () => {
    expect(RESULTS).toMatch(/iPhone/);
    expect(RESULTS).toMatch(/Safari/);
  });

  it("records readiness likely for both devices", () => {
    // at least two 'likely' readings in the recorded results
    const likelyCount = (RESULTS.match(/Readiness:\s*likely/g) || []).length;
    expect(likelyCount).toBeGreaterThanOrEqual(2);
  });

  it("records WebGPU true and IndexedDB true", () => {
    expect(RESULTS).toMatch(/WebGPU:\s*true/);
    expect(RESULTS).toMatch(/IndexedDB:\s*true/);
  });

  it("states the phase 3 first candidate is a WebGPU-style engine", () => {
    expect(RESULTS).toMatch(/WebGPU系/);
    expect(RESULTS).toMatch(/第一候補/);
  });

  it("keeps a Transformers.js-style small model as a fallback", () => {
    expect(RESULTS).toMatch(/Transformers\.js系/);
    expect(RESULTS).toMatch(/保険候補/);
  });
});
