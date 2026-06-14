import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isEmbeddedAiProbeUrl } from "../src/features/embeddedAi/embeddedAiProbeRoute.js";

const MAIN = readFileSync("src/main.js", "utf8");

const loc = (over = {}) => ({ search: "", hash: "", ...over });

describe("isEmbeddedAiProbeUrl — hidden route matcher", () => {
  it("is false for a normal visit", () => {
    expect(isEmbeddedAiProbeUrl(loc())).toBe(false);
    expect(isEmbeddedAiProbeUrl(loc({ search: "?tab=home" }))).toBe(false);
    expect(isEmbeddedAiProbeUrl(loc({ hash: "#home" }))).toBe(false);
  });

  it("matches the query form ?oriexProbe=embedded-ai", () => {
    expect(isEmbeddedAiProbeUrl(loc({ search: "?oriexProbe=embedded-ai" }))).toBe(true);
    expect(isEmbeddedAiProbeUrl(loc({ search: "?a=1&oriexProbe=embedded-ai&b=2" }))).toBe(true);
  });

  it("matches the hash form #embedded-ai-probe", () => {
    expect(isEmbeddedAiProbeUrl(loc({ hash: "#embedded-ai-probe" }))).toBe(true);
    expect(isEmbeddedAiProbeUrl(loc({ hash: "embedded-ai-probe" }))).toBe(true);
  });

  it("does not match near-misses", () => {
    expect(isEmbeddedAiProbeUrl(loc({ search: "?oriexProbe=embedded" }))).toBe(false);
    expect(isEmbeddedAiProbeUrl(loc({ hash: "#embedded-ai" }))).toBe(false);
    expect(isEmbeddedAiProbeUrl(loc({ search: "?oriexprobe=embedded-ai" }))).toBe(false);
  });

  it("never throws on odd input", () => {
    expect(isEmbeddedAiProbeUrl(null)).toBe(false);
    expect(isEmbeddedAiProbeUrl(undefined)).toBe(false);
    expect(isEmbeddedAiProbeUrl({})).toBe(false);
    expect(isEmbeddedAiProbeUrl({ search: 123, hash: {} })).toBe(false);
  });
});

describe("main.js wiring — gated probe, preserved legacy boot", () => {
  it("keeps booting the legacy bundle and does not mount App.jsx", () => {
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
    expect(MAIN).not.toMatch(/from\s+["']\.\/App(\.jsx)?["']/);
    expect(MAIN).not.toMatch(/createRoot\(/); // JSX/mount stays out of the .js entry
  });

  it("guards the probe behind the URL matcher", () => {
    expect(MAIN).toContain("isEmbeddedAiProbeUrl");
    expect(MAIN).toMatch(/isEmbeddedAiProbeUrl\(/);
  });

  it("loads the probe panel via dynamic import only (separate chunk)", () => {
    expect(MAIN).toMatch(/import\(\s*["'][^"']*mountProbe/);
    expect(MAIN).not.toMatch(/import\s+[^;]*from\s+["'][^"']*mountProbe/);
    expect(MAIN).not.toMatch(/import\s+[^;]*from\s+["'][^"']*EmbeddedAi\w*Panel/);
  });

  it("loads the legacy app via a catchable call (no white screen on failure)", () => {
    expect(MAIN).toMatch(/startLegacyApp\s*\(/);
    expect(MAIN).toMatch(/\.catch\(/);
  });
});

describe("docs — how to open the device probe", () => {
  it("documents the probe URL in the plan", () => {
    const plan = readFileSync("docs/EMBEDDED_AI_PLAN.md", "utf8");
    expect(plan).toContain("## Opening the Device Probe");
    expect(plan).toContain("oriexProbe=embedded-ai");
    expect(plan).toContain("embedded-ai-probe");
  });
});
