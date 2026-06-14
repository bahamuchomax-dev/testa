import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  WEBGPU_PROMPT_MAX_LENGTH,
  registerWebGpuEngineLoader,
  loadWebGpuEmbeddedAiEngine,
  generateWithWebGpuEmbeddedAi,
  describeWebGpuReason,
  resetWebGpuEmbeddedAiEngineForTests,
} from "../src/features/embeddedAi/engines/webGpuEngineAdapter.js";

function stubDevice({ gpu = true, idb = true } = {}) {
  const navigator = { userAgent: "test" };
  if (gpu) navigator.gpu = {};
  vi.stubGlobal("navigator", navigator);
  if (idb) vi.stubGlobal("indexedDB", {});
  else vi.stubGlobal("indexedDB", undefined);
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetWebGpuEmbeddedAiEngineForTests();
});

beforeEach(() => {
  resetWebGpuEmbeddedAiEngineForTests();
});

describe("webGpuEngineAdapter — API surface", () => {
  it("exposes the adapter functions", () => {
    expect(typeof loadWebGpuEmbeddedAiEngine).toBe("function");
    expect(typeof generateWithWebGpuEmbeddedAi).toBe("function");
    expect(typeof resetWebGpuEmbeddedAiEngineForTests).toBe("function");
  });

  it("keeps a small input cap", () => {
    expect(WEBGPU_PROMPT_MAX_LENGTH).toBe(800);
  });
});

describe("webGpuEngineAdapter — device gating & deferred engine", () => {
  it("reports no-webgpu when WebGPU is unavailable", async () => {
    stubDevice({ gpu: false, idb: true });
    const r = await loadWebGpuEmbeddedAiEngine();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-webgpu");
  });

  it("reports no-indexeddb when storage is unavailable", async () => {
    stubDevice({ gpu: true, idb: false });
    const r = await loadWebGpuEmbeddedAiEngine();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-indexeddb");
  });

  it("reports engine-not-bundled when WebGPU is present but no engine is wired (phase 3A)", async () => {
    stubDevice({ gpu: true, idb: true });
    const r = await loadWebGpuEmbeddedAiEngine();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("engine-not-bundled");
  });
});

describe("webGpuEngineAdapter — pluggable real engine (future)", () => {
  it("uses a registered engine and returns plain text", async () => {
    stubDevice({ gpu: true, idb: true });
    registerWebGpuEngineLoader(async () => ({
      generate: async (p) => "復習提案: " + p.slice(0, 3),
    }));
    const r = await generateWithWebGpuEmbeddedAi("英語の不定詞を復習した");
    expect(r.ok).toBe(true);
    expect(r.text).toContain("復習提案:");
  });

  it("shares one in-flight load (no double download)", async () => {
    stubDevice({ gpu: true, idb: true });
    let calls = 0;
    registerWebGpuEngineLoader(async () => {
      calls += 1;
      await new Promise((res) => setTimeout(res, 5));
      return { generate: async () => "ok" };
    });
    const [a, b] = await Promise.all([
      loadWebGpuEmbeddedAiEngine(),
      loadWebGpuEmbeddedAiEngine(),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("fails gracefully (no throw) when the loader throws", async () => {
    stubDevice({ gpu: true, idb: true });
    registerWebGpuEngineLoader(async () => {
      throw new Error("boom");
    });
    const r = await loadWebGpuEmbeddedAiEngine();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("load-failed");
  });

  it("rejects an empty prompt and clamps a long one", async () => {
    stubDevice({ gpu: true, idb: true });
    const empty = await generateWithWebGpuEmbeddedAi("   ");
    expect(empty.ok).toBe(false);
    expect(empty.reason).toBe("empty-prompt");

    let seen = "";
    registerWebGpuEngineLoader(async () => ({
      generate: async (p) => {
        seen = p;
        return "ok";
      },
    }));
    await generateWithWebGpuEmbeddedAi("あ".repeat(2000));
    expect(seen.length).toBe(WEBGPU_PROMPT_MAX_LENGTH);
  });

  it("gives plain-text reasons (no HTML)", () => {
    for (const reason of ["no-webgpu", "engine-not-bundled", "load-failed", "empty-prompt"]) {
      const msg = describeWebGpuReason(reason);
      expect(typeof msg).toBe("string");
      expect(msg).not.toMatch(/<[a-z]/i);
    }
  });
});
