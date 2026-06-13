import { describe, it, expect } from "vitest";
import {
  extractJson,
  parseJsonLenient,
  validateRequired,
  reviewPlanSchema,
} from "../src/features/localAi/localAiSchemas.js";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, data: { a: 1 } });
  });
  it("parses ```json fenced blocks", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ ok: true, data: { a: 1 } });
  });
  it("recovers JSON wrapped in prose", () => {
    const r = extractJson('結果です: {"a": 1, "b": [1,2]} 以上。');
    expect(r.ok).toBe(true);
    expect(r.data.b).toEqual([1, 2]);
  });
  it("tolerates trailing commas", () => {
    const r = extractJson('{"a":1,"b":[1,2,],}');
    expect(r.ok).toBe(true);
    expect(r.data.a).toBe(1);
  });
  it("returns ok:false for non-JSON and non-strings", () => {
    expect(extractJson("ぜんぜんJSONじゃない").ok).toBe(false);
    expect(extractJson(123).ok).toBe(false);
  });
});

describe("parseJsonLenient", () => {
  it("parses direct JSON first", () => {
    expect(parseJsonLenient('{"a":1}')).toEqual({ a: 1 });
  });
  it("recovers fenced JSON", () => {
    expect(parseJsonLenient("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
  it("recovers from the first object opener to the last object closer", () => {
    expect(parseJsonLenient('前置き {"a": {"b": 2}} 後置き')).toEqual({ a: { b: 2 } });
  });
  it("recovers arrays when no object can be parsed", () => {
    expect(parseJsonLenient("候補: [1,2,3]")).toEqual([1, 2, 3]);
  });
  it("returns null when recovery fails", () => {
    expect(parseJsonLenient("ぜんぜんJSONじゃない")).toBeNull();
  });
});

describe("validateRequired", () => {
  it("passes when required keys are present", () => {
    const data = { priority: [], tomorrowTasks: [], teacherNote: "x", studentMessage: "y" };
    expect(validateRequired(data, reviewPlanSchema).ok).toBe(true);
  });
  it("fails when a required key is missing", () => {
    expect(validateRequired({ priority: [] }, reviewPlanSchema).ok).toBe(false);
  });
  it("checks array vs object", () => {
    expect(validateRequired({}, { type: "array" }).ok).toBe(false);
    expect(validateRequired([], { type: "array" }).ok).toBe(true);
  });
});
