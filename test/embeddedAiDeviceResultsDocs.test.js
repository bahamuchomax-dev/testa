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
