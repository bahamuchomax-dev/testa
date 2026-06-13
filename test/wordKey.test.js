import { describe, it, expect } from "vitest";
import { wordKey } from "../src/lib/wordKey.js";

describe("wordKey", () => {
  it("prefers an explicit id", () => {
    expect(wordKey({ id: "abc", en: "apple" })).toBe("id:abc");
  });
  it("falls back to en+category+stage for id-less words", () => {
    expect(wordKey({ en: "Apple", category: "fruit", stage: 1 }))
      .toBe("w:apple|c:fruit|s:1");
  });
  it("distinguishes same word across category/stage", () => {
    const a = wordKey({ en: "run", category: "verbs", stage: 1 });
    const b = wordKey({ en: "run", category: "verbs", stage: 2 });
    const c = wordKey({ en: "run", category: "sports", stage: 1 });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
  it("does NOT collapse two different id-less words into one key", () => {
    expect(wordKey({ en: "cat" })).not.toBe(wordKey({ en: "dog" }));
  });
  it("returns empty string for junk", () => {
    expect(wordKey(null)).toBe("");
    expect(wordKey(42)).toBe("");
  });
});
