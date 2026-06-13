import { describe, it, expect } from "vitest";
import {
  parsePageRange,
  looksLikeImagePdf,
  chunkText,
  joinPages,
} from "../src/features/localAi/pdfTextExtractor.js";

describe("parsePageRange", () => {
  it("parses ranges and singletons", () => {
    expect(parsePageRange("1-3,5", 10)).toEqual([1, 2, 3, 5]);
  });
  it("clamps to available pages and dedupes", () => {
    expect(parsePageRange("2-4, 3, 99", 4)).toEqual([2, 3, 4]);
  });
  it("empty spec returns all pages", () => {
    expect(parsePageRange("", 3)).toEqual([1, 2, 3]);
  });
  it("handles reversed ranges", () => {
    expect(parsePageRange("5-3", 10)).toEqual([3, 4, 5]);
  });
});

describe("looksLikeImagePdf", () => {
  it("flags low text density and clears text-rich PDFs", () => {
    expect(looksLikeImagePdf(5, 3)).toBe(true);
    expect(looksLikeImagePdf(500, 3)).toBe(false);
  });
});

describe("chunkText", () => {
  it("returns a single chunk when short", () => {
    expect(chunkText("abc", 6000)).toEqual(["abc"]);
  });
  it("splits long text without losing characters", () => {
    const long = "あ".repeat(13000);
    const chunks = chunkText(long, 6000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("").length).toBe(13000);
  });
  it("returns empty array for empty input", () => {
    expect(chunkText("", 100)).toEqual([]);
  });
});

describe("joinPages", () => {
  it("joins only the selected pages, in order", () => {
    const pages = [
      { page: 1, text: "one" },
      { page: 2, text: "two" },
      { page: 3, text: "three" },
    ];
    const out = joinPages(pages, [1, 3]);
    expect(out).toContain("one");
    expect(out).toContain("three");
    expect(out).not.toContain("two");
  });
});
