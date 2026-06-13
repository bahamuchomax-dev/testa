import { describe, it, expect } from "vitest";
import { stripUndefined } from "../src/lib/sanitize.js";

describe("stripUndefined", () => {
  it("removes undefined keys (role / isTeacher)", () => {
    const out = stripUndefined({ name: "a", role: undefined, isTeacher: undefined });
    expect(out).toEqual({ name: "a" });
    expect("role" in out).toBe(false);
    expect("isTeacher" in out).toBe(false);
  });
  it("keeps null and falsy-but-defined values", () => {
    expect(stripUndefined({ a: null, b: 0, c: "", d: false }))
      .toEqual({ a: null, b: 0, c: "", d: false });
  });
  it("recurses into nested objects and arrays", () => {
    const out = stripUndefined({ p: { x: 1, y: undefined }, list: [{ z: undefined, k: 2 }] });
    expect(out).toEqual({ p: { x: 1 }, list: [{ k: 2 }] });
  });
});
