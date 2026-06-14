import { describe, it, expect, vi, afterEach } from "vitest";
import {
  collectEmbeddedAiProbeReport,
  summarizeEmbeddedAiReadiness,
  formatEmbeddedAiProbeReport,
} from "../src/features/embeddedAi/embeddedAiProbe.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubEnv({ gpu = false, idb = true, secure = true, estimate, nav = {} } = {}) {
  const navigator = {
    userAgent: "test-agent",
    platform: "test",
    language: "ja-JP",
    onLine: true,
    hardwareConcurrency: 8,
    storage: estimate ? { estimate } : undefined,
    ...nav,
  };
  if (gpu) navigator.gpu = {};
  vi.stubGlobal("navigator", navigator);
  vi.stubGlobal("window", { isSecureContext: secure });
  if (idb) vi.stubGlobal("indexedDB", {});
  else vi.stubGlobal("indexedDB", undefined);
}

describe("embeddedAiProbe — API surface", () => {
  it("exposes the three probe functions", () => {
    expect(typeof collectEmbeddedAiProbeReport).toBe("function");
    expect(typeof summarizeEmbeddedAiReadiness).toBe("function");
    expect(typeof formatEmbeddedAiProbeReport).toBe("function");
  });
});

describe("collectEmbeddedAiProbeReport — capability reads", () => {
  it("reports hasWebGpu true when navigator.gpu exists", async () => {
    stubEnv({ gpu: true });
    const r = await collectEmbeddedAiProbeReport();
    expect(r.hasWebGpu).toBe(true);
  });

  it("reports hasIndexedDb true when indexedDB exists", async () => {
    stubEnv({ idb: true });
    const r = await collectEmbeddedAiProbeReport();
    expect(r.hasIndexedDb).toBe(true);
  });

  it("reports hasIndexedDb false when indexedDB is missing", async () => {
    stubEnv({ idb: false });
    const r = await collectEmbeddedAiProbeReport();
    expect(r.hasIndexedDb).toBe(false);
  });

  it("includes a storage estimate when available", async () => {
    stubEnv({ estimate: async () => ({ quota: 2 * 1024 * 1024 * 1024, usage: 1024 }) });
    const r = await collectEmbeddedAiProbeReport();
    expect(r.storageEstimate.supported).toBe(true);
    expect(r.storageEstimate.quota).toBeGreaterThan(0);
  });

  it("does not throw when storage.estimate() rejects", async () => {
    stubEnv({
      estimate: async () => {
        throw new Error("blocked");
      },
    });
    const r = await collectEmbeddedAiProbeReport();
    expect(r.storageEstimate.supported).toBe(false);
    expect(r.storageEstimate.quota).toBeNull();
  });

  it("never throws even with no browser globals", async () => {
    // no stubs: navigator/window/indexedDB may be undefined in node
    vi.unstubAllGlobals();
    const r = await collectEmbeddedAiProbeReport();
    expect(typeof r).toBe("object");
    expect(r).toHaveProperty("hasWebGpu");
    expect(r).toHaveProperty("timestamp");
  });
});

describe("summarizeEmbeddedAiReadiness — soft judgement", () => {
  it("returns unknown for a missing report", () => {
    const r = summarizeEmbeddedAiReadiness(null);
    expect(r.level).toBe("unknown");
  });

  it("is likely with secure context + IndexedDB + WebGPU + ample storage", () => {
    const report = {
      secureContext: true,
      hasIndexedDb: true,
      hasWebGpu: true,
      deviceMemory: 8,
      storageEstimate: { supported: true, quota: 4 * 1024 * 1024 * 1024, usage: 0 },
    };
    expect(summarizeEmbeddedAiReadiness(report).level).toBe("likely");
  });

  it("is limited with IndexedDB but no WebGPU", () => {
    const report = {
      secureContext: true,
      hasIndexedDb: true,
      hasWebGpu: false,
      deviceMemory: 6,
      storageEstimate: { supported: true, quota: 4 * 1024 * 1024 * 1024, usage: 0 },
    };
    const r = summarizeEmbeddedAiReadiness(report);
    expect(["limited", "unknown"]).toContain(r.level);
    expect(r.level).toBe("limited");
  });

  it("is unlikely without IndexedDB", () => {
    const report = { secureContext: true, hasIndexedDb: false, hasWebGpu: false, storageEstimate: {} };
    expect(summarizeEmbeddedAiReadiness(report).level).toBe("unlikely");
  });

  it("warns and is unlikely in a non-secure context", () => {
    const report = {
      secureContext: false,
      hasIndexedDb: true,
      hasWebGpu: true,
      storageEstimate: { supported: true, quota: 4 * 1024 * 1024 * 1024, usage: 0 },
    };
    const r = summarizeEmbeddedAiReadiness(report);
    expect(r.level).toBe("unlikely");
    expect(r.warnings.some((w) => /secure/i.test(w))).toBe(true);
  });

  it("is unlikely with a very small storage quota", () => {
    const report = {
      secureContext: true,
      hasIndexedDb: true,
      hasWebGpu: true,
      storageEstimate: { supported: true, quota: 10 * 1024 * 1024, usage: 0 },
    };
    expect(summarizeEmbeddedAiReadiness(report).level).toBe("unlikely");
  });
});

describe("formatEmbeddedAiProbeReport — plain text, safe", () => {
  it("produces copyable text that states results are not auto-sent", async () => {
    stubEnv({ gpu: true, estimate: async () => ({ quota: 4 * 1024 * 1024 * 1024, usage: 0 }) });
    const r = await collectEmbeddedAiProbeReport();
    const text = formatEmbeddedAiProbeReport(r);
    expect(typeof text).toBe("string");
    expect(text).toContain("readiness:");
    expect(text).toContain("自動送信されません");
    expect(text).not.toMatch(/<[a-z]/i); // no HTML markup
  });
});
