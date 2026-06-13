import { describe, it, expect } from "vitest";
import { parsePositiveMinutes } from "../src/lib/minutes.js";

describe("parsePositiveMinutes", () => {
  it("rejects sub-minute values (the 0.4 -> 0 bug)", () => {
    expect(parsePositiveMinutes(0.4)).toBeNull();
    expect(parsePositiveMinutes(0)).toBeNull();
    expect(parsePositiveMinutes(-5)).toBeNull();
  });
  it("rejects non-numbers", () => {
    expect(parsePositiveMinutes("abc")).toBeNull();
    expect(parsePositiveMinutes(NaN)).toBeNull();
    expect(parsePositiveMinutes(Infinity)).toBeNull();
    expect(parsePositiveMinutes(undefined)).toBeNull();
  });
  it("accepts and rounds valid minutes", () => {
    expect(parsePositiveMinutes(1)).toBe(1);
    expect(parsePositiveMinutes(30)).toBe(30);
    expect(parsePositiveMinutes(1.4)).toBe(1);
    expect(parsePositiveMinutes("45")).toBe(45);
  });
});
