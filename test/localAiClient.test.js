import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkLocalAiHealth,
  generateWithLocalAi,
  generateJsonWithLocalAi,
  classifyBaseUrl,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_LOCAL_AI_MODEL,
  LOCAL_AI_MODEL_PROFILES,
  LOCAL_AI_STRICT_PRESET,
} from "../src/features/localAi/localAiClient.js";
import { LOCAL_AI_TASKS } from "../src/features/localAi/localAiPrompts.js";
import { reviewPlanSchema } from "../src/features/localAi/localAiSchemas.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe("localAiClient", () => {
  it("defaults to the local Ollama URL", () => {
    expect(DEFAULT_OLLAMA_BASE_URL).toBe("http://localhost:11434");
  });

  it("defaults to the recommended 14b model and strict preset", () => {
    expect(DEFAULT_LOCAL_AI_MODEL).toBe("qwen2.5:14b-instruct");
    expect(LOCAL_AI_MODEL_PROFILES.recommended.model).toBe("qwen2.5:14b-instruct");
    expect(LOCAL_AI_MODEL_PROFILES.powerful.model).toBe("qwen2.5:32b-instruct");
    expect(LOCAL_AI_MODEL_PROFILES.lightFallback.model).toBe("qwen2.5:7b-instruct");
    expect(LOCAL_AI_STRICT_PRESET.temperature).toBe(0.1);
    expect(LOCAL_AI_STRICT_PRESET.numCtx).toBe(16384);
  });

  it("health check hits localhost /api/tags and detects the model", async () => {
    let calledUrl = "";
    global.fetch = vi.fn(async (url) => {
      calledUrl = String(url);
      return { ok: true, json: async () => ({ models: [{ name: "qwen2.5:7b-instruct" }] }) };
    });
    const r = await checkLocalAiHealth({ model: "qwen2.5:7b-instruct" });
    expect(calledUrl).toBe("http://localhost:11434/api/tags");
    expect(r.ok).toBe(true);
    expect(r.hasModel).toBe(true);
  });

  it("also allows 127.0.0.1 on the Ollama port", async () => {
    let calledUrl = "";
    global.fetch = vi.fn(async (url) => {
      calledUrl = String(url);
      return { ok: true, json: async () => ({ models: [] }) };
    });
    const r = await checkLocalAiHealth({ baseUrl: "http://127.0.0.1:11434/" });
    expect(calledUrl).toBe("http://127.0.0.1:11434/api/tags");
    expect(r.ok).toBe(true);
  });

  it("does not throw when Ollama is unreachable (UI stays up)", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const r = await checkLocalAiHealth({});
    expect(r.ok).toBe(false);
    expect(r.reachable).toBe(false);
    expect(typeof r.error).toBe("string");
  });

  it("generate posts to localhost /api/generate with stream:false", async () => {
    let calledUrl = "";
    let body = null;
    global.fetch = vi.fn(async (url, opts) => {
      calledUrl = String(url);
      body = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ response: "テスト出力" }) };
    });
    const r = await generateWithLocalAi({
      taskType: LOCAL_AI_TASKS.REPORT_CLEANUP,
      input: "メモ",
      model: "qwen2.5:7b-instruct",
      temperature: 0.3,
    });
    expect(calledUrl).toBe("http://localhost:11434/api/generate");
    expect(body.model).toBe("qwen2.5:7b-instruct");
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(LOCAL_AI_STRICT_PRESET.temperature);
    expect(body.options.num_ctx).toBe(LOCAL_AI_STRICT_PRESET.numCtx);
    expect(r.text).toBe("テスト出力");
  });

  it("passes JSON Schema as Ollama format for structured generation", async () => {
    let body = null;
    global.fetch = vi.fn(async (url, opts) => {
      body = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          response: JSON.stringify({
            priority: [],
            tomorrowTasks: [],
            teacherNote: "x",
            studentMessage: "y",
          }),
        }),
      };
    });
    const r = await generateJsonWithLocalAi({
      taskType: LOCAL_AI_TASKS.REVIEW_PLAN,
      input: "x",
      schema: reviewPlanSchema,
    });
    expect(r.ok).toBe(true);
    expect(body.format).toEqual(reviewPlanSchema);
    expect(body.options.temperature).toBe(0.1);
    expect(body.options.num_ctx).toBe(16384);
  });

  it("maps HTTP 404 to a 'ollama pull <model>' message", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    let caught;
    try {
      await generateWithLocalAi({
        taskType: LOCAL_AI_TASKS.REPORT_CLEANUP,
        input: "x",
        model: "qwen2.5:7b-instruct",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught && caught.name).toBe("LocalAiError");
    expect(caught.userMessage).toContain("ollama pull qwen2.5:7b-instruct");
  });

  it("generateJson falls back to text when the model returns non-JSON", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: "これはJSONではありません" }),
    }));
    const r = await generateJsonWithLocalAi({ taskType: LOCAL_AI_TASKS.REVIEW_PLAN, input: "x" });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("JSONではありません");
  });

  it("classifyBaseUrl only allows localhost and 127.0.0.1 on port 11434", () => {
    expect(classifyBaseUrl("http://localhost:11434").allowed).toBe(true);
    expect(classifyBaseUrl("http://127.0.0.1:11434/").allowed).toBe(true);
    expect(classifyBaseUrl("http://0.0.0.0:11434").allowed).toBe(false);
    expect(classifyBaseUrl("http://192.168.1.5:11434").allowed).toBe(false);
    expect(classifyBaseUrl("https://localhost:11434").allowed).toBe(false);
    expect(classifyBaseUrl("https://api.example.com").allowed).toBe(false);
    expect(classifyBaseUrl("http://localhost:9999").allowed).toBe(false);
    expect(classifyBaseUrl("ftp://nope").ok).toBe(false);
    expect(classifyBaseUrl("not a url").level).toBe("invalid");
  });

  it("blocks health checks before fetch for non-allowed URLs", async () => {
    global.fetch = vi.fn();
    await expect(checkLocalAiHealth({ baseUrl: "http://192.168.1.5:11434" })).rejects.toMatchObject({
      name: "LocalAiError",
    });
    await expect(checkLocalAiHealth({ baseUrl: "https://localhost:11434" })).rejects.toMatchObject({
      name: "LocalAiError",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("blocks generation before fetch for non-allowed URLs", async () => {
    global.fetch = vi.fn();
    await expect(
      generateWithLocalAi({
        taskType: LOCAL_AI_TASKS.REPORT_CLEANUP,
        input: "x",
        baseUrl: "http://example.com:11434",
      })
    ).rejects.toMatchObject({ name: "LocalAiError" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("blocks JSON generation (self-check/repair path) before fetch for non-allowed URLs", async () => {
    global.fetch = vi.fn();
    await expect(
      generateJsonWithLocalAi({
        taskType: LOCAL_AI_TASKS.REVIEW_PLAN,
        input: "x",
        schema: reviewPlanSchema,
        baseUrl: "https://api.example.com",
      })
    ).rejects.toMatchObject({ name: "LocalAiError" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
